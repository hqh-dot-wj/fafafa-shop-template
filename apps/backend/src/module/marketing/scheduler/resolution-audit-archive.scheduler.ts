import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';

const AUDIT_RETENTION_DAYS = 90;

@Injectable()
export class ResolutionAuditArchiveScheduler {
  private readonly logger = new Logger(ResolutionAuditArchiveScheduler.name);

  private readonly lockKey = 'lock:marketing:resolution:audit-archive';

  private readonly lockTtlMs = 30 * 60 * 1000;

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  @IgnoreTenant()
  @CodeManagedJob({
    key: 'marketing.archiveResolutionAudit',
    name: '营销裁决审计归档清理',
    group: 'MARKETING',
    cron: CronExpression.EVERY_DAY_AT_3AM,
    guardMode: 'self-managed',
  })
  @Task({ name: 'marketing.archiveResolutionAudit', description: '删除超过保留期的营销裁决审计记录' })
  async archiveOldResolutionAudits(): Promise<void> {
    const lockToken = await this.redisService.tryLock(this.lockKey, this.lockTtlMs);
    if (!lockToken) {
      this.logger.log('[定时任务] 跳过裁决审计清理：已有实例正在执行');
      return;
    }

    const threshold = new Date(Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    try {
      // Phase D2: cron path 无 @IgnoreTenant Guard 触发，必须显式进入 super-tenant context；
      // 否则 tenantExtension 在 getTenantId() === undefined 时不会追加 tenant 过滤，
      // 这里又是真实的 deleteMany 跨租户清理，没有兜底 context 等同放任跨租户穿透。
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        const result = await this.prisma.mktResolutionAudit.deleteMany({
          where: { createTime: { lt: threshold } },
        });
        this.logger.log(`[定时任务] 裁决审计清理完成，删除 ${result.count} 条（早于 ${threshold.toISOString()}）`);
      });
    } catch (error) {
      this.logger.error(`[定时任务] 裁决审计清理失败: ${getErrorMessage(error)}`, getErrorStack(error));
    } finally {
      try {
        await this.redisService.unlock(this.lockKey, lockToken);
      } catch (error) {
        this.logger.warn(`[定时任务] 释放裁决审计清理锁失败: ${getErrorMessage(error)}`);
      }
    }
  }
}
