import type { components } from '@libs/common-types';
import { request } from '@/service/request';

/**
 * 营销玩法元数据接口，对应 backend PlayController。
 * 玩法列表是配置表单和玩法选择器的事实源，展示名映射必须来自后端元数据。
 */
export type MarketingExecutablePlay = components['schemas']['PlayMetadataVo'];

export async function fetchMarketingExecutablePlayTypes(): Promise<MarketingExecutablePlay[]> {
  const { data } = await request<MarketingExecutablePlay[]>({
    url: '/admin/marketing/play/types',
    method: 'get',
  });

  return data ?? [];
}

export function buildMarketingPlayTypeNameByCode(playTypes: MarketingExecutablePlay[]): Record<string, string> {
  const map: Record<string, string> = {};

  for (const playType of playTypes) {
    map[playType.code] = playType.name || playType.code;
  }

  return map;
}
