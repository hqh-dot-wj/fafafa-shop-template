import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { MemberQueryPort } from '../../ports/member-query.port';

export interface CommissionBudgetConfigInput {
  budgetTotal?: number | null;
  budgetAlertThreshold?: number | null;
  budgetFuseThreshold?: number | null;
}

export interface CommissionBudgetContextInput {
  activityVersionId?: string | null;
  shareChannel?: string | null;
  currentLevelId?: number | null;
  targetLevelId?: number | null;
}

export interface CommissionBudgetAmountInput {
  consumedAmount?: number | null;
  frozenAmount?: number | null;
  releasedAmount?: number | null;
}

export interface CommissionBudgetValidationResult {
  budgetTotal: number;
  budgetAlertThreshold: number;
  budgetFuseThreshold: number;
  occupiedAmount: number;
  budgetRemaining: number;
  budgetUsageRate: number;
  budgetEnforced: boolean;
  missingContext: boolean;
  alertTriggered: boolean;
  fuseTriggered: boolean;
  insufficientBudget: boolean;
  isValid: boolean;
  messages: string[];
}

export interface CommissionBudgetSnapshot {
  budgetTotal: number;
  budgetFrozen: number;
  budgetConsumed: number;
  budgetReleased: number;
  budgetByLevel: Record<string, number>;
  budgetByChannel: Record<string, number>;
  budgetByActivityVersion: Record<string, number>;
  budgetAlertThreshold: number;
  budgetFuseThreshold: number;
}

export function normalizeCommissionBudgetConfig(
  input?: CommissionBudgetConfigInput | null,
): Required<CommissionBudgetConfigInput> {
  return {
    budgetTotal: normalizeBudgetNumber(input?.budgetTotal),
    budgetAlertThreshold: normalizeBudgetNumber(input?.budgetAlertThreshold, 70),
    budgetFuseThreshold: normalizeBudgetNumber(input?.budgetFuseThreshold, 90),
  };
}

export function validateCommissionBudgetContext(
  config: CommissionBudgetConfigInput,
  context: CommissionBudgetContextInput = {},
  amounts: CommissionBudgetAmountInput = {},
): CommissionBudgetValidationResult {
  const normalizedConfig = normalizeCommissionBudgetConfig(config);
  const consumedAmount = normalizeBudgetNumber(amounts.consumedAmount);
  const frozenAmount = normalizeBudgetNumber(amounts.frozenAmount);
  const releasedAmount = normalizeBudgetNumber(amounts.releasedAmount);
  const occupiedAmount = normalizeBudgetNumber(consumedAmount + frozenAmount - releasedAmount);
  const budgetEnforced = normalizedConfig.budgetTotal > 0;
  const budgetUsageRate = budgetEnforced ? (occupiedAmount / normalizedConfig.budgetTotal) * 100 : 0;
  const budgetRemaining = budgetEnforced ? Math.max(normalizedConfig.budgetTotal - occupiedAmount, 0) : 0;
  const missingContext =
    !context.activityVersionId ||
    !context.shareChannel ||
    (context.currentLevelId == null && context.targetLevelId == null);
  const alertTriggered = budgetEnforced && budgetUsageRate >= normalizedConfig.budgetAlertThreshold;
  const fuseTriggered = budgetEnforced && budgetUsageRate >= normalizedConfig.budgetFuseThreshold;
  const insufficientBudget = budgetEnforced && occupiedAmount > normalizedConfig.budgetTotal;
  const messages: string[] = [];

  if (!budgetEnforced) {
    messages.push('预算未启用，使用默认快照');
  }
  if (missingContext) {
    messages.push('预算上下文不完整，使用兼容默认值');
  }
  if (alertTriggered) {
    messages.push('预算已触发预警阈值');
  }
  if (fuseTriggered) {
    messages.push('预算已触发熔断阈值');
  }
  if (insufficientBudget) {
    messages.push('预算不足');
  }

  return {
    budgetTotal: normalizedConfig.budgetTotal,
    budgetAlertThreshold: normalizedConfig.budgetAlertThreshold,
    budgetFuseThreshold: normalizedConfig.budgetFuseThreshold,
    occupiedAmount,
    budgetRemaining,
    budgetUsageRate: Number(budgetUsageRate.toFixed(2)),
    budgetEnforced,
    missingContext,
    alertTriggered,
    fuseTriggered,
    insufficientBudget,
    isValid: !insufficientBudget && !fuseTriggered,
    messages,
  };
}

export function buildCommissionBudgetSnapshot(
  config: CommissionBudgetConfigInput,
  context: CommissionBudgetContextInput = {},
  amounts: CommissionBudgetAmountInput = {},
): CommissionBudgetSnapshot {
  const normalizedConfig = normalizeCommissionBudgetConfig(config);
  const consumedAmount = normalizeBudgetNumber(amounts.consumedAmount);
  const frozenAmount = normalizeBudgetNumber(amounts.frozenAmount);
  const releasedAmount = normalizeBudgetNumber(amounts.releasedAmount);
  const occupiedAmount = normalizeBudgetNumber(consumedAmount + frozenAmount - releasedAmount);
  const levelKey = `L${context.targetLevelId ?? context.currentLevelId ?? 'UNKNOWN'}`;
  const channelKey = context.shareChannel?.trim() || 'UNKNOWN';
  const versionKey = context.activityVersionId?.trim() || 'UNKNOWN';

  return {
    budgetTotal: normalizedConfig.budgetTotal,
    budgetFrozen: frozenAmount,
    budgetConsumed: consumedAmount,
    budgetReleased: releasedAmount,
    budgetByLevel: createBudgetBucket(levelKey, occupiedAmount),
    budgetByChannel: createBudgetBucket(channelKey, occupiedAmount),
    budgetByActivityVersion: createBudgetBucket(versionKey, occupiedAmount),
    budgetAlertThreshold: normalizedConfig.budgetAlertThreshold,
    budgetFuseThreshold: normalizedConfig.budgetFuseThreshold,
  };
}

function createBudgetBucket(key: string, amount: number): Record<string, number> {
  return {
    [key]: amount,
  };
}

function normalizeBudgetNumber(value: number | null | undefined, fallback = 0): number {
  if (value == null) {
    return fallback;
  }
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Number(value.toFixed(2));
}

/**
 * 佣金校验服务
 *
 * @description
 * 自购检测、黑名单校验、限额校验、循环推荐检测
 *
 * @architecture A-T2: 循环推荐检测通过 MemberQueryPort 实现
 */
@Injectable()
export class CommissionValidatorService {
  private readonly logger = new Logger(CommissionValidatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memberQueryPort: MemberQueryPort,
    private readonly tenantHelper: TenantHelper,
  ) {}

  normalizeBudgetConfig(input?: CommissionBudgetConfigInput | null): Required<CommissionBudgetConfigInput> {
    return normalizeCommissionBudgetConfig(input);
  }

  validateBudgetContext(
    config: CommissionBudgetConfigInput,
    context: CommissionBudgetContextInput = {},
    amounts: CommissionBudgetAmountInput = {},
  ): CommissionBudgetValidationResult {
    return validateCommissionBudgetContext(config, context, amounts);
  }

  buildBudgetSnapshot(
    config: CommissionBudgetConfigInput,
    context: CommissionBudgetContextInput = {},
    amounts: CommissionBudgetAmountInput = {},
  ): CommissionBudgetSnapshot {
    return buildCommissionBudgetSnapshot(config, context, amounts);
  }

  /**
   * 检查是否自购 (不返佣)
   */
  checkSelfPurchase(memberId: string, shareUserId: string | null, parentId: string | null): boolean {
    // 情况1: 订单会员 === 分享人
    if (shareUserId && memberId === shareUserId) {
      return true;
    }
    // 情况2: 订单会员 === 上级 (绑定关系)
    if (parentId && memberId === parentId) {
      return true;
    }
    return false;
  }

  /**
   * 检查用户是否在黑名单中
   */
  async isUserBlacklisted(tenantId: string, userId: string): Promise<boolean> {
    const entry = await this.prisma.sysDistBlacklist.findFirst({
      where: this.tenantHelper.readWhereForDelegate('sysDistBlacklist', {
        tenantId,
        userId,
      } as object) as Prisma.SysDistBlacklistWhereInput,
    });
    return !!entry;
  }

  /**
   * 检查跨店日限额
   *
   * @description
   * 使用专门的计数器表(fin_user_daily_quota)防止并发超限
   *
   * 改进点：
   * - 使用 upsert + increment 原子操作，避免 SELECT SUM FOR UPDATE 的首笔并发漏洞
   * - 锁定具体用户配额行，而非聚合结果
   * - 支持回滚（超限时不更新）
   *
   * @param tenantId - 租户ID
   * @param beneficiaryId - 受益人ID
   * @param amount - 本次佣金金额
   * @param limit - 日限额
   * @returns 是否在限额内
   *
   * @concurrency 使用 Prisma upsert 的原子性保证并发安全
   * @performance 锁定范围仅限单个用户单日配额记录
   */
  async checkDailyLimit(tenantId: string, beneficiaryId: string, amount: Decimal, limit: Decimal): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      // 用事务封装"读当前值 → 判断 → 条件写入"，消除两步操作之间的并发窗口。
      // RepeatableRead 保证事务内两次读到同一快照，配合 updateMany 的 WHERE 条件实现原子 CAS。
      return await this.prisma.$transaction(
        async (tx) => {
          const key = { tenantId, beneficiaryId, quotaDate: today };

          // 确保行存在（首次当天用量）
          await tx.finUserDailyQuota.upsert({
            where: { tenantId_beneficiaryId_quotaDate: key },
            create: { ...key, usedAmount: new Decimal(0), limitAmount: limit },
            update: {},
          });

          // 原子 CAS：仅在 usedAmount + amount <= limit 时才增加，否则 count=0
          // updateMany 的 WhereInput 不支持复合唯一键简写，需展开为独立字段
          const updated = await tx.finUserDailyQuota.updateMany({
            where: {
              tenantId,
              beneficiaryId,
              quotaDate: today,
              usedAmount: { lte: limit.sub(amount) },
            },
            data: { usedAmount: { increment: amount } },
          });

          const pass = updated.count > 0;

          this.logger.debug(
            `[DailyLimit] tenant=${tenantId}, user=${beneficiaryId}, ` +
              `attempted=${amount.toFixed(2)}, limit=${limit.toFixed(2)}, pass=${pass}`,
          );

          if (!pass) {
            this.logger.warn(
              `[DailyLimit] Quota exceeded: tenant=${tenantId}, user=${beneficiaryId}, ` +
                `attempted=${amount.toFixed(2)}, limit=${limit.toFixed(2)}`,
            );
          }

          return pass;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    } catch (error) {
      this.logger.error(`[DailyLimit] Error checking limit: ${error instanceof Error ? error.message : String(error)}`);
      // 查询异常时保守拒绝，避免超限
      return false;
    }
  }

  /**
   * 检查循环推荐（绑定推荐人时调用）
   *
   * @description
   * 通过 MemberQueryPort 实现，解耦对 umsMember 的直接访问
   *
   * @architecture A-T2
   */
  async checkCircularReferral(memberId: string, parentId: string): Promise<boolean> {
    return this.memberQueryPort.checkCircularReferral(memberId, parentId);
  }
}
