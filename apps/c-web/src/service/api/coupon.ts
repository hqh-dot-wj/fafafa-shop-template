import type { ApiEnvelope } from '@/utils/api-envelope';
import { unwrapApiData } from '@/utils/api-envelope';

type ApiClient = import('axios').AxiosInstance;

export interface CouponPageResult {
  rows: Record<string, unknown>[];
  total: number;
}

async function getData<T>(client: ApiClient, url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await client.get<ApiEnvelope<T>>(url, { params });
  return unwrapApiData(data);
}

export function getMyCoupons(client: ApiClient, params: { status?: string; pageNum?: number; pageSize?: number }) {
  return getData<CouponPageResult>(client, '/client/marketing/coupon/my-coupons', params as Record<string, unknown>);
}

export async function fetchUnusedCouponTotal(client: ApiClient): Promise<number> {
  try {
    const data = await getMyCoupons(client, { status: 'UNUSED', pageNum: 1, pageSize: 1 });
    return typeof data?.total === 'number' ? data.total : 0;
  } catch {
    return 0;
  }
}
