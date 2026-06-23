/**
 * C 端营销场景 API，对应 backend ClientSceneController / ClientPlayInstanceController。
 * 生成类型只覆盖稳定出数字段，小程序暂保留 primaryOffer / traceId 等灰度诊断 view-model。
 * @expires backend 将灰度诊断字段纳入 OpenAPI 后切换至 generate-types。
 */
import type {
  ClientSceneModule as GeneratedClientSceneModule,
  ClientSceneProductCard as GeneratedClientSceneProductCard,
  ClientSceneView as GeneratedClientSceneView,
} from '@libs/common-types';
import type { CustomRequestOptions } from '@/http/types';
import { httpGet } from '@/http/http';
export type ProductCardView = GeneratedClientSceneProductCard & {
  primaryOffer?: Record<string, unknown>;
  [key: string]: unknown;
};

export type CourseGroupJoinExplain = NonNullable<GeneratedClientSceneProductCard['courseGroupJoinExplain']>;
export type ClientSceneExplainItem = NonNullable<GeneratedClientSceneProductCard['explain']>[number];

export type ClientModuleView = Omit<GeneratedClientSceneModule, 'products' | 'uiConfig'> & {
  uiConfig?: Record<string, unknown>;
  products: ProductCardView[];
};

export type ClientSceneSource =
  | NonNullable<GeneratedClientSceneView['source']>
  | 'fallback'
  | 'cache'
  | 'stale-cache'
  | string;

export type ClientSceneView = Omit<GeneratedClientSceneView, 'modules' | 'source' | 'traceId'> & {
  traceId?: string;
  source?: ClientSceneSource;
  modules: ClientModuleView[];
};

export interface SceneModulesQuery {
  channel?: 'MINIAPP' | 'H5' | 'ADMIN_PREVIEW';
  moduleLimit?: number;
  productLimit?: number;
  clientVersion?: string;
  platform?: string;
  appBuild?: string;
  // 只允许上传设备摘要；原始设备标识属于隐私边界，由后端 ClientSceneController 注释和 swagger 共同约束。
  deviceHashDigest?: string;
}

/** 获取场景出数（模块列表 + 每模块商品），路由为 /client/marketing/scene/:sceneCode/modules。 */
export function getSceneModules(
  sceneCode: string,
  query?: SceneModulesQuery,
  options?: { hideErrorToast?: boolean; timeout?: number },
) {
  return httpGet<ClientSceneView>(`/client/marketing/scene/${sceneCode}/modules`, query, undefined, options);
}

/** C 端营销玩法实例详情，对应 backend ClientPlayInstanceController，仅查询本人实例。 */
export interface MarketingPlayInstanceDetail {
  id: string;
  tenantId: string;
  memberId: string;
  configId: string;
  templateCode: string;
  orderSn?: string | null;
  instanceData: Record<string, unknown>;
  status: string;
  displayData?: Record<string, unknown> | null;
  config?: {
    rules?: Record<string, unknown>;
    [key: string]: unknown;
  };
  createTime?: string;
  updateTime?: string;
}

export function getMarketingPlayInstanceDetail(id: string, options?: Partial<CustomRequestOptions>) {
  return httpGet<MarketingPlayInstanceDetail>(`/client/marketing/instance/${id}`, undefined, undefined, options);
}
