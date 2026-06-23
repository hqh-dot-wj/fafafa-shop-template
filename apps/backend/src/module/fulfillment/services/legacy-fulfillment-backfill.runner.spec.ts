import { OrderStatus, OrderType, PayStatus, PrismaClient, ProductType } from '@prisma/client';
import {
  DEFAULT_FULFILLMENT_BACKFILL_STATUSES,
  FULFILLMENT_BACKFILL_CONFIRMATION,
  LegacyFulfillmentBackfillOptions,
  LegacyFulfillmentBackfillRunner,
} from './legacy-fulfillment-backfill.runner';

describe('LegacyFulfillmentBackfillRunner', () => {
  const buildOrder = (overrides: Record<string, unknown> = {}) => ({
    id: 'order-1',
    orderSn: 'NO202604250001',
    tenantId: 'tenant-1',
    status: OrderStatus.PAID,
    payStatus: PayStatus.PAID,
    orderType: OrderType.SERVICE,
    workerId: 12,
    updateTime: new Date('2026-04-25T00:00:00.000Z'),
    items: [
      {
        id: 1,
        tenantId: 'tenant-1',
        orderId: 'order-1',
        productId: 'service-1',
        productName: 'Service 1',
        productImg: 'service.jpg',
        productTypeSnapshot: ProductType.SERVICE,
        skuId: 'sku-1',
        quantity: 1,
        fulfillmentOrders: [],
      },
    ],
    fulfillmentOrders: [],
    ...overrides,
  });

  const buildOptions = (
    overrides: Partial<LegacyFulfillmentBackfillOptions> = {},
  ): LegacyFulfillmentBackfillOptions => ({
    apply: false,
    runId: 'fulfill-backfill-test',
    tenantId: undefined,
    statuses: [...DEFAULT_FULFILLMENT_BACKFILL_STATUSES],
    limit: 100,
    ...overrides,
  });

  it('returns dry-run rows without writing fulfillment data', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ exists: true }]),
      omsOrder: { findMany: jest.fn().mockResolvedValue([buildOrder()]) },
      pmsTenantSku: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(),
    } as unknown as PrismaClient;
    const runner = new LegacyFulfillmentBackfillRunner(prisma);

    const result = await runner.run(buildOptions());

    expect(result.mode).toBe('DRY_RUN');
    expect(result.summary).toMatchObject({
      scannedOrderCount: 1,
      canBackfillOrderCount: 1,
      reviewRequiredOrderCount: 0,
      skippedOrderCount: 0,
      missingItemCount: 1,
      creatableItemCount: 1,
      createdFulfillmentCount: 0,
    });
    expect(result.rows[0].dryRunItems[0]).toMatchObject({
      productTypeSource: 'SNAPSHOT',
      plannedStatus: 'ASSIGNED',
      dryRunAction: 'CREATE_FULFILLMENT',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects apply without tenant guard and confirmation phrase', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ exists: true }]),
      omsOrder: { findMany: jest.fn() },
      pmsTenantSku: { findMany: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as PrismaClient;
    const runner = new LegacyFulfillmentBackfillRunner(prisma);

    await expect(runner.run(buildOptions({ apply: true }))).rejects.toThrow('--tenant-id');
    expect(prisma.omsOrder.findMany).not.toHaveBeenCalled();
  });

  it('creates fulfillment, backfill event, and service assignment in apply mode', async () => {
    const order = buildOrder();
    const tx = {
      omsOrder: { findFirst: jest.fn().mockResolvedValue(order) },
      pmsTenantSku: { findMany: jest.fn().mockResolvedValue([]) },
      fulfillmentOrder: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'fulfillment-1' }),
      },
      fulfillmentEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
      fulfillmentAssignment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'assignment-1' }),
      },
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ exists: true }]),
      omsOrder: { findMany: jest.fn().mockResolvedValue([order]) },
      pmsTenantSku: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaClient;
    const runner = new LegacyFulfillmentBackfillRunner(prisma);

    const result = await runner.run(
      buildOptions({
        apply: true,
        tenantId: 'tenant-1',
        confirmApply: FULFILLMENT_BACKFILL_CONFIRMATION,
      }),
    );

    expect(result.mode).toBe('APPLY');
    expect(result.summary).toMatchObject({
      createdFulfillmentCount: 1,
      createdEventCount: 1,
      createdAssignmentCount: 1,
    });
    expect(tx.fulfillmentOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          orderId: 'order-1',
          orderItemId: 1,
          status: 'ASSIGNED',
        }),
      }),
    );
    expect(tx.fulfillmentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'LEGACY_BACKFILL',
          operationId: 'fulfill-backfill-test',
        }),
      }),
    );
    expect(tx.fulfillmentAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fulfillmentOrderId: 'fulfillment-1',
          workerId: 12,
          status: 'ASSIGNED',
        }),
      }),
    );
  });

  it('supports dry-run before fulfillment tables are migrated', async () => {
    const order = buildOrder({
      items: [
        {
          id: 1,
          tenantId: 'tenant-1',
          orderId: 'order-1',
          productId: 'service-1',
          productName: 'Service 1',
          skuId: 'sku-1',
          quantity: 1,
        },
      ],
    });
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ exists: false }]),
      omsOrder: { findMany: jest.fn().mockResolvedValue([order]) },
      pmsTenantSku: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sku-1',
            tenantId: 'tenant-1',
            tenantProd: { product: { type: ProductType.SERVICE } },
          },
        ]),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaClient;
    const runner = new LegacyFulfillmentBackfillRunner(prisma);

    const result = await runner.run(buildOptions());

    expect(result.warnings[0]).toContain('未部署履约表');
    expect(result.rows[0].dryRunItems[0]).toMatchObject({
      productTypeSource: 'SKU_JOIN',
      plannedStatus: 'ASSIGNED',
      dryRunAction: 'CREATE_FULFILLMENT',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
