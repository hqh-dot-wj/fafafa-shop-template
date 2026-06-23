/**
 * 权益池编排接口，对应 backend EntitlementController。
 * 这里的本地类型描述页面编辑与编译预览 view-model；后端 DTO/VO 进入 OpenAPI 后应优先迁到 @libs/common-types。
 * @expires backend 导出 entitlement DTO/VO 后切换至 generate-types。
 */
import { request } from '@/service/request';

export type EntitlementPoolType = 'PRODUCT' | 'COUPON' | 'POINTS';
export type EntitlementTouchpoint = 'audience' | 'product' | 'coupon' | 'points' | 'notification' | 'share';
export type EntitlementProductSourceType = 'SCENE' | 'CATEGORY' | 'RECOMMEND';

export interface EntitlementCompileTarget {
  owner: string;
  runtimeArtifacts: string[];
  forbiddenFacts?: string[];
}

export interface EntitlementDefinition {
  version: string;
  poolTypes: EntitlementPoolType[];
  compileTargets: Record<string, EntitlementCompileTarget>;
  disallowedScopes: string[];
}

export interface CompileEntitlementPoolInput {
  poolType: EntitlementPoolType;
  sourceType?: EntitlementProductSourceType;
  sourceKey?: string;
  memberId?: string;
  templateId?: string;
  taskId?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface CompileEntitlementPayload {
  touchpoints: EntitlementTouchpoint[];
  pools: CompileEntitlementPoolInput[];
}

export interface EntitlementPoolCompileResult {
  poolType: EntitlementPoolType;
  poolId: string;
  compileTarget: EntitlementCompileTarget;
  preview?: Record<string, unknown>;
  riskSummary: string[];
}

export interface EntitlementCompileData {
  pools: EntitlementPoolCompileResult[];
  owners: string[];
  riskSummary: string[];
}

export type EntitlementPoolStatus = 'DRAFT' | 'COMPILED' | 'FAILED';

export interface EntitlementPoolRecord {
  id: string;
  name: string;
  poolType: EntitlementPoolType;
  status: EntitlementPoolStatus;
  owner: string;
  touchpoints: EntitlementTouchpoint[];
  sourceType?: EntitlementProductSourceType | null;
  sourceKey?: string | null;
  memberId?: string | null;
  templateId?: string | null;
  templateName?: string | null;
  taskId?: string | null;
  taskName?: string | null;
  compileArtifacts: string[];
  riskSummary: string[];
  compilePreview?: Record<string, unknown>;
  updatedAt: string;
  lastCompiledAt?: string | null;
}

export interface EntitlementPoolListParams extends Api.Common.PaginatingCommonParams {
  keyword?: string;
  poolType?: EntitlementPoolType;
  status?: EntitlementPoolStatus;
}

export type EntitlementPoolListData = Api.Common.PaginatingQueryRecord<EntitlementPoolRecord>;

export interface SaveEntitlementPoolPayload {
  name: string;
  poolType: EntitlementPoolType;
  touchpoints: EntitlementTouchpoint[];
  sourceType?: EntitlementProductSourceType | null;
  sourceKey?: string;
  memberId?: string;
  templateId?: string;
  templateName?: string;
  taskId?: string;
  taskName?: string;
}

export type UpdateEntitlementPoolPayload = Partial<SaveEntitlementPoolPayload> & {
  status?: EntitlementPoolStatus;
  compileArtifacts?: string[];
  riskSummary?: string[];
  compilePreview?: Record<string, unknown>;
  lastCompiledAt?: string;
};

export function fetchGetEntitlementDefinition() {
  return request<EntitlementDefinition>({
    url: '/admin/marketing/entitlement/definition',
    method: 'get',
  });
}

export function fetchCompileEntitlementPool(data: CompileEntitlementPayload) {
  return request<EntitlementCompileData>({
    url: '/admin/marketing/entitlement/compile',
    method: 'post',
    data,
  });
}

export function fetchEntitlementPoolList(params: EntitlementPoolListParams) {
  return request<EntitlementPoolListData>({
    url: '/admin/marketing/entitlement/pools',
    method: 'get',
    params,
  });
}

export function fetchCreateEntitlementPool(data: SaveEntitlementPoolPayload) {
  return request<EntitlementPoolRecord>({
    url: '/admin/marketing/entitlement/pools',
    method: 'post',
    data,
  });
}

export function fetchUpdateEntitlementPool(poolId: string, data: UpdateEntitlementPoolPayload) {
  return request<EntitlementPoolRecord>({
    url: `/admin/marketing/entitlement/pools/${poolId}`,
    method: 'patch',
    data,
  });
}

export function fetchDeleteEntitlementPool(poolId: string) {
  return request<null>({
    url: `/admin/marketing/entitlement/pools/${poolId}`,
    method: 'delete',
  });
}
