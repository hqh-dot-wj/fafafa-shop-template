import { Decimal } from '@prisma/client/runtime/library';

export interface OrderItemForMarketing {
  id: number;
  skuId: string;
  productId?: string;
  productName?: string;
  quantity: number;
  price: Decimal;
  totalAmount: Decimal;
  pointsRatio?: number;
}

export interface OrderForMarketing {
  id: string;
  tenantId: string;
  memberId: string;
  orderSn?: string;
  totalAmount: Decimal;
  payAmount?: Decimal;
  couponDiscount: Decimal;
  pointsDiscount?: Decimal;
  userCouponId?: string | null;
  pointsUsed?: number;
  items: OrderItemForMarketing[];
}

export interface OrderSummaryForMarketing {
  id: string;
  tenantId: string;
  memberId: string;
  orderSn?: string | null;
}
