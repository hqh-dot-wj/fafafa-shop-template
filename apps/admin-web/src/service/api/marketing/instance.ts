import { request } from '@/service/request';

/**
 * 营销实例接口，对应 backend PlayInstanceController。
 * 实例状态是后端状态机事实源，前端只发状态流转请求并展示 probe 诊断结果。
 */
export function fetchInstanceList(params?: Api.Marketing.PlayInstanceSearchParams) {
  return request<Api.Marketing.PlayInstanceList>({
    url: '/marketing/instance/list',
    method: 'get',
    params,
  });
}

export function fetchInstanceDetail(id: string) {
  return request<Api.Marketing.PlayInstance>({
    url: `/marketing/instance/${id}`,
    method: 'get',
  });
}

export function fetchInstanceProbe(id: string, params?: Api.Marketing.InstanceProbeQuery) {
  return request<Api.Marketing.InstanceProbe>({
    url: `/marketing/instance/${id}/probe`,
    method: 'get',
    params,
  });
}

export function fetchUpdateInstanceStatus(id: string, status: string, extraData?: Record<string, unknown>) {
  return request<Api.Marketing.PlayInstance>({
    url: `/marketing/instance/${id}/status`,
    method: 'patch',
    data: { status, extraData },
  });
}
