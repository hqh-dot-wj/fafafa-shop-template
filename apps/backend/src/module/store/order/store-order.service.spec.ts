import { Test, TestingModule } from '@nestjs/testing';
import { StoreOrderService } from './store-order.service';
import { StoreOrderRepository } from './store-order.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { FinanceCommandPort } from 'src/module/finance/ports/finance-command.port';
import { CommissionQueryPort } from 'src/module/finance/ports/commission-query.port';
import { PaymentGatewayPort } from 'src/module/payment/ports/payment-gateway.port';
import { FinRefundService } from 'src/module/finance/refund/fin-refund.service';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks/tenant-helper-mock';
import { OrderStatus, OrderType, CommissionStatus } from '@prisma/client';
import { OrderBatchStatusTransitionTarget } from './dto/store-order.dto';
import { RefundStatus } from 'src/module/payment/interfaces/payment-provider.interface';
import { DistributionQualificationService } from '../distribution/qualification/qualification.service';
import { FulfillmentService } from 'src/module/fulfillment/fulfillment.service';
import { OrderDomainEventPublisher } from 'src/module/client/order/events/order-domain-event.publisher';
import { OrderRefundFinalizerService } from 'src/module/client/order/refund/order-refund-finalizer.service';
import { StepTraceService } from 'src/common/observability';

describe('StoreOrderService', () => {
  let service: StoreOrderService;
  let orderRepo: StoreOrderRepository;
  let financeCommandPort: jest.Mocked<
    Pick<FinanceCommandPort, 'cancelOrderCommissions' | 'cancelCommissionsForOrderPartialRefund'>
  >;
  let orderEventPublisher: jest.Mocked<OrderDomainEventPublisher>;
  let paymentGateway: jest.Mocked<PaymentGatewayPort>;
  let finRefundService: jest.Mocked<
    Pick<FinRefundService, 'createRequested' | 'recordGatewayResult' | 'isSuccess' | 'isFailureTerminal'>
  >;
  let orderRefundFinalizer: jest.Mocked<Pick<OrderRefundFinalizerService, 'finalize'>>;
  let tenantHelper: TenantHelper;
  let distributionQualificationService: jest.Mocked<
    Pick<DistributionQualificationService, 'markServiceOrderVerified' | 'markServiceOrderRefunded'>
  >;
  let fulfillmentService: jest.Mocked<
    Pick<
      FulfillmentService,
      | 'assignServiceForStore'
      | 'shipProductForStore'
      | 'confirmProductReceiptForStore'
      | 'verifyServiceForStore'
      | 'listServiceDispatch'
      | 'listServiceWorkerCandidates'
    >
  >;

  const mockPrisma = {
    $queryRaw: jest.fn(),
    omsOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    mktResolutionAudit: {
      findMany: jest.fn(),
    },
    umsMember: {
      findFirst: jest.fn(),
    },
    srvWorker: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    sysTenant: {
      findFirst: jest.fn(),
    },
  };

  const mockOrderRepo = {
    findPage: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockFinanceCommandPort = {
    cancelOrderCommissions: jest.fn(),
    cancelCommissionsForOrderPartialRefund: jest.fn(),
  };

  const mockCommissionQueryPort = {
    findMany: jest.fn(),
  };

  const mockOrderEventPublisher = {
    publishRefunded: jest.fn(),
  };

  const mockDistributionQualificationService = {
    markServiceOrderVerified: jest.fn(),
    markServiceOrderRefunded: jest.fn(),
  };

  const mockPaymentGateway = {
    refund: jest.fn(),
    prepay: jest.fn(),
    handleCallback: jest.fn(),
    handleRefundCallback: jest.fn(),
    queryRefund: jest.fn(),
    queryPaymentStatus: jest.fn(),
  };

  const mockFinRefundService = {
    createRequested: jest.fn(),
    recordGatewayResult: jest.fn(),
    isSuccess: jest.fn(),
    isFailureTerminal: jest.fn(),
  };

  const mockOrderRefundFinalizer = {
    finalize: jest.fn(),
  };

  const mockFulfillmentService = {
    assignServiceForStore: jest.fn(),
    shipProductForStore: jest.fn(),
    confirmProductReceiptForStore: jest.fn(),
    verifyServiceForStore: jest.fn(),
    listServiceDispatch: jest.fn(),
    listServiceWorkerCandidates: jest.fn(),
  };

  const mockStepTraceService = {
    run: jest.fn(),
  };

  beforeEach(async () => {
    mockStepTraceService.run.mockImplementation(async (_context: unknown, task: () => Promise<unknown>) => task());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreOrderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StoreOrderRepository, useValue: mockOrderRepo },
        { provide: FinanceCommandPort, useValue: mockFinanceCommandPort },
        { provide: CommissionQueryPort, useValue: mockCommissionQueryPort },
        { provide: OrderDomainEventPublisher, useValue: mockOrderEventPublisher },
        { provide: PaymentGatewayPort, useValue: mockPaymentGateway },
        { provide: FinRefundService, useValue: mockFinRefundService },
        { provide: OrderRefundFinalizerService, useValue: mockOrderRefundFinalizer },
        { provide: DistributionQualificationService, useValue: mockDistributionQualificationService },
        { provide: FulfillmentService, useValue: mockFulfillmentService },
        { provide: StepTraceService, useValue: mockStepTraceService },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    service = module.get<StoreOrderService>(StoreOrderService);
    orderRepo = module.get<StoreOrderRepository>(StoreOrderRepository);
    financeCommandPort = module.get(FinanceCommandPort);
    orderEventPublisher = module.get(OrderDomainEventPublisher);
    paymentGateway = module.get(PaymentGatewayPort) as jest.Mocked<PaymentGatewayPort>;
    finRefundService = module.get(FinRefundService);
    orderRefundFinalizer = module.get(OrderRefundFinalizerService);
    tenantHelper = module.get(TenantHelper);
    distributionQualificationService = module.get(DistributionQualificationService);
    fulfillmentService = module.get(FulfillmentService);

    // Mock TenantContext
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant1');
    jest.spyOn(TenantContext, 'isSuperTenant').mockReturnValue(false);
    mockDistributionQualificationService.markServiceOrderVerified.mockResolvedValue({ evidenceCount: 0 });
    mockDistributionQualificationService.markServiceOrderRefunded.mockResolvedValue({
      evidenceCount: 0,
      pendingRewardCount: 0,
    });
    mockFulfillmentService.assignServiceForStore.mockResolvedValue({});
    mockFulfillmentService.shipProductForStore.mockResolvedValue({});
    mockFulfillmentService.confirmProductReceiptForStore.mockResolvedValue({});
    mockFulfillmentService.verifyServiceForStore.mockResolvedValue({});
    mockFulfillmentService.listServiceDispatch.mockResolvedValue({ data: { rows: [], total: 0 } });
    mockFulfillmentService.listServiceWorkerCandidates.mockResolvedValue({ data: { rows: [], total: 0 } });
    mockOrderEventPublisher.publishRefunded.mockResolvedValue(undefined);
    let createdRefundRecord: Record<string, unknown> | null = null;
    mockFinRefundService.createRequested.mockImplementation(async (input) => {
      createdRefundRecord = { id: 'fin-refund-1', status: 'CREATED', ...input };
      return createdRefundRecord as any;
    });
    mockFinRefundService.recordGatewayResult.mockImplementation(async (input) => {
      return {
        ...(createdRefundRecord ?? {}),
        status: input.status,
        refundSn: input.refundSn,
        refundId: input.refundId,
      } as any;
    });
    mockFinRefundService.isSuccess.mockImplementation((refund) => refund.status === RefundStatus.SUCCESS);
    mockFinRefundService.isFailureTerminal.mockImplementation((refund) =>
      [RefundStatus.FAILED, RefundStatus.CLOSED, RefundStatus.ABNORMAL].includes(refund.status as RefundStatus),
    );
    mockOrderRefundFinalizer.finalize.mockImplementation(async (refund) => {
      const payload = (refund.finalizePayload ?? {}) as {
        refundRatio?: string;
        refundDetails?: Array<{ itemId: number; quantity: number; amount: string }>;
        fullyRefundedItemIds?: number[];
        isFullRefund?: boolean;
        remark?: string | null;
      };
      if (payload.refundDetails?.length) {
        await mockFinanceCommandPort.cancelCommissionsForOrderPartialRefund({
          orderId: refund.orderId,
          refundRatio: new Decimal(payload.refundRatio ?? 1),
          relatedId: refund.refundSn,
        });
        await mockOrderRepo.update(refund.orderId, {
          ...(payload.isFullRefund ? { status: OrderStatus.REFUNDED } : {}),
          partialRefundSn: refund.refundSn,
          remark: 'mock refund remark',
        });
        if (payload.fullyRefundedItemIds?.length) {
          await mockDistributionQualificationService.markServiceOrderRefunded(
            refund.tenantId,
            refund.orderId,
            payload.fullyRefundedItemIds,
          );
        }
        await mockOrderEventPublisher.publishRefunded({
          orderId: refund.orderId,
          orderSn: refund.orderSn,
          tenantId: refund.tenantId,
          memberId: 'm1',
          refundReferenceId: refund.refundSn,
          refundPointsAmount: Math.floor(100 * Number(payload.refundRatio ?? 1)),
          earnedPointsClawbackRatio: Number(payload.refundRatio ?? 1),
          refundCoupon: Boolean(payload.isFullRefund),
          partialRefund: !payload.isFullRefund,
          refundedAt: new Date(),
        });
        return { finalized: true };
      }

      await mockOrderRepo.update(refund.orderId, {
        status: OrderStatus.REFUNDED,
        remark: 'mock refund remark',
      });
      await mockFinanceCommandPort.cancelOrderCommissions(refund.orderId);
      await mockDistributionQualificationService.markServiceOrderRefunded(refund.tenantId, refund.orderId);
      await mockOrderEventPublisher.publishRefunded({
        orderId: refund.orderId,
        orderSn: refund.orderSn,
        tenantId: refund.tenantId,
        memberId: 'm1',
        refundedAt: new Date(),
      });
      return { finalized: true };
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated orders with commissions', async () => {
      const mockResult = {
        rows: [
          {
            id: 'order1',
            tenantId: 'tenant1',
            payAmount: '100.00',
            items: [{ productImg: 'img1.jpg' }],
            tenant: { companyName: 'Tenant 1' },
          },
        ],
        total: 1,
      };
      mockOrderRepo.findPage.mockResolvedValue(mockResult);
      mockPrisma.$queryRaw.mockResolvedValue([{ orderId: 'order1', total: '10.00' }]);

      const query: any = { pageNum: 1, pageSize: 10, getDateRange: jest.fn() };
      const result = await service.findAll(query);

      const rows = result.data.rows as any[];
      expect(rows[0].commissionAmount).toBe(10.0);
      expect(rows[0].remainingAmount).toBe(90.0);
      expect(rows[0].tenantName).toBe('Tenant 1');
      expect(rows[0].productImg).toBe('img1.jpg');
    });
  });

  describe('findOne', () => {
    it('should throw error if order not found', async () => {
      mockPrisma.omsOrder.findFirst.mockResolvedValue(null);
      await expect(service.findOne('1')).rejects.toThrow(BusinessException);
    });

    it('should return order details with worker and commissions', async () => {
      const mockOrder = {
        id: 'order1',
        memberId: 'm1',
        workerId: 1,
        tenantId: 't1',
        payAmount: '100.00',
        shareUserId: null as string | null,
      };
      mockPrisma.omsOrder.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.umsMember.findFirst.mockResolvedValue({ memberId: 'm1', nickname: 'Member 1', parentId: null });
      mockPrisma.srvWorker.findFirst.mockResolvedValue({ workerId: 1, name: 'Worker 1' });
      mockPrisma.sysTenant.findFirst.mockResolvedValue({ tenantId: 't1', companyName: 'Tenant 1' });
      mockCommissionQueryPort.findMany.mockResolvedValue([{ amount: '20.00', status: CommissionStatus.FROZEN }] as any);

      const result = await service.findOne('order1', true);

      const data = result.data as any;
      expect(data.order.id).toBe('order1');
      expect(data.customer.nickname).toBe('Member 1');
      expect(data.worker.name).toBe('Worker 1');
      expect(data.business.remainingAmount).toBe('80.00');
      expect(data.business.totalCommissionAmount).toBe('20.00');
    });

    it('should exclude cancelled commissions from calculation', async () => {
      const mockOrder = {
        id: 'order1',
        memberId: 'm1',
        workerId: null as number | null,
        tenantId: 't1',
        payAmount: '100.00',
        shareUserId: null as string | null,
      };
      mockPrisma.omsOrder.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.umsMember.findFirst.mockResolvedValue({ memberId: 'm1', nickname: 'Member 1', parentId: null });
      mockPrisma.sysTenant.findFirst.mockResolvedValue({ tenantId: 't1', companyName: 'Tenant 1' });
      mockCommissionQueryPort.findMany.mockResolvedValue([
        { amount: '20.00', status: CommissionStatus.FROZEN },
        { amount: '10.00', status: CommissionStatus.CANCELLED },
      ] as any);

      const result = await service.findOne('order1', true);

      const data = result.data as any;
      expect(data.business.totalCommissionAmount).toBe('20.00');
      expect(data.business.remainingAmount).toBe('80.00');
    });
  });

  describe('getActivityAudit', () => {
    it('should read order activity audit through tenant scoped order lookup', async () => {
      jest.spyOn(tenantHelper, 'readWhereForDelegate').mockReturnValue({ id: 'order1', tenantId: 'tenant1' });
      mockPrisma.omsOrder.findFirst.mockResolvedValue({
        id: 'order1',
        orderSn: 'NO202605060001',
        tenantId: 'tenant1',
        memberId: 'member1',
        items: [{ id: 1, productName: '服务项' }],
      });
      mockPrisma.mktResolutionAudit.findMany.mockResolvedValue([{ id: 'audit1' }]);

      const result = await service.getActivityAudit('order1');

      expect(tenantHelper.readWhereForDelegate).toHaveBeenCalledWith('omsOrder', { id: 'order1' });
      expect(mockPrisma.omsOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order1', tenantId: 'tenant1' },
        }),
      );
      expect(mockPrisma.mktResolutionAudit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant1', memberId: 'member1' },
        }),
      );
      expect(result.data).toMatchObject({
        orderId: 'order1',
        resolutionAudits: [{ id: 'audit1' }],
      });
    });
  });

  describe('reassignWorker', () => {
    it('should reassign worker for a paid order', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ id: 'order1', status: OrderStatus.PAID });
      mockPrisma.srvWorker.findFirst.mockResolvedValue({ workerId: 2 });

      await service.reassignWorker({ orderId: 'order1', newWorkerId: 2 }, 'admin');

      expect(fulfillmentService.assignServiceForStore).toHaveBeenCalledWith('order1', 2, 'admin');
    });

    it('should throw error if order status not allowed', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ id: 'order1', status: OrderStatus.COMPLETED });
      await expect(service.reassignWorker({ orderId: 'order1', newWorkerId: 2 }, 'admin')).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('listDispatchWorkerCandidates', () => {
    it('delegates candidate query to FulfillmentService', async () => {
      const query = { pageNum: 1, pageSize: 10, keyword: ' 张 ' };

      await service.listDispatchWorkerCandidates(query);

      expect(fulfillmentService.listServiceWorkerCandidates).toHaveBeenCalledWith(query);
    });
  });

  describe('verifyService', () => {
    it('should complete a shipped order', async () => {
      await service.verifyService({ orderId: 'order1', remark: 'Done' }, 'admin');

      expect(fulfillmentService.verifyServiceForStore).toHaveBeenCalledWith('order1', 'Done', 'admin');
    });

    it('should throw error if order not found', async () => {
      mockFulfillmentService.verifyServiceForStore.mockRejectedValueOnce(new BusinessException(404, '订单不存在'));

      await expect(service.verifyService({ orderId: 'order1' }, 'admin')).rejects.toThrow(BusinessException);
    });

    it('should throw error if order status not SHIPPED', async () => {
      mockFulfillmentService.verifyServiceForStore.mockRejectedValueOnce(
        new BusinessException(500, '订单状态不允许核销'),
      );

      await expect(service.verifyService({ orderId: 'order1' }, 'admin')).rejects.toThrow(BusinessException);
    });

    it('should throw error if commission update fails', async () => {
      mockFulfillmentService.verifyServiceForStore.mockRejectedValueOnce(new Error('Commission update failed'));

      await expect(service.verifyService({ orderId: 'order1' }, 'admin')).rejects.toThrow();
    });
  });

  describe('refundOrder', () => {
    it('should refund a paid order and cancel commissions', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        orderType: OrderType.SERVICE,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
      });
      mockPaymentGateway.refund.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_123456',
        refundId: 'wx_refund_123',
        status: RefundStatus.SUCCESS,
        amount: 10000,
      });
      mockFinanceCommandPort.cancelOrderCommissions.mockResolvedValue(undefined);
      mockDistributionQualificationService.markServiceOrderRefunded.mockResolvedValue({
        evidenceCount: 1,
        pendingRewardCount: 0,
      });

      await service.refundOrder('order1', 'Refund request', 'admin');

      expect(paymentGateway.refund).toHaveBeenCalledWith({
        orderSn: 'ORDER123',
        refundSn: 'REFUND_ORDER123_FULL',
        refundAmount: '100.00',
        totalAmount: '100.00',
        reason: 'Refund request',
      });
      expect(orderRepo.update).toHaveBeenCalledWith(
        'order1',
        expect.objectContaining({
          status: OrderStatus.REFUNDED,
        }),
      );
      expect(financeCommandPort.cancelOrderCommissions).toHaveBeenCalledWith('order1');
      expect(distributionQualificationService.markServiceOrderRefunded).toHaveBeenCalledWith('tenant1', 'order1');
      expect(orderEventPublisher.publishRefunded).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order1',
          orderSn: 'ORDER123',
          tenantId: 'tenant1',
          memberId: 'm1',
        }),
      );
    });

    it('Given 微信退款仍在处理中, When 整单退款返回 PROCESSING, Then 不应更新订单为 REFUNDED 或取消佣金', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        orderType: OrderType.SERVICE,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
      });
      mockPaymentGateway.refund.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_FULL',
        refundId: 'wx_refund_processing',
        status: RefundStatus.PROCESSING,
        amount: 10000,
      });

      const result = await service.refundOrder('order1', 'Refund request', 'admin');

      expect(result.msg).toContain('等待渠道确认');
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(financeCommandPort.cancelOrderCommissions).not.toHaveBeenCalled();
      expect(distributionQualificationService.markServiceOrderRefunded).not.toHaveBeenCalled();
      expect(orderEventPublisher.publishRefunded).not.toHaveBeenCalled();
    });

    it('should throw error if order not found', async () => {
      mockOrderRepo.findOne.mockResolvedValue(null);

      await expect(service.refundOrder('order1', 'Refund', 'admin')).rejects.toThrow(BusinessException);
    });

    it('should throw error if order status is PENDING_PAY', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ id: 'order1', status: OrderStatus.PENDING_PAY });

      await expect(service.refundOrder('order1', 'Refund', 'admin')).rejects.toThrow(BusinessException);
    });

    it('should throw error if order already refunded', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ id: 'order1', status: OrderStatus.REFUNDED });

      await expect(service.refundOrder('order1', 'Refund', 'admin')).rejects.toThrow(BusinessException);
    });

    it('should reject full refund when partial refund marker exists', async () => {
      // 修复后：检测 partialRefundSn 列，而非 remark 字符串
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
        partialRefundSn: 'REFUND_ORDER123_PARTIAL', // ← 列，不是 remark
      });

      await expect(service.refundOrder('order1', 'Refund', 'admin')).rejects.toThrow(BusinessException);
      expect(paymentGateway.refund).not.toHaveBeenCalled();
    });

    it('BUG-5 复现：remark 含关键字但 partialRefundSn 为空，不应拦截整单退款', async () => {
      // remark 里碰巧包含 "退款单: REFUND_" 文字（运营手动备注或复制粘贴）
      // 当前 BUG：hasAnyRefundMarker(remark) 误判为已部分退款 → 拦截合法全额退款
      // 预期：以 partialRefundSn=null 为准 → 允许退款
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
        remark: '客服说明：参见历史退款单: REFUND_OTHER_ORDER',
        partialRefundSn: null,
      });
      mockPaymentGateway.refund.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_FULL',
        refundId: 'wx_001',
        status: RefundStatus.SUCCESS,
        amount: 10000,
      });
      mockFinanceCommandPort.cancelOrderCommissions.mockResolvedValue(undefined);

      await service.refundOrder('order1', 'Refund', 'admin');
      expect(paymentGateway.refund).toHaveBeenCalled();
    });

    it('should throw error if wechat refund fails', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
      });
      mockPaymentGateway.refund.mockRejectedValue(new Error('Wechat API Error'));

      await expect(service.refundOrder('order1', 'Refund', 'admin')).rejects.toThrow(BusinessException);
      expect(paymentGateway.refund).toHaveBeenCalled();
    });

    it('should throw error if commission cancellation fails', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
      });
      mockPaymentGateway.refund.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_123456',
        refundId: 'wx_refund_123',
        status: RefundStatus.SUCCESS,
        amount: 10000,
      });
      mockFinanceCommandPort.cancelOrderCommissions.mockRejectedValue(new Error('Cancel failed'));

      await expect(service.refundOrder('order1', 'Refund', 'admin')).rejects.toThrow();
    });

    it('退款 outbox 写入失败时，退款事务应失败并上浮错误', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
      });
      mockPaymentGateway.refund.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_FULL',
        refundId: 'wx_refund_123',
        status: RefundStatus.SUCCESS,
        amount: 10000,
      });
      mockFinanceCommandPort.cancelOrderCommissions.mockResolvedValue(undefined);
      mockOrderEventPublisher.publishRefunded.mockRejectedValue(new Error('Integration failed'));

      await expect(service.refundOrder('order1', 'Refund', 'admin')).rejects.toThrow('Integration failed');

      expect(orderRepo.update).toHaveBeenCalledWith(
        'order1',
        expect.objectContaining({ status: OrderStatus.REFUNDED }),
      );
      expect(orderEventPublisher.publishRefunded).toHaveBeenCalled();
    });

    it('BUG-1 复现：支付成功但 DB 更新失败后重试，不应重复取消佣金', async () => {
      // 场景：paymentGateway.refund() 成功，但 finalizeFullRefundOrder 首次调用时 DB 超时
      // 操作员看到"退款失败"后重试 → refundOrder 再次调用
      // 此时订单已被第一次调用标记为 REFUNDED（或者第一次调用恰好把 status 改掉）
      // 预期：第二次调用 finalizeFullRefundOrder 时检测到 status=REFUNDED → 幂等返回，不重复执行
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.REFUNDED, // ← 模拟：第一次 DB 更新已成功，本次是重复调用
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
      });
      mockPaymentGateway.refund.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_FULL',
        refundId: 'wx_refund_123',
        status: RefundStatus.SUCCESS,
        amount: 10000,
      });

      // REFUNDED 状态被前置校验拦截，不应到达 cancelOrderCommissions
      await expect(service.refundOrder('order1', 'Refund', 'admin')).rejects.toThrow(BusinessException);
      expect(mockFinanceCommandPort.cancelOrderCommissions).not.toHaveBeenCalled();
    });

    it('BUG-1 幂等修复验证：finalizeFullRefundOrder 二次调用时应静默跳过', async () => {
      // 模拟 finalizeFullRefundOrder 内部读到 status=REFUNDED 时直接返回
      // 验证路径：order.status 已是 REFUNDED → early return → cancelOrderCommissions 不被调用
      const alreadyRefunded = {
        id: 'order1',
        status: OrderStatus.REFUNDED,
        memberId: 'm1',
        orderSn: 'ORDER123',
        orderType: OrderType.SERVICE,
        payAmount: '100.00',
      };
      // findOne 第一次（refundOrder 入口校验）返回 REFUNDED → 直接抛出，不调支付
      mockOrderRepo.findOne.mockResolvedValue(alreadyRefunded);

      await expect(service.refundOrder('order1', 'Retry', 'admin')).rejects.toThrow(BusinessException);
      expect(mockPaymentGateway.refund).not.toHaveBeenCalled();
      expect(mockFinanceCommandPort.cancelOrderCommissions).not.toHaveBeenCalled();
    });
  });

  describe('partialRefundOrder', () => {
    it('should partially refund order items', async () => {
      const mockOrder = {
        id: 'order1',
        status: OrderStatus.COMPLETED,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
        couponDiscount: '10.00',
        pointsUsed: 100,
        userCouponId: 'coupon1',
        items: [
          { id: 1, price: '50.00', quantity: 2, productName: 'Product 1' },
          { id: 2, price: '25.00', quantity: 2, productName: 'Product 2' },
        ],
        commissions: [{ id: 'comm1', amount: '20.00', status: CommissionStatus.FROZEN, beneficiaryId: 'm2' }],
      };

      mockPrisma.omsOrder.findFirst.mockResolvedValue(mockOrder);
      mockPaymentGateway.refund.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_123456',
        refundId: 'wx_refund_123',
        status: RefundStatus.SUCCESS,
        amount: 5000,
      });
      mockFinanceCommandPort.cancelCommissionsForOrderPartialRefund.mockResolvedValue(undefined);
      mockDistributionQualificationService.markServiceOrderRefunded.mockResolvedValue({
        evidenceCount: 0,
        pendingRewardCount: 0,
      });

      const dto = {
        orderId: 'order1',
        items: [{ itemId: 1, quantity: 1 }],
        remark: 'Partial refund',
      };

      const result = await service.partialRefundOrder(dto, 'admin');

      expect(paymentGateway.refund).toHaveBeenCalledWith({
        orderSn: 'ORDER123',
        refundSn: expect.stringContaining('REFUND_ORDER123_'),
        refundAmount: '50',
        totalAmount: '100.00',
        reason: 'Partial refund',
      });
      expect(result.data.refundAmount).toBe('50');
      expect(result.data.isFullRefund).toBe(false);
      expect(financeCommandPort.cancelCommissionsForOrderPartialRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order1',
          relatedId: expect.stringContaining('REFUND_ORDER123_'),
        }),
      );
      const partialRefundSn = mockFinanceCommandPort.cancelCommissionsForOrderPartialRefund.mock.calls[0][0]
        .relatedId as string;
      const partialRefundRatio = mockFinanceCommandPort.cancelCommissionsForOrderPartialRefund.mock.calls[0][0]
        .refundRatio as Decimal;
      expect(partialRefundRatio.toString()).toBe('0.5');
      expect(orderEventPublisher.publishRefunded).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order1',
          orderSn: 'ORDER123',
          tenantId: 'tenant1',
          memberId: 'm1',
          refundReferenceId: partialRefundSn,
          refundPointsAmount: 50,
          earnedPointsClawbackRatio: 0.5,
          refundCoupon: false,
          partialRefund: true,
        }),
      );
      expect(distributionQualificationService.markServiceOrderRefunded).not.toHaveBeenCalled();
    });

    it('Given 订单项存在实付分摊金额, When 部分退款, Then 微信退款金额必须按 orderItemFinalPaid 计算', async () => {
      const mockOrder = {
        id: 'order1',
        status: OrderStatus.COMPLETED,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '90.00',
        pointsUsed: 0,
        userCouponId: null as string | null,
        items: [{ id: 1, price: '50.00', quantity: 2, orderItemFinalPaid: '90.00', productName: 'Product 1' }],
      };

      mockPrisma.omsOrder.findFirst.mockResolvedValue(mockOrder);
      mockPaymentGateway.refund.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_PARTIAL',
        refundId: 'wx_refund_123',
        status: RefundStatus.SUCCESS,
        amount: 4500,
      });
      mockFinanceCommandPort.cancelCommissionsForOrderPartialRefund.mockResolvedValue(undefined);

      const result = await service.partialRefundOrder(
        {
          orderId: 'order1',
          items: [{ itemId: 1, quantity: 1 }],
          remark: 'Partial refund',
        },
        'admin',
      );

      expect(paymentGateway.refund).toHaveBeenCalledWith(
        expect.objectContaining({
          refundAmount: '45',
          totalAmount: '90.00',
        }),
      );
      expect(result.data.refundAmount).toBe('45');
    });

    it('should submit partial refund ratio to FinanceCommandPort', async () => {
      const mockOrder = {
        id: 'order1',
        status: OrderStatus.COMPLETED,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
        couponDiscount: '0.00',
        pointsUsed: 0,
        userCouponId: null as string | null,
        items: [{ id: 1, price: '50.00', quantity: 2, productName: 'Product 1' }],
        commissions: [{ id: 99n, amount: '20.00', status: CommissionStatus.SETTLED, beneficiaryId: 'm2' }],
      };

      mockPrisma.omsOrder.findFirst.mockResolvedValue(mockOrder);
      mockPaymentGateway.refund.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_123456',
        refundId: 'wx_refund_123',
        status: RefundStatus.SUCCESS,
        amount: 5000,
      });
      mockFinanceCommandPort.cancelCommissionsForOrderPartialRefund.mockResolvedValue(undefined);
      mockDistributionQualificationService.markServiceOrderRefunded.mockResolvedValue({
        evidenceCount: 1,
        pendingRewardCount: 0,
      });

      const dto = {
        orderId: 'order1',
        items: [{ itemId: 1, quantity: 1 }],
        remark: 'Partial refund',
      };

      await service.partialRefundOrder(dto, 'admin');

      expect(mockFinanceCommandPort.cancelCommissionsForOrderPartialRefund).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order1', relatedId: expect.stringContaining('REFUND_ORDER123_') }),
      );
      const calledRatio = mockFinanceCommandPort.cancelCommissionsForOrderPartialRefund.mock.calls[0][0]
        .refundRatio as Decimal;
      expect(calledRatio.toString()).toBe('0.5');
      expect(distributionQualificationService.markServiceOrderRefunded).not.toHaveBeenCalled();
    });

    it('should mark order as REFUNDED when all items are refunded', async () => {
      const mockOrder = {
        id: 'order1',
        status: OrderStatus.COMPLETED,
        orderType: OrderType.SERVICE,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
        couponDiscount: '0.00',
        pointsUsed: 0,
        userCouponId: null as string | null,
        items: [{ id: 1, price: '100.00', quantity: 1, productName: 'Product 1' }],
        commissions: [] as unknown[],
      };

      mockPrisma.omsOrder.findFirst.mockResolvedValue(mockOrder);
      mockPaymentGateway.refund.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_123456',
        refundId: 'wx_refund_123',
        status: RefundStatus.SUCCESS,
        amount: 10000,
      });
      mockDistributionQualificationService.markServiceOrderRefunded.mockResolvedValue({
        evidenceCount: 1,
        pendingRewardCount: 0,
      });

      const dto = {
        orderId: 'order1',
        items: [{ itemId: 1, quantity: 1 }],
        remark: 'Full refund',
      };

      const result = await service.partialRefundOrder(dto, 'admin');

      expect(result.data.isFullRefund).toBe(true);
      expect(orderRepo.update).toHaveBeenCalledWith(
        'order1',
        expect.objectContaining({
          status: OrderStatus.REFUNDED,
        }),
      );
      expect(distributionQualificationService.markServiceOrderRefunded).toHaveBeenCalledWith('tenant1', 'order1', [1]);
    });

    it('should skip exact duplicate partial refund when refund marker already exists', async () => {
      const dto = {
        orderId: 'order1',
        items: [{ itemId: 1, quantity: 1 }],
        remark: 'Partial refund',
      };
      const refundSn = (
        service as unknown as {
          buildPartialRefundSn: (orderSn: string, items: typeof dto.items, refundAmount: Decimal) => string;
        }
      ).buildPartialRefundSn('ORDER123', dto.items, new Decimal(50));
      const mockOrder = {
        id: 'order1',
        status: OrderStatus.COMPLETED,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
        partialRefundSn: refundSn, // ← 列，不再依赖 remark 子串
        pointsUsed: 100,
        userCouponId: 'coupon1',
        items: [{ id: 1, price: '50.00', quantity: 2, productName: 'Product 1' }],
      };

      mockPrisma.omsOrder.findFirst.mockResolvedValue(mockOrder);

      const result = await service.partialRefundOrder(dto, 'admin');

      expect(result.data.refundAmount).toBe('50');
      expect(paymentGateway.refund).not.toHaveBeenCalled();
      expect(financeCommandPort.cancelCommissionsForOrderPartialRefund).not.toHaveBeenCalled();
      expect(orderEventPublisher.publishRefunded).not.toHaveBeenCalled();
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('should reject new partial refund when another refund marker exists', async () => {
      const mockOrder = {
        id: 'order1',
        status: OrderStatus.COMPLETED,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
        partialRefundSn: 'REFUND_ORDER123_OLDREFUND', // ← 列，不再依赖 remark 子串
        pointsUsed: 0,
        userCouponId: null as string | null,
        items: [{ id: 1, price: '50.00', quantity: 2, productName: 'Product 1' }],
      };

      mockPrisma.omsOrder.findFirst.mockResolvedValue(mockOrder);

      await expect(
        service.partialRefundOrder(
          {
            orderId: 'order1',
            items: [{ itemId: 1, quantity: 1 }],
            remark: 'Another partial refund',
          },
          'admin',
        ),
      ).rejects.toThrow(BusinessException);
      expect(paymentGateway.refund).not.toHaveBeenCalled();
      expect(financeCommandPort.cancelCommissionsForOrderPartialRefund).not.toHaveBeenCalled();
    });

    it('should throw error if order not found', async () => {
      mockPrisma.omsOrder.findFirst.mockResolvedValue(null);

      const dto = {
        orderId: 'order1',
        items: [{ itemId: 1, quantity: 1 }],
      };

      await expect(service.partialRefundOrder(dto, 'admin')).rejects.toThrow(BusinessException);
    });

    it('should throw error if order item not found', async () => {
      const mockOrder = {
        id: 'order1',
        status: OrderStatus.COMPLETED,
        memberId: 'm1',
        payAmount: '100.00',
        items: [{ id: 1, price: '100.00', quantity: 1 }],
        commissions: [],
      };

      mockPrisma.omsOrder.findFirst.mockResolvedValue(mockOrder);

      const dto = {
        orderId: 'order1',
        items: [{ itemId: 999, quantity: 1 }],
      };

      await expect(service.partialRefundOrder(dto, 'admin')).rejects.toThrow(BusinessException);
    });

    it('should throw error if refund quantity exceeds order quantity', async () => {
      const mockOrder = {
        id: 'order1',
        status: OrderStatus.COMPLETED,
        memberId: 'm1',
        payAmount: '100.00',
        items: [{ id: 1, price: '50.00', quantity: 2 }],
        commissions: [] as unknown[],
      };

      mockPrisma.omsOrder.findFirst.mockResolvedValue(mockOrder);

      const dto = {
        orderId: 'order1',
        items: [{ itemId: 1, quantity: 3 }],
      };

      await expect(service.partialRefundOrder(dto, 'admin')).rejects.toThrow(BusinessException);
    });

    it('should throw error if wechat partial refund fails', async () => {
      const mockOrder = {
        id: 'order1',
        status: OrderStatus.COMPLETED,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
        items: [{ id: 1, price: '50.00', quantity: 2 }],
        commissions: [] as unknown[],
      };

      mockPrisma.omsOrder.findFirst.mockResolvedValue(mockOrder);
      mockPaymentGateway.refund.mockRejectedValue(new Error('Wechat API Error'));

      const dto = {
        orderId: 'order1',
        items: [{ itemId: 1, quantity: 1 }],
      };

      await expect(service.partialRefundOrder(dto, 'admin')).rejects.toThrow(BusinessException);
      expect(paymentGateway.refund).toHaveBeenCalled();
    });

    it('should keep refund provider integration behind payment gateway contract', async () => {
      const mockOrder = {
        id: 'order1',
        status: OrderStatus.COMPLETED,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
        items: [{ id: 1, price: '50.00', quantity: 2 }],
        commissions: [] as unknown[],
      };

      mockPrisma.omsOrder.findFirst.mockResolvedValue(mockOrder);
      mockPaymentGateway.refund.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_PARTIAL_123456',
        refundId: 'wx_refund_123',
        status: RefundStatus.SUCCESS,
        amount: 5000,
      });

      await service.partialRefundOrder(
        {
          orderId: 'order1',
          items: [{ itemId: 1, quantity: 1 }],
          remark: 'Partial refund',
        },
        'admin',
      );

      expect(paymentGateway.refund).toHaveBeenCalledWith(
        expect.objectContaining({
          orderSn: 'ORDER123',
          refundAmount: '50',
          totalAmount: '100.00',
          reason: 'Partial refund',
        }),
      );
      expect(paymentGateway.refund).toHaveBeenCalledTimes(1);
    });
  });

  describe('batchVerify', () => {
    it('should verify multiple orders successfully', async () => {
      const dto = {
        orderIds: ['order1', 'order2', 'order3'],
        remark: 'Batch verify',
      };

      const result = await service.batchVerify(dto, 'admin');

      expect(result.data.successCount).toBe(3);
      expect(result.data.failCount).toBe(0);
      expect(result.data.details).toHaveLength(3);
      expect(result.data.details[0].success).toBe(true);
      expect(fulfillmentService.verifyServiceForStore).toHaveBeenCalledTimes(3);
      expect(fulfillmentService.verifyServiceForStore).toHaveBeenCalledWith('order1', 'Batch verify', 'admin');
    });

    it('should handle partial failures in batch verify', async () => {
      mockFulfillmentService.verifyServiceForStore
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new BusinessException(404, '订单不存在'))
        .mockResolvedValueOnce({});

      const dto = {
        orderIds: ['order1', 'order2', 'order3'],
        remark: 'Batch verify',
      };

      const result = await service.batchVerify(dto, 'admin');

      expect(result.data.successCount).toBe(2);
      expect(result.data.failCount).toBe(1);
      expect(result.data.details).toHaveLength(3);
      expect(result.data.details[0].success).toBe(true);
      expect(result.data.details[1].success).toBe(false);
      expect(result.data.details[1].error).toBeDefined();
      expect(result.data.details[2].success).toBe(true);
    });

    it('should continue processing after one order fails', async () => {
      mockFulfillmentService.verifyServiceForStore
        .mockRejectedValueOnce(new BusinessException(500, '订单状态不允许核销'))
        .mockResolvedValueOnce({});

      const dto = {
        orderIds: ['order1', 'order2'],
        remark: 'Batch verify',
      };

      const result = await service.batchVerify(dto, 'admin');

      expect(result.data.successCount).toBe(1);
      expect(result.data.failCount).toBe(1);
      expect(result.data.details[0].success).toBe(false);
      expect(result.data.details[0].error).toContain('不允许核销');
      expect(result.data.details[1].success).toBe(true);
    });

    it('should return empty result for empty order list', async () => {
      const dto = {
        orderIds: [],
        remark: 'Batch verify',
      };

      const result = await service.batchVerify(dto, 'admin');

      expect(result.data.successCount).toBe(0);
      expect(result.data.failCount).toBe(0);
      expect(result.data.details).toHaveLength(0);
    });

    it('Given duplicate orderIds, When batchVerify, Then verify each order once', async () => {
      const result = await service.batchVerify({ orderIds: ['order1', 'order1'], remark: 'Batch verify' }, 'admin');

      expect(result.data.successCount).toBe(1);
      expect(result.data.details).toHaveLength(1);
      expect(fulfillmentService.verifyServiceForStore).toHaveBeenCalledTimes(1);
      expect(fulfillmentService.verifyServiceForStore).toHaveBeenCalledWith('order1', 'Batch verify', 'admin');
    });
  });

  describe('batchRefund', () => {
    it('should refund multiple orders successfully', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
      });
      mockPaymentGateway.refund.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_123456',
        refundId: 'wx_refund_123',
        status: RefundStatus.SUCCESS,
        amount: 10000,
      });
      mockFinanceCommandPort.cancelOrderCommissions.mockResolvedValue(undefined);

      const dto = {
        orderIds: ['order1', 'order2', 'order3'],
        remark: 'Batch refund',
      };

      const result = await service.batchRefund(dto, 'admin');

      expect(result.data.successCount).toBe(3);
      expect(result.data.failCount).toBe(0);
      expect(result.data.details).toHaveLength(3);
      expect(result.data.details[0].success).toBe(true);
      expect(paymentGateway.refund).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in batch refund', async () => {
      mockOrderRepo.findOne
        .mockResolvedValueOnce({
          id: 'order1',
          status: OrderStatus.PAID,
          memberId: 'm1',
          orderSn: 'ORDER123',
          payAmount: '100.00',
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'order3',
          status: OrderStatus.PAID,
          memberId: 'm1',
          orderSn: 'ORDER456',
          payAmount: '100.00',
        });
      mockPaymentGateway.refund.mockResolvedValue({
        refundSn: 'REFUND_123456',
        refundId: 'wx_refund_123',
        status: RefundStatus.SUCCESS,
        amount: 10000,
      });
      mockFinanceCommandPort.cancelOrderCommissions.mockResolvedValue(undefined);

      const dto = {
        orderIds: ['order1', 'order2', 'order3'],
        remark: 'Batch refund',
      };

      const result = await service.batchRefund(dto, 'admin');

      expect(result.data.successCount).toBe(2);
      expect(result.data.failCount).toBe(1);
      expect(result.data.details).toHaveLength(3);
      expect(result.data.details[0].success).toBe(true);
      expect(result.data.details[1].success).toBe(false);
      expect(result.data.details[1].error).toBeDefined();
      expect(result.data.details[2].success).toBe(true);
    });

    it('should continue processing after wechat refund fails', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
      });
      mockPaymentGateway.refund.mockRejectedValueOnce(new Error('Wechat API Error')).mockResolvedValueOnce({
        refundSn: 'REFUND_123456',
        refundId: 'wx_refund_123',
        status: RefundStatus.SUCCESS,
        amount: 10000,
      });
      mockFinanceCommandPort.cancelOrderCommissions.mockResolvedValue(undefined);

      const dto = {
        orderIds: ['order1', 'order2'],
        remark: 'Batch refund',
      };

      const result = await service.batchRefund(dto, 'admin');

      expect(result.data.successCount).toBe(1);
      expect(result.data.failCount).toBe(1);
      expect(result.data.details[0].success).toBe(false);
      expect(result.data.details[0].error).toContain('退款失败');
      expect(result.data.details[1].success).toBe(true);
    });

    it('should return empty result for empty order list', async () => {
      const dto = {
        orderIds: [],
        remark: 'Batch refund',
      };

      const result = await service.batchRefund(dto, 'admin');

      expect(result.data.successCount).toBe(0);
      expect(result.data.failCount).toBe(0);
      expect(result.data.details).toHaveLength(0);
    });

    it('Given duplicate orderIds, When batchRefund, Then refund each order once', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        memberId: 'm1',
        orderSn: 'ORDER123',
        payAmount: '100.00',
      });
      mockPaymentGateway.refund.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_123456',
        refundId: 'wx_refund_123',
        status: RefundStatus.SUCCESS,
        amount: 10000,
      });
      mockFinanceCommandPort.cancelOrderCommissions.mockResolvedValue(undefined);

      const result = await service.batchRefund({ orderIds: ['order1', 'order1'], remark: 'Batch refund' }, 'admin');

      expect(result.data.successCount).toBe(1);
      expect(result.data.details).toHaveLength(1);
      expect(paymentGateway.refund).toHaveBeenCalledTimes(1);
    });

    it('should handle orders with invalid status', async () => {
      mockOrderRepo.findOne
        .mockResolvedValueOnce({ id: 'order1', status: OrderStatus.PENDING_PAY })
        .mockResolvedValueOnce({
          id: 'order2',
          status: OrderStatus.PAID,
          memberId: 'm1',
          orderSn: 'ORDER123',
          payAmount: '100.00',
        });
      mockPaymentGateway.refund.mockResolvedValue({
        refundSn: 'REFUND_123456',
        refundId: 'wx_refund_123',
        status: RefundStatus.SUCCESS,
        amount: 10000,
      });
      mockFinanceCommandPort.cancelOrderCommissions.mockResolvedValue(undefined);

      const dto = {
        orderIds: ['order1', 'order2'],
        remark: 'Batch refund',
      };

      const result = await service.batchRefund(dto, 'admin');

      expect(result.data.successCount).toBe(1);
      expect(result.data.failCount).toBe(1);
      expect(result.data.details[0].success).toBe(false);
      expect(result.data.details[0].error).toContain('不可退款');
      expect(result.data.details[1].success).toBe(true);
    });
  });

  describe('batchTransitionOrderStatus', () => {
    it('should ship multiple product orders in PAID status', async () => {
      const result = await service.batchTransitionOrderStatus(
        {
          orderIds: ['a', 'b'],
          target: OrderBatchStatusTransitionTarget.SHIP,
          remark: 'r1',
        },
        'admin',
      );

      expect(result.data.successCount).toBe(2);
      expect(result.data.failCount).toBe(0);
      expect(fulfillmentService.shipProductForStore).toHaveBeenCalledTimes(2);
      expect(fulfillmentService.shipProductForStore).toHaveBeenCalledWith({ orderId: 'a', remark: 'r1' }, 'admin');
    });

    it('should complete receipt for SHIPPED product orders and update commission', async () => {
      const result = await service.batchTransitionOrderStatus(
        {
          orderIds: ['order1'],
          target: OrderBatchStatusTransitionTarget.COMPLETE_RECEIPT,
        },
        'admin',
      );

      expect(result.data.successCount).toBe(1);
      expect(fulfillmentService.confirmProductReceiptForStore).toHaveBeenCalledWith('order1', undefined, 'admin');
    });

    it('should record partial failures when status invalid', async () => {
      mockFulfillmentService.shipProductForStore
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new BusinessException(500, '仅「已支付待发货」状态的实物订单可发货'));

      const result = await service.batchTransitionOrderStatus(
        {
          orderIds: ['order1', 'order2'],
          target: OrderBatchStatusTransitionTarget.SHIP,
        },
        'admin',
      );

      expect(result.data.successCount).toBe(1);
      expect(result.data.failCount).toBe(1);
      expect(result.data.details[1].success).toBe(false);
      expect(result.data.details[1].error).toContain('已支付待发货');
    });

    it('should return empty details for empty orderIds', async () => {
      const result = await service.batchTransitionOrderStatus(
        { orderIds: [], target: OrderBatchStatusTransitionTarget.SHIP },
        'admin',
      );
      expect(result.data.details).toHaveLength(0);
      expect(result.data.successCount).toBe(0);
    });

    it('Given duplicate orderIds, When batchTransitionOrderStatus, Then transition each order once', async () => {
      const result = await service.batchTransitionOrderStatus(
        { orderIds: ['order1', 'order1'], target: OrderBatchStatusTransitionTarget.SHIP },
        'admin',
      );

      expect(result.data.successCount).toBe(1);
      expect(result.data.details).toHaveLength(1);
      expect(fulfillmentService.shipProductForStore).toHaveBeenCalledTimes(1);
    });
  });

  describe('batchUpdateRemark', () => {
    it('should append remark when append is true', async () => {
      mockPrisma.omsOrder.findFirst.mockResolvedValueOnce({ id: 'o1', remark: 'old' });
      mockPrisma.omsOrder.update.mockResolvedValueOnce({});

      const result = await service.batchUpdateRemark({
        orderIds: ['o1'],
        remark: 'new line',
        append: true,
      });

      expect(result.data.successCount).toBe(1);
      expect(mockPrisma.omsOrder.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { remark: 'old\nnew line' },
      });
    });

    it('should replace remark when append is false', async () => {
      mockPrisma.omsOrder.findFirst.mockResolvedValueOnce({ id: 'o1', remark: 'old' });
      mockPrisma.omsOrder.update.mockResolvedValueOnce({});

      const result = await service.batchUpdateRemark({
        orderIds: ['o1'],
        remark: 'only',
        append: false,
      });

      expect(result.data.successCount).toBe(1);
      expect(mockPrisma.omsOrder.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { remark: 'only' },
      });
    });

    it('should count failure when order not found', async () => {
      mockPrisma.omsOrder.findFirst.mockResolvedValueOnce(null);

      const result = await service.batchUpdateRemark({
        orderIds: ['missing'],
        remark: 'x',
      });

      expect(result.data.failCount).toBe(1);
      expect(result.data.successCount).toBe(0);
      expect(mockPrisma.omsOrder.update).not.toHaveBeenCalled();
    });

    it('Given duplicate orderIds, When batchUpdateRemark, Then update each order once', async () => {
      mockPrisma.omsOrder.findFirst.mockResolvedValueOnce({ id: 'o1', remark: 'old' });
      mockPrisma.omsOrder.update.mockResolvedValueOnce({});

      const result = await service.batchUpdateRemark({
        orderIds: ['o1', 'o1'],
        remark: 'new',
        append: false,
      });

      expect(result.data.successCount).toBe(1);
      expect(result.data.details).toHaveLength(1);
      expect(mockPrisma.omsOrder.update).toHaveBeenCalledTimes(1);
    });
  });
});
