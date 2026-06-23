import {
  FulfillmentActorType,
  FulfillmentEventType,
  FulfillmentStatus,
  FulfillmentType,
  OrderStatus,
  OrderType,
  PayStatus,
  ProductType,
} from '@prisma/client';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { FulfillmentService } from './fulfillment.service';

describe('FulfillmentService diagnoseMissingFulfillment', () => {
  let service: FulfillmentService;

  const mockPrisma = {
    omsOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    fulfillmentOrder: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    fulfillmentShipment: {
      create: jest.fn(),
    },
    fulfillmentAssignment: {
      updateMany: jest.fn(),
    },
    srvWorker: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    pmsTenantSku: {
      findMany: jest.fn(),
    },
  };

  const tenantHelper = {
    readWhereForDelegate: jest.fn((_delegate: string, where?: object) => ({ ...(where ?? {}) })),
  };

  const financeCommandPort = {
    updateCommissionPlanSettleTime: jest.fn(),
  };

  const distributionQualificationService = {
    markServiceOrderVerified: jest.fn(),
  };

  const buildOrder = (overrides: Record<string, unknown> = {}) => ({
    id: 'order-1',
    orderSn: 'NO202604250001',
    tenantId: 'tenant-1',
    status: OrderStatus.PAID,
    payStatus: PayStatus.PAID,
    orderType: OrderType.PRODUCT,
    workerId: null,
    items: [
      {
        id: 1,
        tenantId: 'tenant-1',
        orderId: 'order-1',
        productId: 'product-1',
        productName: 'Product 1',
        productImg: 'product.jpg',
        productTypeSnapshot: ProductType.REAL,
        skuId: 'sku-1',
        quantity: 1,
        fulfillmentOrders: [],
      },
    ],
    fulfillmentOrders: [],
    ...overrides,
  });

  beforeEach(() => {
    service = new FulfillmentService(
      mockPrisma as any,
      tenantHelper as any,
      financeCommandPort as any,
      distributionQualificationService as any,
    );
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'isSuperTenant').mockReturnValue(false);
    mockPrisma.omsOrder.count.mockResolvedValue(1);
    mockPrisma.omsOrder.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.fulfillmentOrder.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.fulfillmentOrder.findFirstOrThrow.mockResolvedValue({
      id: 'fulfillment-1',
      tenantId: 'tenant-1',
      orderId: 'order-1',
      status: FulfillmentStatus.IN_SERVICE,
    });
    mockPrisma.srvWorker.count.mockResolvedValue(1);
    mockPrisma.pmsTenantSku.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('plans product backfill from item snapshot for paid orders', async () => {
    mockPrisma.omsOrder.findMany.mockResolvedValue([buildOrder()]);

    const result = await service.diagnoseMissingFulfillment({ pageNum: 1, pageSize: 10 } as any);
    const row = result.data?.rows[0] as any;

    expect(mockPrisma.omsOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          items: { some: { fulfillmentOrders: { none: {} } } },
        }),
      }),
    );
    expect(row).toMatchObject({
      orderId: 'order-1',
      itemCount: 1,
      totalItemCount: 1,
      existingFulfillmentCount: 0,
      canBackfill: true,
    });
    expect(row.dryRunItems[0]).toMatchObject({
      productType: ProductType.REAL,
      productTypeSource: 'SNAPSHOT',
      fulfillmentType: FulfillmentType.PRODUCT,
      plannedStatus: FulfillmentStatus.PENDING_SHIPMENT,
      dryRunAction: 'CREATE_FULFILLMENT',
      canBackfill: true,
      blockReasons: [],
    });
  });

  it('only plans missing items and can infer service type from sku join', async () => {
    const order = buildOrder({
      status: OrderStatus.SHIPPED,
      orderType: OrderType.MIXED,
      items: [
        {
          id: 1,
          tenantId: 'tenant-1',
          orderId: 'order-1',
          productId: 'product-1',
          productName: 'Existing product',
          productImg: 'product.jpg',
          productTypeSnapshot: ProductType.REAL,
          skuId: 'sku-product',
          quantity: 1,
          fulfillmentOrders: [{ id: 'fulfillment-1' }],
        },
        {
          id: 2,
          tenantId: 'tenant-1',
          orderId: 'order-1',
          productId: 'service-1',
          productName: 'Missing service',
          productImg: 'service.jpg',
          productTypeSnapshot: null,
          skuId: 'sku-service',
          quantity: 1,
          fulfillmentOrders: [],
        },
      ],
      fulfillmentOrders: [{ id: 'fulfillment-1' }],
    });
    mockPrisma.omsOrder.findMany.mockResolvedValue([order]);
    mockPrisma.pmsTenantSku.findMany.mockResolvedValue([
      {
        id: 'sku-service',
        tenantId: 'tenant-1',
        tenantProd: { product: { type: ProductType.SERVICE } },
      },
    ]);

    const result = await service.diagnoseMissingFulfillment({ pageNum: 1, pageSize: 10 } as any);
    const row = result.data?.rows[0] as any;

    expect(mockPrisma.pmsTenantSku.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['sku-service'] },
          tenantId: { in: ['tenant-1'] },
        }),
      }),
    );
    expect(row).toMatchObject({
      itemCount: 1,
      totalItemCount: 2,
      existingFulfillmentCount: 1,
      canBackfill: true,
    });
    expect(row.dryRunItems).toHaveLength(1);
    expect(row.dryRunItems[0]).toMatchObject({
      orderItemId: 2,
      productType: ProductType.SERVICE,
      productTypeSource: 'SKU_JOIN',
      fulfillmentType: FulfillmentType.SERVICE,
      plannedStatus: FulfillmentStatus.SERVICE_DONE,
      dryRunAction: 'CREATE_FULFILLMENT',
    });
  });

  it('marks mixed orders with unknown item type as review required', async () => {
    mockPrisma.omsOrder.findMany.mockResolvedValue([
      buildOrder({
        orderType: OrderType.MIXED,
        items: [
          {
            id: 3,
            tenantId: 'tenant-1',
            orderId: 'order-1',
            productId: 'unknown-1',
            productName: 'Unknown item',
            productImg: 'unknown.jpg',
            productTypeSnapshot: null,
            skuId: 'sku-unknown',
            quantity: 1,
            fulfillmentOrders: [],
          },
        ],
      }),
    ]);

    const result = await service.diagnoseMissingFulfillment({ pageNum: 1, pageSize: 10 } as any);
    const row = result.data?.rows[0] as any;

    expect(row).toMatchObject({
      hasUnknownItemType: true,
      canBackfill: false,
    });
    expect(row.dryRunItems[0]).toMatchObject({
      productType: null,
      productTypeSource: 'UNKNOWN',
      fulfillmentType: null,
      plannedStatus: null,
      dryRunAction: 'REVIEW_REQUIRED',
      canBackfill: false,
    });
    expect(row.dryRunItems[0].blockReasons).toEqual(
      expect.arrayContaining(['PRODUCT_TYPE_UNKNOWN', 'NO_BACKFILL_STATUS_FOR_ORDER_STATE']),
    );
  });

  it('skips unpaid pending orders when the status filter asks for them', async () => {
    mockPrisma.omsOrder.findMany.mockResolvedValue([
      buildOrder({
        status: OrderStatus.PENDING_PAY,
        payStatus: PayStatus.UNPAID,
      }),
    ]);

    const result = await service.diagnoseMissingFulfillment({
      pageNum: 1,
      pageSize: 10,
      status: OrderStatus.PENDING_PAY,
    } as any);
    const row = result.data?.rows[0] as any;

    expect(row.canBackfill).toBe(false);
    expect(row.blockReasons).toEqual(
      expect.arrayContaining(['SKIP_PENDING_PAY_ORDER', 'NO_BACKFILL_STATUS_FOR_ORDER_STATE']),
    );
    expect(row.dryRunItems[0]).toMatchObject({
      dryRunAction: 'SKIP',
      plannedStatus: null,
    });
  });

  it('lists service dispatch orders through fulfillment boundary', async () => {
    mockPrisma.omsOrder.findMany.mockResolvedValue([
      {
        id: 'order-1',
        orderSn: 'NO202604250001',
        tenantId: 'tenant-1',
        orderType: OrderType.SERVICE,
        status: OrderStatus.PAID,
        receiverName: '张三',
        receiverPhone: '13800138000',
        payAmount: '120.00',
        items: [{ productImg: 'service.jpg' }],
        tenant: { companyName: '门店A' },
      },
    ]);

    const result = await service.listServiceDispatch({ pageNum: 1, pageSize: 10, orderSn: 'NO2026' });

    expect(mockPrisma.omsOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          status: OrderStatus.PAID,
          workerId: null,
          orderSn: { contains: 'NO2026' },
        }),
      }),
    );
    expect(result.data?.rows[0]).toMatchObject({
      id: 'order-1',
      productImg: 'service.jpg',
      tenantName: '门店A',
      remainingAmount: 120,
    });
  });

  it('lists service worker candidates with keyword and tenant filter', async () => {
    mockPrisma.srvWorker.findMany.mockResolvedValue([
      {
        workerId: 1,
        name: '张师傅',
        nickName: null,
        phone: '13800138000',
        status: 'WORKING',
        auditStatus: 'APPROVED',
        isOnline: true,
      },
    ]);

    const result = await service.listServiceWorkerCandidates({ pageNum: 1, pageSize: 10, keyword: ' 张 ' });

    expect(mockPrisma.srvWorker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          OR: expect.arrayContaining([
            expect.objectContaining({ name: expect.objectContaining({ contains: '张', mode: 'insensitive' }) }),
          ]),
        }),
      }),
    );
    expect(result.data?.rows[0]).toMatchObject({ workerId: 1, name: '张师傅' });
  });

  it('loads order with explicit tenant scope inside fulfillment helpers', async () => {
    mockPrisma.omsOrder.findFirst.mockResolvedValue(buildOrder());

    const result = await (service as any).findOrderWithItemsAndFulfillments('order-1', 'tenant-1');

    expect(mockPrisma.omsOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1', tenantId: 'tenant-1' },
      }),
    );
    expect(result).toMatchObject({ id: 'order-1', tenantId: 'tenant-1' });
  });

  it('loads fulfillment rows with the order tenant boundary', async () => {
    mockPrisma.fulfillmentOrder.findMany.mockResolvedValue([]);

    await (service as any).findFulfillments('order-1', FulfillmentType.SERVICE, 'tenant-1');

    expect(mockPrisma.fulfillmentOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 'order-1', type: FulfillmentType.SERVICE, tenantId: 'tenant-1' },
      }),
    );
  });

  it('updates fulfillment status with tenant guard', async () => {
    const recordEvent = jest.fn().mockResolvedValue(undefined);
    (service as any).recordEvent = recordEvent;

    await (service as any).transitionFulfillmentOrder(
      {
        id: 'fulfillment-1',
        tenantId: 'tenant-1',
        orderId: 'order-1',
        status: FulfillmentStatus.ASSIGNED,
      },
      FulfillmentStatus.IN_SERVICE,
      {
        eventType: FulfillmentEventType.START,
        actorType: FulfillmentActorType.ADMIN,
        actorId: 'admin-1',
      },
    );

    expect(mockPrisma.fulfillmentOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'fulfillment-1',
          tenantId: 'tenant-1',
          status: FulfillmentStatus.ASSIGNED,
        },
      }),
    );
    expect(mockPrisma.fulfillmentOrder.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'fulfillment-1', tenantId: 'tenant-1' },
    });
  });

  it('skips duplicate product shipment operation without appending order remarks again', async () => {
    (service as any).findStoreOrderForOperation = jest.fn().mockResolvedValue(
      buildOrder({
        orderType: OrderType.PRODUCT,
        status: OrderStatus.PAID,
        payStatus: PayStatus.PAID,
      }),
    );
    (service as any).ensureForPaidOrder = jest.fn().mockResolvedValue(undefined);
    (service as any).findFulfillments = jest.fn().mockResolvedValue([
      {
        id: 'fulfillment-1',
        tenantId: 'tenant-1',
        orderId: 'order-1',
        orderItemId: 1,
        status: FulfillmentStatus.PENDING_SHIPMENT,
        orderItem: { id: 1, skuId: 'sku-1', quantity: 1 },
      },
    ]);
    (service as any).hasOperation = jest.fn().mockResolvedValue(true);
    (service as any).transitionFulfillmentOrder = jest.fn();
    (service as any).syncMainOrderStatus = jest.fn();
    (service as any).getOrderFulfillment = jest.fn().mockResolvedValue({ orderId: 'order-1' });

    await service.shipProductForStore({ orderId: 'order-1', operationId: 'ship-op-1', remark: '重复发货' }, 'admin-1');

    expect(mockPrisma.fulfillmentShipment.create).not.toHaveBeenCalled();
    expect((service as any).transitionFulfillmentOrder).not.toHaveBeenCalled();
    expect((service as any).syncMainOrderStatus).not.toHaveBeenCalled();
  });

  it('skips duplicate product receipt operation without commission settle-time side effects', async () => {
    (service as any).ensureForPaidOrder = jest.fn().mockResolvedValue(undefined);
    (service as any).findFulfillments = jest.fn().mockResolvedValue([
      {
        id: 'fulfillment-1',
        tenantId: 'tenant-1',
        orderId: 'order-1',
        status: FulfillmentStatus.FULFILLED,
      },
    ]);
    (service as any).hasOperation = jest.fn().mockResolvedValue(true);
    (service as any).transitionFulfillmentOrder = jest.fn();

    const processed = await (service as any).completeProductReceipt({
      orderId: 'order-1',
      tenantId: 'tenant-1',
      actorType: FulfillmentActorType.ADMIN,
      actorId: 'admin-1',
      operationId: 'receive-op-1',
      commissionFailureMode: 'throw',
      invalidStatusMessage: '仅「已发货」状态的实物订单可确认收货',
    });

    expect(processed).toBe(false);
    expect((service as any).transitionFulfillmentOrder).not.toHaveBeenCalled();
    expect(financeCommandPort.updateCommissionPlanSettleTime).not.toHaveBeenCalled();
  });

  it('skips duplicate service verify operation without settlement or qualification side effects', async () => {
    (service as any).findStoreOrderForOperation = jest.fn().mockResolvedValue(
      buildOrder({
        orderType: OrderType.SERVICE,
        status: OrderStatus.SHIPPED,
        payStatus: PayStatus.PAID,
      }),
    );
    (service as any).ensureForPaidOrder = jest.fn().mockResolvedValue(undefined);
    (service as any).findFulfillments = jest.fn().mockResolvedValue([
      {
        id: 'fulfillment-1',
        tenantId: 'tenant-1',
        orderId: 'order-1',
        status: FulfillmentStatus.FULFILLED,
      },
    ]);
    (service as any).hasOperation = jest.fn().mockResolvedValue(true);
    (service as any).transitionFulfillmentOrder = jest.fn();
    (service as any).syncMainOrderStatus = jest.fn();
    (service as any).getOrderFulfillment = jest.fn().mockResolvedValue({ orderId: 'order-1' });

    await service.verifyServiceForStore('order-1', '重复核销', 'admin-1', 'verify-op-1');

    expect((service as any).transitionFulfillmentOrder).not.toHaveBeenCalled();
    expect(financeCommandPort.updateCommissionPlanSettleTime).not.toHaveBeenCalled();
    expect(distributionQualificationService.markServiceOrderVerified).not.toHaveBeenCalled();
    expect((service as any).syncMainOrderStatus).not.toHaveBeenCalled();
  });
});
