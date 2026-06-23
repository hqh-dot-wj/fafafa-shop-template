import type { ClientCategory, ClientProduct, ClientProductDetail } from '@libs/common-types';
import type { ApiEnvelope } from '@/utils/api-envelope';
import { unwrapApiData } from '@/utils/api-envelope';

type ApiClient = import('axios').AxiosInstance;

export interface ProductListResult {
  rows: ClientProduct[];
  total: number;
}

export interface ProductListParams {
  categoryId?: number;
  name?: string;
  type?: string;
  pageNum?: number;
  pageSize?: number;
}

async function getData<T>(client: ApiClient, url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await client.get<ApiEnvelope<T>>(url, { params });
  return unwrapApiData(data);
}

/** 商品分类树 */
export function getCategoryTree(client: ApiClient) {
  return getData<ClientCategory[]>(client, '/client/product/category/tree');
}

/** 商品分页列表 */
export function getProductList(client: ApiClient, params: ProductListParams) {
  return getData<ProductListResult>(client, '/client/product/list', params as Record<string, unknown>);
}

/** 商品详情 */
export function getProductDetail(client: ApiClient, id: string, activityContextKey?: string) {
  const params: Record<string, string> = {};
  if (activityContextKey) params.activityContextKey = activityContextKey;
  return getData<ClientProductDetail>(client, `/client/product/detail/${id}`, params);
}
