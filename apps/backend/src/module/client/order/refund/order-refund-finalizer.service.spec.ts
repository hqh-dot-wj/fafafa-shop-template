import { FinRefundStatus, FinRefundType, OrderStatus, OrderType, PayStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderRefundFinalizerService } from './order-refund-finalizer.service';

describe('OrderRefundFinalizerService', () => {
  const prisma = {
    $transaction: jest.fn((callback: () => Promise<unknown>) => callback()),
    omsOrder: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const financeCommandPort = {
    cancelOrderCommissions: jest.fn(),
    cancelCommissionsForOrderPartialRefund: jest.fn(),
    handleSuccessfulRefundSettlement: jest.fn(),
  };

  const orderEventPublisher = {
    publishRefunded: jest.fn(),
  };

  const distributionQualificationService = {
    markServiceOrderRefunded: jest.fn(),
  };

  const finRefundService = {
    markFinalized: jest.fn(),
  };

  const service = new OrderRefundFinalizerService(
    prisma as any,
    financeCommandPort as any,
    orderEventPublisher as any,
    distributionQualificationService as any,
    finRefundService as any,
  );

  const baseRefund = {
    id: 'fin-refund-1',
    tenantId: 'tenant-1',
    orderId: 'order-1',
    orderSn: 'ORDER001',
    refundSn: 'REFUND_ORDER001_FULL',
    refundType: FinRefundType.FULL,
    status: FinRefundStatus.SUCCESS,
    requestedAmount: new Decimal('100.00'),
    finalizedAt: null,
    successTime: new Date('2026-05-18T10:00:00.000Z'),
    finalizePayload: { remark: 'customer request' },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback: () => Promise<unknown>) => callback());
    prisma.omsOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      orderSn: 'ORDER001',
      tenantId: 'tenant-1',
      memberId: 'member-1',
      status: OrderStatus.PAID,
      payStatus: PayStatus.PAID,
      orderType: OrderType.SERVICE,
      payAmount: new Decimal('100.00'),
      pointsUsed: 100,
      remark: null,
      partialRefundSn: null,
    });
    prisma.omsOrder.updateMany.mockResolvedValue({ count: 1 });
    financeCommandPort.cancelOrderCommissions.mockResolvedValue(undefined);
    financeCommandPort.cancelCommissionsForOrderPartialRefund.mockResolvedValue(undefined);
    financeCommandPort.handleSuccessfulRefundSettlement.mockResolvedValue({ action: 'REFRESHED' });
    orderEventPublisher.publishRefunded.mockResolvedValue(undefined);
    distributionQualificationService.markServiceOrderRefunded.mockResolvedValue({
      evidenceCount: 1,
      pendingRewardCount: 0,
    });
    finRefundService.markFinalized.mockResolvedValue(undefined);
  });

  it('Given 整单退款 SUCCESS, When finalize, Then CAS 更新订单后取消佣金并标记已收口', async () => {
    const result = await service.finalize(baseRefund);

    expect(result).toEqual({ finalized: true });
    expect(prisma.omsOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1', tenantId: 'tenant-1', status: { not: OrderStatus.REFUNDED } },
        data: expect.objectContaining({
          status: OrderStatus.REFUNDED,
          payStatus: PayStatus.REFUNDED,
        }),
      }),
    );
    expect(financeCommandPort.cancelOrderCommissions).toHaveBeenCalledWith('order-1');
    expect(financeCommandPort.handleSuccessfulRefundSettlement).toHaveBeenCalledWith(baseRefund);
    expect(orderEventPublisher.publishRefunded).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        refundReferenceId: 'REFUND_ORDER001_FULL',
      }),
    );
    expect(finRefundService.markFinalized).toHaveBeenCalledWith('fin-refund-1');
  });

  it('Given 退款仍在 PROCESSING, When finalize, Then 不更新业务状态', async () => {
    const result = await service.finalize({ ...baseRefund, status: FinRefundStatus.PROCESSING });

    expect(result).toEqual({ finalized: false });
    expect(prisma.omsOrder.findFirst).not.toHaveBeenCalled();
    expect(financeCommandPort.cancelOrderCommissions).not.toHaveBeenCalled();
    expect(financeCommandPort.handleSuccessfulRefundSettlement).not.toHaveBeenCalled();
  });

  it('Given 并发收口时订单已被另一实例更新, When finalize, Then 不重复执行佣金和事件副作用', async () => {
    prisma.omsOrder.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.finalize(baseRefund);

    expect(result).toEqual({ finalized: false });
    expect(financeCommandPort.cancelOrderCommissions).not.toHaveBeenCalled();
    expect(financeCommandPort.handleSuccessfulRefundSettlement).toHaveBeenCalledWith(baseRefund);
    expect(orderEventPublisher.publishRefunded).not.toHaveBeenCalled();
    expect(finRefundService.markFinalized).toHaveBeenCalledWith('fin-refund-1');
  });

  it('Given 按商品退款 SUCCESS, When finalize, Then 使用 finalizePayload 收口部分退款明细', async () => {
    const partialRefund = {
      ...baseRefund,
      refundSn: 'REFUND_ORDER001_ITEM',
      refundType: FinRefundType.PARTIAL,
      requestedAmount: new Decimal('50.00'),
      finalizePayload: {
        remark: 'one item',
        refundAmount: '50.00',
        refundRatio: '0.5',
        refundDetails: [{ itemId: 1, quantity: 1, amount: '50.00' }],
        fullyRefundedItemIds: [1],
        isFullRefund: false,
      },
    };

    const result = await service.finalize(partialRefund);

    expect(result).toEqual({ finalized: true });
    expect(prisma.omsOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'order-1',
          tenantId: 'tenant-1',
          status: { not: OrderStatus.REFUNDED },
          OR: [{ partialRefundSn: null }, { partialRefundSn: 'REFUND_ORDER001_ITEM' }],
        }),
        data: expect.objectContaining({
          partialRefundSn: 'REFUND_ORDER001_ITEM',
        }),
      }),
    );
    expect(financeCommandPort.cancelCommissionsForOrderPartialRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        relatedId: 'REFUND_ORDER001_ITEM',
      }),
    );
    expect(financeCommandPort.handleSuccessfulRefundSettlement).toHaveBeenCalledWith(partialRefund);
    expect(distributionQualificationService.markServiceOrderRefunded).toHaveBeenCalledWith('tenant-1', 'order-1', [1]);
    expect(orderEventPublisher.publishRefunded).toHaveBeenCalledWith(
      expect.objectContaining({
        partialRefund: true,
        earnedPointsClawbackRatio: 0.5,
      }),
    );
  });

  it('Given 自动取消退款 SUCCESS, When finalize, Then 只更新支付退款备注不发布订单退款事件', async () => {
    const result = await service.finalize({
      ...baseRefund,
      refundType: FinRefundType.AUTO_CANCEL,
      refundSn: 'AUTO_REFUND_ORDER001_CANCELLED',
    });

    expect(result).toEqual({ finalized: true });
    expect(prisma.omsOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payStatus: PayStatus.REFUNDED,
        }),
      }),
    );
    expect(orderEventPublisher.publishRefunded).not.toHaveBeenCalled();
    expect(financeCommandPort.handleSuccessfulRefundSettlement).not.toHaveBeenCalled();
    expect(finRefundService.markFinalized).toHaveBeenCalledWith('fin-refund-1');
  });

  // 规格（#4 除零 + #5 积分舍入）
  //   I1: order.payAmount === 0 时 partial finalize 不抛 DivisionByZero；退款比例兜底为 1（100%）
  //   I2: refundPointsAmount 用 Math.round 而非 floor，避免每次部分退款少退用户积分
  it('Given 免单订单(payAmount=0)触发部分退款, When finalize, Then 兜底为 100% 比例不除零', async () => {
    prisma.omsOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      orderSn: 'ORDER001',
      tenantId: 'tenant-1',
      memberId: 'member-1',
      status: OrderStatus.PAID,
      payStatus: PayStatus.PAID,
      orderType: OrderType.SERVICE,
      payAmount: new Decimal('0.00'),
      pointsUsed: 100,
      remark: null,
      partialRefundSn: null,
    });

    const refund = {
      ...baseRefund,
      refundSn: 'REFUND_ZERO_ORDER_PARTIAL',
      refundType: FinRefundType.PARTIAL,
      requestedAmount: new Decimal('0.00'),
      finalizePayload: null,
    };

    // 不应抛 DivisionByZero
    await expect(service.finalize(refund)).resolves.toEqual({ finalized: true });

    expect(orderEventPublisher.publishRefunded).toHaveBeenCalledWith(
      expect.objectContaining({
        earnedPointsClawbackRatio: 1,
        // pointsUsed=100 × ratio=1 = 100，Math.round(100) = 100
        refundPointsAmount: 100,
      }),
    );
  });

  it('Given pointsUsed * ratio 为非整数, When finalize, Then 用 round 而非 floor 避免少退积分', async () => {
    prisma.omsOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      orderSn: 'ORDER001',
      tenantId: 'tenant-1',
      memberId: 'member-1',
      status: OrderStatus.PAID,
      payStatus: PayStatus.PAID,
      orderType: OrderType.SERVICE,
      payAmount: new Decimal('100.00'),
      pointsUsed: 100,
      remark: null,
      partialRefundSn: null,
    });

    const refund = {
      ...baseRefund,
      refundSn: 'REFUND_POINTS_ROUND',
      refundType: FinRefundType.PARTIAL,
      requestedAmount: new Decimal('99.90'),
      finalizePayload: {
        refundRatio: '0.999',
        refundAmount: '99.90',
        isFullRefund: false,
      },
    };

    await service.finalize(refund);

    // 100 × 0.999 = 99.9；floor 会得 99（少退），round 得 100
    expect(orderEventPublisher.publishRefunded).toHaveBeenCalledWith(
      expect.objectContaining({
        refundPointsAmount: 100,
      }),
    );
  });

  // 规格（#merged_bug_002 finalizePartialRefund CAS）
  //   I1: 同 refundSn 重入 → 命中 OR 第二分支，与 status 守卫一同允许 update；副作用幂等（status guard 由 partialRefundSn 等值保证）
  //   I2: 不同 refundSn 已落库 → updateMany.count=0，走早退分支，不污染 partialRefundSn，不再触发副作用
  //   I3: 订单已 REFUNDED 时，partial finalize 必须被 status guard 拦截，走早退分支
  it('Given 订单已存在另一笔 partialRefundSn, When 不同 SN 触发 partial finalize, Then count=0 不覆盖 SN 也不触发副作用', async () => {
    // 并发场景：先到的 REFUND_A 已写入 partialRefundSn；后到的 REFUND_B 不应覆盖。
    prisma.omsOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      orderSn: 'ORDER001',
      tenantId: 'tenant-1',
      memberId: 'member-1',
      status: OrderStatus.PAID,
      payStatus: PayStatus.PAID,
      orderType: OrderType.SERVICE,
      payAmount: new Decimal('100.00'),
      pointsUsed: 100,
      remark: null,
      partialRefundSn: 'REFUND_A',
    });
    prisma.omsOrder.updateMany.mockResolvedValue({ count: 0 });

    const refundB = {
      ...baseRefund,
      refundSn: 'REFUND_B',
      refundType: FinRefundType.PARTIAL,
      requestedAmount: new Decimal('30.00'),
      finalizePayload: { refundAmount: '30.00', refundRatio: '0.3', isFullRefund: false },
    };

    const result = await service.finalize(refundB);

    expect(result).toEqual({ finalized: false });
    // CAS 失败 → 不触发任何业务副作用
    expect(financeCommandPort.cancelCommissionsForOrderPartialRefund).not.toHaveBeenCalled();
    expect(distributionQualificationService.markServiceOrderRefunded).not.toHaveBeenCalled();
    expect(orderEventPublisher.publishRefunded).not.toHaveBeenCalled();
    // 仍幂等补做结算清账（与 finalizeFullRefund 的 count=0 分支对齐）
    expect(financeCommandPort.handleSuccessfulRefundSettlement).toHaveBeenCalledWith(refundB);
    expect(finRefundService.markFinalized).toHaveBeenCalledWith('fin-refund-1');
  });

  it('Given 整退已并发完成订单变 REFUNDED, When 部分退款 finalize, Then status 守卫拦截不发部分退款副作用', async () => {
    // TOCTOU：loadOrder 读到旧快照，updateMany 时订单已被另一实例改为 REFUNDED；
    // 旧实现因缺 status 守卫会写入 partialRefundSn 并发出 partialRefund=true 事件，与整退事件冲突。
    prisma.omsOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      orderSn: 'ORDER001',
      tenantId: 'tenant-1',
      memberId: 'member-1',
      status: OrderStatus.PAID, // loadOrder 时还是 PAID
      payStatus: PayStatus.PAID,
      orderType: OrderType.SERVICE,
      payAmount: new Decimal('100.00'),
      pointsUsed: 100,
      remark: null,
      partialRefundSn: null,
    });
    // updateMany 因 status guard 命中 REFUNDED 而 count=0
    prisma.omsOrder.updateMany.mockResolvedValue({ count: 0 });

    const partialRefund = {
      ...baseRefund,
      refundSn: 'REFUND_LATE_PARTIAL',
      refundType: FinRefundType.PARTIAL,
      requestedAmount: new Decimal('30.00'),
      finalizePayload: { refundAmount: '30.00', refundRatio: '0.3', isFullRefund: false },
    };

    const result = await service.finalize(partialRefund);

    expect(result).toEqual({ finalized: false });
    // CAS where 必须含 status 守卫
    expect(prisma.omsOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: OrderStatus.REFUNDED },
        }),
      }),
    );
    expect(financeCommandPort.cancelCommissionsForOrderPartialRefund).not.toHaveBeenCalled();
    expect(orderEventPublisher.publishRefunded).not.toHaveBeenCalled();
  });

  it('Given 订单已退款但退款单未 finalized, When finalize, Then 仍幂等补做结算处理', async () => {
    prisma.omsOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      orderSn: 'ORDER001',
      tenantId: 'tenant-1',
      memberId: 'member-1',
      status: OrderStatus.REFUNDED,
      payStatus: PayStatus.REFUNDED,
      orderType: OrderType.SERVICE,
      payAmount: new Decimal('100.00'),
      pointsUsed: 100,
      remark: null,
      partialRefundSn: null,
    });

    const result = await service.finalize(baseRefund);

    expect(result).toEqual({ finalized: false });
    expect(prisma.omsOrder.updateMany).not.toHaveBeenCalled();
    expect(financeCommandPort.cancelOrderCommissions).not.toHaveBeenCalled();
    expect(financeCommandPort.handleSuccessfulRefundSettlement).toHaveBeenCalledWith(baseRefund);
    expect(finRefundService.markFinalized).toHaveBeenCalledWith('fin-refund-1');
  });
});
