import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { OrderService } from './order.service';
import { BusinessException } from 'src/common/exceptions';
import { OrderRepository } from './order.repository';
import { CartRepository } from '../cart/cart.repository';
import { OrderCheckoutService } from './services/order-checkout.service';
import { OrderCreationApplicationService } from './services/order-creation-application.service';
import { AttributionService } from './services/attribution.service';
import { OrderItemAttributionService } from './services/order-item-attribution.service';
import { CartService } from '../cart/cart.service';
import { RiskService } from 'src/module/risk/risk.service';
import { OrderIntegrationService } from 'src/module/marketing/integration/integration.service';
import { PlayInstanceService } from 'src/module/marketing/instance/instance.service';
import { Result } from 'src/common/response/result';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { Decimal } from '@prisma/client/runtime/library';
import { FulfillmentService } from 'src/module/fulfillment/fulfillment.service';
import { OrderAsyncTaskPort } from './ports/order-async-task.port';
import { OrderCartPort } from './ports/order-cart.port';
import { OrderInventoryPort } from './ports/order-inventory.port';
import { OrderMarketingPort } from './ports/order-marketing.port';
import { OrderRiskPort } from './ports/order-risk.port';
import { OrderDomainEventPublisher } from './events/order-domain-event.publisher';
import { StockService } from 'src/module/store/stock/stock.service';
import { OrderAutoCancelConfigService } from './config/order-auto-cancel.config';
import { ActivityContextTokenService } from 'src/module/marketing/resolution/services/activity-context-token.service';
import { CouponUsageService } from 'src/module/marketing/coupon/usage/usage.service';
import { PointsAccountService } from 'src/module/marketing/points/account/account.service';
import { DistributorEligibilityService } from 'src/module/store/distribution/services/distributor-eligibility.service';

describe('OrderService', () => {
  let service: OrderService;

  // ── Mock 基础数据 ──────────────────────────────────────────────
  const MEMBER_ID = 'member-1';
  const TENANT_ID = 'tenant-1';
  const ORDER_ID = 'order-id-1';
  const ORDER_SN = '202601010000ABCD1234';

  const mockCheckoutPreview = {
    totalAmount: 100,
    freightAmount: 0,
    discountAmount: 0,
    payAmount: 100,
    hasService: false,
    outOfRange: false,
    items: [
      {
        skuId: 'sku-1',
        productId: 'prod-1',
        productName: '测试商品',
        productImg: 'img.jpg',
        price: 100,
        quantity: 1,
        totalAmount: 100,
      },
    ],
  };

  const mockOrder = {
    id: ORDER_ID,
    orderSn: ORDER_SN,
    memberId: MEMBER_ID,
    tenantId: TENANT_ID,
    status: 'PENDING_PAY',
    payStatus: 'UNPAID',
    orderType: 'PRODUCT',
    totalAmount: new Decimal(100),
    freightAmount: new Decimal(0),
    discountAmount: new Decimal(0),
    couponDiscount: new Decimal(0),
    pointsDiscount: new Decimal(0),
    payAmount: new Decimal(100),
    receiverName: '张三',
    receiverPhone: '13800138000',
    receiverAddress: '北京市',
    bookingTime: null,
    serviceRemark: null,
    payTime: null,
    createTime: new Date(),
    remark: null,
    items: [
      {
        productId: 'prod-1',
        productName: '测试商品',
        productImg: 'img.jpg',
        skuId: 'sku-1',
        specData: null,
        price: new Decimal(100),
        quantity: 1,
        totalAmount: new Decimal(100),
      },
    ],
  };

  // ── Mock 依赖 ──────────────────────────────────────────────────
  const mockPrisma = {
    umsMember: { findFirst: jest.fn() },
    omsOrder: { create: jest.fn(), update: jest.fn() },
    omsOrderItem: { updateMany: jest.fn(), update: jest.fn() },
    playInstance: { findFirst: jest.fn() },
    pmsTenantSku: { findFirst: jest.fn() },
  };

  const mockTenantHelper = {
    readWhereForDelegate: jest.fn((_, where) => where),
  };

  const mockOrderRepo = {
    findOne: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    updateStatusIfCurrent: jest.fn(),
    cancelUnpaidIfCurrent: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  };

  const mockCartRepo = {
    deleteByMemberAndTenant: jest.fn().mockResolvedValue(undefined),
    deleteCheckedOutLines: jest.fn().mockResolvedValue(undefined),
  };

  const mockCheckoutService = {
    getCheckoutPreview: jest.fn().mockResolvedValue(mockCheckoutPreview),
    checkLocation: jest.fn().mockResolvedValue(undefined),
  };

  const mockAttributionService = {
    getFinalShareUserId: jest.fn().mockResolvedValue(null),
  };
  const mockDistributorEligibilityService = {
    isActive: jest.fn().mockResolvedValue(true),
  };

  const mockCartService = {
    syncCartToRedis: jest.fn().mockResolvedValue(undefined),
  };

  const mockOrderItemAttributionService = {
    createFromPreview: jest.fn().mockResolvedValue({ id: 'attr-1' }),
    writeOrderItemFact: jest.fn().mockResolvedValue(undefined),
  };

  const mockRiskService = {
    checkOrderRisk: jest.fn().mockResolvedValue(undefined),
  };

  const mockOrderIntegrationService = {
    calculateOrderDiscount: jest.fn(),
  };

  const mockOrderEventPublisher = {
    publishCreated: jest.fn().mockResolvedValue(undefined),
    publishPaid: jest.fn().mockResolvedValue(undefined),
    publishCancelled: jest.fn().mockResolvedValue(undefined),
    publishRefunded: jest.fn().mockResolvedValue(undefined),
  };

  const mockPlayInstanceService = {
    create: jest.fn(),
  };

  const mockFulfillmentService = {
    confirmProductReceiptForCustomer: jest.fn(),
  };

  const mockStockService = {
    deductForOrderItems: jest.fn().mockResolvedValue(undefined),
    releaseForOrderItems: jest.fn().mockResolvedValue(undefined),
  };

  const mockNotificationQueue = { add: jest.fn().mockResolvedValue({}) };
  const mockOrderDelayQueue = { add: jest.fn().mockResolvedValue({}) };
  const mockConfigService = {
    get: jest.fn(),
  };
  const mockActivityContextTokenService = {
    verify: jest.fn().mockReturnValue({
      tenantId: TENANT_ID,
      memberId: MEMBER_ID,
      activityType: 'FLASH',
      activityConfigId: 'cfg-1',
    }),
  };
  const mockCouponUsageService = {
    lockCouponInTx: jest.fn().mockResolvedValue(undefined),
  };
  const mockPointsAccountService = {
    freezePointsInTx: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        OrderCreationApplicationService,
        OrderInventoryPort,
        OrderMarketingPort,
        OrderCartPort,
        OrderRiskPort,
        OrderAsyncTaskPort,
        OrderAutoCancelConfigService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TenantHelper, useValue: mockTenantHelper },
        { provide: OrderRepository, useValue: mockOrderRepo },
        { provide: CartRepository, useValue: mockCartRepo },
        { provide: OrderCheckoutService, useValue: mockCheckoutService },
        { provide: AttributionService, useValue: mockAttributionService },
        { provide: OrderItemAttributionService, useValue: mockOrderItemAttributionService },
        { provide: CartService, useValue: mockCartService },
        { provide: RiskService, useValue: mockRiskService },
        { provide: OrderIntegrationService, useValue: mockOrderIntegrationService },
        { provide: OrderDomainEventPublisher, useValue: mockOrderEventPublisher },
        { provide: PlayInstanceService, useValue: mockPlayInstanceService },
        { provide: FulfillmentService, useValue: mockFulfillmentService },
        { provide: StockService, useValue: mockStockService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ActivityContextTokenService, useValue: mockActivityContextTokenService },
        { provide: CouponUsageService, useValue: mockCouponUsageService },
        { provide: PointsAccountService, useValue: mockPointsAccountService },
        { provide: DistributorEligibilityService, useValue: mockDistributorEligibilityService },
        { provide: getQueueToken('ORDER_NOTIFICATION'), useValue: mockNotificationQueue },
        { provide: getQueueToken('ORDER_DELAY'), useValue: mockOrderDelayQueue },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    jest.clearAllMocks();

    // 重置常用默认值
    mockCheckoutService.getCheckoutPreview.mockResolvedValue(mockCheckoutPreview);
    mockPrisma.umsMember.findFirst.mockResolvedValue({ parentId: null });
    mockPrisma.omsOrder.create.mockResolvedValue({ ...mockOrder, items: mockOrder.items });
    mockPrisma.pmsTenantSku.findFirst.mockResolvedValue({ pointsRatio: 100 });
    mockCartRepo.deleteCheckedOutLines.mockResolvedValue(undefined);
    mockPrisma.playInstance.findFirst.mockResolvedValue(null);
    mockPlayInstanceService.create.mockResolvedValue(Result.ok({ id: 'play-inst-1' }));
    mockFulfillmentService.confirmProductReceiptForCustomer.mockResolvedValue(Result.ok(null, '确认收货成功'));
    mockPrisma.omsOrderItem.update.mockResolvedValue({});
    mockNotificationQueue.add.mockResolvedValue({});
    mockOrderDelayQueue.add.mockResolvedValue({});
    mockOrderRepo.updateStatusIfCurrent.mockResolvedValue({ count: 1 });
    mockOrderRepo.cancelUnpaidIfCurrent.mockResolvedValue({ count: 1 });
    mockOrderEventPublisher.publishCreated.mockResolvedValue(undefined);
    mockOrderEventPublisher.publishCancelled.mockResolvedValue(undefined);
    mockStockService.deductForOrderItems.mockResolvedValue(undefined);
    mockStockService.releaseForOrderItems.mockResolvedValue(undefined);
    mockDistributorEligibilityService.isActive.mockResolvedValue(true);
  });

  /** 断言 BusinessException 的 msg 字段 */
  const expectBizError = async (promise: Promise<unknown>, msg: string) => {
    await expect(promise).rejects.toThrow(BusinessException);
    await expect(promise).rejects.toMatchObject({
      response: expect.objectContaining({ msg: expect.stringContaining(msg) }),
    });
  };

  const baseCreateDto = {
    tenantId: TENANT_ID,
    items: [{ skuId: 'sku-1', quantity: 1 }],
    receiverName: '张三',
    receiverPhone: '13800138000',
    receiverAddress: '北京市',
  };

  // ══════════════════════════════════════════════════════════════
  // createOrder
  // ══════════════════════════════════════════════════════════════
  describe('createOrder', () => {
    // R-PRE-ORDER-01: 未登录时拒绝创建
    it('Given memberId 为空, When createOrder, Then 抛出"请先登录"', async () => {
      await expectBizError(service.createOrder('', baseCreateDto), '请先登录');
    });

    it('Given tenantId 为空, When createOrder, Then 拒绝下单且不触发风控或结算预览', async () => {
      await expectBizError(service.createOrder(MEMBER_ID, { ...baseCreateDto, tenantId: ' ' }), '租户ID不能为空');

      expect(mockRiskService.checkOrderRisk).not.toHaveBeenCalled();
      expect(mockCheckoutService.getCheckoutPreview).not.toHaveBeenCalled();
      expect(mockPrisma.omsOrder.create).not.toHaveBeenCalled();
    });

    it('Given items 为空数组, When createOrder, Then 拒绝创建空订单', async () => {
      await expectBizError(service.createOrder(MEMBER_ID, { ...baseCreateDto, items: [] }), '订单商品不能为空');

      expect(mockRiskService.checkOrderRisk).not.toHaveBeenCalled();
      expect(mockCheckoutService.getCheckoutPreview).not.toHaveBeenCalled();
      expect(mockPrisma.omsOrder.create).not.toHaveBeenCalled();
    });

    it.each([0, -1, Number.NaN, 1.5])(
      'Given 订单商品数量=%p, When createOrder, Then 拒绝非法数量',
      async (quantity) => {
        await expectBizError(
          service.createOrder(MEMBER_ID, {
            ...baseCreateDto,
            items: [{ skuId: 'sku-1', quantity } as any],
          }),
          '订单商品数量必须大于0',
        );

        expect(mockRiskService.checkOrderRisk).not.toHaveBeenCalled();
        expect(mockCheckoutService.getCheckoutPreview).not.toHaveBeenCalled();
        expect(mockPrisma.omsOrder.create).not.toHaveBeenCalled();
      },
    );

    it('Given skuId 为空, When createOrder, Then 拒绝非法订单明细', async () => {
      await expectBizError(
        service.createOrder(MEMBER_ID, {
          ...baseCreateDto,
          items: [{ skuId: ' ', quantity: 1 }],
        }),
        'SKU不能为空',
      );

      expect(mockRiskService.checkOrderRisk).not.toHaveBeenCalled();
      expect(mockCheckoutService.getCheckoutPreview).not.toHaveBeenCalled();
      expect(mockPrisma.omsOrder.create).not.toHaveBeenCalled();
    });

    // R-FLOW-ORDER-01: 正常创建订单返回 orderId/orderSn/payAmount
    it('Given 有效参数, When createOrder, Then 返回 orderId/orderSn/payAmount', async () => {
      const result = await service.createOrder(MEMBER_ID, baseCreateDto);

      expect(result.data).toMatchObject({
        orderId: ORDER_ID,
        orderSn: ORDER_SN,
        payAmount: expect.anything(),
      });
      expect(String(result.data.payAmount)).toBe('100');
      expect(mockStockService.deductForOrderItems).toHaveBeenCalledWith(
        TENANT_ID,
        baseCreateDto.items,
        expect.any(Map),
      );
    });

    it('Given last-touch 分享人已失效, When createOrder, Then 回退到有效绑定归因', async () => {
      mockCheckoutService.getCheckoutPreview.mockResolvedValue({
        ...mockCheckoutPreview,
        items: [{ ...mockCheckoutPreview.items[0], shareUserId: 'share-inactive' }],
      });
      mockAttributionService.getFinalShareUserId.mockResolvedValue('share-active');
      mockDistributorEligibilityService.isActive.mockImplementation((_tenantId: string, memberId: string) =>
        Promise.resolve(memberId === 'share-active'),
      );

      await service.createOrder(MEMBER_ID, baseCreateDto);

      expect(mockDistributorEligibilityService.isActive).toHaveBeenCalledWith(TENANT_ID, 'share-inactive');
      expect(mockDistributorEligibilityService.isActive).toHaveBeenCalledWith(TENANT_ID, 'share-active');
      expect(mockPrisma.omsOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shareUserId: 'share-active',
          }),
        }),
      );
    });

    // R-FLOW-ORDER-01b: 会员升级活动下单时创建玩法实例并绑定订单项
    it('Given 结算明细含 MEMBER_UPGRADE, When createOrder, Then 创建玩法实例并回写 playInstanceId', async () => {
      const cfgId = 'cfg-member-upgrade';
      mockCheckoutService.getCheckoutPreview.mockResolvedValue({
        ...mockCheckoutPreview,
        items: [
          {
            ...mockCheckoutPreview.items[0],
            activityContextKey: `MEMBER_UPGRADE:${cfgId}`,
            activityType: 'MEMBER_UPGRADE',
            activityConfigId: cfgId,
            activityNameSnapshot: 'MEMBER_UPGRADE',
            activityPriceSnapshot: 59,
            activityStatusSnapshot: 'ON_SHELF',
            activityCommissionModeSnapshot: null,
            activityCommissionRateSnapshot: null,
          },
        ],
      });
      mockPrisma.omsOrder.create.mockResolvedValue({
        ...mockOrder,
        items: [
          {
            id: 901,
            productId: 'prod-1',
            productName: '测试商品',
            productImg: 'img.jpg',
            skuId: 'sku-1',
            specData: null,
            price: new Decimal(100),
            quantity: 1,
            totalAmount: new Decimal(100),
            activityContextKey: `MEMBER_UPGRADE:${cfgId}`,
            activityType: 'MEMBER_UPGRADE',
            activityConfigId: cfgId,
            activityNameSnapshot: 'MEMBER_UPGRADE',
            activityPriceSnapshot: 59,
            activityStatusSnapshot: 'ON_SHELF',
            activityCommissionModeSnapshot: null,
            activityCommissionRateSnapshot: null,
          },
        ],
      });

      await service.createOrder(MEMBER_ID, baseCreateDto);

      expect(mockPlayInstanceService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          templateCode: 'MEMBER_UPGRADE',
          configId: cfgId,
          orderId: ORDER_ID,
          orderItemId: 901,
        }),
      );
      expect(mockPrisma.omsOrderItem.update).toHaveBeenCalledWith({
        where: { id: 901 },
        data: { playInstanceId: 'play-inst-1' },
      });
    });

    it('Given COURSE_GROUP_BUY item with groupId, When createOrder, Then create play instance and bind playInstanceId', async () => {
      const cfgId = 'cfg-course-group';
      const groupId = 'team-001';

      mockCheckoutService.getCheckoutPreview.mockResolvedValue({
        ...mockCheckoutPreview,
        items: [
          {
            ...mockCheckoutPreview.items[0],
            activityContextKey: `COURSE_GROUP_BUY:${cfgId}`,
            activityType: 'COURSE_GROUP_BUY',
            activityConfigId: cfgId,
            activityNameSnapshot: 'COURSE_GROUP_BUY',
            activityPriceSnapshot: 59,
            activityStatusSnapshot: 'ON_SHELF',
            activityCommissionModeSnapshot: null,
            activityCommissionRateSnapshot: null,
          },
        ],
      });
      mockPrisma.omsOrder.create.mockResolvedValue({
        ...mockOrder,
        items: [
          {
            id: 902,
            productId: 'prod-1',
            productName: 'test',
            productImg: 'img.jpg',
            skuId: 'sku-1',
            specData: null,
            price: new Decimal(100),
            quantity: 1,
            totalAmount: new Decimal(100),
            activityContextKey: `COURSE_GROUP_BUY:${cfgId}`,
            activityType: 'COURSE_GROUP_BUY',
            activityConfigId: cfgId,
            activityNameSnapshot: 'COURSE_GROUP_BUY',
            activityPriceSnapshot: 59,
            activityStatusSnapshot: 'ON_SHELF',
            activityCommissionModeSnapshot: null,
            activityCommissionRateSnapshot: null,
          },
        ],
      });

      await service.createOrder(MEMBER_ID, {
        ...baseCreateDto,
        items: [{ skuId: 'sku-1', quantity: 1, groupId, isLeader: false }],
      } as any);

      expect(mockPlayInstanceService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          templateCode: 'COURSE_GROUP_BUY',
          configId: cfgId,
          orderId: ORDER_ID,
          orderItemId: 902,
          instanceData: expect.objectContaining({
            groupId,
            parentId: groupId,
            isLeader: false,
          }),
        }),
      );
      expect(mockPrisma.omsOrderItem.update).toHaveBeenCalledWith({
        where: { id: 902 },
        data: { playInstanceId: 'play-inst-1' },
      });
    });

    it('Given COURSE_GROUP_BUY order with global groupId/isLeader, When createOrder, Then fallback global params are used', async () => {
      const cfgId = 'cfg-course-group-global';
      const globalGroupId = 'team-global-01';

      mockCheckoutService.getCheckoutPreview.mockResolvedValue({
        ...mockCheckoutPreview,
        items: [
          {
            ...mockCheckoutPreview.items[0],
            activityContextKey: `COURSE_GROUP_BUY:${cfgId}`,
            activityType: 'COURSE_GROUP_BUY',
            activityConfigId: cfgId,
            activityNameSnapshot: 'COURSE_GROUP_BUY',
            activityPriceSnapshot: 79,
            activityStatusSnapshot: 'ON_SHELF',
            activityCommissionModeSnapshot: null,
            activityCommissionRateSnapshot: null,
          },
        ],
      });
      mockPrisma.omsOrder.create.mockResolvedValue({
        ...mockOrder,
        items: [
          {
            id: 903,
            productId: 'prod-1',
            productName: 'test',
            productImg: 'img.jpg',
            skuId: 'sku-1',
            specData: null,
            price: new Decimal(100),
            quantity: 1,
            totalAmount: new Decimal(100),
            activityContextKey: `COURSE_GROUP_BUY:${cfgId}`,
            activityType: 'COURSE_GROUP_BUY',
            activityConfigId: cfgId,
            activityNameSnapshot: 'COURSE_GROUP_BUY',
            activityPriceSnapshot: 79,
            activityStatusSnapshot: 'ON_SHELF',
            activityCommissionModeSnapshot: null,
            activityCommissionRateSnapshot: null,
          },
        ],
      });

      await service.createOrder(MEMBER_ID, {
        ...baseCreateDto,
        groupId: globalGroupId,
        isLeader: false,
      } as any);

      expect(mockPlayInstanceService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          templateCode: 'COURSE_GROUP_BUY',
          configId: cfgId,
          orderItemId: 903,
          instanceData: expect.objectContaining({
            groupId: globalGroupId,
            parentId: globalGroupId,
            isLeader: false,
          }),
        }),
      );
    });

    // R-FLOW-ORDER-02: 创建订单后清除购物车
    it('Given 正常下单, When createOrder, Then 清除购物车中对应 SKU', async () => {
      await service.createOrder(MEMBER_ID, baseCreateDto);

      expect(mockCartRepo.deleteCheckedOutLines).toHaveBeenCalledWith(MEMBER_ID, TENANT_ID, [
        { skuId: 'sku-1', activityContextKey: null },
      ]);
    });

    // R-FLOW-ORDER-03: 创建订单后同步购物车到 Redis
    it('Given 正常下单, When createOrder, Then 同步购物车到 Redis', async () => {
      await service.createOrder(MEMBER_ID, baseCreateDto);

      expect(mockCartService.syncCartToRedis).toHaveBeenCalledWith(MEMBER_ID, TENANT_ID);
    });

    // R-FLOW-ORDER-04: 创建订单后加入延迟通知队列
    it('Given 正常下单, When createOrder, Then 加入通知延迟队列（2分钟）', async () => {
      await service.createOrder(MEMBER_ID, baseCreateDto);

      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        { orderId: ORDER_ID },
        expect.objectContaining({
          jobId: `order_notification:${ORDER_ID}`,
          delay: 1000 * 60 * 2,
          attempts: 3,
          removeOnComplete: 100,
          removeOnFail: 500,
        }),
      );
    });

    // R-FLOW-ORDER-05: 创建订单后加入超时自动关闭队列
    it('Given 正常下单, When createOrder, Then 按配置加入自动取消队列', async () => {
      await service.createOrder(MEMBER_ID, baseCreateDto);

      expect(mockOrderDelayQueue.add).toHaveBeenCalledWith(
        'cancel_unpaid',
        expect.objectContaining({
          orderId: ORDER_ID,
          reason: '超时未支付自动关闭',
          timeoutMinutes: 30,
        }),
        expect.objectContaining({
          jobId: `cancel_unpaid:${ORDER_ID}`,
          delay: 30 * 60 * 1000,
          attempts: 3,
          removeOnComplete: 100,
          removeOnFail: 500,
        }),
      );
    });

    // R-PRE-ORDER-02: 库存不足时抛出异常
    it('Given 库存不足, When createOrder, Then 抛出"库存不足"', async () => {
      mockStockService.deductForOrderItems.mockRejectedValue(new BusinessException(500, '商品 测试商品 库存不足'));

      await expectBizError(service.createOrder(MEMBER_ID, baseCreateDto), '库存不足');
    });

    it('Given 优惠券订单扣库存失败, When createOrder, Then 不发布订单创建营销事件', async () => {
      mockOrderIntegrationService.calculateOrderDiscount.mockResolvedValue({
        data: { couponDiscount: 10, pointsDiscount: 0, finalAmount: 90 },
      });
      mockStockService.deductForOrderItems.mockRejectedValue(new BusinessException(500, '商品 测试商品 库存不足'));

      await expectBizError(
        service.createOrder(MEMBER_ID, {
          ...baseCreateDto,
          userCouponId: 'coupon-1',
        }),
        '库存不足',
      );

      expect(mockOrderEventPublisher.publishCreated).not.toHaveBeenCalled();
      expect(mockCartRepo.deleteCheckedOutLines).not.toHaveBeenCalled();
    });

    it('Given 优惠券订单清购物车失败, When createOrder, Then 不发布订单创建营销事件', async () => {
      mockOrderIntegrationService.calculateOrderDiscount.mockResolvedValue({
        data: { couponDiscount: 10, pointsDiscount: 0, finalAmount: 90 },
      });
      mockCartRepo.deleteCheckedOutLines.mockRejectedValue(new Error('cart db down'));

      await expect(
        service.createOrder(MEMBER_ID, {
          ...baseCreateDto,
          userCouponId: 'coupon-1',
        }),
      ).rejects.toThrow('cart db down');

      expect(mockStockService.deductForOrderItems).toHaveBeenCalled();
      expect(mockOrderEventPublisher.publishCreated).not.toHaveBeenCalled();
    });

    // R-FLOW-ORDER-06: 有坐标时调用 LBS 二次校验
    it('Given 传入坐标, When createOrder, Then 调用 checkLocation 二次校验', async () => {
      await service.createOrder(MEMBER_ID, {
        ...baseCreateDto,
        receiverLat: '39.9',
        receiverLng: '116.4',
      });

      expect(mockCheckoutService.checkLocation).toHaveBeenCalledWith(TENANT_ID, 39.9, 116.4);
    });

    // R-BRANCH-ORDER-01: 无坐标且预览超出范围时抛出异常
    it('Given 无坐标且 outOfRange=true, When createOrder, Then 抛出"超出服务范围"', async () => {
      mockCheckoutService.getCheckoutPreview.mockResolvedValue({
        ...mockCheckoutPreview,
        outOfRange: true,
      });

      await expectBizError(service.createOrder(MEMBER_ID, baseCreateDto), '超出服务范围');
    });

    // R-BRANCH-ORDER-02: 有优惠券时调用折扣计算并锁定
    it('Given 传入 userCouponId, When createOrder, Then 调用折扣计算并锁定优惠券', async () => {
      mockOrderIntegrationService.calculateOrderDiscount.mockResolvedValue({
        data: { couponDiscount: 10, pointsDiscount: 0, finalAmount: 90 },
      });

      await service.createOrder(MEMBER_ID, {
        ...baseCreateDto,
        userCouponId: 'coupon-1',
      });

      expect(mockOrderIntegrationService.calculateOrderDiscount).toHaveBeenCalled();
      expect(mockPrisma.omsOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountAmount: 10,
            couponDiscount: 10,
            pointsDiscount: 0,
            payAmount: 90,
          }),
        }),
      );
      expect(mockCouponUsageService.lockCouponInTx).toHaveBeenCalledWith('coupon-1', ORDER_ID);
      expect(mockPointsAccountService.freezePointsInTx).not.toHaveBeenCalled();
      expect(mockOrderEventPublisher.publishCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: ORDER_ID,
          orderSn: expect.any(String),
          tenantId: TENANT_ID,
          memberId: MEMBER_ID,
          userCouponId: 'coupon-1',
        }),
      );
    });

    it('Given 使用积分下单, When createOrder, Then 在发布 outbox 前冻结积分', async () => {
      mockOrderIntegrationService.calculateOrderDiscount.mockResolvedValue({
        data: { couponDiscount: 0, pointsDiscount: 5, finalAmount: 95 },
      });

      await service.createOrder(MEMBER_ID, {
        ...baseCreateDto,
        pointsUsed: 50,
      });

      expect(mockPrisma.omsOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountAmount: 5,
            couponDiscount: 0,
            pointsDiscount: 5,
            payAmount: 95,
          }),
        }),
      );
      expect(mockPointsAccountService.freezePointsInTx).toHaveBeenCalledWith(MEMBER_ID, 50, ORDER_ID);
      expect(mockOrderEventPublisher.publishCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: ORDER_ID,
          pointsUsed: 50,
        }),
      );
    });

    // R-BRANCH-ORDER-03: 优惠计算失败时抛出异常
    it('Given 优惠计算抛出异常, When createOrder, Then 抛出"优惠计算失败"', async () => {
      mockOrderIntegrationService.calculateOrderDiscount.mockRejectedValue(new Error('服务不可用'));

      await expectBizError(
        service.createOrder(MEMBER_ID, { ...baseCreateDto, userCouponId: 'coupon-1' }),
        '优惠计算失败',
      );
    });

    it('Given 优惠后应付金额与冻结口径不一致, When createOrder, Then 拒绝创建脏金额订单', async () => {
      mockOrderIntegrationService.calculateOrderDiscount.mockResolvedValue({
        data: { couponDiscount: 10, pointsDiscount: 0, finalAmount: 95 },
      });

      await expectBizError(
        service.createOrder(MEMBER_ID, { ...baseCreateDto, userCouponId: 'coupon-1' }),
        '订单金额计算异常',
      );
      expect(mockPrisma.omsOrder.create).not.toHaveBeenCalled();
    });

    // R-FLOW-ORDER-07: 风控检测（有 clientInfo 时调用）
    it('Given 传入 clientInfo, When createOrder, Then 调用风控检测', async () => {
      const clientInfo = { ipaddr: '127.0.0.1', deviceType: 'H5' } as any;

      await service.createOrder(MEMBER_ID, baseCreateDto, clientInfo);

      expect(mockRiskService.checkOrderRisk).toHaveBeenCalledWith(MEMBER_ID, TENANT_ID, '127.0.0.1', 'H5');
    });

    // R-BRANCH-ORDER-04: 通知队列失败不影响订单创建
    it('Given 通知队列 add 失败, When createOrder, Then 订单仍创建成功', async () => {
      mockNotificationQueue.add.mockRejectedValue(new Error('队列不可用'));

      const result = await service.createOrder(MEMBER_ID, baseCreateDto);

      expect(result.data.orderId).toBe(ORDER_ID);
    });

    it('Given 购物车 Redis 同步失败, When createOrder, Then 订单仍创建成功并继续投递队列', async () => {
      mockCartService.syncCartToRedis.mockRejectedValue(new Error('redis down'));

      const result = await service.createOrder(MEMBER_ID, baseCreateDto);

      expect(result.data.orderId).toBe(ORDER_ID);
      expect(mockNotificationQueue.add).toHaveBeenCalled();
      expect(mockOrderDelayQueue.add).toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // cancelOrder
  // ══════════════════════════════════════════════════════════════
  describe('cancelOrder', () => {
    // R-PRE-CANCEL-01: 订单不存在时抛出异常
    it('Given 订单不存在, When cancelOrder, Then 抛出"订单不存在"', async () => {
      mockOrderRepo.findOne.mockResolvedValue(null);

      await expectBizError(service.cancelOrder(MEMBER_ID, { orderId: ORDER_ID }), '订单不存在');
    });

    it('Given 用户 A 尝试取消用户 B 的订单, When cancelOrder, Then 按当前 memberId 查询并拒绝越权', async () => {
      mockOrderRepo.findOne.mockResolvedValue(null);

      await expectBizError(service.cancelOrder('member-2', { orderId: ORDER_ID }), '订单不存在');

      expect(mockOrderRepo.findOne).toHaveBeenCalledWith(
        { id: ORDER_ID, memberId: 'member-2' },
        { include: { items: true } },
      );
      expect(mockOrderRepo.cancelUnpaidIfCurrent).not.toHaveBeenCalled();
      expect(mockStockService.releaseForOrderItems).not.toHaveBeenCalled();
    });

    // R-PRE-CANCEL-02: 非待支付状态不可取消
    it('Given 订单状态为 SHIPPED, When cancelOrder, Then 抛出"只能取消待支付订单"', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ ...mockOrder, status: 'SHIPPED' });

      await expectBizError(service.cancelOrder(MEMBER_ID, { orderId: ORDER_ID }), '只能取消待支付订单');
    });

    it('Given 订单已经取消, When cancelOrder 重复调用, Then 幂等返回已取消且不重复释放库存', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ ...mockOrder, status: 'CANCELLED' });

      const result = await service.cancelOrder(MEMBER_ID, { orderId: ORDER_ID });

      expect(result.msg).toBe('订单已取消');
      expect(mockOrderRepo.cancelUnpaidIfCurrent).not.toHaveBeenCalled();
      expect(mockStockService.releaseForOrderItems).not.toHaveBeenCalled();
      expect(mockOrderEventPublisher.publishCancelled).not.toHaveBeenCalled();
    });

    // R-FLOW-CANCEL-01: 取消成功后更新状态并恢复库存
    it('Given 待支付订单, When cancelOrder, Then 更新状态为 CANCELLED 并恢复库存', async () => {
      mockOrderRepo.findOne.mockResolvedValue(mockOrder);

      await service.cancelOrder(MEMBER_ID, { orderId: ORDER_ID });

      expect(mockOrderRepo.cancelUnpaidIfCurrent).toHaveBeenCalledWith(ORDER_ID, undefined);
      expect(mockStockService.releaseForOrderItems).toHaveBeenCalledWith(TENANT_ID, mockOrder.items);
    });

    // R-FLOW-CANCEL-02: 取消后触发订单取消领域事件
    it('Given 取消成功, When cancelOrder, Then 发布 order.cancelled 事件', async () => {
      mockOrderRepo.findOne.mockResolvedValue(mockOrder);

      await service.cancelOrder(MEMBER_ID, { orderId: ORDER_ID });

      expect(mockOrderEventPublisher.publishCancelled).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: ORDER_ID,
          orderSn: ORDER_SN,
          tenantId: TENANT_ID,
          memberId: MEMBER_ID,
        }),
      );
    });

    // R-ATOMIC-CANCEL-02: 取消事件 outbox 写入失败必须回滚取消事务
    it('Given order.cancelled outbox 写入失败, When cancelOrder, Then 错误上浮', async () => {
      mockOrderRepo.findOne.mockResolvedValue(mockOrder);
      mockOrderEventPublisher.publishCancelled.mockRejectedValue(new Error('outbox down'));

      await expect(service.cancelOrder(MEMBER_ID, { orderId: ORDER_ID })).rejects.toThrow('outbox down');
    });

    it('Given 两个取消请求并发且 CAS 已失败, When cancelOrder, Then 不释放库存也不发布取消事件', async () => {
      mockOrderRepo.findOne.mockResolvedValue(mockOrder);
      mockOrderRepo.cancelUnpaidIfCurrent.mockResolvedValue({ count: 0 });

      const result = await service.cancelOrder(MEMBER_ID, { orderId: ORDER_ID });

      expect(result.msg).toBe('订单状态已变化，请刷新后重试');
      expect(mockStockService.releaseForOrderItems).not.toHaveBeenCalled();
      expect(mockOrderEventPublisher.publishCancelled).not.toHaveBeenCalled();
    });

    // R-ATOMIC-CANCEL-01: 库存释放抛出时错误必须上浮，不能静默返回取消成功
    it('Given CAS 成功但库存释放抛出, When cancelOrder, Then 错误上浮（库存-取消原子性保证）', async () => {
      mockOrderRepo.findOne.mockResolvedValue(mockOrder);
      mockStockService.releaseForOrderItems.mockRejectedValue(new Error('库存服务不可用'));

      await expect(service.cancelOrder(MEMBER_ID, { orderId: ORDER_ID })).rejects.toThrow('库存服务不可用');
      expect(mockOrderEventPublisher.publishCancelled).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // confirmReceipt
  // ══════════════════════════════════════════════════════════════
  describe('confirmReceipt', () => {
    // R-PRE-CONFIRM-01: 订单不存在时抛出异常
    it('Given 订单不存在, When confirmReceipt, Then 抛出"订单不存在"', async () => {
      mockFulfillmentService.confirmProductReceiptForCustomer.mockRejectedValueOnce(
        new BusinessException(404, '订单不存在'),
      );

      await expectBizError(service.confirmReceipt(MEMBER_ID, ORDER_ID), '订单不存在');
    });

    // R-PRE-CONFIRM-02: 非已发货状态不可确认
    it('Given 订单状态为 PENDING_PAY, When confirmReceipt, Then 抛出"订单状态不正确"', async () => {
      mockFulfillmentService.confirmProductReceiptForCustomer.mockRejectedValueOnce(
        new BusinessException(500, '订单状态不正确'),
      );

      await expectBizError(service.confirmReceipt(MEMBER_ID, ORDER_ID), '订单状态不正确');
    });

    // R-FLOW-CONFIRM-01: 确认收货委托履约状态机处理
    it('Given 已发货订单, When confirmReceipt, Then 委托履约状态机确认收货', async () => {
      mockFulfillmentService.confirmProductReceiptForCustomer.mockResolvedValueOnce(Result.ok(null, '确认收货成功'));

      await service.confirmReceipt(MEMBER_ID, ORDER_ID);

      expect(mockFulfillmentService.confirmProductReceiptForCustomer).toHaveBeenCalledWith(MEMBER_ID, ORDER_ID);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // cancelOrderBySystem
  // ══════════════════════════════════════════════════════════════
  describe('cancelOrderBySystem', () => {
    // R-PRE-SYSCANCEL-01: 订单不存在时静默跳过
    it('Given 订单不存在, When cancelOrderBySystem, Then 静默返回不抛出', async () => {
      mockOrderRepo.findOne.mockResolvedValue(null);

      await expect(service.cancelOrderBySystem(ORDER_ID, '超时未支付')).resolves.not.toThrow();
    });

    // R-PRE-SYSCANCEL-02: 非待支付状态时跳过
    it('Given 订单状态为 PAID, When cancelOrderBySystem, Then 跳过不更新', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ ...mockOrder, status: 'PAID', items: [] });

      await service.cancelOrderBySystem(ORDER_ID, '超时');

      expect(mockOrderRepo.cancelUnpaidIfCurrent).not.toHaveBeenCalled();
    });

    it('Given 订单支付状态已变为 PAID, When cancelOrderBySystem, Then 跳过不释放库存', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ ...mockOrder, payStatus: 'PAID', items: [] });

      const result = await service.cancelOrderBySystem(ORDER_ID, '超时');

      expect(result.status).toBe('skipped');
      expect(mockOrderRepo.cancelUnpaidIfCurrent).not.toHaveBeenCalled();
      expect(mockStockService.releaseForOrderItems).not.toHaveBeenCalled();
    });

    // R-FLOW-SYSCANCEL-01: 待支付订单自动关闭并恢复库存
    it('Given 待支付订单, When cancelOrderBySystem, Then 更新状态并恢复库存', async () => {
      mockOrderRepo.findOne.mockResolvedValue(mockOrder);

      await service.cancelOrderBySystem(ORDER_ID, '超时未支付');

      expect(mockOrderRepo.cancelUnpaidIfCurrent).toHaveBeenCalledWith(ORDER_ID, expect.stringContaining('超时未支付'));
      expect(mockStockService.releaseForOrderItems).toHaveBeenCalledWith(TENANT_ID, mockOrder.items);
    });

    it('Given 系统自动取消 CAS 冲突, When cancelOrderBySystem, Then 不释放库存也不发布取消事件', async () => {
      mockOrderRepo.findOne.mockResolvedValue(mockOrder);
      mockOrderRepo.cancelUnpaidIfCurrent.mockResolvedValue({ count: 0 });

      const result = await service.cancelOrderBySystem(ORDER_ID, '超时未支付');

      expect(result.status).toBe('conflict');
      expect(mockStockService.releaseForOrderItems).not.toHaveBeenCalled();
      expect(mockOrderEventPublisher.publishCancelled).not.toHaveBeenCalled();
    });

    // R-ATOMIC-SYSCANCEL-01: 库存释放抛出时错误必须上浮，不能静默返回 cancelled
    it('Given CAS 成功但库存释放抛出, When cancelOrderBySystem, Then 错误上浮（库存-取消原子性保证）', async () => {
      mockOrderRepo.findOne.mockResolvedValue(mockOrder);
      mockStockService.releaseForOrderItems.mockRejectedValue(new Error('库存服务不可用'));

      await expect(service.cancelOrderBySystem(ORDER_ID, '超时未支付')).rejects.toThrow('库存服务不可用');
      expect(mockOrderEventPublisher.publishCancelled).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // getOrderList / getOrderDetail
  // ══════════════════════════════════════════════════════════════
  describe('getOrderList', () => {
    // R-FLOW-LIST-01: 返回分页订单列表
    it('Given 有效 memberId, When getOrderList, Then 返回 rows 和 total', async () => {
      mockOrderRepo.count.mockResolvedValue(1);
      mockOrderRepo.findMany.mockResolvedValue([mockOrder]);

      const result = await service.getOrderList(MEMBER_ID, { pageNum: 1, pageSize: 10 } as any);

      expect(result.data.total).toBe(1);
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0]).toMatchObject({ id: ORDER_ID, orderSn: ORDER_SN });
    });

    it.each([0, -1, 1.5, Number.NaN])(
      'Given pageNum=%p, When getOrderList, Then 拒绝非法页码且不查库',
      async (pageNum) => {
        await expectBizError(
          service.getOrderList(MEMBER_ID, { pageNum, pageSize: 10 } as any),
          '页码必须为大于等于 1 的整数',
        );

        expect(mockOrderRepo.count).not.toHaveBeenCalled();
        expect(mockOrderRepo.findMany).not.toHaveBeenCalled();
      },
    );

    it.each([0, -1, 51, 1.5, Number.NaN])(
      'Given pageSize=%p, When getOrderList, Then 拒绝非法每页数量且不查库',
      async (pageSize) => {
        await expectBizError(
          service.getOrderList(MEMBER_ID, { pageNum: 1, pageSize } as any),
          '每页数量必须为 1 到 50 的整数',
        );

        expect(mockOrderRepo.count).not.toHaveBeenCalled();
        expect(mockOrderRepo.findMany).not.toHaveBeenCalled();
      },
    );

    it('Given 非法订单状态, When getOrderList, Then 拒绝非法状态且不查库', async () => {
      await expectBizError(
        service.getOrderList(MEMBER_ID, { pageNum: 1, pageSize: 10, status: 'UNKNOWN' } as any),
        '订单状态不合法',
      );

      expect(mockOrderRepo.count).not.toHaveBeenCalled();
      expect(mockOrderRepo.findMany).not.toHaveBeenCalled();
    });

    it('Given 空订单列表, When getOrderList, Then 返回空 rows 和 total=0', async () => {
      mockOrderRepo.count.mockResolvedValue(0);
      mockOrderRepo.findMany.mockResolvedValue([]);

      const result = await service.getOrderList(MEMBER_ID, { pageNum: 1, pageSize: 10 } as any);

      expect(result.data).toEqual({ rows: [], total: 0 });
    });

    it('Given 请求第三页, When getOrderList, Then 计算稳定 skip/take', async () => {
      mockOrderRepo.count.mockResolvedValue(25);
      mockOrderRepo.findMany.mockResolvedValue([]);

      await service.getOrderList(MEMBER_ID, { pageNum: 3, pageSize: 10 } as any);

      expect(mockOrderRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('Given 仅返回 1 条封面商品但 _count.items=3, When getOrderList, Then itemCount 返回 3', async () => {
      mockOrderRepo.count.mockResolvedValue(1);
      mockOrderRepo.findMany.mockResolvedValue([
        {
          ...mockOrder,
          items: [mockOrder.items[0]],
          _count: { items: 3 },
        },
      ]);

      const result = await service.getOrderList(MEMBER_ID, { pageNum: 1, pageSize: 10 } as any);
      expect(result.data.rows[0].itemCount).toBe(3);
    });
  });

  describe('getOrderDetail', () => {
    // R-PRE-DETAIL-01: 订单不存在时抛出异常
    it('Given 订单不存在, When getOrderDetail, Then 抛出"订单不存在"', async () => {
      mockOrderRepo.findOne.mockResolvedValue(null);

      await expectBizError(service.getOrderDetail(MEMBER_ID, ORDER_ID), '订单不存在');
    });

    it('Given 用户 A 访问用户 B 的订单详情, When getOrderDetail, Then 按当前 memberId 查询并拒绝越权', async () => {
      mockOrderRepo.findOne.mockResolvedValue(null);

      await expectBizError(service.getOrderDetail('member-2', ORDER_ID), '订单不存在');

      expect(mockOrderRepo.findOne).toHaveBeenCalledWith(
        { id: ORDER_ID, memberId: 'member-2' },
        { include: { items: true } },
      );
    });

    // R-FLOW-DETAIL-01: 返回完整订单详情
    it('Given 订单存在, When getOrderDetail, Then 返回含 items 的详情', async () => {
      mockOrderRepo.findOne.mockResolvedValue(mockOrder);

      const result = await service.getOrderDetail(MEMBER_ID, ORDER_ID);

      expect(result).toMatchObject({
        id: ORDER_ID,
        orderSn: ORDER_SN,
        payAmount: 100,
      });
      expect(result.items).toHaveLength(1);
    });

    it('Given 旧订单券和积分抵扣未写入 discountAmount, When getOrderDetail, Then VO 补算总优惠', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        ...mockOrder,
        createTime: new Date('2026-05-16T23:59:59.000Z'),
        discountAmount: new Decimal(0),
        couponDiscount: new Decimal(10),
        pointsDiscount: new Decimal(5),
        payAmount: new Decimal(85),
      });

      const result = await service.getOrderDetail(MEMBER_ID, ORDER_ID);

      expect(result.discountAmount).toBe(15);
      expect(result.payAmount).toBe(85);
    });

    it('Given 新订单 discountAmount 已冻结为总优惠, When getOrderDetail, Then VO 直接返回库内口径', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        ...mockOrder,
        createTime: new Date('2026-05-17T00:00:00.000Z'),
        discountAmount: new Decimal(15),
        couponDiscount: new Decimal(10),
        pointsDiscount: new Decimal(5),
        payAmount: new Decimal(85),
      });

      const result = await service.getOrderDetail(MEMBER_ID, ORDER_ID);

      expect(result.discountAmount).toBe(15);
      expect(result.payAmount).toBe(85);
    });
  });
});
