import { Test, TestingModule } from '@nestjs/testing';
import { PointsDebtReason, PointsDebtStatus, PointsTransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClsService } from 'nestjs-cls';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { RedisService } from 'src/module/common/redis/redis.service';
import { ORDER_SERVICE } from 'src/module/client/order/order-service.token';
import { MessageTouchpointDispatcher } from '../events/message-touchpoint.dispatcher';
import { MarketingEventType } from '../events/marketing-event.types';
import { CouponUsageService } from '../coupon/usage/usage.service';
import { PointsAccountService } from '../points/account/account.service';
import { PointsRuleService } from '../points/rule/rule.service';
import { PointsGracefulDegradationService } from '../points/degradation/degradation.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { OrderIntegrationService } from './integration.service';
import { PlayInstanceService } from '../instance/instance.service';
import { ShareTokenService } from 'src/module/store/distribution/services/share-token.service';

describe('OrderIntegrationService', () => {
  let service: OrderIntegrationService;

  const mockPlayInstanceService = {
    handlePaymentSuccessById: jest.fn(),
  };

  const mockCouponUsageService = {
    calculateDiscount: jest.fn(),
    lockCoupon: jest.fn(),
    useCoupon: jest.fn(),
    unlockCoupon: jest.fn(),
    refundCoupon: jest.fn(),
  };

  const mockPointsAccountService = {
    freezePoints: jest.fn(),
    unfreezePoints: jest.fn(),
    settleFrozenPoints: jest.fn(),
    refundSpentPoints: jest.fn(),
    addPoints: jest.fn(),
    deductPoints: jest.fn(),
  };

  const mockPointsRuleService = {
    validatePointsUsage: jest.fn(),
    calculatePointsDiscount: jest.fn(),
    calculateOrderPointsByItems: jest.fn(),
  };

  const mockDegradationService = {
    recordFailure: jest.fn(),
  };

  const mockRedisClient = {
    set: jest.fn(),
    get: jest.fn(),
  };

  const mockRedisService = {
    tryLock: jest.fn(),
    unlock: jest.fn(),
    getClient: jest.fn(),
    del: jest.fn(),
    renewLock: jest.fn(),
  };

  const mockOrderService = {
    findByIdForMarketing: jest.fn(),
    updateOrderPointsEarned: jest.fn(),
  };

  const mockPrisma = {
    mktUserCoupon: { findFirst: jest.fn() },
    mktPointsTransaction: { findFirst: jest.fn() },
    mktPointsAccount: { findFirst: jest.fn() },
    mktPointsDebt: { upsert: jest.fn() },
    omsOrderItemAttribution: { findMany: jest.fn() },
  };

  const mockEventEmitter = {
    dispatch: jest.fn(),
  };

  const mockCls = { get: jest.fn() };
  const mockShareTokenService = {
    applySidOrderCountIncrement: jest.fn(),
    applySidOrderCountDecrement: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderIntegrationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClsService, useValue: mockCls },
        { provide: RedisService, useValue: mockRedisService },
        { provide: MessageTouchpointDispatcher, useValue: mockEventEmitter },
        { provide: ORDER_SERVICE, useValue: mockOrderService },
        { provide: CouponUsageService, useValue: mockCouponUsageService },
        { provide: PointsAccountService, useValue: mockPointsAccountService },
        { provide: PointsRuleService, useValue: mockPointsRuleService },
        { provide: PointsGracefulDegradationService, useValue: mockDegradationService },
        { provide: PlayInstanceService, useValue: mockPlayInstanceService },
        { provide: ShareTokenService, useValue: mockShareTokenService },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    service = module.get<OrderIntegrationService>(OrderIntegrationService);
    jest.clearAllMocks();
    mockRedisService.tryLock.mockResolvedValue(true);
    mockRedisService.unlock.mockResolvedValue(1);
    mockRedisService.getClient.mockReturnValue(mockRedisClient);
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.get.mockResolvedValue(null);
    mockEventEmitter.dispatch.mockResolvedValue(undefined);
    mockPrisma.omsOrderItemAttribution.findMany.mockResolvedValue([]);
    mockShareTokenService.applySidOrderCountIncrement.mockResolvedValue(true);
    mockShareTokenService.applySidOrderCountDecrement.mockResolvedValue(true);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateOrderDiscount', () => {
    it('仅商品时应返回原价无优惠', async () => {
      const result = await service.calculateOrderDiscount('m1', {
        items: [{ productId: 'p1', productName: '商品1', price: 100, quantity: 2 }],
      });

      expect(result.data.originalAmount).toBe(200);
      expect(result.data.couponDiscount).toBe(0);
      expect(result.data.pointsDiscount).toBe(0);
      expect(result.data.finalAmount).toBe(200);
      // preview 路径不发 INTEGRATION_ORDER_DISCOUNT_CALCULATED，避免事件爆量（PR #23 review H1）
      expect(mockEventEmitter.dispatch).not.toHaveBeenCalled();
    });

    it('使用优惠券时应计入优惠券抵扣', async () => {
      mockCouponUsageService.calculateDiscount.mockResolvedValue(30);
      mockPrisma.mktUserCoupon.findFirst.mockResolvedValue({
        couponName: '满200减30',
      });

      const result = await service.calculateOrderDiscount('m1', {
        items: [{ productId: 'p1', productName: '商品1', price: 100, quantity: 2 }],
        userCouponId: 'uc1',
      });

      expect(result.data.originalAmount).toBe(200);
      expect(result.data.couponDiscount).toBe(30);
      expect(result.data.finalAmount).toBe(170);
      expect(result.data.couponName).toBe('满200减30');
    });

    it('使用积分时应校验并计入积分抵扣', async () => {
      mockPointsRuleService.validatePointsUsage.mockResolvedValue(undefined);
      mockPointsRuleService.calculatePointsDiscount.mockResolvedValue(new Decimal(5));

      const result = await service.calculateOrderDiscount('m1', {
        items: [{ productId: 'p1', productName: '商品1', price: 100, quantity: 2 }],
        pointsUsed: 500,
      });

      // A2：validatePointsUsage 现在按 (points, originalAmount, couponDiscount) 调用
      expect(mockPointsRuleService.validatePointsUsage).toHaveBeenCalledWith(
        500,
        expect.any(Decimal),
        expect.any(Decimal),
      );
      const validateCall = mockPointsRuleService.validatePointsUsage.mock.calls[0];
      expect(Number(validateCall[1])).toBe(200); // originalAmount = 100 × 2
      expect(Number(validateCall[2])).toBe(0); // 无券抵扣
      expect(result.data.pointsDiscount).toBe(5);
      expect(result.data.finalAmount).toBe(195);
    });

    // 业务决策 A2：券 + 积分组合时，validatePointsUsage 收到的应为原价 + 券抵扣金额
    it('Given 同时使用券和积分, When calculateOrderDiscount, Then 传给 validatePointsUsage 的基数是原价且 couponDiscount 正确', async () => {
      mockCouponUsageService.calculateDiscount.mockResolvedValue(30);
      mockPrisma.mktUserCoupon.findFirst.mockResolvedValue({ couponName: '满200减30' });
      mockPointsRuleService.validatePointsUsage.mockResolvedValue(undefined);
      mockPointsRuleService.calculatePointsDiscount.mockResolvedValue(new Decimal(5));

      await service.calculateOrderDiscount('m1', {
        items: [{ productId: 'p1', productName: '商品1', price: 100, quantity: 2 }],
        userCouponId: 'uc1',
        pointsUsed: 500,
      });

      const validateCall = mockPointsRuleService.validatePointsUsage.mock.calls[0];
      expect(Number(validateCall[1])).toBe(200);
      expect(Number(validateCall[2])).toBe(30);
    });

    it('最终金额不为负', async () => {
      mockCouponUsageService.calculateDiscount.mockResolvedValue(300);
      mockPrisma.mktUserCoupon.findFirst.mockResolvedValue({ couponName: '大额券' });

      const result = await service.calculateOrderDiscount('m1', {
        items: [{ productId: 'p1', productName: '商品1', price: 100, quantity: 2 }],
        userCouponId: 'uc1',
      });

      expect(result.data.finalAmount).toBe(0);
    });
  });

  describe('recordOrderCreated', () => {
    it('Given 有优惠券且有积分抵扣, When recordOrderCreated, Then 只记录创建事实不锁资产', async () => {
      await service.recordOrderCreated('order1', 'm1', { userCouponId: 'uc1', pointsUsed: 100 });

      expect(mockCouponUsageService.lockCoupon).not.toHaveBeenCalled();
      expect(mockPointsAccountService.freezePoints).not.toHaveBeenCalled();
      expect(mockEventEmitter.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MarketingEventType.INTEGRATION_ORDER_CREATED,
          instanceId: 'order1',
          memberId: 'm1',
        }),
      );
    });

    it('Given 无优惠券但有积分抵扣, When recordOrderCreated, Then 事件 payload 保留 pointsUsed', async () => {
      await service.recordOrderCreated('order1', 'm1', { pointsUsed: 50 });

      expect(mockCouponUsageService.lockCoupon).not.toHaveBeenCalled();
      expect(mockPointsAccountService.freezePoints).not.toHaveBeenCalled();
      expect(mockEventEmitter.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ pointsUsed: 50 }),
        }),
      );
    });

    it('Given 未获得分布式锁, When recordOrderCreated, Then 跳过处理', async () => {
      mockRedisService.tryLock.mockResolvedValueOnce(false);

      await service.recordOrderCreated('order1', 'm1', { userCouponId: 'uc1', pointsUsed: 100 });

      expect(mockCouponUsageService.lockCoupon).not.toHaveBeenCalled();
      expect(mockPointsAccountService.freezePoints).not.toHaveBeenCalled();
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('Given 订单事件幂等键已存在, When recordOrderCreated, Then 忽略重复处理', async () => {
      mockRedisClient.get.mockResolvedValueOnce('done');

      await service.recordOrderCreated('order1', 'm1', { userCouponId: 'uc1', pointsUsed: 100 });

      expect(mockCouponUsageService.lockCoupon).not.toHaveBeenCalled();
      expect(mockPointsAccountService.freezePoints).not.toHaveBeenCalled();
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('Given handler 成功, When recordOrderCreated, Then 在 handler 成功后才写入 done 标记', async () => {
      await service.recordOrderCreated('order1', 'm1', { userCouponId: 'uc1', pointsUsed: 100 });

      const setCalls = mockRedisClient.set.mock.calls;
      expect(setCalls.length).toBeGreaterThanOrEqual(2);
      const inflightCall = setCalls.find((args) => args[1] === 'inflight');
      const doneCall = setCalls.find((args) => args[1] === 'done');
      expect(inflightCall).toBeDefined();
      expect(doneCall).toBeDefined();
      expect(setCalls.indexOf(inflightCall!)).toBeLessThan(setCalls.indexOf(doneCall!));
    });

    it('Given handler 抛错, When recordOrderCreated, Then 删除 in-flight 幂等键且不写入 done', async () => {
      mockEventEmitter.dispatch.mockRejectedValueOnce(new Error('boom'));

      await expect(
        service.recordOrderCreated('order1', 'm1', { userCouponId: 'uc1', pointsUsed: 100 }),
      ).rejects.toThrow('boom');

      expect(mockRedisService.del).toHaveBeenCalled();
      const setCalls = mockRedisClient.set.mock.calls;
      expect(setCalls.some((args) => args[1] === 'done')).toBe(false);
    });
  });

  describe('handleOrderPaid', () => {
    // R-PRE-ORDER-01
    it('Given 订单不存在, When handleOrderPaid, Then 抛出业务异常', async () => {
      mockOrderService.findByIdForMarketing.mockResolvedValue(null);
      jest.spyOn(service['logger'], 'error').mockImplementation(() => {});

      await expect(service.handleOrderPaid('order1', 'm1', 100)).rejects.toThrow(BusinessException);
    });

    // R-FLOW-ORDER-02
    it('Given 订单含券与积分, When handleOrderPaid, Then 核销券并结算冻结积分且发放消费积分', async () => {
      const order = {
        id: 'order1',
        tenantId: 't1',
        memberId: 'm1',
        userCouponId: 'uc1',
        pointsUsed: 50,
        couponDiscount: new Decimal(20),
        totalAmount: new Decimal(200),
        items: [
          {
            id: 101,
            skuId: 's1',
            price: new Decimal(100),
            quantity: 2,
            pointsRatio: 100,
          },
        ],
      };
      mockOrderService.findByIdForMarketing.mockResolvedValue(order);
      mockPointsRuleService.calculateOrderPointsByItems.mockResolvedValue([{ skuId: 's1', earnedPoints: 18 }]);
      mockOrderService.updateOrderPointsEarned.mockResolvedValue(undefined);
      mockPointsAccountService.settleFrozenPoints.mockResolvedValue({ data: {} });
      mockPointsAccountService.addPoints.mockResolvedValue({ data: {} });
      mockPrisma.omsOrderItemAttribution.findMany.mockResolvedValue([{ entryContextSnapshot: { sid: 'DST_001' } }]);

      await service.handleOrderPaid('order1', 'm1', 180);

      expect(mockCouponUsageService.useCoupon).toHaveBeenCalledWith('uc1', 'order1', 20);
      expect(mockPointsAccountService.settleFrozenPoints).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'm1',
          amount: 50,
          type: PointsTransactionType.USE_ORDER,
          relatedId: 'order1',
        }),
      );
      expect(mockPointsAccountService.addPoints).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'm1',
          amount: 18,
          type: PointsTransactionType.EARN_ORDER,
        }),
      );
      expect(mockOrderService.updateOrderPointsEarned).toHaveBeenCalledWith(
        'order1',
        [{ skuId: 's1', earnedPoints: 18 }],
        18,
      );
      expect(mockPlayInstanceService.handlePaymentSuccessById).toHaveBeenCalledWith('order1');
      expect(mockShareTokenService.applySidOrderCountIncrement).toHaveBeenCalledWith('DST_001', {
        tenantId: 't1',
        orderId: 'order1',
        memberId: 'm1',
        eventLog: true,
      });
      expect(mockEventEmitter.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MarketingEventType.INTEGRATION_ORDER_PAID,
          instanceId: 'order1',
          memberId: 'm1',
        }),
      );
    });

    // R-BRANCH-ORDER-01
    it('Given 发放消费积分失败, When handleOrderPaid, Then 记录降级且不抛错', async () => {
      const order: {
        id: string;
        tenantId: string;
        memberId: string;
        userCouponId: string | null;
        pointsUsed: number;
        couponDiscount: Decimal;
        totalAmount: Decimal;
        items: Array<{
          id: number;
          skuId: string;
          price: Decimal;
          quantity: number;
          pointsRatio: number;
        }>;
      } = {
        id: 'order1',
        tenantId: 't1',
        memberId: 'm1',
        userCouponId: null,
        pointsUsed: 0,
        couponDiscount: new Decimal(0),
        totalAmount: new Decimal(100),
        items: [{ id: 101, skuId: 's1', price: new Decimal(100), quantity: 1, pointsRatio: 100 }],
      };
      mockOrderService.findByIdForMarketing.mockResolvedValue(order);
      mockPointsRuleService.calculateOrderPointsByItems.mockResolvedValue([{ skuId: 's1', earnedPoints: 10 }]);
      mockOrderService.updateOrderPointsEarned.mockResolvedValue(undefined);
      mockPointsAccountService.addPoints.mockRejectedValue(new Error('DB error'));

      await expect(service.handleOrderPaid('order1', 'm1', 100)).resolves.not.toThrow();
      expect(mockDegradationService.recordFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'm1',
          amount: 10,
          type: PointsTransactionType.EARN_ORDER,
        }),
      );
      expect(mockPlayInstanceService.handlePaymentSuccessById).toHaveBeenCalledWith('order1');
    });

    it('Given 支付后营销事件发送失败, When handleOrderPaid, Then 仍写入幂等完成态避免重复处理', async () => {
      const order = {
        id: 'order1',
        tenantId: 't1',
        memberId: 'm1',
        userCouponId: null,
        pointsUsed: 0,
        couponDiscount: new Decimal(0),
        totalAmount: new Decimal(100),
        items: [],
      };
      mockOrderService.findByIdForMarketing.mockResolvedValue(order);
      mockPointsRuleService.calculateOrderPointsByItems.mockResolvedValue([]);
      mockOrderService.updateOrderPointsEarned.mockResolvedValue(undefined);
      mockPrisma.omsOrderItemAttribution.findMany.mockResolvedValue([]);
      mockEventEmitter.dispatch.mockRejectedValueOnce(new Error('dispatch failed'));
      jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});

      await expect(service.handleOrderPaid('order1', 'm1', 100)).resolves.not.toThrow();

      expect(mockRedisClient.set).toHaveBeenLastCalledWith(expect.stringContaining('idem:'), 'done', 'EX', 600);
    });
  });

  describe('handleOrderCancelled', () => {
    // R-FLOW-ORDER-03
    it('Given 订单已锁券和冻结积分, When handleOrderCancelled, Then 解锁优惠券并解冻积分', async () => {
      mockOrderService.findByIdForMarketing.mockResolvedValue({
        id: 'order1',
        userCouponId: 'uc1',
        pointsUsed: 50,
      });

      await service.handleOrderCancelled('order1', 'm1');

      expect(mockCouponUsageService.unlockCoupon).toHaveBeenCalledWith('uc1', 'order1');
      expect(mockPointsAccountService.unfreezePoints).toHaveBeenCalledWith('m1', 50, 'order1');
      expect(mockEventEmitter.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MarketingEventType.INTEGRATION_ORDER_CANCELLED,
          instanceId: 'order1',
          memberId: 'm1',
        }),
      );
    });
  });

  describe('handleOrderRefunded', () => {
    // R-FLOW-ORDER-04
    it('Given 订单已发放消费积分, When handleOrderRefunded, Then 退券退积分并回收消费积分', async () => {
      mockOrderService.findByIdForMarketing.mockResolvedValue({
        id: 'order1',
        tenantId: 't1',
        memberId: 'm1',
        userCouponId: 'uc1',
        pointsUsed: 30,
        items: [{ id: 101 }],
      });
      mockPrisma.mktPointsTransaction.findFirst.mockResolvedValue({
        amount: 15,
      });
      mockPrisma.mktPointsAccount.findFirst.mockResolvedValue({
        availablePoints: 30,
      });
      mockPointsAccountService.refundSpentPoints.mockResolvedValue({
        data: { ledger: { strategy: 'ORIGINAL_LOT_RESTORE' } },
      });
      mockPointsAccountService.deductPoints.mockResolvedValue({});
      mockPrisma.omsOrderItemAttribution.findMany.mockResolvedValue([{ entryContextSnapshot: { sid: 'DST_001' } }]);

      await service.handleOrderRefunded('order1', 'm1');

      expect(mockCouponUsageService.refundCoupon).toHaveBeenCalledWith('uc1', 'order1');
      expect(mockPointsAccountService.refundSpentPoints).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'm1',
          amount: 30,
          relatedId: 'order1',
        }),
      );
      expect(mockPointsAccountService.deductPoints).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 15,
          type: PointsTransactionType.DEDUCT_ADMIN,
        }),
      );
      expect(mockShareTokenService.applySidOrderCountDecrement).toHaveBeenCalledWith('DST_001', {
        tenantId: 't1',
        orderId: 'order1',
        memberId: 'm1',
        eventLog: true,
      });
      expect(mockEventEmitter.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MarketingEventType.INTEGRATION_ORDER_REFUNDED,
          instanceId: 'order1',
          memberId: 'm1',
        }),
      );
    });

    it('Given 部分退款参数, When handleOrderRefunded, Then 仅处理本次退款积分且使用退款单幂等', async () => {
      mockOrderService.findByIdForMarketing.mockResolvedValue({
        id: 'order1',
        tenantId: 't1',
        memberId: 'm1',
        userCouponId: 'uc1',
        pointsUsed: 100,
        items: [{ id: 101 }],
      });
      mockPrisma.mktPointsTransaction.findFirst.mockResolvedValue({
        id: 'earn-tx-1',
        amount: 20,
      });
      mockPrisma.mktPointsAccount.findFirst.mockResolvedValue({
        id: 'account-1',
        availablePoints: 50,
      });
      mockPointsAccountService.refundSpentPoints.mockResolvedValue({
        data: { ledger: { strategy: 'ORIGINAL_LOT_RESTORE' } },
      });
      mockPointsAccountService.deductPoints.mockResolvedValue({});

      await service.handleOrderRefunded('order1', 'm1', {
        refundReferenceId: 'refund-1',
        refundPointsAmount: 40,
        earnedPointsClawbackRatio: 0.4,
        refundCoupon: false,
        partialRefund: true,
      });

      expect(mockRedisService.tryLock).toHaveBeenCalledWith('lock:mkt:idem:order:refunded:order1:refund-1', 30000);
      expect(mockRedisClient.set).toHaveBeenCalledWith('mkt:idem:order:refunded:order1:refund-1', 'inflight', 'EX', 30);
      expect(mockRedisClient.set).toHaveBeenCalledWith('mkt:idem:order:refunded:order1:refund-1', 'done', 'EX', 600);
      expect(mockCouponUsageService.refundCoupon).not.toHaveBeenCalled();
      expect(mockShareTokenService.applySidOrderCountDecrement).not.toHaveBeenCalled();
      expect(mockPointsAccountService.refundSpentPoints).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'm1',
          amount: 40,
          relatedId: 'order1',
          remark: '订单部分退款原路返还',
        }),
      );
      expect(mockPointsAccountService.deductPoints).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 8,
          type: PointsTransactionType.DEDUCT_ADMIN,
          remark: '订单部分退款扣减消费积分',
        }),
      );
      expect(mockEventEmitter.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            userCouponId: null,
            refundPoints: 40,
            partialRefund: true,
            refundReferenceId: 'refund-1',
            clawbackEarnedPoints: 8,
          }),
        }),
      );
    });

    // R-BRANCH-ORDER-02
    it('Given 可用积分小于待回收消费积分, When handleOrderRefunded, Then 部分扣回并记录欠账', async () => {
      mockOrderService.findByIdForMarketing.mockResolvedValue({
        id: 'order1',
        tenantId: 't1',
        memberId: 'm1',
        userCouponId: null,
        pointsUsed: 0,
        items: [{ id: 101 }],
      });
      mockPrisma.mktPointsTransaction.findFirst.mockResolvedValue({
        id: 'earn-tx-1',
        amount: 15,
      });
      mockPrisma.mktPointsAccount.findFirst.mockResolvedValue({
        id: 'account-1',
        availablePoints: 10,
      });
      mockPointsAccountService.refundSpentPoints.mockResolvedValue({
        data: { ledger: { strategy: 'ORIGINAL_LOT_RESTORE' } },
      });

      await service.handleOrderRefunded('order1', 'm1');

      expect(mockPointsAccountService.deductPoints).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10,
          type: PointsTransactionType.DEDUCT_ADMIN,
          relatedId: 'order1',
        }),
      );
      expect(mockPrisma.mktPointsDebt.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            accountId: 'account-1',
            memberId: 'm1',
            sourceTransactionId: 'earn-tx-1',
            relatedId: 'order1',
            reason: PointsDebtReason.ORDER_REFUND_CLAWBACK_INSUFFICIENT,
            status: PointsDebtStatus.PARTIAL,
            expectedAmount: 15,
            deductedAmount: 10,
            debtAmount: 5,
          }),
        }),
      );
    });
  });
});
