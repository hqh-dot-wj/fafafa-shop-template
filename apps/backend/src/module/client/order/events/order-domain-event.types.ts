export enum OrderDomainEventType {
  CREATED = 'order.created',
  PAID = 'order.paid',
  CANCELLED = 'order.cancelled',
  REFUNDED = 'order.refunded',
}

export interface OrderCreatedDomainEvent {
  type: OrderDomainEventType.CREATED;
  orderId: string;
  orderSn: string;
  tenantId: string;
  memberId: string;
  userCouponId?: string;
  pointsUsed?: number;
  createdAt: Date;
}

export interface OrderPaidDomainEvent {
  type: OrderDomainEventType.PAID;
  orderId: string;
  orderSn: string;
  tenantId: string;
  memberId: string;
  payAmount: number;
  transactionId: string;
  paidAt: Date;
}

export interface OrderCancelledDomainEvent {
  type: OrderDomainEventType.CANCELLED;
  orderId: string;
  orderSn: string;
  tenantId: string;
  memberId: string;
  reason?: string;
  cancelledAt: Date;
}

export interface OrderRefundedDomainEvent {
  type: OrderDomainEventType.REFUNDED;
  orderId: string;
  orderSn: string;
  tenantId: string;
  memberId: string;
  refundReferenceId?: string;
  refundPointsAmount?: number;
  earnedPointsClawbackRatio?: number;
  refundCoupon?: boolean;
  partialRefund?: boolean;
  refundedAt: Date;
}

export type OrderDomainEvent =
  | OrderCreatedDomainEvent
  | OrderPaidDomainEvent
  | OrderCancelledDomainEvent
  | OrderRefundedDomainEvent;
