import { request } from '@/service/request';

/** 获取错误事件列表 */
export function fetchGetErrorEventList(params?: Api.Monitor.ErrorEventSearchParams) {
  return request<Api.Monitor.ErrorEventList>({
    url: '/monitor/error-event/list',
    method: 'get',
    params,
  });
}

/** 获取步骤事件列表 */
export function fetchGetStepEventList(params?: Api.Monitor.StepEventSearchParams) {
  return request<Api.Monitor.StepEventList>({
    url: '/monitor/error-event/steps',
    method: 'get',
    params,
  });
}

/** 获取错误事件关联步骤 */
export function fetchGetErrorEventSteps(errorId: string) {
  return request<Api.Monitor.StepEventList>({
    url: `/monitor/error-event/${errorId}/steps`,
    method: 'get',
  });
}
