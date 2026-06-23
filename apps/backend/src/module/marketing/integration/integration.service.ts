import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PointsDebtReason, PointsDebtStatus, PointsTransactionType, Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { Result } from 'src/common/response/result';
import { PrismaService } from 'src/prisma/prisma.service';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { RedisService } from 'src/module/common/redis/redis.service';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { CouponUsageService } from '../coupon/usage/usage.service';
import { PointsAccountService } from '../points/account/account.service';
import { PointsRuleService } from '../points/rule/rule.service';
import { PointsGracefulDegradationService } from '../points/degradation/degradation.service';
import { CalculateDiscountDto } from './dto/calculate-discount.dto';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { ORDER_SERVICE, OrderServiceContract } from 'src/module/client/order/order-service.token';
import { MessageTouchpointDispatcher } from '../events/message-touchpoint.dispatcher';
import { MarketingEventType } from '../events/marketing-event.types';
import { PlayInstanceService } from '../instance/instance.service';
import { IdempotencyActions } from 'src/common/idempotency/actions';
import { buildIdempotencyKey, redisIdempotencyKey } from 'src/common/idempotency/keys';
import { ShareTokenService } from 'src/module/store/distribution/services/share-token.service';

export interface OrderRefundIntegrationOptions {
  /** 本次退款单号或外部退款引用，只用于退款事件幂等，不替代积分 lot 的原订单 relatedId。 */
  refundReferenceId?: string;
  /** 本次应原路返还的已抵扣积分；不传时保持全量退款旧语义。 */
  refundPointsAmount?: number;
  /** 本次应扣回消费赠送积分的比例；不传时保持全量扣回旧语义。 */
  earnedPointsClawbackRatio?: number;
  /** 是否退回订单优惠券；部分退款默认由调用方显式控制。 */
  refundCoupon?: boolean;
  partialRefund?: boolean;
}

interface OrderPaidIntegrationEvent {
  orderId: string;
  memberId: string;
  payAmount: number;
  userCouponId: string | null;
  pointsUsed: number;
  earnedPoints: number;
}

/**
 * 订单集成服务
 *
 * @description 处理订单与优惠券、积分的集成逻辑
 */
@Injectable()
export class OrderIntegrationService {
  private readonly logger = new Logger(OrderIntegrationService.name);
  /** 幂等键在 Redis 中的存活时间（秒），防止同一订单事件被重复处理 */
  private readonly idempotencyTtlSeconds = 600;
  /** 订单事件处理分布式锁的超时时间（ms） */
  private readonly lockTtlMs = 30 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly redisService: RedisService,
    private readonly couponUsageService: CouponUsageService,
    private readonly pointsAccountService: PointsAccountService,
    private readonly pointsRuleService: PointsRuleService,
    private readonly degradationService: PointsGracefulDegradationService,
    private readonly messageTouchpointDispatcher: MessageTouchpointDispatcher,
    @Inject(ORDER_SERVICE)
    private readonly orderService: OrderServiceContract,
    private readonly tenantHelper: TenantHelper,
    @Inject(forwardRef(() => PlayInstanceService))
    private readonly playInstanceService: PlayInstanceService,
    private readonly shareTokenService: ShareTokenService,
  ) {}

  /**
   * 计算订单优惠（优惠券+积分）
   *
   * @param memberId 用户ID
   * @param dto 计算参数
   * @returns 优惠计算结果
   */
  async calculateOrderDiscount(memberId: string, dto: CalculateDiscountDto) {
    // 1. 计算订单原价
    const originalAmount = dto.items.reduce(
      (sum, item) => sum.add(new Decimal(String(item.price)).mul(item.quantity)),
      new Decimal(0),
    );

    let couponDiscount = new Decimal(0);
    let pointsDiscount = new Decimal(0);
    let couponName: string | null = null;
    let finalAmount = originalAmount;

    // 2. 计算优惠券抵扣
    if (dto.userCouponId) {
      const discount = await this.couponUsageService.calculateDiscount(dto.userCouponId, originalAmount.toNumber());

      couponDiscount = new Decimal(String(discount));

      // 获取优惠券名称
      const coupon = await this.prisma.mktUserCoupon.findFirst({
        where: this.tenantHelper.readWhereForDelegate('mktUserCoupon', {
          id: dto.userCouponId,
        }) as Prisma.MktUserCouponWhereInput,
      });
      couponName = coupon?.couponName || null;

      finalAmount = finalAmount.sub(couponDiscount);
    }

    // 3. 计算积分抵扣
    if (dto.pointsUsed && dto.pointsUsed > 0) {
      // 业务决策 A2：maxDiscountPercentOrder 的基数为订单原价，
      // 由 validatePointsUsage 内部按 originalAmount × pct - couponDiscount 计算积分可用上限，
      // 避免券 + 积分组合抵扣穿透"总抵扣不超过原价 X%" 的护栏
      await this.pointsRuleService.validatePointsUsage(dto.pointsUsed, originalAmount, couponDiscount);

      // 计算积分抵扣金额
      const discount = await this.pointsRuleService.calculatePointsDiscount(dto.pointsUsed);
      pointsDiscount = discount;
      finalAmount = finalAmount.sub(pointsDiscount);
    }

    // 4. 确保最终金额不为负数
    if (finalAmount.lt(0)) {
      finalAmount = new Decimal(0);
    }

    const totalDiscount = couponDiscount.add(pointsDiscount);

    this.logger.log(
      `订单优惠计算: memberId=${memberId}, original=${originalAmount.toFixed(2)}, coupon=${couponDiscount.toFixed(2)}, points=${pointsDiscount.toFixed(2)}, final=${finalAmount.toFixed(2)}`,
    );

    // 该函数为 checkout preview 上的纯算价路径，前端每次调整数量/选券都会触发；
    // INTEGRATION_ORDER_DISCOUNT_CALCULATED 事件改在订单真实创建/支付路径发射（见 recordOrderCreated / handleOrderPaid），
    // 避免触点编排被预览流量放大。设计依据：PR #23 review H1。
    return Result.ok({
      originalAmount: originalAmount.toNumber(),
      couponDiscount: couponDiscount.toNumber(),
      pointsDiscount: pointsDiscount.toNumber(),
      totalDiscount: totalDiscount.toNumber(),
      finalAmount: finalAmount.toNumber(),
      userCouponId: dto.userCouponId || null,
      pointsUsed: dto.pointsUsed || 0,
      couponName,
    });
  }

  async recordOrderCreated(
    orderId: string,
    memberId: string,
    options: { userCouponId?: string; pointsUsed?: number } = {},
  ) {
    this.logger.log(
      `记录订单创建事件: orderId=${orderId}, memberId=${memberId}, coupon=${options.userCouponId}, points=${options.pointsUsed}`,
    );

    return this.executeWithIdempotency('created', orderId, async () => {
      await this.emitIntegrationEvent(MarketingEventType.INTEGRATION_ORDER_CREATED, orderId, memberId, {
        userCouponId: options.userCouponId ?? null,
        pointsUsed: options.pointsUsed ?? 0,
      });
    });
  }

  /**
   * 订单支付成功时处理优惠券和积分
   *
   * @param orderId 订单ID
   * @param memberId 用户ID
   * @param payAmount 实付金额
   */
  async handleOrderPaid(orderId: string, memberId: string, payAmount: number) {
    this.logger.log(`处理订单支付: orderId=${orderId}, memberId=${memberId}, payAmount=${payAmount}`);

    return this.executeWithIdempotency('paid', orderId, async () => {
      try {
        const event = await this.persistOrderPaidEffects(orderId, memberId, payAmount);
        await this.emitOrderPaidIntegrationEventAfterCommit(event);
      } catch (error) {
        this.logger.error(
          `订单支付处理失败: orderId=${orderId}, error=${getErrorMessage(error)}`,
          getErrorStack(error),
        );
        throw error;
      }
    });
  }

  @Transactional()
  private async persistOrderPaidEffects(
    orderId: string,
    memberId: string,
    payAmount: number,
  ): Promise<OrderPaidIntegrationEvent> {
    // 查询订单信息（包含订单明细）
    const order = await this.orderService.findByIdForMarketing(orderId, true);

    if (!order) {
      BusinessException.throw(404, '订单不存在');
    }

    // 1. 使用优惠券
    if (order.userCouponId) {
      await this.couponUsageService.useCoupon(order.userCouponId, orderId, Number(order.couponDiscount));
      this.logger.log(`优惠券已使用: couponId=${order.userCouponId}`);
    }

    // 2. 结算冻结积分：直接把冻结分摊转成消费分摊，保留退款原路回退所需的 lot 归属。
    if (order.pointsUsed && order.pointsUsed > 0) {
      await this.pointsAccountService.settleFrozenPoints({
        memberId,
        amount: order.pointsUsed,
        type: PointsTransactionType.USE_ORDER,
        relatedId: orderId,
        remark: '订单抵扣',
      });

      this.logger.log(`积分已扣减: points=${order.pointsUsed}`);
    }

    // 3. 按商品明细计算并发放消费积分（防止积分套利）
    // 积分计算基数 = 原价 - 优惠券抵扣（不包括积分抵扣）
    const baseAmount = order.totalAmount.sub(order.couponDiscount);

    const itemsPointsResult = await this.pointsRuleService.calculateOrderPointsByItems(
      order.items.map((item) => ({
        skuId: item.skuId,
        price: item.price,
        quantity: item.quantity,
        pointsRatio: item.pointsRatio ?? 100,
      })),
      baseAmount,
      order.totalAmount,
    );

    // 计算总积分
    const totalPointsToEarn = itemsPointsResult.reduce((sum, item) => sum + item.earnedPoints, 0);

    await this.orderService.updateOrderPointsEarned(orderId, itemsPointsResult, totalPointsToEarn);

    // 发放积分
    if (totalPointsToEarn > 0) {
      try {
        await this.pointsAccountService.addPoints({
          memberId,
          amount: totalPointsToEarn,
          type: PointsTransactionType.EARN_ORDER,
          relatedId: orderId,
          remark: '消费获得',
        });

        this.logger.log(`消费积分已发放: points=${totalPointsToEarn}`);
      } catch (error) {
        // 积分发放失败，记录到降级服务进行重试
        this.logger.warn({
          message: '消费积分发放失败，已加入重试队列',
          orderId,
          memberId,
          pointsToEarn: totalPointsToEarn,
          error: getErrorMessage(error),
        });

        await this.degradationService.recordFailure({
          memberId,
          amount: totalPointsToEarn,
          type: PointsTransactionType.EARN_ORDER,
          relatedId: orderId,
          remark: '消费获得',
          failureReason: getErrorMessage(error),
        });

        // 不抛出错误，避免影响订单支付流程
        // 积分会通过重试队列异步发放
      }
    }

    await this.playInstanceService.handlePaymentSuccessById(orderId);
    await this.applyShareTokenOrderCountIncrement(orderId, memberId, order.tenantId, order.items ?? []);

    return {
      orderId,
      memberId,
      payAmount,
      userCouponId: order.userCouponId ?? null,
      pointsUsed: order.pointsUsed ?? 0,
      earnedPoints: totalPointsToEarn,
    };
  }

  private async emitOrderPaidIntegrationEventAfterCommit(event: OrderPaidIntegrationEvent): Promise<void> {
    try {
      await this.emitIntegrationEvent(MarketingEventType.INTEGRATION_ORDER_PAID, event.orderId, event.memberId, {
        payAmount: event.payAmount,
        userCouponId: event.userCouponId,
        pointsUsed: event.pointsUsed,
        earnedPoints: event.earnedPoints,
      });
    } catch (error) {
      this.logger.warn({
        message: '订单支付营销事件提交后发送失败，已保留订单处理幂等完成态',
        orderId: event.orderId,
        memberId: event.memberId,
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * 订单取消时处理优惠券和积分
   *
   * @param orderId 订单ID
   * @param memberId 用户ID
   */
  async handleOrderCancelled(orderId: string, memberId: string) {
    this.logger.log(`处理订单取消: orderId=${orderId}, memberId=${memberId}`);

    return this.executeWithIdempotency('cancelled', orderId, async () => {
      try {
        // 查询订单信息
        const order = await this.orderService.findByIdForMarketing(orderId, true);

        if (!order) {
          BusinessException.throw(404, '订单不存在');
        }

        // 1. 解锁优惠券
        if (order.userCouponId) {
          await this.couponUsageService.unlockCoupon(order.userCouponId, orderId);
          this.logger.log(`优惠券已解锁: couponId=${order.userCouponId}`);
        }

        // 2. 解冻积分
        if (order.pointsUsed && order.pointsUsed > 0) {
          await this.pointsAccountService.unfreezePoints(memberId, order.pointsUsed, orderId);
          this.logger.log(`积分已解冻: points=${order.pointsUsed}`);
        }

        await this.emitIntegrationEvent(MarketingEventType.INTEGRATION_ORDER_CANCELLED, orderId, memberId, {
          userCouponId: order.userCouponId ?? null,
          pointsUsed: order.pointsUsed ?? 0,
        });
      } catch (error) {
        this.logger.error(
          `订单取消处理失败: orderId=${orderId}, error=${getErrorMessage(error)}`,
          getErrorStack(error),
        );
        throw error;
      }
    });
  }

  /**
   * 订单退款时处理优惠券和积分
   *
   * @param orderId 订单ID
   * @param memberId 用户ID
   * @param options 本次退款的幂等引用和部分退款比例；未传时保持全量退款兼容行为
   */
  async handleOrderRefunded(orderId: string, memberId: string, options: OrderRefundIntegrationOptions = {}) {
    this.logger.log(`处理订单退款: orderId=${orderId}, memberId=${memberId}`);
    return this.executeWithIdempotency(
      'refunded',
      orderId,
      async () => {
        try {
          // 查询订单信息
          const order = await this.orderService.findByIdForMarketing(orderId, true);

          if (!order) {
            BusinessException.throw(404, '订单不存在');
          }

          // 1. 退还优惠券
          const shouldRefundCoupon = options.refundCoupon ?? true;
          if (shouldRefundCoupon && order.userCouponId) {
            await this.couponUsageService.refundCoupon(order.userCouponId, orderId);
            this.logger.log(`优惠券已退还: couponId=${order.userCouponId}`);
          }

          // 2. 退还积分
          const refundPointsAmount = this.resolveRefundPointsAmount(order.pointsUsed ?? 0, options.refundPointsAmount);
          if (refundPointsAmount > 0) {
            const refundResult = await this.pointsAccountService.refundSpentPoints({
              memberId,
              amount: refundPointsAmount,
              relatedId: orderId,
              remark: options.partialRefund ? '订单部分退款原路返还' : '订单退款原路返还',
            });

            const refundStrategy = refundResult.data?.ledger.strategy ?? 'NEW_REFUND_TRANSACTION';
            this.logger.log(`积分已退还: points=${refundPointsAmount}, strategy=${refundStrategy}`);
            if (refundStrategy === 'NEW_REFUND_TRANSACTION') {
              this.logger.warn(`积分退款策略风险: orderId=${orderId}, 历史消费缺少分摊记录，已创建补偿批次`);
            }
          }

          // 3. 扣减消费积分（如果已发放）
          const earnedPoints = await this.prisma.mktPointsTransaction.findFirst({
            where: this.tenantHelper.readWhereForDelegate('mktPointsTransaction', {
              memberId,
              type: PointsTransactionType.EARN_ORDER,
              relatedId: orderId,
              tenantId: order.tenantId,
            }) as Prisma.MktPointsTransactionWhereInput,
          });

          if (earnedPoints && earnedPoints.amount > 0) {
            const clawbackAmount = this.resolveEarnedPointsClawbackAmount(
              earnedPoints.amount,
              options.earnedPointsClawbackRatio,
            );
            if (clawbackAmount <= 0) {
              await this.applyShareTokenOrderCountDecrement(
                orderId,
                memberId,
                order.tenantId,
                order.items ?? [],
                options,
              );
              await this.emitIntegrationEvent(MarketingEventType.INTEGRATION_ORDER_REFUNDED, orderId, memberId, {
                userCouponId: shouldRefundCoupon ? (order.userCouponId ?? null) : null,
                refundPoints: refundPointsAmount,
                partialRefund: options.partialRefund ?? false,
                refundReferenceId: options.refundReferenceId ?? null,
                clawbackEarnedPoints: 0,
              });
              return;
            }
            const account = await this.prisma.mktPointsAccount.findFirst({
              where: this.tenantHelper.readWhereForDelegate('mktPointsAccount', {
                memberId,
                tenantId: order.tenantId,
              }) as Prisma.MktPointsAccountWhereInput,
              select: { id: true, availablePoints: true },
            });
            const availablePoints = account?.availablePoints ?? 0;

            if (availablePoints < clawbackAmount) {
              const deductedAmount = Math.max(0, availablePoints);
              if (deductedAmount > 0) {
                await this.pointsAccountService.deductPoints({
                  memberId,
                  amount: deductedAmount,
                  type: PointsTransactionType.DEDUCT_ADMIN,
                  relatedId: orderId,
                  remark: '订单退款部分扣减消费积分',
                });
              }

              const debtAmount = clawbackAmount - deductedAmount;
              await this.recordRefundClawbackDebt({
                tenantId: order.tenantId,
                accountId: account?.id ?? null,
                memberId,
                orderId,
                sourceTransactionId: earnedPoints.id,
                expectedAmount: clawbackAmount,
                deductedAmount,
                debtAmount,
                availableAtCreate: availablePoints,
              });
              this.logger.warn(
                `退款扣减消费积分存在欠账: orderId=${orderId}, memberId=${memberId}, deducted=${deductedAmount}, debt=${debtAmount}`,
              );
            } else {
              await this.pointsAccountService.deductPoints({
                memberId,
                amount: clawbackAmount,
                type: PointsTransactionType.DEDUCT_ADMIN,
                relatedId: orderId,
                remark: options.partialRefund ? '订单部分退款扣减消费积分' : '订单退款扣减消费积分',
              });

              this.logger.log(`消费积分已扣减: points=${clawbackAmount}`);
            }
          }

          await this.applyShareTokenOrderCountDecrement(orderId, memberId, order.tenantId, order.items ?? [], options);
          await this.emitIntegrationEvent(MarketingEventType.INTEGRATION_ORDER_REFUNDED, orderId, memberId, {
            userCouponId: shouldRefundCoupon ? (order.userCouponId ?? null) : null,
            refundPoints: refundPointsAmount,
            partialRefund: options.partialRefund ?? false,
            refundReferenceId: options.refundReferenceId ?? null,
            clawbackEarnedPoints: this.resolveEarnedPointsClawbackAmount(
              earnedPoints?.amount ?? 0,
              options.earnedPointsClawbackRatio,
            ),
          });
        } catch (error) {
          this.logger.error(
            `订单退款处理失败: orderId=${orderId}, error=${getErrorMessage(error)}`,
            getErrorStack(error),
          );
          throw error;
        }
      },
      options.refundReferenceId,
    );
  }

  private async recordRefundClawbackDebt(input: {
    tenantId: string;
    accountId: string | null;
    memberId: string;
    orderId: string;
    sourceTransactionId: string;
    expectedAmount: number;
    deductedAmount: number;
    debtAmount: number;
    availableAtCreate: number;
  }): Promise<void> {
    const reason = PointsDebtReason.ORDER_REFUND_CLAWBACK_INSUFFICIENT;
    const status = this.resolvePointsDebtStatus(input.debtAmount, input.deductedAmount);

    await this.prisma.mktPointsDebt.upsert({
      where: {
        tenantId_memberId_relatedId_reason: {
          tenantId: input.tenantId,
          memberId: input.memberId,
          relatedId: input.orderId,
          reason,
        },
      },
      create: {
        tenantId: input.tenantId,
        accountId: input.accountId,
        memberId: input.memberId,
        sourceTransactionId: input.sourceTransactionId,
        relatedId: input.orderId,
        relatedType: 'ORDER',
        reason,
        status,
        expectedAmount: input.expectedAmount,
        deductedAmount: input.deductedAmount,
        debtAmount: input.debtAmount,
        availableAtCreate: input.availableAtCreate,
        remark: '订单退款扣回赠送积分时余额不足',
      },
      update: {
        accountId: input.accountId,
        sourceTransactionId: input.sourceTransactionId,
        status,
        expectedAmount: input.expectedAmount,
        deductedAmount: input.deductedAmount,
        debtAmount: input.debtAmount,
        availableAtCreate: input.availableAtCreate,
        remark: '订单退款扣回赠送积分时余额不足',
      },
    });
  }

  private resolvePointsDebtStatus(debtAmount: number, deductedAmount: number) {
    if (debtAmount <= 0) return PointsDebtStatus.RESOLVED;
    if (deductedAmount > 0) return PointsDebtStatus.PARTIAL;
    return PointsDebtStatus.OPEN;
  }

  private resolveRefundPointsAmount(orderPointsUsed: number, requestedAmount?: number): number {
    const total = Math.max(0, Math.trunc(orderPointsUsed));
    if (typeof requestedAmount !== 'number' || !Number.isFinite(requestedAmount)) {
      return total;
    }
    return Math.min(total, Math.max(0, Math.trunc(requestedAmount)));
  }

  private resolveEarnedPointsClawbackAmount(earnedPoints: number, ratio?: number): number {
    const total = Math.max(0, Math.trunc(earnedPoints));
    if (typeof ratio !== 'number' || !Number.isFinite(ratio)) {
      return total;
    }
    const normalizedRatio = Math.min(1, Math.max(0, ratio));
    return Math.min(total, Math.max(0, Math.floor(total * normalizedRatio)));
  }

  private async applyShareTokenOrderCountIncrement(
    orderId: string,
    memberId: string,
    tenantId: string,
    items: Array<{ id: number }>,
  ): Promise<void> {
    const sids = await this.resolveOrderItemSids(tenantId, items);
    if (sids.length === 0) return;
    // 多个 sid 互不依赖，使用 allSettled 并行；任一 sid 失败不阻断其他 sid 计数（已有事件日志兜底）
    const results = await Promise.allSettled(
      sids.map((sid) =>
        this.shareTokenService.applySidOrderCountIncrement(sid, {
          tenantId,
          orderId,
          memberId,
          eventLog: true,
        }),
      ),
    );
    this.logShareTokenSidErrors('increment', orderId, results, sids);
  }

  private async applyShareTokenOrderCountDecrement(
    orderId: string,
    memberId: string,
    tenantId: string,
    items: Array<{ id: number }>,
    options: OrderRefundIntegrationOptions,
  ): Promise<void> {
    if (options.partialRefund) return;
    const sids = await this.resolveOrderItemSids(tenantId, items);
    if (sids.length === 0) return;
    const results = await Promise.allSettled(
      sids.map((sid) =>
        this.shareTokenService.applySidOrderCountDecrement(sid, {
          tenantId,
          orderId,
          memberId,
          eventLog: true,
        }),
      ),
    );
    this.logShareTokenSidErrors('decrement', orderId, results, sids);
  }

  private logShareTokenSidErrors(
    action: 'increment' | 'decrement',
    orderId: string,
    results: PromiseSettledResult<unknown>[],
    sids: string[],
  ): void {
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        this.logger.warn({
          message: `分享 sid ${action} 失败`,
          orderId,
          sid: sids[idx],
          error: getErrorMessage(result.reason),
        });
      }
    });
  }

  private async resolveOrderItemSids(tenantId: string, items: Array<{ id: number }>): Promise<string[]> {
    const orderItemIds = [...new Set(items.map((item) => item.id).filter((id) => Number.isInteger(id)))];
    if (orderItemIds.length === 0) return [];

    const rows = await this.prisma.omsOrderItemAttribution.findMany({
      where: this.tenantHelper.readWhereForDelegate('omsOrderItemAttribution', {
        tenantId,
        orderItemId: { in: orderItemIds },
      }) as Prisma.OmsOrderItemAttributionWhereInput,
      select: {
        entryContextSnapshot: true,
      },
    });

    const sids = new Set<string>();
    for (const row of rows) {
      const sid = this.readSidFromEntryContext(row.entryContextSnapshot);
      if (sid) sids.add(sid);
    }
    return [...sids];
  }

  private readSidFromEntryContext(value: unknown): string | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const sid = (value as Record<string, unknown>).sid;
    return typeof sid === 'string' && sid.trim() ? sid.trim() : null;
  }

  /**
   * 以幂等方式执行订单事件处理逻辑：
   * 1. 获取分布式锁（同一事件同一订单同一时刻只有一个实例处理）
   * 2. 启动心跳：每 lockTtlMs/3 续锁一次，避免 handler 长跑导致锁 TTL 过期被他人抢入
   * 3. 先读幂等键：value='done' 说明上次已成功，直接跳过
   * 4. 写入 in-flight 标记（TTL 与锁同寿），handler 成功后再写入正式 'done' key
   *
   * 不再"先 SET NX 占位再执行 handler"：进程被 SIGKILL/OOM 时无 catch 执行，
   * 残留的幂等键会让 Bull retry 误判为已处理。改为"成功后再标记"，崩溃时短 TTL 的
   * in-flight 自然过期，允许重试；handler 抛错时显式 DEL 立即释放。
   */
  private async executeWithIdempotency(
    eventType: 'created' | 'paid' | 'cancelled' | 'refunded',
    orderId: string,
    handler: () => Promise<void>,
    subId?: string,
  ): Promise<void> {
    const idemKey = buildIdempotencyKey(
      'order',
      IdempotencyActions.order[eventType],
      orderId,
      subId?.trim() || undefined,
    );
    const redisKey = redisIdempotencyKey(idemKey);
    const lockKey = `lock:${redisKey}`;
    const lockToken = await this.redisService.tryLock(lockKey, this.lockTtlMs);
    if (!lockToken) {
      this.logger.warn(`订单事件处理锁未获取，已跳过: event=${eventType}, orderId=${orderId}`);
      return;
    }

    // 心跳续锁：handler 真实耗时 > lockTtlMs 时也不会被他人抢入
    const heartbeatMs = Math.max(1000, Math.floor(this.lockTtlMs / 3));
    const heartbeat = setInterval(() => {
      this.redisService.renewLock(lockKey, lockToken, this.lockTtlMs).catch((error) => {
        this.logger.warn(
          `订单事件处理锁续租失败: event=${eventType}, orderId=${orderId}, error=${getErrorMessage(error)}`,
        );
      });
    }, heartbeatMs);

    try {
      const existing = await this.redisService.getClient().get(redisKey);
      if (existing === 'done') {
        this.logger.warn(`重复订单事件已忽略: event=${eventType}, orderId=${orderId}`);
        return;
      }

      const inflightTtlSeconds = Math.max(1, Math.ceil(this.lockTtlMs / 1000));
      await this.redisService.getClient().set(redisKey, 'inflight', 'EX', inflightTtlSeconds);

      try {
        await handler();
        await this.redisService.getClient().set(redisKey, 'done', 'EX', this.idempotencyTtlSeconds);
      } catch (error) {
        await this.redisService.del(redisKey);
        throw error;
      }
    } finally {
      clearInterval(heartbeat);
      try {
        await this.redisService.unlock(lockKey, lockToken);
      } catch (error) {
        this.logger.warn(
          `订单事件处理释放锁失败: event=${eventType}, orderId=${orderId}, error=${getErrorMessage(error)}`,
        );
      }
    }
  }

  /** 发送订单集成事件，携带租户/会员上下文及订单相关 payload */
  private async emitIntegrationEvent(
    type: MarketingEventType,
    orderId: string,
    memberId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.messageTouchpointDispatcher.dispatch({
      type,
      tenantId: TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID,
      instanceId: orderId,
      configId: 'integration.order',
      memberId,
      payload,
      timestamp: new Date(),
    });
  }
}
