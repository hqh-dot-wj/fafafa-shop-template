/**
 * 商品相关 API
 * 类型来自 @libs/common-types（由 backend openApi.json 生成）
 * C 端营销聚合卡片仍保留本地 view-model，字段变更时需回看 backend ClientAggregateProductCard DTO/VO。
 * @expires backend 导出 aggregate product card DTO/VO 后切换至 generate-types。
 */
import type {
  ClientCategory,
  ClientProduct,
  ClientProductDetail,
  ProductDisplayTag,
  ProductPurchaseStatus,
  ProductServiceSummary,
} from '@libs/common-types';
import type { CourseGroupJoinExplain } from './marketing';
import { httpGet, httpPost } from '@/http/http';

/** 商品分类树 */
export function getCategoryTree() {
  return httpGet<ClientCategory[]>('/client/product/category/tree');
}

/** 商品列表 */
export function getProductList(params: {
  categoryId?: number;
  name?: string;
  type?: string;
  pageNum?: number;
  pageSize?: number;
}) {
  return httpGet<{ rows: ClientProduct[]; total: number }>('/client/product/list', params);
}

/** 商品详情 */
export function getProductDetail(id: string, activityContextKey?: string) {
  const params: Record<string, string> = {};
  if (activityContextKey) params.activityContextKey = activityContextKey;
  return httpGet<ClientProductDetail>(`/client/product/detail/${id}`, params);
}

/** C 端营销聚合卡片（与 backend ClientAggregateProductCard 对齐） */
export interface ClientAggregateProductCard {
  productId: string;
  productName: string;
  productImg: string;
  mainActivity: {
    activityContextKey: string;
    activityType: string;
    configId: string;
    activityName: string;
    displayPrice: number;
    originalPrice: number;
    tagLabel: string;
    statusSummary: string;
    countdownEndTime: string | null;
    remainingSlots: number | null;
    courseGroupJoinExplain?: CourseGroupJoinExplain;
    joinBlockReasonCode?: string;
    joinBlockReasonText?: string;
  };
  fallbackActivities: Array<{ activityContextKey: string; activityType: string }>;
  displayTags?: ProductDisplayTag[];
  purchaseStatus?: ProductPurchaseStatus;
  serviceSummary?: ProductServiceSummary;
}

/** 营销聚合商品列表（Result.data 为数组，非分页 rows/total） */
export function getAggregateProducts(
  params?: { pageNum?: number; pageSize?: number },
  options?: { hideErrorToast?: boolean; timeout?: number },
) {
  return httpGet<ClientAggregateProductCard[] | null>(
    '/client/marketing/aggregate/products',
    params,
    undefined,
    options,
  );
}

/** 营销专区商品列表 */
export function getZoneProducts(activityType: string, params?: { pageNum?: number; pageSize?: number }) {
  return httpGet<{ rows: ClientProduct[]; total: number }>(`/client/marketing/zones/${activityType}/products`, params);
}

/** 匹配位置归属租户 */
export function matchTenant(lat: number, lng: number) {
  return httpPost<{ tenantId: string; tenantName: string }>('/client/location/match-tenant', { lat, lng });
}

/** 获取附近租户列表 */
export function getNearbyTenants(lat: number, lng: number) {
  return httpGet<{ tenantId: string; tenantName: string }[]>('/client/location/nearby-tenants', { lat, lng });
}
