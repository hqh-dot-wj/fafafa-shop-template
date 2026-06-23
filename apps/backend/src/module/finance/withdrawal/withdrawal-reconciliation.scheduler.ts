import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { FinWithdrawal, WithdrawalStatus } from '@prisma/client';
import { WalletService } from '../wallet/wallet.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';
import { WithdrawalPaymentService } from './withdrawal-payment.service';
import { WithdrawalAuditService } from './withdrawal-audit.service';
import { WithdrawalRepository } from './withdrawal.repository';
import { Transactional } from 'src/common/decorators/transactional.decorator';

type ReconciliationWithdrawal = FinWithdrawal;

/**
 * 提现对账补偿定时任务
 *
 * @description
 * 处理打款超时的提现记录：
 * 1. 查询支付平台获取真实状态
 * 2. 根据真实状态更新本地记录
 * 3. 超时未确认或通道确认失败的记录终止并解冻余额
 *
 * 解决 D-3 缺陷：approve 方法分布式事务失衡
 */
@Injectable()
export class WithdrawalReconciliationScheduler {
  private readonly logger = new Logger(WithdrawalReconciliationScheduler.name);
  private readonly LOCK_KEY = 'lock:withdrawal:reconciliation';
  // 毫秒口径，配合 RedisService.tryLock/unlock（底层 PX）
  private readonly LOCK_TTL_MS = 5 * 60 * 1000; // 5分钟
  private readonly TIMEOUT_MINUTES = 30; // 超时时间（分钟）
  // 当前实例持有的锁 token；releaseLock 必须比对此值，禁止占位符（如 '1'）误删他人锁。
  private lockToken: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly walletService: WalletService,
    private readonly paymentService: WithdrawalPaymentService,
    private readonly auditService: WithdrawalAuditService,
    private readonly withdrawalRepo: WithdrawalRepository,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 每10分钟执行对账任务
   */
  @IgnoreTenant()
  @CodeManagedJob({
    key: 'withdrawal.reconcileJob',
    name: '提现对账补偿',
    group: 'FINANCE',
    cron: CronExpression.EVERY_10_MINUTES,
    guardMode: 'self-managed',
  })
  @Task({ name: 'withdrawal.reconcileJob', description: '提现对账补偿' })
  async reconcileJob() {
    const locked = await this.acquireLock();
    if (!locked) {
      this.logger.debug('Reconciliation job skipped: another instance is running');
      return;
    }

    try {
      // Phase D2: doReconcile 跨租户扫描 finWithdrawal 并联动 walletService.unfreezeBalance，
      // cron path 无 Guard 触发，进入 super-tenant context 兜底保持契约对齐。
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        await this.doReconcile();
      });
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * 执行对账
   */
  private async doReconcile() {
    const timeoutThreshold = new Date(Date.now() - this.TIMEOUT_MINUTES * 60 * 1000);

    const records = await this.prisma.finWithdrawal.findMany({
      where: this.tenantHelper.readWhereForDelegate('finWithdrawal', {
        status: {
          in: [WithdrawalStatus.FAILED, WithdrawalStatus.PROCESSING],
        },
        createTime: { lte: timeoutThreshold },
      }),
      // 按 createTime 升序，确保积压超过 take 上限时最老记录优先处理（C2.3）
      orderBy: { createTime: 'asc' },
      take: 50,
    });

    for (const record of records) {
      try {
        await this.handleTimedOutWithdrawal(record);
      } catch (error) {
        this.logger.error(`Reconciliation failed for withdrawal ${record.id}`, error);
      }
    }

    if (records.length > 0) {
      this.logger.log(`Reconciled ${records.length} withdrawal records`);
    }
  }

  /**
   * 处理失败的提现记录
   *
   * @description
   * 1. 查询支付平台确认最终状态
   * 2. 如果支付平台确认失败，解冻用户余额
   * 3. 如果支付平台确认成功，更新状态为 APPROVED
   */
  private async handleTimedOutWithdrawal(withdrawal: ReconciliationWithdrawal) {
    if (!withdrawal.paymentNo) {
      if (withdrawal.status === WithdrawalStatus.FAILED) {
        const retried = await this.auditService.retryPayment(withdrawal.id);
        if (retried) {
          return;
        }
      }

      const rejected = await this.rejectAndUnfreezeIfCurrent(withdrawal, '系统对账：打款超时自动驳回');
      if (rejected) {
        this.logger.log(`Withdrawal ${withdrawal.id} auto-rejected due to payment timeout`);
      }
      return;
    }

    const paymentStatus = await this.paymentService.queryStatus(withdrawal.paymentNo);

    if (paymentStatus.status === 'PROCESSING') {
      this.logger.debug(`Withdrawal ${withdrawal.id} still processing: ${paymentStatus.rawStatus}`);
      return;
    }

    if (paymentStatus.status === 'SUCCESS') {
      const completed = await this.auditService.completeChannelConfirmedSuccess(
        withdrawal,
        withdrawal.paymentNo,
        withdrawal.status,
        paymentStatus.finishTime,
      );
      if (completed) {
        this.logger.log(`Withdrawal ${withdrawal.id} confirmed by channel as success`);
      }
      return;
    }

    const rejected = await this.rejectAndUnfreezeIfCurrent(
      withdrawal,
      '系统对账：通道确认失败，已退回余额',
      paymentStatus.failReason ?? paymentStatus.rawStatus,
    );
    if (rejected) {
      this.logger.warn(`Withdrawal ${withdrawal.id} confirmed by channel as failed`);
    }
  }

  @Transactional()
  private async rejectAndUnfreezeIfCurrent(
    withdrawal: ReconciliationWithdrawal,
    auditRemark: string,
    failReason?: string | null,
  ) {
    const updated = await this.withdrawalRepo.updateStatusIfCurrent(withdrawal.id, withdrawal.status, {
      status: WithdrawalStatus.REJECTED,
      auditRemark,
      auditTime: new Date(),
      ...(failReason ? { failReason } : {}),
    });

    if (updated === 0) {
      this.logger.warn(`Withdrawal ${withdrawal.id} reconciliation skipped: status already changed`);
      return false;
    }

    await this.walletService.unfreezeBalance(withdrawal.memberId, withdrawal.amount);
    return true;
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
      this.logger.error('Failed to acquire lock', error);
      this.lockToken = null;
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    if (!this.lockToken) {
      return;
    }
    const token = this.lockToken;
    this.lockToken = null;
    try {
      await this.redis.unlock(this.LOCK_KEY, token);
    } catch (error) {
      this.logger.error('Failed to release lock', error);
    }
  }
}
