import { request } from '@/service/request';

const BASE = '/store/order';

/**
 * 获取订单列表
 */
export function fetchGetOrderList(params: Api.Order.SearchParams) {
  return request<Api.Order.ListResult>({
    url: `${BASE}/list`,
    method: 'get',
    params,
  });
}

/**
 * 获取订单详情
 */
export function fetchGetOrderDetail(id: string) {
  return request<Api.Order.DetailResult>({
    url: `${BASE}/detail/${id}`,
    method: 'get',
  });
}

/**
 * 订单业务操作日志（核销、退款、改派等）
 */
export function fetchGetOrderOperationLogs(params: Api.Order.OrderOperationLogParams) {
  return request<Api.Order.OperationLogListResult>({
    url: `${BASE}/operation-logs`,
    method: 'get',
    params,
  });
}

/**
 * 获取待派单列表
 *
 * @deprecated 仅保留旧接口兼容，新页面请使用 `fetchGetServiceDispatchList`。
 */
export function fetchGetDispatchList(params: Api.Order.SearchParams) {
  return request<Api.Order.ListResult>({
    url: `${BASE}/dispatch/list`,
    method: 'get',
    params,
  });
}

/**
 * 派单/改派：技师候选列表
 *
 * @deprecated 仅保留旧接口兼容，新页面请使用 `fetchListServiceWorkerCandidates`。
 */
export function fetchListDispatchWorkerCandidates(params: Api.Order.DispatchWorkerCandidateParams) {
  return request<Api.Order.DispatchWorkerCandidateListResult>({
    url: `${BASE}/dispatch/worker-candidates`,
    method: 'get',
    params,
  });
}

/**
 * 改派技师
 *
 * @deprecated 仅保留旧接口兼容，新页面请使用 `fetchAssignServiceFulfillment`。
 */
export function fetchReassignWorker(data: { orderId: string; newWorkerId: number }) {
  return request<null>({
    url: `${BASE}/reassign`,
    method: 'post',
    data,
  });
}

/**
 * 强制核销
 *
 * @deprecated 仅保留旧接口兼容，新页面请使用 `fetchVerifyServiceFulfillment`。
 */
export function fetchVerifyService(data: { orderId: string; remark?: string }) {
  return request<null>({
    url: `${BASE}/verify`,
    method: 'post',
    data,
  });
}

/**
 * 订单退款
 */
export function fetchRefundOrder(data: { orderId: string; remark?: string }) {
  return request<null>({
    url: `${BASE}/refund`,
    method: 'post',
    data,
  });
}

/**
 * 部分退款（按商品维度）
 */
export function fetchPartialRefundOrder(data: {
  orderId: string;
  items: Array<{ itemId: number; quantity: number }>;
  remark?: string;
}) {
  return request<{
    refundAmount: string;
    refundRatio: string;
    isFullRefund: boolean;
    refundDetails: Array<{ itemId: number; quantity: number; amount: string }>;
  }>({
    url: `${BASE}/refund/partial`,
    method: 'post',
    data,
  });
}

/**
 * 导出订单数据（返回 Excel 文件流）
 */
export function fetchExportOrders(params?: Api.Order.SearchParams) {
  return request<Blob, 'blob'>({
    url: `${BASE}/export`,
    method: 'get',
    params,
    responseType: 'blob',
  });
}

/**
 * 批量核销
 */
export function fetchBatchVerify(data: { orderIds: string[]; remark?: string }) {
  return request<Api.Order.BatchOperationResult>({
    url: `${BASE}/batch/verify`,
    method: 'post',
    data,
  });
}

/**
 * 批量退款
 */
export function fetchBatchRefund(data: { orderIds: string[]; remark?: string }) {
  return request<Api.Order.BatchOperationResult>({
    url: `${BASE}/batch/refund`,
    method: 'post',
    data,
  });
}

/**
 * 批量更新订单备注
 */
export function fetchBatchUpdateOrderRemark(data: {
  orderIds: string[];
  remark: string;
  append?: boolean;
}) {
  return request<Api.Order.BatchOperationResult>({
    url: `${BASE}/batch/remark`,
    method: 'post',
    data,
  });
}

/** 实物订单批量状态流转：发货 / 确认收货 */
export function fetchBatchTransitionOrderStatus(data: {
  orderIds: string[];
  target: 'SHIP' | 'COMPLETE_RECEIPT';
  remark?: string;
}) {
  return request<Api.Order.BatchOperationResult>({
    url: `${BASE}/batch/status`,
    method: 'post',
    data,
  });
}
