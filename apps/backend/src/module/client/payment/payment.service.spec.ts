import { OrderStatus, PayStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { DelFlagEnum } from 'src/common/enum';
import { PaymentService } from './payment.service';
import { RefundStatus } from 'src/module/payment/interfaces/payment-provider.interface';

describe('PaymentService', () => {
  const prisma = {
    omsOrder: {
      updateMany: jest.fn(),
    },
  };
  const orderRepo = {
    findBySn: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
  };
  const financeCommandPort = {
    ensureTenantSettlementProfile: jest.fn(),
  };
  const orderEventPublisher = {
    publishPaid: jest.fn(),
  };
  const paymentGateway = {
    handleCallback: jest.fn(),
    handleRefundCallback: jest.fn(),
    prepay: jest.fn(),
    refund: jest.fn(),
    queryRefund: jest.fn(),
  };
  const finRefundService = {
    createRequested: jest.fn(),
    recordGatewayResult: jest.fn(),
    recordGatewayFailure: jest.fn(),
    recordNotifyResult: jest.fn(),
  };
  const orderRefundFinalizer = {
    finalize: jest.fn(),
  };
  const refundRetryQueue = {
    enqueueAutoCancelRefund: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  const fulfillmentService = {
    ensureForPaidOrder: jest.fn(),
  };

  let service: PaymentService;

  const createOrder = (status: OrderStatus, overrides: Record<string, unknown> = {}) =>
    ({
      id: 'order-1',
      orderSn: 'SN202605080001',
      tenantId: 'tenant-1',
      memberId: 'member-1',
      status,
      payStatus: PayStatus.UNPAID,
      payAmount: new Decimal(100),
      ...overrides,
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentService(
      prisma as any,
      orderRepo as any,
      financeCommandPort as any,
      orderEventPublisher as any,
      paymentGateway as any,
      finRefundService as any,
      orderRefundFinalizer as any,
      refundRetryQueue as any,
      configService as any,
      fulfillmentService as any,
    );
    paymentGateway.handleCallback.mockResolvedValue({
      orderSn: 'SN202605080001',
      transactionId: 'wx-tx-1',
      payAmount: 100,
    });
    paymentGateway.refund.mockResolvedValue({
      refundSn: 'AUTO_REFUND_SN202605080001_CANCELLED',
      refundId: 'wx-refund-1',
      status: RefundStatus.PROCESSING,
      amount: 10000,
    });
    finRefundService.createRequested.mockResolvedValue({ id: 'fin-refund-1' });
    finRefundService.recordGatewayResult.mockImplementation(async (input) => ({ status: input.status }));
    finRefundService.recordGatewayFailure.mockImplementation(async (input) => ({
      status: RefundStatus.PROCESSING,
      refundSn: input.refundSn,
    }));
    finRefundService.recordNotifyResult.mockImplementation(async (input) => ({
      id: 'fin-refund-1',
      status: input.status,
      refundSn: input.refundSn,
    }));
    orderRefundFinalizer.finalize.mockResolvedValue({ finalized: false });
    refundRetryQueue.enqueueAutoCancelRefund.mockResolvedValue(
      'auto-cancel-refund:AUTO_REFUND_SN202605080001_CANCELLED',
    );
    paymentGateway.prepay.mockResolvedValue({
      timeStamp: '1715155200',
      nonceStr: 'nonce',
      package: 'prepay_id=mock-prepay',
      signType: 'RSA',
      paySign: 'signature',
    });
    financeCommandPort.ensureTenantSettlementProfile.mockResolvedValue({
      enabled: false,
      defaultChannel: 'WECHAT',
    });
    orderRepo.findBySn.mockResolvedValue({ id: 'order-1' });
  });

  describe('prepay', () => {
    it('Given 订单状态待支付但支付状态已支付, When prepay, Then 拒绝重复预下单', async () => {
      orderRepo.findOne.mockResolvedValue(createOrder(OrderStatus.PENDING_PAY, { payStatus: PayStatus.PAID }));

      await expect(service.prepay('member-1', { orderId: 'order-1', paymentMethod: 'WECHAT' })).rejects.toThrow(
        BusinessException,
      );

      expect(paymentGateway.prepay).not.toHaveBeenCalled();
      expect(financeCommandPort.ensureTenantSettlementProfile).not.toHaveBeenCalled();
    });
  });

  describe('handleCallback payload validation', () => {
    it('Given 回调缺少交易单号, When handleCallback, Then 拒绝处理且不查询订单', async () => {
      paymentGateway.handleCallback.mockResolvedValue({
        orderSn: 'SN202605080001',
        transactionId: '',
        payAmount: 100,
      });

      await expect(service.handleCallback({}, '{}')).rejects.toThrow(BusinessException);

      expect(orderRepo.findBySn).not.toHaveBeenCalled();
      expect(prisma.omsOrder.updateMany).not.toHaveBeenCalled();
    });

    it('Given 回调金额与订单金额不一致, When handleCallback, Then 拒绝推进支付状态', async () => {
      const pendingOrder = createOrder(OrderStatus.PENDING_PAY);
      paymentGateway.handleCallback.mockResolvedValue({
        orderSn: 'SN202605080001',
        transactionId: 'wx-tx-1',
        payAmount: 99.98,
      });
      orderRepo.findById.mockResolvedValueOnce(pendingOrder);

      await expect(service.handleCallback({}, '{}')).rejects.toThrow(BusinessException);

      expect(prisma.omsOrder.updateMany).not.toHaveBeenCalled();
      expect(fulfillmentService.ensureForPaidOrder).not.toHaveBeenCalled();
      expect(orderEventPublisher.publishPaid).not.toHaveBeenCalled();
    });

    it('Given 回调金额只差 1 分, When handleCallback, Then 不用浮点容差放行', async () => {
      const pendingOrder = createOrder(OrderStatus.PENDING_PAY, { payAmount: new Decimal('0.30') });
      paymentGateway.handleCallback.mockResolvedValue({
        orderSn: 'SN202605080001',
        transactionId: 'wx-tx-1',
        payAmount: 0.29,
      });
      orderRepo.findById.mockResolvedValueOnce(pendingOrder);

      await expect(service.handleCallback({}, '{}')).rejects.toThrow(BusinessException);

      expect(prisma.omsOrder.updateMany).not.toHaveBeenCalled();
      expect(fulfillmentService.ensureForPaidOrder).not.toHaveBeenCalled();
      expect(orderEventPublisher.publishPaid).not.toHaveBeenCalled();
    });
  });

  describe('handleRefundCallback', () => {
    it('Given 微信退款回调 SUCCESS, When handleRefundCallback, Then 记录 NOTIFY 并触发订单收口', async () => {
      const successTime = new Date('2026-05-18T10:00:00.000Z');
      paymentGateway.handleRefundCallback.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_FULL',
        refundId: 'wx-refund-1',
        status: RefundStatus.SUCCESS,
        amount: 10000,
        payerRefundAmount: 10000,
        settlementRefundAmount: 9988,
        refundFeeAmount: 12,
        discountRefundAmount: 0,
        successTime,
        rawPayload: { out_refund_no: 'REFUND_ORDER123_FULL' },
      });

      const result = await service.handleRefundCallback({}, '{}');

      expect(result).toEqual({ status: RefundStatus.SUCCESS });
      expect(finRefundService.recordNotifyResult).toHaveBeenCalledWith(
        expect.objectContaining({
          refundSn: 'REFUND_ORDER123_FULL',
          refundId: 'wx-refund-1',
          status: RefundStatus.SUCCESS,
          amount: 10000,
          payerRefundAmount: 10000,
          settlementRefundAmount: 9988,
          refundFeeAmount: 12,
          discountRefundAmount: 0,
          successTime,
          operator: 'payment-refund-callback',
        }),
      );
      expect(orderRefundFinalizer.finalize).toHaveBeenCalledWith(
        expect.objectContaining({
          status: RefundStatus.SUCCESS,
          refundSn: 'REFUND_ORDER123_FULL',
        }),
      );
    });

    it('Given 退款回调缺少退款单号, When handleRefundCallback, Then 拒绝写入退款事实源', async () => {
      paymentGateway.handleRefundCallback.mockResolvedValue({
        refundSn: '',
        refundId: 'wx-refund-1',
        status: RefundStatus.SUCCESS,
        amount: 10000,
      });

      await expect(service.handleRefundCallback({}, '{}')).rejects.toThrow(BusinessException);

      expect(finRefundService.recordNotifyResult).not.toHaveBeenCalled();
      expect(orderRefundFinalizer.finalize).not.toHaveBeenCalled();
    });
  });

  it('Given 支付回调先读到待支付但自动取消先落库, When 支付 CAS 失败且最新状态已取消, Then 触发退款防线', async () => {
    const pendingOrder = createOrder(OrderStatus.PENDING_PAY);
    const cancelledOrder = createOrder(OrderStatus.CANCELLED);
    orderRepo.findById.mockResolvedValueOnce(pendingOrder).mockResolvedValueOnce(cancelledOrder);
    prisma.omsOrder.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.handleCallback({}, '{}');

    expect(result).toEqual({
      status: 'REFUND_PENDING',
      message: 'Order was cancelled, refund triggered',
    });
    expect(prisma.omsOrder.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-1',
        status: OrderStatus.PENDING_PAY,
        payStatus: PayStatus.UNPAID,
        delFlag: DelFlagEnum.NORMAL,
      },
      data: {
        status: OrderStatus.PAID,
        payStatus: PayStatus.PAID,
        payTime: expect.any(Date),
        transactionId: 'wx-tx-1',
      },
    });
    expect(paymentGateway.refund).toHaveBeenCalledWith(
      expect.objectContaining({
        orderSn: pendingOrder.orderSn,
        refundSn: 'AUTO_REFUND_SN202605080001_CANCELLED',
        refundAmount: pendingOrder.payAmount,
        totalAmount: pendingOrder.payAmount,
        reason: '订单已取消，自动退款',
      }),
    );
    expect(finRefundService.createRequested).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: pendingOrder.id,
        orderSn: pendingOrder.orderSn,
        refundSn: 'AUTO_REFUND_SN202605080001_CANCELLED',
      }),
    );
    expect(finRefundService.recordGatewayResult).toHaveBeenCalledWith(
      expect.objectContaining({
        refundSn: 'AUTO_REFUND_SN202605080001_CANCELLED',
        status: RefundStatus.PROCESSING,
      }),
    );
    expect(fulfillmentService.ensureForPaidOrder).not.toHaveBeenCalled();
    expect(orderEventPublisher.publishPaid).not.toHaveBeenCalled();
  });

  it('Given 自动取消退款首次外呼失败且队列可用, When 支付回调处理, Then 写失败事件并投递 Bull 重试', async () => {
    const cancelledOrder = createOrder(OrderStatus.CANCELLED);
    orderRepo.findById.mockResolvedValueOnce(cancelledOrder);
    paymentGateway.refund.mockRejectedValue(new Error('network timeout'));

    const result = await service.handleCallback({}, '{}');

    expect(result).toEqual({
      status: 'REFUND_PENDING',
      message: 'Order was cancelled, refund triggered',
    });
    expect(finRefundService.createRequested).toHaveBeenCalledWith(
      expect.objectContaining({
        refundSn: 'AUTO_REFUND_SN202605080001_CANCELLED',
      }),
    );
    expect(finRefundService.recordGatewayFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        refundSn: 'AUTO_REFUND_SN202605080001_CANCELLED',
        failReason: 'network timeout',
        operator: 'payment-callback',
      }),
    );
    expect(refundRetryQueue.enqueueAutoCancelRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        orderId: 'order-1',
        orderSn: 'SN202605080001',
        refundSn: 'AUTO_REFUND_SN202605080001_CANCELLED',
        refundAmount: '100.00',
        totalAmount: '100.00',
      }),
    );
  });

  it('Given 自动取消退款首次外呼失败且队列不可用, When 支付回调处理, Then 上浮错误让微信支付回调重试', async () => {
    const cancelledOrder = createOrder(OrderStatus.CANCELLED);
    orderRepo.findById.mockResolvedValueOnce(cancelledOrder);
    paymentGateway.refund.mockRejectedValue(new Error('network timeout'));
    refundRetryQueue.enqueueAutoCancelRefund.mockRejectedValue(new Error('redis unavailable'));

    await expect(service.handleCallback({}, '{}')).rejects.toThrow('redis unavailable');

    expect(finRefundService.recordGatewayFailure).toHaveBeenCalled();
    expect(refundRetryQueue.enqueueAutoCancelRefund).toHaveBeenCalled();
  });

  it('Given 订单主状态待支付但 payStatus 已支付, When 支付回调重复到达, Then 不再次更新订单或创建履约', async () => {
    const inconsistentOrder = createOrder(OrderStatus.PENDING_PAY, { payStatus: PayStatus.PAID });
    orderRepo.findById.mockResolvedValueOnce(inconsistentOrder);

    const result = await service.handleCallback({}, '{}');

    expect(result).toEqual({ status: OrderStatus.PENDING_PAY });
    expect(prisma.omsOrder.updateMany).not.toHaveBeenCalled();
    expect(fulfillmentService.ensureForPaidOrder).not.toHaveBeenCalled();
    expect(orderEventPublisher.publishPaid).not.toHaveBeenCalled();
    expect(paymentGateway.refund).not.toHaveBeenCalled();
  });

  it('Given 订单已软删除, When 支付回调尝试推进状态, Then CAS 必须带 delFlag=NORMAL 防止命中删除数据', async () => {
    const pendingOrder = createOrder(OrderStatus.PENDING_PAY);
    orderRepo.findById.mockResolvedValueOnce(pendingOrder).mockResolvedValueOnce(pendingOrder);
    prisma.omsOrder.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.handleCallback({}, '{}');

    expect(result).toEqual({ status: OrderStatus.PENDING_PAY });
    expect(prisma.omsOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: OrderStatus.PENDING_PAY,
          payStatus: PayStatus.UNPAID,
          delFlag: DelFlagEnum.NORMAL,
        }),
      }),
    );
    expect(fulfillmentService.ensureForPaidOrder).not.toHaveBeenCalled();
    expect(orderEventPublisher.publishPaid).not.toHaveBeenCalled();
  });

  it('Given 回调到达时订单已经取消, When 处理支付成功回调, Then 不推进为已支付并触发退款防线', async () => {
    const cancelledOrder = createOrder(OrderStatus.CANCELLED);
    orderRepo.findById.mockResolvedValueOnce(cancelledOrder);

    const result = await service.handleCallback({}, '{}');

    expect(result).toEqual({
      status: 'REFUND_PENDING',
      message: 'Order was cancelled, refund triggered',
    });
    expect(prisma.omsOrder.updateMany).not.toHaveBeenCalled();
    expect(paymentGateway.refund).toHaveBeenCalledTimes(1);
    expect(fulfillmentService.ensureForPaidOrder).not.toHaveBeenCalled();
    expect(orderEventPublisher.publishPaid).not.toHaveBeenCalled();
  });

  it('Given 支付回调重复到达且订单已支付, When 处理回调, Then 重发支付事件补偿首次发布失败', async () => {
    const paidOrder = createOrder(OrderStatus.PAID, {
      payStatus: PayStatus.PAID,
      transactionId: 'wx-tx-0',
      payTime: new Date('2026-05-14T00:00:00.000Z'),
    });
    orderRepo.findById.mockResolvedValueOnce(paidOrder);

    const result = await service.handleCallback({}, '{}');

    expect(result).toEqual({ status: OrderStatus.PAID });
    expect(prisma.omsOrder.updateMany).not.toHaveBeenCalled();
    expect(paymentGateway.refund).not.toHaveBeenCalled();
    expect(orderEventPublisher.publishPaid).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        transactionId: 'wx-tx-0',
        paidAt: new Date('2026-05-14T00:00:00.000Z'),
      }),
    );
  });

  // R-EVENT-PAID-01: publishPaid 失败时错误必须上浮，不能静默返回 PAID（财务链路可见性）
  it('Given publishPaid 抛出, When handleCallback 回调到达, Then 服务应抛出（不静默返回 PAID）', async () => {
    const pendingOrder = createOrder(OrderStatus.PENDING_PAY);
    orderRepo.findById.mockResolvedValue(pendingOrder);
    prisma.omsOrder.updateMany.mockResolvedValue({ count: 1 });
    fulfillmentService.ensureForPaidOrder.mockResolvedValue(undefined);
    orderEventPublisher.publishPaid.mockRejectedValue(new Error('事件总线不可用'));

    await expect(service.handleCallback({}, '{}')).rejects.toThrow('事件总线不可用');
  });
});
