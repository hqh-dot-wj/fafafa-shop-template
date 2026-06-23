import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { Status } from '@prisma/client';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';
import { RedisService } from 'src/module/common/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import {
  MARKETING_AGGREGATE_TENANT_SET_KEY,
  MARKETING_COMPAT_TENANT_SET_KEY,
} from '../marketing-aggregate-traffic.constants';
import {
  MARKETING_OBSERVABILITY_TENANT_SET_KEY,
  ResolutionObservabilityService,
} from '../resolution/resolution-observability.service';

@Injectable()
export class ResolutionAlertScheduler {
  private readonly logger = new Logger(ResolutionAlertScheduler.name);

  private readonly lockKey = 'lock:marketing:resolution:alert-message';

  private readonly lockTtlMs = 4 * 60 * 1000;

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
    private readonly observabilityService: ResolutionObservabilityService,
  ) {}

  @IgnoreTenant()
  @CodeManagedJob({
    key: 'marketing.publishResolutionAlerts',
    name: '营销场景告警写入消息中心',
    group: 'MARKETING',
    cron: CronExpression.EVERY_5_MINUTES,
    guardMode: 'self-managed',
  })
  @Task({ name: 'marketing.publishResolutionAlerts', description: '营销场景告警写入消息中心' })
  async publishResolutionAlerts(): Promise<void> {
    const lockToken = await this.redisService.tryLock(this.lockKey, this.lockTtlMs);
    if (!lockToken) {
      this.logger.log('[定时任务] 跳过营销场景告警写入：已有实例正在执行');
      return;
    }

    const startedAt = Date.now();
    try {
      // Phase D2: 入口对 sysTenant.findMany 是跨租户读，observabilityService.getDashboard 内部
      // 还会按租户访问观测数据；统一进入 super-tenant context 让 tenantExtension 跳过过滤，
      // 与契约模板对齐避免 cron 漏标 ignoreTenant 时被静默静默丢弃。
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        const tenants = await this.prisma.sysTenant.findMany({
          where: { status: Status.NORMAL },
          select: { tenantId: true },
        });

        // C3.3: 用 marketing aggregate / compat 两个流量集合做活跃租户预筛，
        // 避免每 5 分钟对全部租户都跑 dashboard 重查询。
        // 任一集合非空就视为有过流量；双方都空（新部署冷启动 / Redis 异常）回退全租户兜底。
        const activeTenantIds = await this.loadActiveTenantIds();
        const effective =
          activeTenantIds && activeTenantIds.size > 0
            ? tenants.filter((t) => activeTenantIds.has(t.tenantId))
            : tenants;

        let successCount = 0;
        let failedCount = 0;

        for (const tenant of effective) {
          try {
            await this.observabilityService.getDashboard(tenant.tenantId);
            successCount += 1;
          } catch (error) {
            failedCount += 1;
            this.logger.error(`[定时任务] 写入营销场景告警失败 tenant=${tenant.tenantId}: ${getErrorMessage(error)}`);
          }
        }

        const duration = Date.now() - startedAt;
        this.logger.log(
          `[定时任务] 营销场景告警写入完成，注册租户 ${tenants.length} 个，活跃 ${effective.length} 个，成功 ${successCount} 个，失败 ${failedCount} 个，耗时 ${duration}ms`,
        );
      });
    } catch (error) {
      this.logger.error(`[定时任务] 营销场景告警写入执行失败: ${getErrorMessage(error)}`, getErrorStack(error));
    } finally {
      try {
        await this.redisService.unlock(this.lockKey, lockToken);
      } catch (error) {
        this.logger.warn(`[定时任务] 释放营销场景告警任务锁失败: ${getErrorMessage(error)}`);
      }
    }
  }

  /**
   * 从三个集合读活跃租户并集：
   * - aggregate / compat：C 端聚合 / 兼容入口写入，反映 C 端流量
   * - observability：ResolutionObservabilityService 在 recordSceneResolve /
   *   recordCacheInvalidation 写入，反映**告警指标**真实写入路径
   *
   * observability 集合是覆盖 dashboard 输入最完整的来源（ultrareview rqxa0c2jb #bug_001 修复点）：
   * 直连 /scene 与缓存失效事件不会写 aggregate / compat，但都会写 observability 集合，
   * 缺它就会让 scene-only / cache-event-only 租户的告警被静默丢弃。
   *
   * 返回 null 表示需要回退到全租户兜底（三集合都空或 Redis 异常）。
   */
  private async loadActiveTenantIds(): Promise<Set<string> | null> {
    try {
      const client = this.redisService.getClient();
      const [agg, compat, obs] = await Promise.all([
        client.smembers(MARKETING_AGGREGATE_TENANT_SET_KEY),
        client.smembers(MARKETING_COMPAT_TENANT_SET_KEY),
        client.smembers(MARKETING_OBSERVABILITY_TENANT_SET_KEY),
      ]);
      const union = new Set<string>([...(agg ?? []), ...(compat ?? []), ...(obs ?? [])]);
      if (union.size === 0) {
        return null;
      }
      return union;
    } catch (error) {
      this.logger.warn(`[定时任务] 读取活跃租户预筛失败，回退全租户扫描: ${getErrorMessage(error)}`);
      return null;
    }
  }
}
