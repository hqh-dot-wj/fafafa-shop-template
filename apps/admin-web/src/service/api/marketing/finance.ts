import { request } from '@/service/request';

/**
 * 营销结算旧接口封装，属于资金高风险入口。
 * 当前扫描未在 backend marketing 目录命中明确 settlement Controller；启用或修改前必须先核对后端真实路由、权限和审计链路。
 */
export function fetchGetSettlementList(params?: Api.Marketing.SettlementSearchParams) {
  return request<Api.Marketing.SettlementList>({
    url: '/marketing/settlement/list',
    method: 'get',
    params,
  });
}

/** 申请结算是资金写入口；前端不得在未确认后端审计与状态机前扩展调用场景。 */
export function fetchApplySettlement(data: Api.Marketing.SettlementApply) {
  return request({
    url: '/marketing/settlement/apply',
    method: 'post',
    data,
  });
}

/** 审核结算是资金状态变更入口；必须由后端权限、审计和状态机兜底。 */
export function fetchAuditSettlement(id: string, data: Api.Marketing.SettlementAudit) {
  return request({
    url: `/marketing/settlement/${id}/audit`,
    method: 'patch',
    data,
  });
}

/** 用户营销资产接口，对应 backend UserAssetController。 */
export function fetchGetUserAssetList(params?: Api.Marketing.UserAssetSearchParams) {
  return request<Api.Marketing.UserAssetList>({
    url: '/marketing/asset/list',
    method: 'get',
    params,
  });
}

/** 资产核销会扣减权益余额；前端只提交核销数量，幂等和余额校验由后端处理。 */
export function fetchConsumeAsset(id: string, amount: number) {
  return request({
    url: `/marketing/asset/${id}/consume`,
    method: 'post',
    data: { amount },
  });
}
