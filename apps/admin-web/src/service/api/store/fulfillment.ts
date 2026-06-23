import { request } from '@/service/request';

const BASE = '/store/fulfillment';

type ServiceDispatchSearchParams = Pick<
  Api.Order.SearchParams,
  'pageNum' | 'pageSize' | 'orderSn' | 'receiverPhone' | 'memberId'
>;

/** 服务履约待派单列表 */
export function fetchGetServiceDispatchList(params: ServiceDispatchSearchParams) {
  return request<Api.Order.ListResult>({
    url: `${BASE}/service/dispatch/list`,
    method: 'get',
    params,
  });
}

/** 服务履约派单/改派：技师候选列表 */
export function fetchListServiceWorkerCandidates(params: Api.Order.DispatchWorkerCandidateParams) {
  return request<Api.Order.DispatchWorkerCandidateListResult>({
    url: `${BASE}/service/worker-candidates`,
    method: 'get',
    params,
  });
}

/** 服务履约指派技师 */
export function fetchAssignServiceFulfillment(data: { orderId: string; workerId: number; remark?: string }) {
  return request<unknown>({
    url: `${BASE}/service/assign`,
    method: 'post',
    data,
  });
}

/** 后台核销服务履约 */
export function fetchVerifyServiceFulfillment(data: { orderId: string; remark?: string }) {
  return request<unknown>({
    url: `${BASE}/service/verify`,
    method: 'post',
    data,
  });
}
