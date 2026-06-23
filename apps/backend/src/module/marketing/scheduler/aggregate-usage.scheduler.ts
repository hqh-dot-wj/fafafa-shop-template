import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { DelFlag, Status } from '@prisma/client';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';
import { RedisService } from 'src/module/common/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MARKETING_CLIENT_AGGREGATE_ENABLED_KEY } from '../marketing-client-runtime.constants';
import {
  MARKETING_AGGREGATE_TENANT_SET_KEY,
  MARKETING_COMPAT_TENANT_SET_KEY,
  type MarketingCompatEndpoint,
  marketingAggregateDailyCountKey,
  marketingAggregateEverUsedKey,
  marketingAggregateZeroStreakKey,
  marketingCompatDailyCountKey,
  marketingCompatEverUsedKey,
  marketingCompatWindowSummaryKey,
  marketingCompatZeroStreakKey,
} from '../marketing-aggregate-traffic.constants';

/** 聚合接口连续零流量天数阈值，达到后自动关闭租户开关 */
const ZERO_STREAK_DAYS = 14;
/** 兼容接口流量观测滚动窗口天数 */
const COMPAT_WINDOW_DAYS = 14;
/** 兼容接口 14 天汇总数据在 Redis 中的保留时长（ms） */
const COMPAT_SUMMARY_TTL_MS = 45 * 24 * 60 * 60 * 1000;
/** 需要进行兼容流量观测的接口端点列表 */
const COMPAT_ENDPOINTS: MarketingCompatEndpoint[] = ['aggregate', 'zone'];

type CompatWindowSummary = {
  tenantId: string;
  endpoint: MarketingCompatEndpoint;
  date: string;
  thresholdDays: number;
  calls14d: number;
  zeroStreakDays: number;
  canDeprecate: boolean;
};

/**
 * 聚合接口用量调度器
 *
 * @description
 * 每日凌晨 3 点（UTC）执行两项任务：
 * 1. **零流量自动关闭**：连续 ZERO_STREAK_DAYS 天无聚合调用的租户，自动写入 sysConfig 关闭开关
 * 2. **兼容窗口观测**：统计 `aggregate`/`zone` 兼容接口过去 14 天的调用量，
 *    汇总写入 Redis 供运维判断是否可以下线旧接口
 */
@Injectable()
export class AggregateUsageScheduler {
  private readonly logger = new Logger(AggregateUsageScheduler.name);

  /** 分布式锁键，防止多实例重复执行 */
  private readonly lockKey = 'lock:marketing:aggregate:auto-off';
  /** 分布式锁超时时间，应大于单次任务最长执行时间 */
  private readonly lockTtlMs = 15 * 60 * 1000;

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  @IgnoreTenant()
  @CodeManagedJob({
    key: 'marketing.disableIdleAggregate',
    name: '营销聚合接口连续零流量自动关闭',
    group: 'MARKETING',
    cron: CronExpression.EVERY_DAY_AT_3AM,
    guardMode: 'self-managed',
  })
  @Task({
    name: 'marketing.disableIdleAggregate',
    description: '连续 14 个 UTC 日历日无 C 端聚合调用则关闭该租户开关，并输出兼容接口 14 天下线观测数据',
  })
  async disableIdleAggregateEndpoints(): Promise<void> {
    const lockToken = await this.redisService.tryLock(this.lockKey, this.lockTtlMs);
    if (!lockToken) {
      this.logger.log('[定时任务] 跳过聚合零流量巡检：已有实例正在执行');
      return;
    }

    try {
      // Phase D2: 任务内 sysConfig.findFirst / update / create 跨多个租户写，必须显式进入
      // super-tenant context；否则 tenantExtension 在 getTenantId() 未定义时不追加 tenantId 过滤，
      // 既会让 findFirst 误命中其他租户记录，也让 update / create 缺乏 tenant 隔离兜底。
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        const aggregateTenantIds = await this.redisService.getClient().smembers(MARKETING_AGGREGATE_TENANT_SET_KEY);
        if (!aggregateTenantIds.length) {
          this.logger.log('[定时任务] 聚合零流量巡检：无追踪租户');
        }

        const now = new Date();
        const yesterdayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
        const ymd = this.formatUtcYmd(yesterdayUtc);

        let disabled = 0;
        for (const tenantId of aggregateTenantIds) {
          try {
            const everUsed = await this.redisService.get(marketingAggregateEverUsedKey(tenantId));
            if (!everUsed) {
              continue;
            }

            const safeCnt = await this.readAggregateDailyCount(tenantId, ymd);
            const streakKey = marketingAggregateZeroStreakKey(tenantId);
            if (safeCnt > 0) {
              await this.redisService.del(streakKey);
              continue;
            }

            const streak = await this.redisService.incr(streakKey);
            if (streak < ZERO_STREAK_DAYS) {
              continue;
            }

            await this.disableAggregateForTenant(tenantId);
            await this.redisService.del(streakKey);
            await this.redisService.getClient().srem(MARKETING_AGGREGATE_TENANT_SET_KEY, tenantId);
            disabled += 1;
            this.logger.warn(
              `[定时任务] 已连续 ${ZERO_STREAK_DAYS} 个 UTC 日无聚合调用，已关闭租户 ${tenantId} 的 ${MARKETING_CLIENT_AGGREGATE_ENABLED_KEY}`,
            );
          } catch (error) {
            this.logger.error(
              `[定时任务] 聚合零流量巡检失败 tenant=${tenantId}: ${getErrorMessage(error)}`,
              getErrorStack(error),
            );
          }
        }

        await this.refreshCompatibilityWindow(now, aggregateTenantIds);
        this.logger.log(
          `[定时任务] 聚合零流量巡检完成，追踪 ${aggregateTenantIds.length} 个租户，自动关闭 ${disabled} 个`,
        );
      });
    } catch (error) {
      this.logger.error(`[定时任务] 聚合零流量巡检执行失败: ${getErrorMessage(error)}`, getErrorStack(error));
    } finally {
      try {
        await this.redisService.unlock(this.lockKey, lockToken);
      } catch (error) {
        this.logger.warn(`[定时任务] 释放聚合零流量巡检锁失败: ${getErrorMessage(error)}`);
      }
    }
  }

  /**
   * 刷新兼容接口 14 天流量观测窗口。
   * @description
   * 对每个租户 × 每个兼容端点：
   * 1. 更新昨日零流量连续天数（zeroStreakDays）
   * 2. 累加过去 14 天总调用量（calls14d）
   * 3. 将汇总结果写入 Redis，供台账展示和下线决策
   */
  private async refreshCompatibilityWindow(now: Date, aggregateTenantIds: string[]): Promise<void> {
    const compatTenantIds = await this.redisService.getClient().smembers(MARKETING_COMPAT_TENANT_SET_KEY);
    const tenantIds = [...new Set([...compatTenantIds, ...aggregateTenantIds])];
    if (!tenantIds.length) {
      this.logger.log('[定时任务] 兼容入口 14 天观测：无追踪租户');
      return;
    }

    const summaryDate = this.formatUtcYmd(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)),
    );

    for (const tenantId of tenantIds) {
      for (const endpoint of COMPAT_ENDPOINTS) {
        try {
          const everUsed = await this.redisService.get(marketingCompatEverUsedKey(tenantId, endpoint));
          if (!everUsed) {
            continue;
          }

          const yesterdayCount = await this.readCompatDailyCount(tenantId, endpoint, now, 1);
          const streakKey = marketingCompatZeroStreakKey(tenantId, endpoint);
          let zeroStreakDays = 0;
          if (yesterdayCount > 0) {
            await this.redisService.del(streakKey);
          } else {
            zeroStreakDays = await this.redisService.incr(streakKey);
          }

          const calls14d = await this.sumCompatWindowCalls(tenantId, endpoint, now, COMPAT_WINDOW_DAYS);
          const canDeprecate = calls14d === 0 && zeroStreakDays >= COMPAT_WINDOW_DAYS;

          const summary: CompatWindowSummary = {
            tenantId,
            endpoint,
            date: summaryDate,
            thresholdDays: COMPAT_WINDOW_DAYS,
            calls14d,
            zeroStreakDays,
            canDeprecate,
          };
          await this.redisService.set(
            marketingCompatWindowSummaryKey(tenantId, endpoint),
            summary,
            COMPAT_SUMMARY_TTL_MS,
          );

          this.logger.log(
            `[compat.window] tenant=${tenantId} endpoint=${endpoint} calls14d=${calls14d} ` +
              `zeroStreakDays=${zeroStreakDays} canDeprecate=${canDeprecate}`,
          );
        } catch (error) {
          this.logger.error(
            `[定时任务] 兼容入口 14 天观测失败 tenant=${tenantId} endpoint=${endpoint}: ${getErrorMessage(error)}`,
            getErrorStack(error),
          );
        }
      }
    }
  }

  /** 累加指定租户/端点过去 days 天的兼容接口调用量 */
  private async sumCompatWindowCalls(
    tenantId: string,
    endpoint: MarketingCompatEndpoint,
    now: Date,
    days: number,
  ): Promise<number> {
    let total = 0;
    for (let offset = 1; offset <= days; offset += 1) {
      total += await this.readCompatDailyCount(tenantId, endpoint, now, offset);
    }
    return total;
  }

  /** 读取指定租户/端点在 now 前 dayOffset 天的 UTC 日历日调用量；Redis 无记录时返回 0 */
  private async readCompatDailyCount(
    tenantId: string,
    endpoint: MarketingCompatEndpoint,
    now: Date,
    dayOffset: number,
  ): Promise<number> {
    const dayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOffset));
    const ymd = this.formatUtcYmd(dayUtc);
    const cntRaw = await this.redisService.get(marketingCompatDailyCountKey(tenantId, endpoint, ymd));
    const parsed = cntRaw == null || cntRaw === '' ? 0 : Number(String(cntRaw));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /** 读取指定租户在 ymd（格式 YYYYMMDD）的聚合接口调用量；Redis 无记录时返回 0 */
  private async readAggregateDailyCount(tenantId: string, ymd: string): Promise<number> {
    const cntRaw = await this.redisService.get(marketingAggregateDailyCountKey(tenantId, ymd));
    const parsed = cntRaw == null || cntRaw === '' ? 0 : Number(String(cntRaw));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /** 将 Date 格式化为 UTC 日期字符串（YYYYMMDD），与 Redis 计数键命名约定保持一致 */
  private formatUtcYmd(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  /** 将租户的聚合接口开关写入（或更新）sysConfig 为 'N'，并附加自动关闭说明 */
  private async disableAggregateForTenant(tenantId: string): Promise<void> {
    const configKey = MARKETING_CLIENT_AGGREGATE_ENABLED_KEY;
    const remark = `由定时任务在连续 ${ZERO_STREAK_DAYS} 个 UTC 日历日零调用后自动关闭，可手工改回 Y`;
    const existing = await this.prisma.sysConfig.findFirst({
      where: { tenantId, configKey, delFlag: DelFlag.NORMAL },
    });
    if (existing) {
      await this.prisma.sysConfig.update({
        where: { configId: existing.configId },
        data: {
          configValue: 'N',
          updateBy: 'system',
          updateTime: new Date(),
          remark,
        },
      });
      return;
    }

    await this.prisma.sysConfig.create({
      data: {
        tenantId,
        configKey,
        configName: 'C端营销聚合列表接口总开关',
        configValue: 'N',
        configType: 'Y',
        createBy: 'system',
        status: Status.NORMAL,
        delFlag: DelFlag.NORMAL,
        remark,
      },
    });
  }
}
