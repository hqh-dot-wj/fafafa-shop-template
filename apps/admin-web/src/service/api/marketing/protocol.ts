import { request } from '@/service/request';

/**
 * 营销协议定义接口，对应 backend MarketingProtocolController。
 * 返回值用于编排页读取协议元信息，不应在页面内重复维护协议结构。
 */
export function fetchMarketingProtocolDefinition() {
  return request<Api.Marketing.ProtocolDefinition>({
    url: '/marketing/protocol/definition',
    method: 'get',
  });
}
