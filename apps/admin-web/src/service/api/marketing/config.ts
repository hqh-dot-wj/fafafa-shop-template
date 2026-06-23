import { request } from '@/service/request';

/**
 * 门店营销商品配置接口，对应 backend StorePlayConfigController。
 * 写入体只承载玩法、库存和规则配置；租户来源由后端用户上下文注入，前端不要补 tenantId。
 */
export function fetchGetStoreConfigList(params?: Api.Marketing.StoreConfigSearchParams) {
  return request<Api.Marketing.StoreConfigList>({
    url: '/marketing/config/list',
    method: 'get',
    params,
  });
}

export function fetchCreateStoreConfig(data: Api.Marketing.StoreConfigCreate) {
  return request<Api.Marketing.StoreConfig>({
    url: '/marketing/config',
    method: 'post',
    data,
  });
}

export function fetchUpdateStoreConfig(id: string, data: Api.Marketing.StoreConfigUpdate) {
  return request<Api.Marketing.StoreConfig>({
    url: `/marketing/config/${id}`,
    method: 'put',
    data,
  });
}

/** 快捷上下架只改变配置状态，不替代版本回滚和规则历史能力。 */
export function fetchUpdateStoreConfigStatus(id: string, status: string) {
  return request({
    url: `/marketing/config/${id}/status`,
    method: 'patch',
    data: { status },
  });
}

export function fetchDeleteStoreConfig(id: string) {
  return request({
    url: `/marketing/config/${id}`,
    method: 'delete',
  });
}
