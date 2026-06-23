import type { ApiEnvelope } from '@/utils/api-envelope';
import { unwrapApiData } from '@/utils/api-envelope';

type ApiClient = import('axios').AxiosInstance;

/** 行政区划；backend RegionVo 暂未入 common-types，与 miniapp api/region 一致。 */
export interface RegionVo {
  code: string;
  name: string;
  parentId?: string;
  level: number;
}

async function getData<T>(client: ApiClient, url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await client.get<ApiEnvelope<T>>(url, { params });
  return unwrapApiData(data);
}

export function getRegionList(client: ApiClient, parentId?: string) {
  return getData<RegionVo[]>(client, '/lbs/region/list', parentId ? { parentId } : undefined);
}
