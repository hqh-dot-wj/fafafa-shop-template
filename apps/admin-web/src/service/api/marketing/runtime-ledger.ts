import { request } from '@/service/request';

/**
 * C 端营销运行时台账接口，对应 backend MarketingRuntimeLedgerController。
 * 该列表只读展示 sys_config 当前生效值，前端不要在此接口上扩展写入能力。
 */
export function fetchMarketingRuntimeLedger() {
  return request<Api.Marketing.RuntimeLedgerEntry[]>({ url: '/marketing/runtime-ledger', method: 'get' });
}
