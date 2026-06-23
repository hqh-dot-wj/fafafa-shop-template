import { request } from '@/service/request';

/**
 * Message API
 */

/** get message list */
export function fetchGetMessageList(params?: Api.System.MessageSearchParams) {
  return request<Api.System.MessageListVo>({
    url: '/system/message/list',
    method: 'get',
    params,
  });
}

/** mark as read */
export function fetchReadMessage(id: number) {
  return request<null>({
    url: `/system/message/${id}/read`,
    method: 'put',
  });
}
