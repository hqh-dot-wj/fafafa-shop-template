import { request } from '@/service/request';

/**
 * 营销经营视图接口，对应 backend MarketingBusinessDashboardController。
 * 当前查询按后端租户上下文聚合，前端只传筛选条件，不自行拼经营指标。
 */
export function fetchBusinessDashboard(params?: Api.Marketing.BusinessDashboardQuery) {
  return request<Api.Marketing.BusinessDashboard>({
    url: '/marketing/business-dashboard',
    method: 'get',
    params,
  });
}
