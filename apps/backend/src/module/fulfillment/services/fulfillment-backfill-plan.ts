import { FulfillmentStatus, FulfillmentType, OrderStatus, OrderType, PayStatus, ProductType } from '@prisma/client';

export type FulfillmentBackfillProductTypeSource = 'SNAPSHOT' | 'SKU_JOIN' | 'ORDER_TYPE' | 'UNKNOWN';
export type FulfillmentBackfillAction = 'CREATE_FULFILLMENT' | 'SKIP' | 'REVIEW_REQUIRED';

export interface FulfillmentBackfillOrderItemInput {
  id: number;
  tenantId?: string | null;
  productId: string;
  skuId: string;
  productName: string;
  quantity: number;
  productTypeSnapshot?: ProductType | null;
  fulfillmentOrders?: readonly unknown[];
}

export interface FulfillmentBackfillOrderInput {
  id: string;
  orderSn: string;
  tenantId: string;
  status: OrderStatus;
  payStatus: PayStatus;
  orderType: OrderType;
  workerId: number | null;
  items: readonly FulfillmentBackfillOrderItemInput[];
  fulfillmentOrders?: readonly unknown[];
}

export interface FulfillmentBackfillItemPlan {
  orderItemId: number;
  productId: string;
  skuId: string;
  productName: string;
  quantity: number;
  productType: ProductType | null;
  productTypeSource: FulfillmentBackfillProductTypeSource;
  fulfillmentType: FulfillmentType | null;
  plannedStatus: FulfillmentStatus | null;
  dryRunAction: FulfillmentBackfillAction;
  canBackfill: boolean;
  blockReasons: string[];
}

export interface FulfillmentBackfillOrderPlan {
  orderId: string;
  orderSn: string;
  tenantId: string;
  status: OrderStatus;
  payStatus: PayStatus;
  orderType: OrderType;
  workerId: number | null;
  totalItemCount: number;
  existingFulfillmentCount: number;
  itemCount: number;
  hasUnknownItemType: boolean;
  canBackfill: boolean;
  blockReasons: string[];
  dryRunItems: FulfillmentBackfillItemPlan[];
}

export function skuTypeKey(tenantId: string, skuId: string): string {
  return `${tenantId}:${skuId}`;
}

export function toFulfillmentType(productType: ProductType): FulfillmentType {
  if (productType === ProductType.REAL) return FulfillmentType.PRODUCT;
  return FulfillmentType.SERVICE;
}

export function initialFulfillmentStatusFor(type: FulfillmentType, workerId: number | null): FulfillmentStatus {
  if (type === FulfillmentType.PRODUCT) return FulfillmentStatus.PENDING_SHIPMENT;
  return workerId == null ? FulfillmentStatus.PENDING_ASSIGNMENT : FulfillmentStatus.ASSIGNED;
}

export function buildMissingFulfillmentBackfillPlan(
  order: FulfillmentBackfillOrderInput,
  skuTypeMap: Map<string, ProductType>,
): FulfillmentBackfillOrderPlan {
  const orderBlockReasons = getBackfillOrderBlockReasons(order);
  const missingItems = order.items.filter((item) => (item.fulfillmentOrders?.length ?? 0) === 0);
  const dryRunItems = missingItems.map((item) => {
    const inferred = inferBackfillProductType(order, item, skuTypeMap);
    const fulfillmentType = inferred.productType ? toFulfillmentType(inferred.productType) : null;
    const plannedStatus = fulfillmentType ? planBackfillStatus(order, fulfillmentType) : null;
    const itemBlockReasons = getBackfillItemBlockReasons(inferred.source, plannedStatus);
    const blockReasons = [...orderBlockReasons, ...itemBlockReasons];
    const canBackfill = blockReasons.length === 0;

    return {
      orderItemId: item.id,
      productId: item.productId,
      skuId: item.skuId,
      productName: item.productName,
      quantity: item.quantity,
      productType: inferred.productType,
      productTypeSource: inferred.source,
      fulfillmentType,
      plannedStatus,
      dryRunAction: resolveBackfillAction(canBackfill, blockReasons),
      canBackfill,
      blockReasons,
    };
  });

  const hasUnknownItemType = dryRunItems.some((item) => item.productTypeSource === 'UNKNOWN');
  const itemBlockReasons = [...new Set(dryRunItems.flatMap((item) => item.blockReasons))];
  const blockReasons = [...new Set([...orderBlockReasons, ...itemBlockReasons])];
  const existingFulfillmentCount =
    order.fulfillmentOrders?.length ??
    order.items.reduce((count, item) => count + (item.fulfillmentOrders?.length ?? 0), 0);

  return {
    orderId: order.id,
    orderSn: order.orderSn,
    tenantId: order.tenantId,
    status: order.status,
    payStatus: order.payStatus,
    orderType: order.orderType,
    workerId: order.workerId,
    totalItemCount: order.items.length,
    existingFulfillmentCount,
    itemCount: dryRunItems.length,
    hasUnknownItemType,
    canBackfill: dryRunItems.length > 0 && dryRunItems.every((item) => item.canBackfill),
    blockReasons,
    dryRunItems,
  };
}

function inferBackfillProductType(
  order: FulfillmentBackfillOrderInput,
  item: FulfillmentBackfillOrderItemInput,
  skuTypeMap: Map<string, ProductType>,
): { productType: ProductType | null; source: FulfillmentBackfillProductTypeSource } {
  if (item.productTypeSnapshot) {
    return { productType: item.productTypeSnapshot, source: 'SNAPSHOT' };
  }

  const productTypeFromSku = skuTypeMap.get(skuTypeKey(order.tenantId, item.skuId));
  if (productTypeFromSku) {
    return { productType: productTypeFromSku, source: 'SKU_JOIN' };
  }

  if (order.orderType === OrderType.PRODUCT) {
    return { productType: ProductType.REAL, source: 'ORDER_TYPE' };
  }
  if (order.orderType === OrderType.SERVICE) {
    return { productType: ProductType.SERVICE, source: 'ORDER_TYPE' };
  }

  return { productType: null, source: 'UNKNOWN' };
}

function planBackfillStatus(
  order: Pick<FulfillmentBackfillOrderInput, 'status' | 'payStatus' | 'workerId'>,
  fulfillmentType: FulfillmentType,
): FulfillmentStatus | null {
  if (order.status === OrderStatus.PAID) {
    return initialFulfillmentStatusFor(fulfillmentType, order.workerId);
  }

  if (order.status === OrderStatus.SHIPPED) {
    if (fulfillmentType === FulfillmentType.PRODUCT) return FulfillmentStatus.SHIPPED;
    return FulfillmentStatus.SERVICE_DONE;
  }

  if (order.status === OrderStatus.COMPLETED) {
    return FulfillmentStatus.FULFILLED;
  }

  if (order.status === OrderStatus.REFUNDED) {
    return FulfillmentStatus.CANCELLED;
  }

  if (order.status === OrderStatus.CANCELLED && order.payStatus === PayStatus.PAID) {
    return FulfillmentStatus.CANCELLED;
  }

  return null;
}

function getBackfillOrderBlockReasons(
  order: Pick<FulfillmentBackfillOrderInput, 'items' | 'status' | 'payStatus'>,
): string[] {
  const reasons: string[] = [];

  if (order.items.length === 0) {
    reasons.push('ORDER_HAS_NO_ITEMS');
  }

  if (order.status === OrderStatus.PENDING_PAY) {
    reasons.push('SKIP_PENDING_PAY_ORDER');
  }

  if (
    ([OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED] as OrderStatus[]).includes(order.status) &&
    order.payStatus !== PayStatus.PAID
  ) {
    reasons.push('PAY_STATUS_NOT_PAID_FOR_ACTIVE_FULFILLMENT');
  }

  if (
    order.status === OrderStatus.REFUNDED &&
    !([PayStatus.PAID, PayStatus.REFUNDED] as PayStatus[]).includes(order.payStatus)
  ) {
    reasons.push('PAY_STATUS_CONFLICT_FOR_REFUNDED_ORDER');
  }

  if (order.status === OrderStatus.CANCELLED && order.payStatus !== PayStatus.PAID) {
    reasons.push('SKIP_CANCELLED_UNPAID_ORDER');
  }

  return reasons;
}

function getBackfillItemBlockReasons(
  productTypeSource: FulfillmentBackfillProductTypeSource,
  plannedStatus: FulfillmentStatus | null,
): string[] {
  const reasons: string[] = [];
  if (productTypeSource === 'UNKNOWN') {
    reasons.push('PRODUCT_TYPE_UNKNOWN');
  }
  if (!plannedStatus) {
    reasons.push('NO_BACKFILL_STATUS_FOR_ORDER_STATE');
  }
  return reasons;
}

function resolveBackfillAction(canBackfill: boolean, blockReasons: string[]): FulfillmentBackfillAction {
  if (canBackfill) return 'CREATE_FULFILLMENT';
  if (blockReasons.some((reason) => reason.startsWith('SKIP_'))) return 'SKIP';
  return 'REVIEW_REQUIRED';
}
