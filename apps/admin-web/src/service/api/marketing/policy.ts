import { request } from '@/service/request';

/**
 * 营销策略中心接口，对应 backend MarketingPolicyController。
 * source/resolver/audience/sort/card-template 是同一策略集合的五个分面，页面提交时保持分面 DTO 白名单。
 */
export function fetchPolicyList(params?: Api.Marketing.PolicySearchParams) {
  return request<Api.Marketing.PolicyList>({ url: '/marketing/policy/list', method: 'get', params });
}

export function fetchSaveSourcePolicy(data: Api.Marketing.SaveSourcePolicyParams) {
  return request({ url: '/marketing/policy/source', method: 'post', data });
}

export function fetchSaveResolverPolicy(data: Api.Marketing.SaveResolverPolicyParams) {
  return request({ url: '/marketing/policy/resolver', method: 'post', data });
}

export function fetchSaveAudiencePolicy(data: Api.Marketing.SaveAudiencePolicyParams) {
  return request({ url: '/marketing/policy/audience', method: 'post', data });
}

export function fetchSaveSortPolicy(data: Api.Marketing.SaveSortPolicyParams) {
  return request({ url: '/marketing/policy/sort', method: 'post', data });
}

export function fetchSaveCardTemplate(data: Api.Marketing.SaveCardTemplateParams) {
  return request({ url: '/marketing/policy/card-template', method: 'post', data });
}
