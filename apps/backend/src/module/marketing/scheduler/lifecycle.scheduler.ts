import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { Prisma, PlayInstanceStatus, PublishStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { RedisService } from 'src/module/common/redis/redis.service';
import { PlayInstanceService } from '../instance/instance.service';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';

/**
 * 营销活动生命周期调度器
 *
 * @description
 * 自动化处理营销活动的生命周期管理，包括：
 * 1. 超时实例自动关闭（防止长期占用资源）
 * 2. 活动自动上下架（根据时间规则）
 * 3. 过期数据归档（保持数据库性能）
 * 4. 库存自动释放（超时/失败后释放）
 *
 * 核心原则：
 * - 定时任务必须幂等（可重复执行）
 * - 批量处理提升性能
 * - 异常不影响后续任务
 * - 记录详细日志便于追踪
 */
@Injectable()
export class ActivityLifecycleScheduler {
  private readonly logger = new Logger(ActivityLifecycleScheduler.name);
  private readonly timeoutLockKey = 'lock:marketing:lifecycle:handle-timeout-instances';
  private readonly timeoutLockTtlMs = 55 * 1000;
  private readonly activityStatusLockKey = 'lock:marketing:lifecycle:handle-activity-status';
  private readonly activityStatusLockTtlMs = 55 * 60 * 1000;
  private readonly healthLockKey = 'lock:marketing:lifecycle:health-check';
  private readonly healthLockTtlMs = 4 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly instanceService: PlayInstanceService,
    private readonly redisService: RedisService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 定时任务 1: 处理超时实例
   *
   * @description
   * 每分钟执行一次，检查并处理超时的实例：
   * - PENDING_PAY 状态超过 30 分钟 -> TIMEOUT
   * - ACTIVE 状态超过活动有效期 -> FAILED
   *
   * @cron 每分钟的第 0 秒执行
   */
  @IgnoreTenant()
  @CodeManagedJob({
    key: 'marketing.handleTimeoutInstances',
    name: '处理超时实例',
    group: 'MARKETING',
    cron: CronExpression.EVERY_MINUTE,
    guardMode: 'self-managed',
  })
  @Task({ name: 'marketing.handleTimeoutInstances', description: '处理超时实例（待支付超时+活动超时）' })
  async handleTimeoutInstances() {
    const lockToken = await this.redisService.tryLock(this.timeoutLockKey, this.timeoutLockTtlMs);
    if (!lockToken) {
      this.logger.log('[定时任务] 跳过处理超时实例：已有实例正在执行');
      return;
    }

    const startTime = Date.now();
    this.logger.log('[定时任务] 开始处理超时实例...');

    try {
      // Phase D2: readWhereForDelegate 在缺 tenant context 时不会追加 tenantId 过滤；
      // 这里业务需求就是跨租户扫描全部超时实例，进入 super-tenant context 让契约显式化，
      // 同时也让 instanceService.transitStatus 内嵌的写路径在 tenantExtension 看来是合法的跨租户写。
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        // === 1. 处理待支付超时 ===
        const paymentTimeout = 30 * 60 * 1000; // 30分钟
        const paymentDeadline = new Date(Date.now() - paymentTimeout);

        const timeoutPendingInstances = await this.prisma.playInstance.findMany({
          where: this.tenantHelper.readWhereForDelegate('playInstance', {
            status: PlayInstanceStatus.PENDING_PAY,
            createTime: { lt: paymentDeadline },
          }) as Prisma.PlayInstanceWhereInput,
          take: 100, // 每次最多处理 100 条，防止长时间阻塞
        });

        this.logger.log(`[待支付超时] 发现 ${timeoutPendingInstances.length} 个超时实例`);

        for (const instance of timeoutPendingInstances) {
          try {
            // 流转状态到 TIMEOUT
            await this.instanceService.transitStatus(instance.id, PlayInstanceStatus.TIMEOUT);

            this.logger.debug(`[待支付超时] 实例 ${instance.id} 已超时关闭`);
          } catch (error) {
            this.logger.error(`[待支付超时] 处理实例 ${instance.id} 失败: ${getErrorMessage(error)}`);
            // 继续处理下一个，不中断整个任务
          }
        }

        // === 2. 处理活动中超时 ===
        // 查询所有 ACTIVE 状态的实例，检查是否超过活动有效期
        const activeInstances = await this.prisma.playInstance.findMany({
          where: this.tenantHelper.readWhereForDelegate('playInstance', {
            status: PlayInstanceStatus.ACTIVE,
          }) as Prisma.PlayInstanceWhereInput,
          include: {
            config: true, // 需要获取活动规则
          },
          take: 100,
        });

        let activeTimeoutCount = 0;
        for (const instance of activeInstances) {
          try {
            const rules = instance.config.rules as Record<string, unknown> | null;
            const validDays = Number(rules?.validDays) || 7; // 默认 7 天有效期
            const deadline = new Date(instance.createTime.getTime() + validDays * 24 * 60 * 60 * 1000);

            if (Date.now() > deadline.getTime()) {
              // 活动超时，流转到 FAILED
              await this.instanceService.transitStatus(instance.id, PlayInstanceStatus.FAILED);
              activeTimeoutCount++;
              this.logger.debug(`[活动超时] 实例 ${instance.id} 已超时失败`);
            }
          } catch (error) {
            this.logger.error(`[活动超时] 处理实例 ${instance.id} 失败: ${getErrorMessage(error)}`);
          }
        }

        this.logger.log(`[活动超时] 处理 ${activeTimeoutCount} 个超时实例`);

        const duration = Date.now() - startTime;
        this.logger.log(
          `[定时任务] 超时实例处理完成，耗时 ${duration}ms，共处理 ${timeoutPendingInstances.length + activeTimeoutCount} 个实例`,
        );
      });
    } catch (error) {
      this.logger.error(`[定时任务] 处理超时实例失败: ${getErrorMessage(error)}`, getErrorStack(error));
    } finally {
      try {
        await this.redisService.unlock(this.timeoutLockKey, lockToken);
      } catch (error) {
        this.logger.warn(`[定时任务] 释放超时实例任务锁失败: ${getErrorMessage(error)}`);
      }
    }
  }

  /**
   * 定时任务 2: 活动自动上下架
   *
   * @description
   * 每小时执行一次，根据活动的时间规则自动上下架：
   * - 到达开始时间 -> 自动上架
   * - 到达结束时间 -> 自动下架
   *
   * @cron 每小时的第 0 分 0 秒执行
   */
  @IgnoreTenant()
  @CodeManagedJob({
    key: 'marketing.handleActivityStatus',
    name: '活动自动上下架',
    group: 'MARKETING',
    cron: CronExpression.EVERY_HOUR,
    guardMode: 'self-managed',
  })
  @Task({ name: 'marketing.handleActivityStatus', description: '活动自动上下架' })
  async handleActivityStatus() {
    const lockToken = await this.redisService.tryLock(this.activityStatusLockKey, this.activityStatusLockTtlMs);
    if (!lockToken) {
      this.logger.log('[定时任务] 跳过活动状态检查：已有实例正在执行');
      return;
    }

    const startTime = Date.now();
    this.logger.log('[定时任务] 开始检查活动状态...');

    try {
      // Phase D2: 两次 storePlayConfig.updateMany 直接跨租户改 status，没显式 tenant context
      // 时 tenantExtension 不追加任何 tenant 过滤，等同放任跨租户写穿透。进入
      // super-tenant 兜底 context 把跨租户操作明示出来，并与契约模板对齐。
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        const now = new Date();

        // === 1. 自动上架到期的活动 ===
        // 查询：状态为下架 + 开始时间已到 + 结束时间未到
        const toOnShelf = await this.prisma.storePlayConfig.updateMany({
          where: {
            status: PublishStatus.OFF_SHELF,
            rules: {
              path: ['startTime'],
              lte: now.toISOString(),
            },
            AND: [
              {
                OR: [
                  { rules: { path: ['endTime'], gte: now.toISOString() } },
                  { rules: { path: ['endTime'], equals: null } }, // 没有结束时间
                ],
              },
            ],
          },
          data: {
            status: PublishStatus.ON_SHELF,
          },
        });

        this.logger.log(`[自动上架] 上架 ${toOnShelf.count} 个活动`);

        // === 2. 自动下架过期的活动 ===
        // 查询：状态为上架 + 结束时间已到
        const toOffShelf = await this.prisma.storePlayConfig.updateMany({
          where: {
            status: PublishStatus.ON_SHELF,
            rules: {
              path: ['endTime'],
              lte: now.toISOString(),
            },
          },
          data: {
            status: PublishStatus.OFF_SHELF,
          },
        });

        this.logger.log(`[自动下架] 下架 ${toOffShelf.count} 个活动`);

        const duration = Date.now() - startTime;
        this.logger.log(
          `[定时任务] 活动状态检查完成，耗时 ${duration}ms，上架 ${toOnShelf.count} 个，下架 ${toOffShelf.count} 个`,
        );
      });
    } catch (error) {
      this.logger.error(`[定时任务] 检查活动状态失败: ${getErrorMessage(error)}`, getErrorStack(error));
    } finally {
      try {
        await this.redisService.unlock(this.activityStatusLockKey, lockToken);
      } catch (error) {
        this.logger.warn(`[定时任务] 释放活动状态检查锁失败: ${getErrorMessage(error)}`);
      }
    }
  }

  /**
   * 定时任务 3: 健康检查（原"清理过期数据"已下线，详见 SCHEDULER-AUDIT Phase B）
   *
   * @description
   * 每 5 分钟执行一次，检查系统健康状态：
   * - 统计各状态实例数量
   * - 检查是否有异常堆积
   * - 记录关键指标
   *
   * @cron 每 5 分钟执行
   */
  @IgnoreTenant()
  @CodeManagedJob({
    key: 'marketing.healthCheck',
    name: '营销系统健康检查',
    group: 'MARKETING',
    cron: '0 */5 * * * *',
    guardMode: 'self-managed',
  })
  @Task({ name: 'marketing.healthCheck', description: '营销系统健康检查' })
  async healthCheck() {
    const lockToken = await this.redisService.tryLock(this.healthLockKey, this.healthLockTtlMs);
    if (!lockToken) {
      this.logger.log('[定时任务] 跳过健康检查：已有实例正在执行');
      return;
    }

    try {
      // Phase D2: groupBy / findFirst 在缺 tenant context 时 tenantExtension 不会追加过滤；
      // 这里是全租户聚合健康检查，进入 super-tenant context 让契约显式化，避免后续被回退。
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        // 统计各状态实例数量
        const statusCounts = await this.prisma.playInstance.groupBy({
          by: ['status'],
          where: this.tenantHelper.readWhereForDelegate('playInstance', {}) as Prisma.PlayInstanceWhereInput,
          _count: true,
        });

        const stats: Record<string, number> = {};
        for (const item of statusCounts) {
          stats[item.status] = item._count;
        }

        this.logger.log(`[健康检查] 实例状态统计: ${JSON.stringify(stats)}`);

        // 检查是否有异常堆积（例如：PENDING_PAY 超过 1000 个）
        if (stats[PlayInstanceStatus.PENDING_PAY] > 1000) {
          this.logger.warn(
            `[健康检查] 警告：待支付实例数量过多 (${stats[PlayInstanceStatus.PENDING_PAY]})，可能存在异常`,
          );
        }

        // 检查是否有长时间未处理的实例
        const oldestPending = await this.prisma.playInstance.findFirst({
          where: this.tenantHelper.readWhereForDelegate('playInstance', {
            status: PlayInstanceStatus.PENDING_PAY,
          }) as Prisma.PlayInstanceWhereInput,
          orderBy: { createTime: 'asc' },
        });

        if (oldestPending) {
          const age = Date.now() - oldestPending.createTime.getTime();
          const ageMinutes = Math.floor(age / 60000);
          if (ageMinutes > 60) {
            this.logger.warn(`[健康检查] 警告：存在超过 ${ageMinutes} 分钟的待支付实例 (${oldestPending.id})`);
          }
        }
      });
    } catch (error) {
      this.logger.error(`[健康检查] 执行失败: ${getErrorMessage(error)}`, getErrorStack(error));
    } finally {
      try {
        await this.redisService.unlock(this.healthLockKey, lockToken);
      } catch (error) {
        this.logger.warn(`[健康检查] 释放健康检查锁失败: ${getErrorMessage(error)}`);
      }
    }
  }
}
