/**
 * 将订单列表当前筛选条件转为导出接口 GET 查询参数（与列表 findAll / exportOrders 条件一致，不含分页）
 */
export function buildOrderExportQueryParams(sp: Api.Order.SearchParams): Record<string, string> {
  const flat = sp as Record<string, unknown>;
  const beginTime = flat['params.beginTime'] ?? sp.params?.beginTime;
  const endTime = flat['params.endTime'] ?? sp.params?.endTime;

  const q: Record<string, string> = {};
  const put = (key: string, v: unknown) => {
    if (v !== null && v !== undefined && v !== '') q[key] = String(v);
  };

  put('orderSn', sp.orderSn);
  put('receiverPhone', sp.receiverPhone);
  put('status', sp.status);
  put('orderType', sp.orderType);
  put('memberId', sp.memberId);
  put('params.beginTime', beginTime);
  put('params.endTime', endTime);

  return q;
}
