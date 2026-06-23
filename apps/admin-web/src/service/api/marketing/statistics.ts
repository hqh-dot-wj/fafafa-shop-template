import { request } from '@/service/request';

/**
 * 营销统计聚合入口。
 * 当前只保留优惠券和积分余额概览的轻量封装；更细的积分账本、导出和分摊查询在 points.ts 中维护。
 */

/** 优惠券统计，对应 backend CouponManagementController.getStatistics。 */
export function fetchGetCouponStatistics(params?: { templateId?: string }) {
  return request<Api.Marketing.CouponStatistics>({
    url: '/admin/marketing/coupon/statistics',
    method: 'get',
    params,
  });
}

/** 积分余额概览，对应 backend PointsManagementController.getBalanceStatistics。 */
export function fetchGetPointsStatistics() {
  return request<Api.Marketing.PointsStatistics>({
    url: '/admin/marketing/points/statistics/balance',
    method: 'get',
  });
}
