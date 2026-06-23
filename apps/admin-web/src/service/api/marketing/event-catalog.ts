import type { components, operations } from '@libs/common-types';
import { request } from '@/service/request';

/**
 * 营销事件目录接口，对应 backend EventCatalogController。
 * 类型直接取 OpenAPI 生成的 @libs/common-types，避免页面重新手写事件目录契约。
 */
export type MarketingEventCatalogItem = components['schemas']['EventCatalogItemVo'];
export type MarketingEventCatalogSummary = components['schemas']['EventCatalogSummaryVo'];
export type MarketingEventCatalogQuery = NonNullable<operations['EventCatalogController_list']['parameters']['query']>;

export async function fetchMarketingEventCatalog(
  params?: MarketingEventCatalogQuery,
): Promise<MarketingEventCatalogItem[]> {
  const { data } = await request<MarketingEventCatalogItem[]>({
    url: '/admin/marketing/events/catalog',
    method: 'get',
    params,
  });

  return data ?? [];
}

export async function fetchMarketingEventCatalogSummary(): Promise<MarketingEventCatalogSummary | null> {
  const { data } = await request<MarketingEventCatalogSummary>({
    url: '/admin/marketing/events/catalog/summary',
    method: 'get',
  });

  return data ?? null;
}
