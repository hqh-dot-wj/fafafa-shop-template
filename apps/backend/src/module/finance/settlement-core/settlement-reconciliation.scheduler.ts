import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ReconciliationStatus, SettlementExecutionStatus } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { PrismaService } from 'src/prisma/prisma.service';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';
import { RedisService } from 'src/module/common/redis/redis.service';
import { SettlementCoreService } from './settlement-core.service';
import { SettlementExecutionService } from './settlement-execution.service';

@Injectable()
export class SettlementReconciliationScheduler {
  private readonly logger = new Logger(SettlementReconciliationScheduler.name);
  private readonly LOCK_KEY = 'lock:settlement:reconciliation';
  // 毫秒口径，配合 RedisService.tryLock/unlock（底层 PX）
  private readonly LOCK_TTL_MS = 5 * 60 * 1000;
  // 当前实例持有的锁 token；releaseLock 必须比对此值，禁止占位符（如 '1'）误删他人锁。
  private lockToken: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantHelper: TenantHelper,
    private readonly settlementExecutionService: SettlementExecutionService,
    private readonly settlementCoreService: SettlementCoreService,
  ) {}

  @IgnoreTenant()
  @CodeManagedJob({
    key: 'settlement.reconcileJob',
    name: '结算执行对账补偿',
    group: 'FINANCE',
    cron: CronExpression.EVERY_10_MINUTES,
    guardMode: 'self-managed',
  })
  @Task({ name: 'settlement.reconcileJob', description: '结算执行对账补偿' })
  async reconcileJob() {
    const locked = await this.acquireLock();
    if (!locked) {
      this.logger.debug('Settlement reconciliation skipped: another instance is running');
      return;
    }

    try {
      // Phase D2: doReconcile 跨租户扫描 finSettlementExecution，并调用 settlementCoreService
      // 更新状态。cron path 无 Guard 触发，进入 super-tenant context 兜底保持契约对齐。
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        await this.doReconcile();
      });
    } finally {
      await this.releaseLock();
    }
  }

  private async doReconcile() {
    const executions = await this.prisma.finSettlementExecution.findMany({
      where: this.tenantHelper.readWhereForDelegate('finSettlementExecution', {
        status: {
          in: [SettlementExecutionStatus.PENDING, SettlementExecutionStatus.PROCESSING],
        },
      }) as any,
      include: {
        bill: {
          include: {
            payRecord: {
              select: {
                transactionId: true,
              },
            },
          },
        },
      },
      take: 50,
      orderBy: { createTime: 'asc' },
    });

    for (const execution of executions) {
      try {
        const result = await this.settlementExecutionService.query({
          execution,
          bill: execution.bill,
        });

        if (result.issueStatus === ReconciliationStatus.WAITING) {
          continue;
        }

        await this.settlementCoreService.updateExecutionFromChannel({
          executionId: execution.id,
          operator: 'system:settlement.reconcileJob',
          executionStatus: result.executionStatus,
          billStatus: result.billStatus,
          issueStatus: result.issueStatus,
          externalNo: result.externalNo,
          stage: result.stage,
          message: result.message,
          responsePayload: result.responsePayload,
          failureReason: result.failureReason,
        });
      } catch (error) {
        this.logger.error(`Settlement reconciliation failed for execution ${execution.id}`, error);
      }
    }
  }

  // Phase A2: token 化锁，避免误删他人锁；与 settlement / refund-reconciliation 风格统一。
  private async acquireLock(): Promise<boolean> {
    try {
      const token = await this.redis.tryLock(this.LOCK_KEY, this.LOCK_TTL_MS);
      if (!token) {
        this.lockToken = null;
        return false;
      }
      this.lockToken = token;
      return true;
    } catch (error) {
      this.logger.error('Failed to acquire settlement reconciliation lock', error);
      this.lockToken = null;
      return false;
    }
  }

  private async releaseLock() {
    if (!this.lockToken) {
      return;
    }
    const token = this.lockToken;
    this.lockToken = null;
    try {
      await this.redis.unlock(this.LOCK_KEY, token);
    } catch (error) {
      this.logger.error('Failed to release settlement reconciliation lock', error);
    }
  }
}
