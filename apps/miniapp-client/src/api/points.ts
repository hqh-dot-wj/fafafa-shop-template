import type { components, operations } from '@libs/common-types';
import { httpGet } from '@/http/http';

export type PointsBalance = components['schemas']['PointsBalanceVo'];
export type PointsLot = components['schemas']['PointsLotVo'];
export type PointsConsumeAllocation = components['schemas']['PointsConsumeAllocationVo'];
export type PointsRefundAllocation = components['schemas']['PointsRefundAllocationVo'];

export type PointsLotQuery = NonNullable<operations['ClientPointsAccountController_getLots']['parameters']['query']>;
export type PointsConsumeAllocationQuery = NonNullable<
  operations['ClientPointsAccountController_getConsumeAllocations']['parameters']['query']
>;
export type PointsRefundAllocationQuery = NonNullable<
  operations['ClientPointsAccountController_getRefundAllocations']['parameters']['query']
>;

// C 端积分接口对应 backend ClientPointsAccountController。
// 小程序只读取余额、批次、消费分摊和退款回流，不发起调账、冻结或扣减动作。
export interface PointsPage<T> {
  rows?: T[];
  total?: number;
  pageNum?: number;
  pageSize?: number;
}

export function getPointsBalance(options?: { hideErrorToast?: boolean; timeout?: number }) {
  // 余额展示由后端按积分账实时聚合，前端不根据批次列表自行相加。
  return httpGet<PointsBalance>('/client/marketing/points/balance', undefined, undefined, options);
}

export function getPointsLots(query?: PointsLotQuery, options?: { hideErrorToast?: boolean; timeout?: number }) {
  return httpGet<PointsPage<PointsLot>>('/client/marketing/points/lots', query, undefined, options);
}

export function getPointsConsumeAllocations(
  query?: PointsConsumeAllocationQuery,
  options?: { hideErrorToast?: boolean; timeout?: number },
) {
  return httpGet<PointsPage<PointsConsumeAllocation>>(
    '/client/marketing/points/consume-allocations',
    query,
    undefined,
    options,
  );
}

export function getPointsRefundAllocations(
  query?: PointsRefundAllocationQuery,
  options?: { hideErrorToast?: boolean; timeout?: number },
) {
  return httpGet<PointsPage<PointsRefundAllocation>>(
    '/client/marketing/points/refund-allocations',
    query,
    undefined,
    options,
  );
}
