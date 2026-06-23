import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException } from 'src/common/exceptions';
import { PrepayDto } from './dto/payment.dto';
import { FinRefundType, OrderStatus, PayStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ResponseCode } from 'src/common/response';
import { DelFlagEnum } from 'src/common/enum';
import { FinanceCommandPort } from '../../finance/ports/finance-command.port';
import { OrderRepository } from '../order/order.repository';
import { PaymentGatewayPort } from 'src/module/payment/ports/payment-gateway.port';
import { PrismaService } from 'src/prisma/prisma.service';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { FulfillmentService } from 'src/module/fulfillment/fulfillment.service';
import { OrderDomainEventPublisher } from '../order/events/order-domain-event.publisher';
import { FinRefundService } from 'src/module/finance/refund/fin-refund.service';
import { OrderRefundFinalizerService } from '../order/refund/order-refund-finalizer.service';
import { getErrorMessage } from 'src/common/utils/error';
import { RefundRetryQueueService } from './refund-retry.queue';

type PaymentOrder = NonNullable<Awaited<ReturnType<OrderRepository['findById']>>>;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderRepo: OrderRepository,
    private readonly financeCommandPort: FinanceCommandPort,
    private readonly orderEventPublisher: OrderDomainEventPublisher,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly finRefundService: FinRefundService,
    private readonly orderRefundFinalizer: OrderRefundFinalizerService,
    private readonly refundRetryQueue: RefundRetryQueueService,
    private readonly configService: ConfigService,
    private readonly fulfillmentService: FulfillmentService,
  ) {}

  /**
   * 预下单，获取支付参数
   *
   * 委托 PaymentGatewayPort：测试环境返回 Mock，生产环境调用微信 JSAPI 统一下单
   */
  async prepay(memberId: string, dto: PrepayDto) {
    const order = await this.orderRepo.findOne({
      id: dto.orderId,
      memberId,
    });

    BusinessException.throwIfNull(order, '订单不存在');
    BusinessException.throwIf(
      order.status !== OrderStatus.PENDING_PAY || order.payStatus !== PayStatus.UNPAID,
      '订单状态不正确',
    );

    const openId = (order as { openId?: string }).openId ?? '';
    const settlementProfile = await this.financeCommandPort.ensureTenantSettlementProfile(order.tenantId);
    return this.paymentGateway.prepay({
      orderSn: order.orderSn,
      amount: order.payAmount,
      description: `订单${order.orderSn}`,
      openId,
      profitSharing: settlementProfile.enabled && settlementProfile.defaultChannel === 'WECHAT_PROFITSHARING',
    });
  }

  /**
   * 支付回调处理
   *
   * 委托 PaymentGatewayPort.handleCallback 验签，验签通过后执行业务逻辑
   * 非法签名返回 FAIL，不更新订单（AC-2）
   */
  async handleCallback(headers: Record<string, string>, body: string) {
    const payload = await this.paymentGateway.handleCallback(headers, body);
    BusinessException.throwIf(
      !payload.orderSn || !payload.transactionId,
      '支付回调数据缺失',
      ResponseCode.PARAM_INVALID,
    );

    const order = await this.orderRepo.findBySn(payload.orderSn);
    BusinessException.throwIfNull(order, '订单不存在');
    return this.processPaymentSuccess(order.id, payload.transactionId, payload.payAmount);
  }

  async handleRefundCallback(headers: Record<string, string>, body: string) {
    const payload = await this.paymentGateway.handleRefundCallback(headers, body);
    BusinessException.throwIf(!payload.refundSn, '退款回调数据缺失', ResponseCode.PARAM_INVALID);

    const refund = await this.finRefundService.recordNotifyResult({
      refundSn: payload.refundSn,
      refundId: payload.refundId,
      status: payload.status,
      amount: payload.amount,
      payerRefundAmount: payload.payerRefundAmount,
      settlementRefundAmount: payload.settlementRefundAmount,
      refundFeeAmount: payload.refundFeeAmount,
      discountRefundAmount: payload.discountRefundAmount,
      netAmount: payload.netAmount,
      successTime: payload.successTime,
      rawPayload: payload.rawPayload as Prisma.InputJsonValue | undefined,
      operator: 'payment-refund-callback',
    });

    await this.orderRefundFinalizer.finalize(refund);

    return { status: refund.status };
  }

  /**
   * 模拟支付成功 (Dev Only)
   */
  async mockSuccess(memberId: string, orderId: string) {
    const isProd = this.configService.get<string>('NODE_ENV', process.env.NODE_ENV || 'development') === 'production';
    const allowMockSuccess = this.parseBoolean(this.configService.get<string>('PAYMENT_ENABLE_MOCK_SUCCESS'), !isProd);
    BusinessException.throwIf(
      !allowMockSuccess,
      '当前环境未启用 mock-success，请走真实支付回调链路',
      ResponseCode.PERMISSION_DENIED,
    );

    const order = await this.orderRepo.findOne({
      id: orderId,
      memberId,
    });

    BusinessException.throwIfNull(order, '订单不存在');

    return this.processPaymentSuccess(orderId, 'mock_trans_' + Date.now(), order.payAmount.toNumber());
  }

  /**
   * 处理支付成功逻辑 (核心)
   */
  private async processPaymentSuccess(orderId: string, transactionId: string, payAmount: number) {
    const order = await this.orderRepo.findById(orderId);
    BusinessException.throwIfNull(order, '订单不存在');
    BusinessException.throwIf(!Number.isFinite(payAmount), '支付回调金额无效', ResponseCode.PARAM_INVALID);
    const orderPayAmount = order.payAmount;
    const callbackPayAmount = new Decimal(String(payAmount));
    BusinessException.throwIf(
      !callbackPayAmount.eq(orderPayAmount),
      `支付金额校验失败，订单应付 ${orderPayAmount.toFixed(2)}，回调金额 ${callbackPayAmount.toFixed(2)}`,
      ResponseCode.BUSINESS_ERROR,
    );
    const orderPayAmountForEvent = orderPayAmount.toNumber();

    if (order.status === OrderStatus.CANCELLED) {
      return this.refundCancelledOrderPayment(order);
    }

    // Idempotent retry: if the first callback marked the order PAID but publishing
    // failed, gateway retry must be able to republish the paid fact.
    if (order.status === OrderStatus.PAID && order.payStatus === PayStatus.PAID) {
      await this.ensurePaidOutbox(order, transactionId, orderPayAmountForEvent);
      return { status: OrderStatus.PAID };
    }

    // Idempotency Check
    if (order.status !== OrderStatus.PENDING_PAY || order.payStatus !== PayStatus.UNPAID) {
      return { status: order.status };
    }

    const transitionResult = await this.markOrderPaidAndEnsureFulfillment(order, transactionId, orderPayAmountForEvent);
    if (!transitionResult.changed) {
      if (transitionResult.status === OrderStatus.CANCELLED) {
        return this.refundCancelledOrderPayment(order);
      }
      return { status: transitionResult.status };
    }

    this.logger.log(`Order ${orderId} payment processed. Transaction: ${transactionId}`);

    return { status: OrderStatus.PAID };
  }

  @Transactional()
  private async ensurePaidOutbox(order: PaymentOrder, transactionId: string, orderPayAmount: number) {
    await this.publishPaidEvent(order, transactionId, orderPayAmount, order.payTime ?? new Date());
  }

  private async publishPaidEvent(order: PaymentOrder, transactionId: string, orderPayAmount: number, paidAt: Date) {
    await this.orderEventPublisher.publishPaid({
      orderId: order.id,
      orderSn: order.orderSn,
      tenantId: order.tenantId,
      memberId: order.memberId,
      payAmount: orderPayAmount,
      transactionId: order.transactionId ?? transactionId,
      paidAt,
    });
  }

  /**
   * 支付状态与履约单创建必须同事务提交，避免出现“已支付但无履约入口”的半挂状态。
   */
  @Transactional()
  private async markOrderPaidAndEnsureFulfillment(order: PaymentOrder, transactionId: string, orderPayAmount: number) {
    const paidAt = new Date();
    const updateResult = await this.prisma.omsOrder.updateMany({
      where: {
        id: order.id,
        status: OrderStatus.PENDING_PAY,
        payStatus: PayStatus.UNPAID,
        delFlag: DelFlagEnum.NORMAL,
      },
      data: {
        status: OrderStatus.PAID,
        payStatus: PayStatus.PAID,
        payTime: paidAt,
        transactionId,
      },
    });

    if (updateResult.count === 0) {
      const latestOrder = await this.orderRepo.findById(order.id);
      return { status: latestOrder?.status ?? OrderStatus.PENDING_PAY, changed: false };
    }

    await this.fulfillmentService.ensureForPaidOrder(order.id);
    await this.publishPaidEvent(order, transactionId, orderPayAmount, paidAt);
    return { status: OrderStatus.PAID, changed: true };
  }

  /**
   * 支付成功与自动取消并发时，若取消先落库，支付回调必须进入退款防线。
   */
  private async refundCancelledOrderPayment(order: Awaited<ReturnType<OrderRepository['findById']>>) {
    BusinessException.throwIfNull(order, '订单不存在');
    this.logger.warn(`[Payment Defense] Order ${order.id} was cancelled but payment received. Triggering auto-refund.`);
    const refundSn = `AUTO_REFUND_${order.orderSn}_CANCELLED`;
    await this.finRefundService.createRequested({
      tenantId: order.tenantId,
      orderId: order.id,
      orderSn: order.orderSn,
      refundSn,
      refundType: FinRefundType.AUTO_CANCEL,
      requestedAmount: order.payAmount,
      payerTotalAmount: order.payAmount,
      settlementTotalAmount: order.payAmount,
      reason: '订单已取消，自动退款',
      operator: 'payment-callback',
    });
    try {
      const refundResult = await this.paymentGateway.refund({
        orderSn: order.orderSn,
        refundSn,
        refundAmount: order.payAmount,
        totalAmount: order.payAmount,
        reason: '订单已取消，自动退款',
      });
      const refundRecord = await this.finRefundService.recordGatewayResult({
        refundSn: refundResult.refundSn,
        refundId: refundResult.refundId,
        status: refundResult.status,
        amount: refundResult.amount,
        payerRefundAmount: refundResult.payerRefundAmount,
        settlementRefundAmount: refundResult.settlementRefundAmount,
        refundFeeAmount: refundResult.refundFeeAmount,
        discountRefundAmount: refundResult.discountRefundAmount,
        netAmount: refundResult.netAmount,
        rawPayload: (refundResult.rawPayload ?? {
          refundSn: refundResult.refundSn,
          refundId: refundResult.refundId,
          status: refundResult.status,
          amount: refundResult.amount ?? null,
          payerRefundAmount: refundResult.payerRefundAmount ?? null,
          settlementRefundAmount: refundResult.settlementRefundAmount ?? null,
          refundFeeAmount: refundResult.refundFeeAmount ?? null,
          discountRefundAmount: refundResult.discountRefundAmount ?? null,
          netAmount: refundResult.netAmount ?? null,
        }) as Prisma.InputJsonValue,
        operator: 'payment-callback',
      });
      await this.orderRefundFinalizer.finalize(refundRecord);
      this.logger.log(`[Payment Defense] Auto-refund success for order ${order.id}`);
    } catch (error) {
      const message = getErrorMessage(error);
      await this.recordAutoRefundFailure(refundSn, order, message);
      await this.enqueueAutoRefundRetry(refundSn, order, message);
      this.logger.warn(`[Payment Defense] Auto-refund failed for order ${order.id}, queued retry. error=${message}`);
    }
    return { status: 'REFUND_PENDING', message: 'Order was cancelled, refund triggered' };
  }

  private async recordAutoRefundFailure(refundSn: string, order: PaymentOrder, message: string): Promise<void> {
    try {
      await this.finRefundService.recordGatewayFailure({
        refundSn,
        failReason: message,
        operator: 'payment-callback',
        rawPayload: {
          refundSn,
          orderId: order.id,
          orderSn: order.orderSn,
          tenantId: order.tenantId,
          error: message,
          stage: 'auto-cancel-refund-initial-call',
        },
      });
    } catch (recordError) {
      this.logger.error(
        `[Payment Defense] Failed to record auto-refund failure for order ${order.id}: ${getErrorMessage(recordError)}`,
      );
    }
  }

  private async enqueueAutoRefundRetry(refundSn: string, order: PaymentOrder, failureMessage: string): Promise<void> {
    try {
      await this.refundRetryQueue.enqueueAutoCancelRefund({
        tenantId: order.tenantId,
        orderId: order.id,
        orderSn: order.orderSn,
        refundSn,
        refundAmount: this.toAmountString(order.payAmount),
        totalAmount: this.toAmountString(order.payAmount),
        reason: `订单已取消，自动退款；首次外呼失败: ${failureMessage}`,
      });
    } catch (queueError) {
      this.logger.error(
        `[Payment Defense] Failed to enqueue auto-refund retry for order ${order.id}: ${getErrorMessage(queueError)}`,
      );
      throw queueError;
    }
  }

  private toAmountString(value: { toFixed?: (scale?: number) => string; toNumber?: () => number } | string | number) {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number') {
      return value.toFixed(2);
    }
    if (typeof value.toFixed === 'function') {
      return value.toFixed(2);
    }
    if (typeof value.toNumber === 'function') {
      return value.toNumber().toFixed(2);
    }
    return String(value);
  }

  private parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value == null || value.trim().length === 0) return defaultValue;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return defaultValue;
  }
}
