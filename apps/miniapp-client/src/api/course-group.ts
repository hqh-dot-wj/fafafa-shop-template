/**
 * C 端拼课 API
 * 类型优先来自 @libs/common-types；仅保留少量页面展示所需的可选补充字段，避免继续手写整套 DTO/VO。
 * 待后端 OpenAPI 补齐 skuId 等字段后，通过 pnpm generate-types 切换至 schema 生成类型并删除本文件窄补充。
 */
import type { components, operations } from '@libs/common-types';
import { httpGet, httpPost } from '@/http/http';

export type CourseGroupTeamStatus = components['schemas']['CourseGroupClientTeamSummaryVo']['teamStatus'];
export type CourseGroupViewerRole = components['schemas']['CourseGroupClientTeamDetailVo']['viewerRole'];
export type CourseGroupJoinBlockReasonCode =
  components['schemas']['CourseGroupClientJoinPreviewVo']['joinBlockReasonCode'];

export type CourseGroupTeamLeader = components['schemas']['CourseGroupClientTeamLeaderVo'];
export type CourseGroupTeamMember = components['schemas']['CourseGroupClientTeamMemberVo'];
export type CourseGroupTeamMemberInspect = components['schemas']['CourseGroupClientTeamMemberInspectVo'];

// `skuId` 与部分顶层展示字段已在 backend 契约中补齐，但当前生成产物仍受 openapi 刷新阻塞影响，这里只保留窄补充。
export type CourseGroupTeamSummary = components['schemas']['CourseGroupClientTeamSummaryVo'] & { skuId?: string };

export type CourseGroupTeamsResponse = Omit<components['schemas']['CourseGroupClientTeamListVo'], 'teams'> & {
  teams: CourseGroupTeamSummary[];
  productName?: string;
  productImg?: string;
  tenantId?: string;
  tenantName?: string;
  emptyHint?: string;
};

export type CourseGroupTeamDetail = components['schemas']['CourseGroupClientTeamDetailVo'] & {
  skuId?: string;
  members: CourseGroupTeamMember[];
};

export type CourseGroupOpenPayload = components['schemas']['CourseGroupClientOpenTeamDto'];
export type CourseGroupOpenResult = components['schemas']['CourseGroupClientOpenResultVo'];
export type CourseGroupJoinPreviewPayload = components['schemas']['CourseGroupClientJoinPreviewDto'];
export type CourseGroupJoinPreview = components['schemas']['CourseGroupClientJoinPreviewVo'];

export type CourseGroupListQuery = Partial<
  NonNullable<operations['CourseGroupClientController_listProductTeams']['parameters']['query']>
>;

export type CourseGroupDetailQuery = Partial<
  NonNullable<operations['CourseGroupClientController_getTeamDetail']['parameters']['query']>
>;

export type CourseGroupInspectQuery = Partial<
  NonNullable<operations['CourseGroupClientController_inspectTeamMember']['parameters']['query']>
>;

export async function openCourseGroupTeam(
  payload: CourseGroupOpenPayload,
  options?: { hideErrorToast?: boolean; timeout?: number },
) {
  return httpPost<CourseGroupOpenResult>('/client/course-group/team/open', payload, undefined, undefined, options);
}

export async function proxyOpenCourseGroupTeam(
  payload: CourseGroupOpenPayload,
  options?: { hideErrorToast?: boolean; timeout?: number },
) {
  return httpPost<CourseGroupOpenResult>(
    '/client/course-group/team/proxy-open',
    payload,
    undefined,
    undefined,
    options,
  );
}

export async function listCourseGroupTeams(
  productId: string,
  query?: CourseGroupListQuery,
  options?: { hideErrorToast?: boolean; timeout?: number },
) {
  return httpGet<CourseGroupTeamsResponse>(
    `/client/course-group/product/${productId}/teams`,
    query,
    undefined,
    options,
  );
}

export async function getCourseGroupTeamDetail(
  teamId: string,
  query?: CourseGroupDetailQuery,
  options?: { hideErrorToast?: boolean; timeout?: number },
) {
  return httpGet<CourseGroupTeamDetail>(`/client/course-group/team/${teamId}`, query, undefined, options);
}

export async function inspectCourseGroupTeamMember(
  teamId: string,
  memberId: string,
  query?: CourseGroupInspectQuery,
  options?: { hideErrorToast?: boolean; timeout?: number },
) {
  return httpGet<CourseGroupTeamMemberInspect>(
    `/client/course-group/team/${teamId}/member/${memberId}/inspect`,
    query,
    undefined,
    options,
  );
}

export async function getCourseGroupJoinPreview(
  teamId: string,
  payload?: CourseGroupJoinPreviewPayload,
  options?: { hideErrorToast?: boolean; timeout?: number },
) {
  // 参团前必须调用后端预检，重新确认名额、价格、门店和活动状态，避免列表缓存造成误下单。
  return httpPost<CourseGroupJoinPreview>(
    `/client/course-group/team/${teamId}/join-preview`,
    payload,
    undefined,
    undefined,
    options,
  );
}
