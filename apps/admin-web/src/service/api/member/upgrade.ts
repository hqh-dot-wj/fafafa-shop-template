import { request } from '@/service/request';

/** 审批参数 */
export interface ApproveParams {
  action: 'approve' | 'reject';
  reason?: string;
}

/** 手动调级参数 */
export interface ManualLevelParams {
  targetLevel: number;
  reason?: string;
}

/** 统计数据 */
export interface UpgradeStats {
  pendingCount: number;
  totalCount: number;
}

export type UpgradeApplyListParams = Api.Member.UpgradeApplySearchParams;
export type UpgradeApplyItem = Api.Member.UpgradeApply;
export type UpgradeApplyListResponse = Api.Common.PaginatingQueryRecord<UpgradeApplyItem>;
export type UpgradeStatsResponse = UpgradeStats;
export type UpgradeDecisionRequest = ApproveParams;
export type ManualLevelRequest = ManualLevelParams;
export type UpgradeMutationResponse = null;

export function fetchGetUpgradeApplyList(params?: UpgradeApplyListParams) {
  return request<UpgradeApplyListResponse>({
    url: '/admin/upgrade/list',
    method: 'get',
    params,
  });
}

export function fetchGetUpgradeStats() {
  return request<UpgradeStatsResponse>({
    url: '/admin/upgrade/stats',
    method: 'get',
  });
}

export function fetchApproveUpgrade(id: string, data: UpgradeDecisionRequest) {
  return request<UpgradeMutationResponse>({
    url: `/admin/upgrade/${id}/approve`,
    method: 'put',
    data,
  });
}

export function fetchManualLevel(memberId: string, data: ManualLevelRequest) {
  return request<UpgradeMutationResponse>({
    url: `/admin/upgrade/member/${memberId}/level`,
    method: 'put',
    data,
  });
}
