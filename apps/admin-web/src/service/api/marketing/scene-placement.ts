import { request } from '@/service/request';

/**
 * 场景投放接口集合。
 * 场景定义和商品预览走 backend MarketingSceneAliasController（/admin/scene），
 * 导航树走 NavigationAdminController（/admin/navigation）；页面把两者组合成“投放位置”工作台。
 */
export interface SceneDefinition {
  id: string;
  sceneCode: string;
  sceneName: string;
  sceneType: string;
  channelScope: string[];
  pageRoute?: string | null;
  defaultCardTemplateCode?: string | null;
  defaultResolverPolicyCode?: string | null;
  /** 原始 JSON（列表接口同时会展开 activityTypeFilter 等扁平字段） */
  placementConfig?: Record<string, unknown> | null;
  /** 列表接口展开自 placement_config */
  activityTypeFilter?: string;
  storeMatchMode?: string;
  sortMode?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT' | string;
  createTime?: string;
  updateTime?: string;
}

export interface SceneDefinitionListParams {
  pageNum?: number;
  pageSize?: number;
  sceneCode?: string;
  status?: string;
}

/** 与 `useTable` / `NaiveUI.TableApiFn` 对齐：分页体须含 pageNum、pageSize（后端若省略，运行时仍由表格参数驱动） */
export type SceneDefinitionListData = Api.Common.PaginatingQueryRecord<SceneDefinition>;

export interface SaveSceneDefinitionPayload {
  sceneCode: string;
  sceneName: string;
  sceneType: string;
  channelScope: string[];
  pageRoute?: string;
  defaultCardTemplateCode?: string;
  /** 裁决策略 policy_code（如 NR_RESOLVER_DEFAULT），勿与 sortMode 混淆 */
  defaultResolverPolicyCode?: string;
  /** 投放展示：活动类型过滤、门店匹配、排序方式等 */
  placementConfig?: Record<string, unknown>;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
}

export type NavigationNodeType = 'CATEGORY' | 'SCENE' | 'LINK';

export interface NavigationNode {
  nodeType: NavigationNodeType;
  nodeId: string;
  code: string;
  name: string;
  parentNodeId?: string;
  pagePath?: string;
  status?: string;
  sort?: number;
  children?: NavigationNode[];
}

export interface NavigationTreeResult {
  tenantId: string;
  nodes: NavigationNode[];
}

export interface SaveNavigationNodePayload {
  tenantId?: string;
  /** CATEGORY/SCENE/LINK 决定节点是否绑定场景、纯分组还是外链。 */
  nodeType?: NavigationNodeType;
  sceneCode?: string;
  sceneName?: string;
  categoryName?: string;
  parentNodeId?: string;
  sort?: number;
  sceneType?: string;
  pageRoute?: string;
  status?: string;
  channelScope?: string[];
}

export interface SortNavigationNodePayload {
  tenantId?: string;
  sort?: number;
  parentNodeId?: string;
}

export interface ScenePreviewCard {
  sceneCode: string;
  moduleCode: string;
  moduleName: string;
  productId: string;
  productName: string;
  productImg?: string;
  activityContextKey?: string;
  activityType?: string;
  activityConfigId?: string;
  displayPrice?: number;
  originalPrice?: number;
  status?: string;
}

export interface ScenePreviewQuery {
  /** ADMIN_PREVIEW 是后台模拟通道，不能当成真实 C 端曝光来源写入运行态。 */
  channel?: 'MINIAPP' | 'H5' | 'ADMIN_PREVIEW';
  memberId?: string;
  clientVersion?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface ScenePreviewResult {
  rows: ScenePreviewCard[];
  total: number;
  pageNum: number;
  pageSize: number;
  sceneCode: string;
  releaseNo?: number;
  traceId?: string;
}

export function fetchSceneDefinitionList(params: SceneDefinitionListParams = {}) {
  return request<SceneDefinitionListData>({
    url: '/admin/scene/list',
    method: 'get',
    params,
  });
}

/** 后端分页单页 pageSize 上限为 100，全量拉取场景定义时分页合并 */
export async function fetchAllSceneDefinitions(
  filters?: Pick<SceneDefinitionListParams, 'sceneCode' | 'status'>,
): Promise<SceneDefinition[]> {
  const pageSize = 100;
  let pageNum = 1;
  const all: SceneDefinition[] = [];
  const maxPages = 100;
  for (; pageNum <= maxPages; pageNum += 1) {
    // 分页接口需按页顺序拉取，不能并行合并（页码依赖上一页是否还有数据）
    // eslint-disable-next-line no-await-in-loop -- 顺序分页直至末页
    const { data } = await fetchSceneDefinitionList({ ...filters, pageNum, pageSize });
    const rows = data?.rows ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

export function fetchCreateSceneDefinition(data: SaveSceneDefinitionPayload) {
  return request<SceneDefinition>({
    url: '/admin/scene',
    method: 'post',
    data,
  });
}

export function fetchUpdateSceneDefinition(sceneId: string, data: SaveSceneDefinitionPayload) {
  return request<SceneDefinition>({
    url: `/admin/scene/${sceneId}`,
    method: 'put',
    data,
  });
}

export function fetchNavigationTree(tenantId?: string) {
  return request<NavigationTreeResult>({
    url: '/admin/navigation/tree',
    method: 'get',
    params: {
      tenantId,
    },
  });
}

export function fetchCreateNavigationNode(data: SaveNavigationNodePayload) {
  return request<NavigationNode>({
    url: '/admin/navigation/node',
    method: 'post',
    data,
  });
}

export function fetchUpdateNavigationNode(nodeId: string, data: SaveNavigationNodePayload) {
  return request<NavigationNode>({
    url: `/admin/navigation/node/${nodeId}`,
    method: 'put',
    data,
  });
}

export function fetchSortNavigationNode(nodeId: string, data?: SortNavigationNodePayload) {
  return request({
    url: `/admin/navigation/node/${nodeId}/sort`,
    method: 'post',
    data,
  });
}

export function fetchScenePreviewProducts(sceneCode: string, params?: ScenePreviewQuery) {
  return request<ScenePreviewResult>({
    url: `/admin/scene/${sceneCode}/preview-products`,
    method: 'get',
    params,
  });
}
