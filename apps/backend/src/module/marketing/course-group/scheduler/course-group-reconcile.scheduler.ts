import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';
import { RedisService } from 'src/module/common/redis/redis.service';
import { getErrorMessage } from 'src/common/utils/error';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { CourseGroupBuyService } from '../../play/course-group-buy.service';
import { IncidentService } from '../../resolution/incident.service';

@Injectable()
export class CourseGroupReconcileScheduler {
  private readonly logger = new Logger(CourseGroupReconcileScheduler.name);
  private readonly lockKey = 'lock:marketing:course-group:reconcile-sweep';
  private readonly lockTtlMs = 55 * 1000;

  constructor(
    private readonly courseGroupBuyService: CourseGroupBuyService,
    private readonly redisService: RedisService,
    private readonly incidentService: IncidentService,
  ) {}

  @IgnoreTenant()
  @CodeManagedJob({
    key: 'marketing.courseGroupReconcileSweep',
    name: '拼课团队重算补偿',
    group: 'MARKETING',
    cron: CronExpression.EVERY_MINUTE,
    guardMode: 'self-managed',
  })
  @Task({ name: 'marketing.courseGroupReconcileSweep', description: '拼课团队重算补偿' })
  async handleReconcileSweep() {
    const token = await this.redisService.tryLock(this.lockKey, this.lockTtlMs);
    if (!token) {
      return;
    }

    try {
      // Phase D2: runReconcileSweep + incidentService.reportIncident 都是跨租户写路径；
      // cron path 无 Guard 触发，统一进入 super-tenant context 兜底保持契约对齐。
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        const incidents = await this.courseGroupBuyService.runReconcileSweep();
        for (const incident of incidents) {
          await this.incidentService.reportIncident(incident);
        }
      });
    } catch (error) {
      this.logger.error(`[拼课团队重算补偿] 执行失败: ${getErrorMessage(error)}`);
    } finally {
      await this.redisService.unlock(this.lockKey, token);
    }
  }
}
