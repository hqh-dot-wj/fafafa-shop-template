import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { CommissionStatus, TransType } from '@prisma/client';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { CommissionRepository } from '../commission.repository';
import { WalletService } from '../../wallet/wallet.service';

/**
 * 佣金结算服务
 * 职责：佣金取消、回滚、结算时间更新
 */
@Injectable()
export class CommissionSettlerService {
  private readonly logger = new Logger(CommissionSettlerService.name);

  constructor(
    private readonly commissionRepo: CommissionRepository,
    private readonly walletService: WalletService,
  ) {}

  /**
   * 查询订单佣金列表
   */
  async getCommissionsByOrder(orderId: string) {
    return this.commissionRepo.findMany({
      where: { orderId },
      include: {
        beneficiary: {
          select: {
            memberId: true,
            nickname: true,
            avatar: true,
            mobile: true,
          },
        },
      },
    });
  }

  /**
   * 取消订单佣金 (退款时调用)
   *
   * @param orderId 订单ID
   * @param itemIds 可选,指定要退款的商品ID列表,支持部分退款
   *
   * @description
   * - 全额退款: 不传 itemIds,取消所有佣金
   * - 部分退款: 传入 itemIds,仅取消对应商品的佣金
   */
  @Transactional()
  async cancelCommissions(orderId: string, itemIds?: number[]) {
    // 构建查询条件
    type WhereCondition = {
      orderId: string;
      orderItemId?: { in: number[] };
    };

    const where: WhereCondition = { orderId };
    if (itemIds && itemIds.length > 0) {
      // 部分退款: 仅查询指定商品的佣金
      where.orderItemId = { in: itemIds };
    }

    const commissions = await this.commissionRepo.findMany({ where });

    if (commissions.length === 0) {
      this.logger.warn(`No commissions found for order ${orderId}${itemIds ? ` with items ${itemIds.join(',')}` : ''}`);
      return;
    }

    // 每条佣金可能触发独立钱包回滚副作用，必须按顺序处理并保留首个失败语义。
    for (const comm of commissions) {
      await this.cancelSingleCommission(comm);
    }

    this.logger.log(
      `Cancelled ${commissions.length} commissions for order ${orderId}${itemIds ? ` (items: ${itemIds.join(',')})` : ' (full refund)'}`,
    );
  }

  /**
   * 部分退款佣金回滚。
   *
   * 当前数据模型没有“部分保留佣金”的独立状态，本方法延续历史行为：订单发生部分退款后取消该订单有效佣金，
   * 对已结算佣金仅按退款比例回退钱包金额，避免业务侧直接写 `fin_commission` 或 `fin_wallet`。
   */
  @Transactional()
  async cancelCommissionsForPartialRefund(orderId: string, refundRatio: Decimal, relatedId: string = orderId) {
    BusinessException.throwIf(
      !refundRatio || refundRatio.lte(0) || refundRatio.gt(1),
      '退款比例必须大于0且不超过1',
      ResponseCode.PARAM_INVALID,
    );

    const commissions = await this.commissionRepo.findMany({
      where: {
        orderId,
        status: { not: CommissionStatus.CANCELLED },
      },
    });

    if (commissions.length === 0) {
      this.logger.warn(`No active commissions found for partial refund order ${orderId}`);
      return;
    }

    // 部分退款同样可能逐条触发钱包回退，不能用批量 updateMany 掩盖单条失败。
    for (const commission of commissions) {
      await this.cancelSinglePartialRefundCommission(orderId, commission, refundRatio, relatedId);
    }

    this.logger.log(`Cancelled ${commissions.length} commissions for partial refund order ${orderId}`);
  }

  /**
   * 单条佣金取消。冻结佣金只改佣金状态，已结算佣金还要触发钱包回滚。
   */
  private async cancelSingleCommission(commission: {
    beneficiaryId: string;
    amount: Decimal;
    orderId: string;
    id: string | bigint;
    status: CommissionStatus;
  }) {
    if (commission.status === CommissionStatus.FROZEN) {
      await this.commissionRepo.update(commission.id, { status: CommissionStatus.CANCELLED });
    } else if (commission.status === CommissionStatus.SETTLED) {
      await this.rollbackCommission(commission);
    }
  }

  private async cancelSinglePartialRefundCommission(
    orderId: string,
    commission: {
      beneficiaryId: string;
      amount: Decimal;
      originalAmount: Decimal | null;
      id: string | bigint;
      status: CommissionStatus;
    },
    refundRatio: Decimal,
    relatedId: string,
  ) {
    // 应扣金额以 originalAmount × refundRatio 为基准，避免按"当前剩余"算 ratio 导致多次部分退款累计偏小。
    // refundRatio 在上游始终是「这一笔退款 / 原订单 payAmount」（store-order.service.ts:629），与 originalAmount 同维度。
    // 历史数据 originalAmount 可能为 null（迁移前佣金），fallback 到 amount——这些佣金按设计不会再触发部分退款。
    const baseAmount = commission.originalAmount ?? commission.amount;
    const idealDeduct = baseAmount.mul(refundRatio).toDecimalPlaces(2);
    // 防御性 cap：实际应扣不能超过当前剩余金额（多次部分退款累计可能逼近上限）。
    const refundCommissionAmount = Decimal.min(idealDeduct, commission.amount).toDecimalPlaces(2);
    const remainingAmount = commission.amount.sub(refundCommissionAmount).toDecimalPlaces(2);

    if (remainingAmount.lt(0.01)) {
      // 剩余 < 1 分，视为全部回收，直接取消
      await this.commissionRepo.update(commission.id, { status: CommissionStatus.CANCELLED });
    } else {
      // 退款只覆盖部分佣金：保留记录，仅减去对应金额，剩余继续冻结/结算
      await this.commissionRepo.update(commission.id, { amount: remainingAmount });
      this.logger.log(
        `[部分退款] 佣金 #${commission.id} 扣减 ${refundCommissionAmount}，剩余 ${remainingAmount}（仍 ${commission.status}）`,
      );
    }

    if (commission.status === CommissionStatus.SETTLED && refundCommissionAmount.gt(0)) {
      await this.walletService.reverseSettledCommissionForOrderRefund(
        commission.beneficiaryId,
        refundCommissionAmount,
        relatedId,
        `订单${orderId}部分退款回退已结算佣金(佣金#${commission.id})`,
      );
    }
  }

  /**
   * 回滚已结算佣金
   *
   * @description
   * C-T4: 使用 deductBalanceOrPendingRecovery 支持余额不足场景
   * 当余额不足时，差额记入待回收台账，不会导致回滚失败
   */
  @Transactional()
  private async rollbackCommission(commission: {
    beneficiaryId: string;
    amount: Decimal;
    orderId: string;
    id: string | bigint;
  }) {
    // 扣减余额或记入待回收（不会因余额不足而失败）
    const { deducted, pendingRecovery } = await this.walletService.deductBalanceOrPendingRecovery(
      commission.beneficiaryId,
      commission.amount,
      commission.orderId,
      `订单退款，佣金回收`,
      TransType.REFUND_DEDUCT,
    );

    if (pendingRecovery.gt(0)) {
      this.logger.warn(`[佣金回滚] 佣金 ${commission.id} 部分回收: 扣减 ${deducted}, 待回收 ${pendingRecovery}`);
    }

    // 更新佣金状态
    await this.commissionRepo.update(commission.id, { status: CommissionStatus.CANCELLED });
  }

  /**
   * 按订单项ID取消佣金（单品退款场景）
   *
   * @param orderId - 订单ID
   * @param orderItemId - 退款的订单项ID
   *
   * @description
   * 活动佣金（commissionRuleSource === 'ACTIVITY_FIXED_RATE'）和普通佣金回滚逻辑一致：
   * 冻结中直接取消，已结算倒扣余额。
   */
  @Transactional()
  async cancelByOrderItemId(orderId: string, orderItemId: number) {
    return this.cancelCommissions(orderId, [orderItemId]);
  }

  /**
   * 更新计划结算时间 (订单确认收货/核销时调用)
   */
  async updatePlanSettleTime(orderId: string, eventType: 'CONFIRM' | 'VERIFY') {
    const commissions = await this.commissionRepo.findMany({
      where: {
        orderId,
        status: 'FROZEN',
      },
    });

    if (commissions.length === 0) return;

    const now = new Date();
    let planSettleTime: Date;

    if (eventType === 'VERIFY') {
      // 服务核销: T+1 (24小时后)
      planSettleTime = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    } else {
      // 实物确认收货: T+7 (7天后)
      planSettleTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    // 批量更新
    await this.commissionRepo.updateMany(
      {
        orderId,
        status: CommissionStatus.FROZEN,
      },
      {
        planSettleTime,
      },
    );

    this.logger.log(`Updated settlement time for order ${orderId} to ${planSettleTime.toISOString()}`);
  }
}
