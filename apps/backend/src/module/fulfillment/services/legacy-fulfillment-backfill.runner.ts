import {
  FulfillmentActorType,
  FulfillmentAssignmentStatus,
  FulfillmentEventType,
  FulfillmentStatus,
  FulfillmentType,
  OrderStatus,
  Prisma,
  PrismaClient,
  ProductType,
} from '@prisma/client';
import {
  buildMissingFulfillmentBackfillPlan,
  FulfillmentBackfillOrderInput,
  FulfillmentBackfillOrderPlan,
  skuTypeKey,
} from './fulfillment-backfill-plan';

export const FULFILLMENT_BACKFILL_CONFIRMATION = 'FULFILLMENT_BACKFILL';
export const DEFAULT_FULFILLMENT_BACKFILL_STATUSES = [
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
  OrderStatus.COMPLETED,
] as const;

export interface LegacyFulfillmentBackfillOptions {
  apply: boolean;
  runId: string;
  tenantId?: string;
  statuses: OrderStatus[];
  orderSn?: string;
  limit: number;
  confirmApply?: string;
  allowTerminalStatus?: boolean;
}

export interface LegacyFulfillmentBackfillSummary {
  scannedOrderCount: number;
  canBackfillOrderCount: number;
  reviewRequiredOrderCount: number;
  skippedOrderCount: number;
  missingItemCount: number;
  creatableItemCount: number;
  reviewRequiredItemCount: number;
  skippedItemCount: number;
  createdFulfillmentCount: number;
  createdEventCount: number;
  createdAssignmentCount: number;
  alreadyExistingFulfillmentCount: number;
}

export interface LegacyFulfillmentBackfillApplyOrderResult {
  orderId: string;
  orderSn: string;
  action: 'APPLIED' | 'SKIPPED' | 'REVIEW_REQUIRED';
  blockReasons: string[];
  createdFulfillmentCount: number;
  createdEventCount: number;
  createdAssignmentCount: number;
  alreadyExistingFulfillmentCount: number;
}

export interface LegacyFulfillmentBackfillResult {
  runId: string;
  mode: 'DRY_RUN' | 'APPLY';
  warnings: string[];
  filters: {
    tenantId?: string;
    statuses: OrderStatus[];
    orderSn?: string;
    limit: number;
  };
  summary: LegacyFulfillmentBackfillSummary;
  rows: FulfillmentBackfillOrderPlan[];
  applyResults: LegacyFulfillmentBackfillApplyOrderResult[];
}

type BackfillDbClient = PrismaClient | Prisma.TransactionClient;
type BackfillOrder = Prisma.OmsOrderGetPayload<{
  include: {
    items: {
      include: {
        fulfillmentOrders: true;
      };
    };
    fulfillmentOrders: true;
  };
}>;
type RunnerOrder = FulfillmentBackfillOrderInput & {
  updateTime: Date;
};

export class LegacyFulfillmentBackfillRunner {
  constructor(private readonly prisma: PrismaClient) {}

  async run(options: LegacyFulfillmentBackfillOptions): Promise<LegacyFulfillmentBackfillResult> {
    this.assertValidOptions(options);
    const hasFulfillmentSchema = await this.hasFulfillmentSchema();
    const warnings: string[] = [];
    if (!hasFulfillmentSchema) {
      warnings.push(
        '当前数据库未部署履约表；dry-run 会按所有候选订单项均缺失履约单处理，且无法读取 productTypeSnapshot。执行 --apply 前必须先部署履约 migration。',
      );
    }

    const rows = await this.findCandidateOrders(options, hasFulfillmentSchema);
    const skuTypeMap = await this.loadSkuProductTypes(
      this.collectMissingSkuIds(rows),
      rows.map((order) => order.tenantId),
      this.prisma,
    );
    const plans = rows.map((order) => buildMissingFulfillmentBackfillPlan(order, skuTypeMap));
    const summary = this.summarizePlans(plans);
    const applyResults: LegacyFulfillmentBackfillApplyOrderResult[] = [];

    if (options.apply) {
      for (const plan of plans) {
        const result = await this.applyOrder(plan.orderId, options);
        applyResults.push(result);
        summary.createdFulfillmentCount += result.createdFulfillmentCount;
        summary.createdEventCount += result.createdEventCount;
        summary.createdAssignmentCount += result.createdAssignmentCount;
        summary.alreadyExistingFulfillmentCount += result.alreadyExistingFulfillmentCount;
      }
    }

    return {
      runId: options.runId,
      mode: options.apply ? 'APPLY' : 'DRY_RUN',
      warnings,
      filters: {
        tenantId: options.tenantId,
        statuses: options.statuses,
        orderSn: options.orderSn,
        limit: options.limit,
      },
      summary,
      rows: plans,
      applyResults,
    };
  }

  private async findCandidateOrders(
    options: LegacyFulfillmentBackfillOptions,
    hasFulfillmentSchema: boolean,
  ): Promise<RunnerOrder[]> {
    if (!hasFulfillmentSchema) {
      if (options.apply) {
        throw new Error('当前数据库未部署履约表，不能执行 --apply；请先部署履约 migration。');
      }
      return this.findCandidateOrdersBeforeFulfillmentSchema(options);
    }

    const where: Prisma.OmsOrderWhereInput = {
      status: { in: options.statuses },
      items: {
        some: {
          fulfillmentOrders: { none: {} },
        },
      },
    };

    if (options.tenantId) {
      where.tenantId = options.tenantId;
    }
    if (options.orderSn) {
      where.orderSn = { contains: options.orderSn };
    }

    const rows = await this.prisma.omsOrder.findMany({
      where,
      take: options.limit,
      orderBy: { createTime: 'asc' },
      include: {
        items: {
          include: {
            fulfillmentOrders: true,
          },
        },
        fulfillmentOrders: true,
      },
    });
    return rows.map((order) => this.toRunnerOrder(order));
  }

  private async findCandidateOrdersBeforeFulfillmentSchema(
    options: LegacyFulfillmentBackfillOptions,
  ): Promise<RunnerOrder[]> {
    const where: Prisma.OmsOrderWhereInput = {
      status: { in: options.statuses },
      items: { some: {} },
    };

    if (options.tenantId) {
      where.tenantId = options.tenantId;
    }
    if (options.orderSn) {
      where.orderSn = { contains: options.orderSn };
    }

    const rows = await this.prisma.omsOrder.findMany({
      where,
      take: options.limit,
      orderBy: { createTime: 'asc' },
      select: {
        id: true,
        orderSn: true,
        tenantId: true,
        status: true,
        payStatus: true,
        orderType: true,
        workerId: true,
        updateTime: true,
        items: {
          select: {
            id: true,
            tenantId: true,
            productId: true,
            productName: true,
            skuId: true,
            quantity: true,
          },
        },
      },
    });

    return rows.map(
      (order): RunnerOrder => ({
        ...order,
        fulfillmentOrders: [] as unknown[],
        items: order.items.map((item) => ({
          ...item,
          productTypeSnapshot: null as ProductType | null,
          fulfillmentOrders: [] as unknown[],
        })),
      }),
    );
  }

  private async applyOrder(
    orderId: string,
    options: LegacyFulfillmentBackfillOptions,
  ): Promise<LegacyFulfillmentBackfillApplyOrderResult> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.omsOrder.findFirst({
        where: {
          id: orderId,
          ...(options.tenantId ? { tenantId: options.tenantId } : {}),
        },
        include: {
          items: {
            include: {
              fulfillmentOrders: true,
            },
          },
          fulfillmentOrders: true,
        },
      });

      if (!order) {
        return this.emptyApplyResult(orderId, '', 'SKIPPED', ['ORDER_NOT_FOUND']);
      }

      const skuTypeMap = await this.loadSkuProductTypes(this.collectMissingSkuIds([order]), [order.tenantId], tx);
      const plan = buildMissingFulfillmentBackfillPlan(order, skuTypeMap);
      if (!plan.canBackfill) {
        return this.emptyApplyResult(order.id, order.orderSn, this.resolvePlanSkipAction(plan), plan.blockReasons);
      }

      const result = this.emptyApplyResult(order.id, order.orderSn, 'APPLIED', []);
      for (const item of plan.dryRunItems) {
        if (item.dryRunAction !== 'CREATE_FULFILLMENT' || !item.fulfillmentType || !item.plannedStatus) {
          continue;
        }

        const existing = await tx.fulfillmentOrder.findUnique({
          where: {
            tenantId_orderId_orderItemId_type: {
              tenantId: order.tenantId,
              orderId: order.id,
              orderItemId: item.orderItemId,
              type: item.fulfillmentType,
            },
          },
        });

        const fulfillment =
          existing ??
          (await tx.fulfillmentOrder.create({
            data: {
              tenantId: order.tenantId,
              orderId: order.id,
              orderItemId: item.orderItemId,
              type: item.fulfillmentType,
              status: item.plannedStatus,
              completedAt: this.completedAtFor(order, item.plannedStatus),
              cancelledAt: this.cancelledAtFor(order, item.plannedStatus),
            },
          }));

        if (existing) {
          result.alreadyExistingFulfillmentCount += 1;
        } else {
          result.createdFulfillmentCount += 1;
        }

        const eventCreated = await this.ensureBackfillEvent(tx, order, fulfillment.id, item, options.runId);
        if (eventCreated) {
          result.createdEventCount += 1;
        }

        if (item.fulfillmentType === FulfillmentType.SERVICE && order.workerId != null) {
          const assignmentCreated = await this.ensureBackfillAssignment(
            tx,
            fulfillment.id,
            order.tenantId,
            order.workerId,
          );
          if (assignmentCreated) {
            result.createdAssignmentCount += 1;
          }
        }
      }

      return result;
    });
  }

  private async ensureBackfillEvent(
    tx: Prisma.TransactionClient,
    order: RunnerOrder,
    fulfillmentOrderId: string,
    item: FulfillmentBackfillOrderPlan['dryRunItems'][number],
    runId: string,
  ): Promise<boolean> {
    const existing = await tx.fulfillmentEvent.findFirst({
      where: {
        tenantId: order.tenantId,
        fulfillmentOrderId,
        operationId: runId,
        eventType: FulfillmentEventType.LEGACY_BACKFILL,
      },
      select: { id: true },
    });
    if (existing) return false;

    await tx.fulfillmentEvent.create({
      data: {
        tenantId: order.tenantId,
        fulfillmentOrderId,
        orderId: order.id,
        eventType: FulfillmentEventType.LEGACY_BACKFILL,
        toStatus: item.plannedStatus,
        actorType: FulfillmentActorType.SYSTEM,
        actorId: 'legacy-backfill',
        operationId: runId,
        payloadJson: {
          source: 'legacy_fulfillment_backfill',
          backfillRunId: runId,
          sourceOrderStatus: order.status,
          sourcePayStatus: order.payStatus,
          orderType: order.orderType,
          orderItemId: item.orderItemId,
          skuId: item.skuId,
          productType: item.productType,
          productTypeSource: item.productTypeSource,
          fulfillmentType: item.fulfillmentType,
          plannedStatus: item.plannedStatus,
          inferred: true,
        },
        remark: '历史履约回填',
      },
    });

    return true;
  }

  private async ensureBackfillAssignment(
    tx: Prisma.TransactionClient,
    fulfillmentOrderId: string,
    tenantId: string,
    workerId: number,
  ): Promise<boolean> {
    const existing = await tx.fulfillmentAssignment.findFirst({
      where: {
        fulfillmentOrderId,
        workerId,
      },
      select: { id: true },
    });
    if (existing) return false;

    await tx.fulfillmentAssignment.create({
      data: {
        tenantId,
        fulfillmentOrderId,
        workerId,
        status: FulfillmentAssignmentStatus.ASSIGNED,
        assignedAt: new Date(),
        remark: '历史履约回填自动补建指派',
      },
    });

    return true;
  }

  private async loadSkuProductTypes(
    skuIds: string[],
    tenantIds: string[],
    client: BackfillDbClient,
  ): Promise<Map<string, ProductType>> {
    const uniqueSkuIds = [...new Set(skuIds)];
    const uniqueTenantIds = [...new Set(tenantIds)];
    if (uniqueSkuIds.length === 0 || uniqueTenantIds.length === 0) return new Map();

    const rows = await client.pmsTenantSku.findMany({
      where: {
        id: { in: uniqueSkuIds },
        tenantId: { in: uniqueTenantIds },
      },
      include: {
        tenantProd: {
          include: { product: true },
        },
      },
    });

    return new Map(rows.map((row) => [skuTypeKey(row.tenantId, row.id), row.tenantProd.product.type]));
  }

  private collectMissingSkuIds(orders: FulfillmentBackfillOrderInput[]): string[] {
    return orders.flatMap((order) =>
      order.items.filter((item) => (item.fulfillmentOrders?.length ?? 0) === 0).map((item) => item.skuId),
    );
  }

  private summarizePlans(plans: FulfillmentBackfillOrderPlan[]): LegacyFulfillmentBackfillSummary {
    const items = plans.flatMap((plan) => plan.dryRunItems);

    return {
      scannedOrderCount: plans.length,
      canBackfillOrderCount: plans.filter((plan) => plan.canBackfill).length,
      reviewRequiredOrderCount: plans.filter(
        (plan) => !plan.canBackfill && this.resolvePlanSkipAction(plan) === 'REVIEW_REQUIRED',
      ).length,
      skippedOrderCount: plans.filter((plan) => !plan.canBackfill && this.resolvePlanSkipAction(plan) === 'SKIPPED')
        .length,
      missingItemCount: items.length,
      creatableItemCount: items.filter((item) => item.dryRunAction === 'CREATE_FULFILLMENT').length,
      reviewRequiredItemCount: items.filter((item) => item.dryRunAction === 'REVIEW_REQUIRED').length,
      skippedItemCount: items.filter((item) => item.dryRunAction === 'SKIP').length,
      createdFulfillmentCount: 0,
      createdEventCount: 0,
      createdAssignmentCount: 0,
      alreadyExistingFulfillmentCount: 0,
    };
  }

  private resolvePlanSkipAction(plan: FulfillmentBackfillOrderPlan): 'SKIPPED' | 'REVIEW_REQUIRED' {
    if (plan.blockReasons.some((reason) => reason.startsWith('SKIP_'))) return 'SKIPPED';
    return 'REVIEW_REQUIRED';
  }

  private emptyApplyResult(
    orderId: string,
    orderSn: string,
    action: LegacyFulfillmentBackfillApplyOrderResult['action'],
    blockReasons: string[],
  ): LegacyFulfillmentBackfillApplyOrderResult {
    return {
      orderId,
      orderSn,
      action,
      blockReasons,
      createdFulfillmentCount: 0,
      createdEventCount: 0,
      createdAssignmentCount: 0,
      alreadyExistingFulfillmentCount: 0,
    };
  }

  private toRunnerOrder(order: BackfillOrder): RunnerOrder {
    return {
      id: order.id,
      orderSn: order.orderSn,
      tenantId: order.tenantId,
      status: order.status,
      payStatus: order.payStatus,
      orderType: order.orderType,
      workerId: order.workerId,
      updateTime: order.updateTime,
      fulfillmentOrders: order.fulfillmentOrders,
      items: order.items.map((item) => ({
        id: item.id,
        tenantId: item.tenantId,
        productId: item.productId,
        skuId: item.skuId,
        productName: item.productName,
        quantity: item.quantity,
        productTypeSnapshot: item.productTypeSnapshot,
        fulfillmentOrders: item.fulfillmentOrders,
      })),
    };
  }

  private async hasFulfillmentSchema(): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public.fulfillment_order') IS NOT NULL AS "exists"
    `;
    return rows[0]?.exists === true;
  }

  private completedAtFor(order: Pick<RunnerOrder, 'updateTime'>, status: FulfillmentStatus): Date | undefined {
    if (status !== FulfillmentStatus.FULFILLED) return undefined;
    return order.updateTime ?? new Date();
  }

  private cancelledAtFor(order: Pick<RunnerOrder, 'updateTime'>, status: FulfillmentStatus): Date | undefined {
    if (status !== FulfillmentStatus.CANCELLED) return undefined;
    return order.updateTime ?? new Date();
  }

  private assertValidOptions(options: LegacyFulfillmentBackfillOptions): void {
    if (options.limit <= 0 || options.limit > 500) {
      throw new Error('limit 必须在 1 到 500 之间');
    }
    if (!options.runId || options.runId.length > 64) {
      throw new Error('runId 不能为空，且长度不能超过 64');
    }
    if (options.statuses.length === 0) {
      throw new Error('statuses 不能为空');
    }
    if (!options.apply) return;
    if (!options.tenantId) {
      throw new Error('执行 --apply 时必须指定 --tenant-id，禁止跨租户批量写入');
    }
    if (options.confirmApply !== FULFILLMENT_BACKFILL_CONFIRMATION) {
      throw new Error(`执行 --apply 时必须传入 --confirm-apply=${FULFILLMENT_BACKFILL_CONFIRMATION}`);
    }
    const hasTerminalStatus = options.statuses.some(
      (status) => status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED,
    );
    if (hasTerminalStatus && !options.allowTerminalStatus) {
      throw new Error('CANCELLED/REFUNDED 回填需要额外传入 --allow-terminal-status');
    }
  }
}
