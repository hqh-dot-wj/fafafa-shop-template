import { OrderForMarketing, OrderSummaryForMarketing } from './contract/order-for-marketing.type';

export const ORDER_SERVICE = Symbol('ORDER_SERVICE');

export interface OrderServiceContract {
  findByIdForMarketing(orderId: string, includeItems?: boolean): Promise<OrderForMarketing | null>;
  findBySnForMarketing(orderSn: string): Promise<OrderSummaryForMarketing | null>;
  updateOrderPointsEarned(
    orderId: string,
    itemPoints: Array<{ skuId: string; earnedPoints: number }>,
    totalPoints: number,
  ): Promise<void>;
}
