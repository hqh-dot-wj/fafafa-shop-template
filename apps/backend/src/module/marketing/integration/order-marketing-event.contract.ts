export interface OrderMarketingRefundOptions {
  refundReferenceId?: string;
  refundPointsAmount?: number;
  earnedPointsClawbackRatio?: number;
  refundCoupon?: boolean;
  partialRefund?: boolean;
}

export interface OrderMarketingCreatedJob {
  orderId: string;
  memberId: string;
  tenantId: string;
  userCouponId?: string;
  pointsUsed?: number;
}

export interface OrderMarketingPaidJob {
  orderId: string;
  orderSn: string;
  memberId: string;
  tenantId: string;
  payAmount: number;
  transactionId: string;
  paidAt: string;
}

export interface OrderMarketingCancelledJob {
  orderId: string;
  memberId: string;
  tenantId: string;
  reason?: string;
}

export interface OrderMarketingRefundedJob {
  orderId: string;
  memberId: string;
  tenantId: string;
  options: OrderMarketingRefundOptions;
  /** 退款完成时间（ISO 字符串），用于下游审计、对账与归因时序排序。 */
  refundedAt: string;
}

export const ORDER_MARKETING_QUEUE = 'order-marketing';
export const ORDER_MARKETING_CREATED = 'created';
export const ORDER_MARKETING_PAID = 'paid';
export const ORDER_MARKETING_CANCELLED = 'cancelled';
export const ORDER_MARKETING_REFUNDED = 'refunded';
