import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';
import { RedisService } from 'src/module/common/redis/redis.service';
import { getErrorMessage } from 'src/common/utils/error';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { CourseGroupBuyService } from '../../play/course-group-buy.service';

@Injectable()
export class CourseGroupAutoFillScheduler {
  private readonly logger = new Logger(CourseGroupAutoFillScheduler.name);
  private readonly lockKey = 'lock:marketing:course-group:auto-fill';
  private readonly lockTtlMs = 55 * 1000;

  constructor(
    private readonly courseGroupBuyService: CourseGroupBuyService,
    private readonly redisService: RedisService,
  ) {}

  @IgnoreTenant()
  @CodeManagedJob({
    key: 'marketing.courseGroupAutoFill',
    name: '拼课自动补位',
    group: 'MARKETING',
    cron: CronExpression.EVERY_MINUTE,
    guardMode: 'self-managed',
  })
  @Task({ name: 'marketing.courseGroupAutoFill', description: '拼课自动补位' })
  async handleAutoFill() {
    const token = await this.redisService.tryLock(this.lockKey, this.lockTtlMs);
    if (!token) {
      return;
    }

    try {
      // Phase D2: runAutoFillSweep 内部跨租户扫描拼课订单做自动补位写入，
      // cron path 无 @IgnoreTenant Guard 触发，须显式进入 super-tenant context 兜底。
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        await this.courseGroupBuyService.runAutoFillSweep();
      });
    } catch (error) {
      this.logger.error(`[拼课自动补位] 执行失败: ${getErrorMessage(error)}`);
    } finally {
      await this.redisService.unlock(this.lockKey, token);
    }
  }
}
