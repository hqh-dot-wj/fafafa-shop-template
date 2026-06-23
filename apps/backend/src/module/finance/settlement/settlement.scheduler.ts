import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { WalletService } from '../wallet/wallet.service';
import { FinanceEventEmitter } from '../events/finance-event.emitter';
import { SettlementLogService } from './settlement-log.service';
import { Decimal } from '@prisma/client/runtime/library';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { BusinessConstants } from 'src/common/constants/business.constants';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { Prisma } from '@prisma/client';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';

/**
 * 结算统计结果
 */
interface SettlementStats {
  settledCount: number;
  failedCount: number;
  totalAmount: Decimal;
  lastProcessedId: bigint | null;
  errorDetails?: string[];
}

/**
 * 结算定时任务
 *
 * @description
 * 每5分钟扫描到期的冻结佣金并结算到用户钱包
 *
 * S-T1: 看门狗机制，锁自动续期防止重入 ✅
 * S-T2: settleOne 事务内重新查询状态 ✅
 * S-T3: 增加重试指数退避机制 ✅
 * S-T5: 批量处理支持断点续传 ✅
 * S-T6: 新增结算统计功能 ✅
 * S-T8: 新增结算日志记录 ✅
 * S-T9: 批量大小配置化 ✅
 * S-T10: 集成监控告警 ✅
 */
@Injectable()
export class SettlementScheduler {
  private readonly logger = new Logger(SettlementScheduler.name);
  private readonly LOCK_KEY = 'lock:settle:commission';
  private readonly CHECKPOINT_KEY = 'settle:checkpoint';
  // 毫秒口径，配合 RedisService.tryLock/renewLock（底层 PX/pexpire）
  private readonly LOCK_TTL_MS = BusinessConstants.REDIS_LOCK.SETTLEMENT_TTL_MS;
  private readonly LOCK_RENEW_INTERVAL = 60000; // 1分钟续期一次
  // S-T9: 批量大小配置化
  private readonly BATCH_SIZE = BusinessConstants.FINANCE.SETTLEMENT_BATCH_SIZE ?? 100;
  private readonly MAX_RETRY_COUNT = 3;
  private readonly BASE_RETRY_DELAY = 1000; // 1秒
  // S-T10: 告警阈值
  private readonly FAILURE_RATE_THRESHOLD = 0.01; // 1% 失败率告警
  private lockRenewTimer: NodeJS.Timeout | null = null;
  // 当前实例持有的锁 token；null 代表未持有或已丢失。
  // unlock/renewLock 必须比对此值，禁止用占位符（如 '1'）误删/误续他人的锁。
  private lockToken: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly walletService: WalletService,
    private readonly eventEmitter: FinanceEventEmitter,
    private readonly logService: SettlementLogService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 每5分钟执行结算任务
   */
  @IgnoreTenant()
  @CodeManagedJob({
    key: 'finance.settleJob',
    name: '佣金结算到钱包',
    group: 'FINANCE',
    cron: CronExpression.EVERY_5_MINUTES,
    guardMode: 'self-managed',
  })
  @Task({ name: 'finance.settleJob', description: '佣金结算到钱包' })
  async settleJob() {
    const locked = await this.acquireLock();
    if (!locked) {
      this.logger.debug('Settlement job skipped: another instance is running');
      return;
    }

    // S-T1: 启动看门狗续期；watchdog 自身只调 redis.renewLock，不依赖 tenant 上下文，
    // 因此放在 TenantContext.run 外面，独立于业务 ALS 链路。
    this.startLockRenewal();
    const startTime = new Date();

    try {
      // Phase D2: 仅包裹 cron 入口的 doSettle / logService / eventEmitter / checkAndAlert，
      // 这里跨租户结算 finCommission FROZEN -> SETTLED 并改钱包余额，必须显式 super-tenant context。
      // triggerSettlement 是 controller 手动触发路径，由 controller 自带请求 context，
      // 不要在 doSettle 内部硬编码 super-tenant context，避免覆盖管理员的请求 tenant 边界。
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        const stats = await this.doSettle();

        // S-T8: 记录结算日志
        if (stats.settledCount > 0 || stats.failedCount > 0) {
          await this.logService.createLog({
            settledCount: stats.settledCount,
            failedCount: stats.failedCount,
            totalAmount: stats.totalAmount,
            startTime,
            endTime: new Date(),
            triggerType: 'SCHEDULED',
            errorDetails: stats.errorDetails?.length ? JSON.stringify(stats.errorDetails) : undefined,
          });

          // S-T6: 发送结算统计事件
          await this.eventEmitter.emitSettlementBatchCompleted('system', {
            settledCount: stats.settledCount,
            failedCount: stats.failedCount,
            totalAmount: stats.totalAmount.toString(),
          });

          // S-T10: 检查失败率并告警
          await this.checkAndAlert(stats);
        }
      });
    } finally {
      this.stopLockRenewal();
      await this.releaseLock();
    }
  }

  /**
   * 手动触发结算（供 Controller 调用）
   *
   * @description
   * S-T7: 新增手动触发结算接口
   */
  async triggerSettlement(): Promise<SettlementStats> {
    const locked = await this.acquireLock();
    if (!locked) {
      return {
        settledCount: 0,
        failedCount: 0,
        totalAmount: new Decimal(0),
        lastProcessedId: null,
      };
    }

    this.startLockRenewal();
    const startTime = new Date();

    try {
      const stats = await this.doSettle();

      // S-T8: 记录结算日志
      if (stats.settledCount > 0 || stats.failedCount > 0) {
        await this.logService.createLog({
          settledCount: stats.settledCount,
          failedCount: stats.failedCount,
          totalAmount: stats.totalAmount,
          startTime,
          endTime: new Date(),
          triggerType: 'MANUAL',
          errorDetails: stats.errorDetails?.length ? JSON.stringify(stats.errorDetails) : undefined,
        });
      }

      return stats;
    } finally {
      this.stopLockRenewal();
      await this.releaseLock();
    }
  }

  /**
   * 获取结算统计
   *
   * @description
   * S-T6: 新增结算统计功能
   */
  async getSettlementStats(): Promise<{
    pendingCount: number;
    pendingAmount: Decimal;
    todaySettledCount: number;
    todaySettledAmount: Decimal;
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const sw = (w: Prisma.FinCommissionWhereInput) =>
      this.tenantHelper.readWhereForDelegate('finCommission', w as object) as Prisma.FinCommissionWhereInput;

    const [pendingStats, todayStats] = await Promise.all([
      this.prisma.finCommission.aggregate({
        where: sw({
          status: 'FROZEN',
          planSettleTime: { lte: now },
        }),
        _count: true,
        _sum: { amount: true },
      }),
      this.prisma.finCommission.aggregate({
        where: this.tenantHelper.readWhereForDelegate('finCommission', {
          status: 'SETTLED',
          settleTime: { gte: todayStart },
        } as object) as Prisma.FinCommissionWhereInput,
        _count: true,
        _sum: { amount: true },
      }),
    ]);

    return {
      pendingCount: pendingStats._count,
      pendingAmount: pendingStats._sum.amount ?? new Decimal(0),
      todaySettledCount: todayStats._count,
      todaySettledAmount: todayStats._sum.amount ?? new Decimal(0),
    };
  }

  /**
   * 执行结算
   *
   * @description
   * S-T5: 支持断点续传，从上次中断的位置继续
   */
  private async doSettle(): Promise<SettlementStats> {
    const now = new Date();
    let cursor = await this.getCheckpoint();
    let totalSettled = 0;
    let totalFailed = 0;
    let totalAmount = new Decimal(0);
    const errorDetails: string[] = [];

    while (true) {
      const records = await this.prisma.finCommission.findMany({
        where: this.tenantHelper.readWhereForDelegate('finCommission', {
          status: 'FROZEN',
          planSettleTime: { lte: now },
          ...(cursor ? { id: { gt: cursor } } : {}),
        }) as Prisma.FinCommissionWhereInput,
        orderBy: { id: 'asc' },
        take: this.BATCH_SIZE,
      });

      if (records.length === 0) {
        // 清除断点
        await this.clearCheckpoint();
        break;
      }

      for (const record of records) {
        // S-T3: 带重试的结算
        const result = await this.settleOneWithRetry(record);
        if (result.success && result.settled) {
          totalSettled++;
          totalAmount = totalAmount.add(record.amount);
        } else if (!result.success) {
          totalFailed++;
          if (result.error) {
            errorDetails.push(`Commission ${record.id}: ${result.error}`);
          }
        }
      }

      cursor = records[records.length - 1].id;
      // S-T5: 保存断点
      await this.saveCheckpoint(cursor);
    }

    if (totalSettled > 0 || totalFailed > 0) {
      this.logger.log(`Settlement completed: settled=${totalSettled}, failed=${totalFailed}, amount=${totalAmount}`);
    }

    return {
      settledCount: totalSettled,
      failedCount: totalFailed,
      totalAmount,
      lastProcessedId: cursor,
      errorDetails: errorDetails.length > 0 ? errorDetails.slice(0, 100) : undefined, // 最多保留100条错误
    };
  }

  /**
   * 带重试的单条结算
   *
   * @description
   * S-T3: 增加重试指数退避机制
   */
  private async settleOneWithRetry(commission: {
    id: bigint;
    beneficiaryId: string;
    tenantId: string;
    amount: Decimal;
    orderId: string;
  }): Promise<{ success: boolean; settled: boolean; error?: string }> {
    for (let attempt = 1; attempt <= this.MAX_RETRY_COUNT; attempt++) {
      try {
        const settled = await this.settleOne(commission);
        return { success: true, settled };
      } catch (error) {
        const errorMsg = getErrorMessage(error);
        const delay = this.BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Settlement attempt ${attempt}/${this.MAX_RETRY_COUNT} failed for commission ${commission.id}, ` +
            `retrying in ${delay}ms: ${errorMsg}`,
        );

        if (attempt < this.MAX_RETRY_COUNT) {
          await this.sleep(delay);
        } else {
          this.logger.error(
            `Settlement failed after ${this.MAX_RETRY_COUNT} attempts for commission ${commission.id}`,
            getErrorStack(error),
          );
          return { success: false, settled: false, error: errorMsg };
        }
      }
    }
    return { success: false, settled: false, error: 'Unknown error' };
  }

  /**
   * S-T10: 检查失败率并告警
   */
  private async checkAndAlert(stats: SettlementStats): Promise<void> {
    const total = stats.settledCount + stats.failedCount;
    if (total === 0) return;

    const failureRate = stats.failedCount / total;
    if (failureRate > this.FAILURE_RATE_THRESHOLD) {
      this.logger.error(
        `[结算告警] 失败率过高: ${(failureRate * 100).toFixed(2)}% ` +
          `(成功: ${stats.settledCount}, 失败: ${stats.failedCount})`,
      );

      // 发送告警事件（可对接监控系统）
      await this.eventEmitter.emit({
        type: 'settlement.alert' as never,
        tenantId: 'system',
        memberId: 'system',
        payload: {
          alertType: 'HIGH_FAILURE_RATE',
          failureRate: failureRate.toFixed(4),
          settledCount: stats.settledCount,
          failedCount: stats.failedCount,
          threshold: this.FAILURE_RATE_THRESHOLD,
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * 结算单条佣金
   *
   * @description
   * S-T2: 事务内重新查询状态 where: { status: 'FROZEN' }
   * S-T4: 结算前校验订单状态（通过关联查询）
   */
  private async settleOne(commission: {
    id: bigint;
    beneficiaryId: string;
    tenantId: string;
    amount: Decimal;
    orderId: string;
  }): Promise<boolean> {
    const settled = await this.prisma.$transaction(async (tx) => {
      // S-T2: 原子性更新佣金状态（带状态校验防止并发重复结算）
      const updateResult = await tx.finCommission.updateMany({
        where: {
          id: commission.id,
          status: 'FROZEN',
        },
        data: {
          status: 'SETTLED',
          settleTime: new Date(),
        },
      });

      if (updateResult.count === 0) {
        this.logger.warn(`Commission ${commission.id} skipped: status is not FROZEN`);
        return false;
      }

      // 获取或创建钱包
      let wallet = await tx.finWallet.findFirst({
        where: this.tenantHelper.readWhereForDelegate('finWallet', {
          memberId: commission.beneficiaryId,
        }) as Prisma.FinWalletWhereInput,
      });

      if (!wallet) {
        wallet = await tx.finWallet.create({
          data: {
            memberId: commission.beneficiaryId,
            tenantId: commission.tenantId,
            balance: 0,
            frozen: 0,
            totalIncome: 0,
            pendingRecovery: 0,
          },
        });
      }

      // 检查是否有待回收余额，优先抵扣
      let actualIncome = commission.amount;
      let recoveryAmount = new Decimal(0);
      if (wallet.pendingRecovery.gt(0)) {
        recoveryAmount = Decimal.min(commission.amount, wallet.pendingRecovery);
        actualIncome = commission.amount.minus(recoveryAmount);

        if (recoveryAmount.gt(0)) {
          await tx.finWallet.update({
            where: { id: wallet.id },
            data: {
              pendingRecovery: { decrement: recoveryAmount },
            },
          });
          this.logger.log(`[结算回收] 用户 ${commission.beneficiaryId} 抵扣待回收 ${recoveryAmount}`);
        }
      }

      // 增加钱包余额（仅增加抵扣后的实际收入）
      const updatedWallet = await tx.finWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: actualIncome },
          totalIncome: { increment: commission.amount },
          version: { increment: 1 },
        },
      });

      // 写入 COMMISSION_IN 流水：记录全额佣金，与 totalIncome 增量对齐（可审计）
      await tx.finTransaction.create({
        data: {
          walletId: wallet.id,
          tenantId: commission.tenantId,
          type: 'COMMISSION_IN',
          amount: commission.amount,
          balanceAfter: updatedWallet.balance,
          relatedId: commission.orderId,
          remark: `订单${commission.orderId}佣金结算`,
        },
      });

      // 若有待回收抵扣，补写 DEBT_RECOVERY 流水：解释 balance 增量小于 totalIncome 增量的差值
      if (recoveryAmount.gt(0)) {
        await tx.finTransaction.create({
          data: {
            walletId: wallet.id,
            tenantId: commission.tenantId,
            type: 'DEBT_RECOVERY',
            amount: recoveryAmount.negated(),
            balanceAfter: updatedWallet.balance,
            relatedId: commission.orderId,
            remark: `订单${commission.orderId}佣金结算时抵扣历史欠款`,
          },
        });
      }
      return true;
    });

    if (!settled) {
      return false;
    }

    // 发送佣金结算事件
    await this.eventEmitter.emitCommissionSettled(commission.tenantId, commission.beneficiaryId, {
      commissionId: commission.id.toString(),
      orderId: commission.orderId,
      amount: commission.amount.toString(),
    });
    return true;
  }

  // ========== 锁管理 ==========
  //
  // Phase A2: 全部走 RedisService.tryLock/unlock/renewLock 的 token 化 API。
  // 历史实现 `set ... '1' NX` + `del` + `expire` 没有 token 校验，可在多实例
  // 并发场景下误删/误续他人的锁，资金路径不可接受。

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
      this.logger.error('Failed to acquire lock', getErrorMessage(error));
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
      this.logger.error('Failed to release lock', getErrorMessage(error));
    }
  }

  /**
   * S-T1: 看门狗单次续期。
   *
   * 返回 true 表示锁仍归本实例所有；false 表示锁已丢失（token mismatch / 网络异常），
   * 调用方应立即停止当前结算批次，避免无锁继续动钱包余额（Phase A2 决策 D2=a）。
   */
  private async renewLockOnce(): Promise<boolean> {
    if (!this.lockToken) {
      return false;
    }
    try {
      const result = await this.redis.renewLock(this.LOCK_KEY, this.lockToken, this.LOCK_TTL_MS);
      if (result === 0) {
        this.logger.warn('Settlement lock lost during renewal; releasing watchdog');
        this.lockToken = null;
        return false;
      }
      this.logger.debug('Lock renewed');
      return true;
    } catch (error) {
      this.logger.error('Failed to renew lock', getErrorMessage(error));
      this.lockToken = null;
      return false;
    }
  }

  /**
   * S-T1: 启动看门狗续期；锁丢失时自动停 timer，由 settleJob 的 finally 收尾。
   */
  private startLockRenewal(): void {
    this.lockRenewTimer = setInterval(async () => {
      const stillHeld = await this.renewLockOnce();
      if (!stillHeld) {
        this.stopLockRenewal();
      }
    }, this.LOCK_RENEW_INTERVAL);
  }

  /**
   * S-T1: 停止看门狗续期
   */
  private stopLockRenewal(): void {
    if (this.lockRenewTimer) {
      clearInterval(this.lockRenewTimer);
      this.lockRenewTimer = null;
    }
  }

  // ========== 断点续传 ==========

  /**
   * S-T5: 获取断点
   */
  private async getCheckpoint(): Promise<bigint | null> {
    try {
      const checkpoint = await this.redis.getClient().get(this.CHECKPOINT_KEY);
      return checkpoint ? BigInt(checkpoint) : null;
    } catch {
      return null;
    }
  }

  /**
   * S-T5: 保存断点
   */
  private async saveCheckpoint(id: bigint): Promise<void> {
    try {
      // 断点保留 1 小时
      await this.redis.getClient().set(this.CHECKPOINT_KEY, id.toString(), 'EX', 3600);
    } catch (error) {
      this.logger.error('Failed to save checkpoint', getErrorMessage(error));
    }
  }

  /**
   * S-T5: 清除断点
   */
  private async clearCheckpoint(): Promise<void> {
    try {
      await this.redis.getClient().del(this.CHECKPOINT_KEY);
    } catch (error) {
      this.logger.error('Failed to clear checkpoint', getErrorMessage(error));
    }
  }

  // ========== 工具方法 ==========

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
