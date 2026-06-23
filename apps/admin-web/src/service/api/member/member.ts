import { request } from '@/service/request';

export type MemberListParams = Api.Member.MemberSearchParams;
export type MemberListResponse = Api.Member.MemberList;
export type UpdateMemberReferrerRequest = Api.Member.UpdateReferrerParams;
export type UpdateMemberTenantRequest = Api.Member.UpdateTenantParams;
export interface UpdateMemberStatusRequest {
  memberId: string;
  status: string;
}
export interface UpdateMemberLevelRequest {
  memberId: string;
  levelId: number;
}
export type MemberMutationResponse = null;
export type MemberPointHistoryParams = Api.Member.PointHistorySearchParams;
export type MemberPointHistoryResponse = Api.Member.PointHistoryList;
export type AdjustMemberPointsRequest = Api.Member.PointAdjustment;
export type AdjustMemberPointsResponse = null;
export type MemberOperationLogParams = Api.Member.MemberOperationLogParams;
export type MemberOperationLogResponse = Api.Member.MemberOperationLogList;

/** Get member list */
export function fetchGetMemberList(params?: MemberListParams) {
  return request<MemberListResponse>({
    url: '/admin/member/list',
    method: 'get',
    params,
  });
}

/** Update member referrer */
export function fetchUpdateMemberReferrer(data: UpdateMemberReferrerRequest) {
  return request<MemberMutationResponse>({
    url: '/admin/member/referrer',
    method: 'put',
    data,
  });
}

/** Update member tenant */
export function fetchUpdateMemberTenant(data: UpdateMemberTenantRequest) {
  return request<MemberMutationResponse>({
    url: '/admin/member/tenant',
    method: 'put',
    data,
  });
}

/** Update member status */
export function fetchUpdateMemberStatus(data: UpdateMemberStatusRequest) {
  return request<MemberMutationResponse>({
    url: '/admin/member/status',
    method: 'put',
    data,
  });
}

/** Update member level */
export function fetchUpdateMemberLevel(data: UpdateMemberLevelRequest) {
  return request<MemberMutationResponse>({
    url: '/admin/member/level',
    method: 'put',
    data,
  });
}

/** Get member point history */
export function fetchGetMemberPointHistory(params: MemberPointHistoryParams) {
  return request<MemberPointHistoryResponse>({
    url: '/admin/member/point/history',
    method: 'get',
    params,
  });
}

/** Adjust member points */
export function fetchAdjustMemberPoints(data: AdjustMemberPointsRequest) {
  return request<AdjustMemberPointsResponse>({
    url: '/admin/member/point/adjust',
    method: 'post',
    data,
  });
}

/** 会员业务操作日志 */
export function fetchGetMemberOperationLogs(params: MemberOperationLogParams) {
  return request<MemberOperationLogResponse>({
    url: '/admin/member/operation-logs',
    method: 'get',
    params,
  });
}
