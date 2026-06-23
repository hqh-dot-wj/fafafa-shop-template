import type { components, operations } from '@libs/common-types';
import { request } from '@/service/request';

/**
 * 营销裁决与排障接口，对应 backend resolution 目录下的 priority/simulator/metrics/incident/diagnostic controllers。
 * 诊断 VO 已走 @libs/common-types；模拟器和工单仍保留本地 view-model，改字段前需回看 backend DTO/VO。
 * @expires backend 导出 simulator / incident DTO/VO 后切换至 generate-types。
 */

export type ResolutionExecutionMode = 'PREVIEW' | 'REPLAY' | 'COMMIT';
export type ResolutionTraceDiagnostic = components['schemas']['ResolutionTraceDiagnosticVo'];
export type ResolutionTraceDiagnosticQuery = NonNullable<
  operations['ResolutionDiagnosticController_getTraceDiagnostic']['parameters']['query']
>;

export interface ResolutionDelayCompression {
  enabled?: boolean;
  ratio?: number;
  maxGapMs?: number;
}

export interface ResolutionSimulateRequest {
  tenantId: string;
  productId: string;
  memberId?: string;
  simulateTime?: string;
  isNewcomer?: boolean;
  memberLevel?: string;
  executionMode?: ResolutionExecutionMode;
  scenarioCode?: string;
  sampleEventIds?: string[];
  /** 仅用于回放/压缩排障时间轴，不改变真实裁决策略。 */
  delayCompression?: ResolutionDelayCompression;
  /** 打开后端探针输出，供排障面板展示每一步过滤与选择原因。 */
  probeEnabled?: boolean;
}

export interface ResolutionSimulateCandidate {
  id?: string;
  configId?: string;
  type: string;
  status: string;
  displayPriority: number;
}

export interface ResolutionSimulateFilteredItem {
  configId: string;
  type: string;
  reason: string;
}

export interface ResolutionSimulateEligibleItem {
  id?: string;
  type: string;
}

export interface ResolutionSimulateSelectedActivity {
  configId: string;
  activityType: string;
  activityContextKey: string;
  commissionMode: string;
}

export interface ResolutionSimulateTimelineStep {
  eventId: string;
  code: string;
  name: string;
  eventType: string;
  payload: Record<string, unknown>;
  offsetMs: number;
  gapMs: number;
}

export interface ResolutionSimulateProbe {
  steps: Api.Marketing.SimulateProbeStep[];
}

export interface ResolutionSideEffectsState {
  executed: boolean;
  emittedCount: number;
}

export interface ResolutionSimulateResult {
  executionMode?: ResolutionExecutionMode;
  scenarioCode?: string;
  timeline?: ResolutionSimulateTimelineStep[];
  candidates?: ResolutionSimulateCandidate[];
  eligible?: ResolutionSimulateEligibleItem[];
  filtered?: ResolutionSimulateFilteredItem[];
  selectedActivity?: ResolutionSimulateSelectedActivity | null;
  selected?: ResolutionSimulateSelectedActivity | null;
  sideEffects?: ResolutionSideEffectsState;
  probe?: ResolutionSimulateProbe;
  candidateCount?: number;
  eligibleCount?: number;
  filteredCount?: number;
}

export type ResolutionIncidentType = 'METRIC_ALERT' | 'PROBE_STEP_MISSING';
export type ResolutionIncidentLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ResolutionIncidentStatus = 'OPEN' | 'ACK' | 'RESOLVED' | 'IGNORED';
export type ResolutionIncidentAction = 'ACK' | 'RESOLVE' | 'IGNORE';

export interface ResolutionIncidentHandleRecord {
  action: ResolutionIncidentAction;
  remark?: string;
  operator: string;
  handledAt: string;
}

export interface ResolutionIncident {
  id: string;
  tenantId: string;
  type: ResolutionIncidentType;
  level: ResolutionIncidentLevel;
  status: ResolutionIncidentStatus;
  title: string;
  message: string;
  referenceId?: string;
  code?: string;
  traceId?: string | null;
  context?: Record<string, unknown>;
  occurredAt: string;
  latestHandle?: ResolutionIncidentHandleRecord;
}

export interface ResolutionIncidentSearchParams {
  pageNum?: number;
  pageSize?: number;
  status?: ResolutionIncidentStatus | null;
  level?: ResolutionIncidentLevel | null;
  type?: ResolutionIncidentType | null;
  keyword?: string;
}

export interface ResolutionIncidentHandlePayload {
  action: ResolutionIncidentAction;
  remark?: string;
}

/** 获取优先级规则列表 */
export function fetchPriorityRules() {
  return request<Api.Marketing.PriorityRule[]>({ url: '/marketing/resolution/priority-rule/list' });
}

/** 创建/更新优先级规则 */
export function fetchUpsertPriorityRule(data: {
  activityType: string;
  priority: number;
  aggregateEnabled?: boolean;
  zoneEnabled?: boolean;
}) {
  return request({ url: '/marketing/resolution/priority-rule', method: 'post', data });
}

/** 删除优先级规则 */
export function fetchDeletePriorityRule(id: string) {
  return request({ url: `/marketing/resolution/priority-rule/${id}`, method: 'delete' });
}

/** 初始化默认优先级 */
export function fetchInitDefaultPriorityRules() {
  return request({ url: '/marketing/resolution/priority-rule/init-defaults', method: 'post' });
}

/** 裁决模拟 */
export function fetchSimulateResolution(data: ResolutionSimulateRequest) {
  return request<ResolutionSimulateResult>({
    url: '/marketing/resolution/simulator/simulate',
    method: 'post',
    data,
  });
}

/** 裁决监控看板 */
export function fetchResolutionMetricsDashboard() {
  return request<Api.Marketing.ResolutionMetricsDashboard>({
    url: '/marketing/resolution/metrics/dashboard',
    method: 'get',
  });
}

/** 排障中心工单列表 */
export function fetchResolutionIncidents(params?: ResolutionIncidentSearchParams) {
  return request<Common.PaginatingQueryRecord<ResolutionIncident>>({
    url: '/marketing/resolution/incidents',
    method: 'get',
    params,
  });
}

/** 处理排障工单 */
export function fetchHandleResolutionIncident(id: string, data: ResolutionIncidentHandlePayload) {
  return request<ResolutionIncident>({
    url: `/marketing/resolution/incidents/${id}/handle`,
    method: 'post',
    data,
  });
}

/** Trace 诊断聚合 */
export async function fetchResolutionTraceDiagnostic(
  params: ResolutionTraceDiagnosticQuery,
): Promise<ResolutionTraceDiagnostic | null> {
  const { data } = await request<ResolutionTraceDiagnostic>({
    url: '/marketing/resolution/diagnostics/trace',
    method: 'get',
    params,
  });

  return data ?? null;
}

/** 订单活动审计 */
export function fetchOrderActivityAudit(orderId: string) {
  return request<Api.Marketing.OrderActivityAuditPayload>({ url: `/store/order/${orderId}/activity-audit` });
}

/** 佣金审计：跨到 finance 只读审计接口，营销排障页只展示证据，不在这里触发结算或修复动作。 */
export function fetchCommissionAudit(orderId: string, orderItemId: number) {
  return request<Api.Marketing.CommissionAuditRecord[]>({
    url: `/admin/finance/commission/audit/${orderId}/${orderItemId}`,
  });
}
