import { request } from '@/service/request';

/**
 * 拼课执行台接口，对应 backend CourseGroupStoreController。
 * admin-web 页面当前使用 /store/course-group 前缀，是门店执行视角；/admin/course-group 为后台治理前缀。
 * 本文件类型仍为前端本地 view-model，字段变动时需同步检查 course-group read/member/lifecycle services 的返回。
 */
export interface CourseGroupTeamLeader {
  userId: string;
  name: string;
  avatar?: string;
  mobile?: string;
}

export interface CourseGroupTeamSummary {
  teamId: string;
  productId: string;
  productName: string;
  productImg: string;
  tenantId: string;
  tenantName: string;
  activityContextKey: string;
  activityConfigId: string;
  teamStatus: 'RECRUITING' | 'FORMED' | 'IN_CLASS' | 'FINISHED' | 'FAILED' | 'CLOSED' | string;
  leader: CourseGroupTeamLeader;
  classAddress?: string;
  classStartTime?: string;
  classEndTime?: string;
  minCount: number;
  maxCount: number;
  currentMembers: number;
  paidMembers: number;
  realMemberCount: number;
  virtualMemberCount: number;
  effectiveMemberCount: number;
  realPaidMemberCount: number;
  realPaidAmount: number;
  commissionBaseAmount: number;
  commissionAmount: number;
  formedByVirtual: boolean;
  financeEvidenceReady: boolean;
  enableVirtualFill: boolean;
  allowLeaderManualFill: boolean;
  allowAdminManualFill: boolean;
  remainingSlots: number;
  recommended: boolean;
  joinable: boolean;
  storeReady: boolean;
  ruleSummary?: string;
  revenueHint?: string;
  shareTitle?: string;
  latestVirtualFillAt?: string;
  latestVirtualFillSource?: string;
  createTime?: string;
}

export interface CourseGroupTeamMember {
  id?: string;
  memberRecordId?: string;
  memberId: string;
  userId: string;
  name: string;
  avatar?: string;
  mobile?: string;
  role: 'LEADER' | 'MEMBER' | string;
  payStatus: 'PAID' | 'WAIT_PAY' | string;
  joinedAt: string;
  paidAt?: string;
  remark?: string;
  memberType?: 'REAL' | 'VIRTUAL' | string;
  sourceType?: 'AUTO' | 'LEADER_MANUAL' | 'ADMIN_MANUAL' | string;
  virtualMemberId?: string;
  participatesInOrder?: boolean;
  participatesInAttendance?: boolean;
  participatesInCommission?: boolean;
}

export interface CourseGroupVirtualFillAudit {
  auditId: string;
  opType: 'ADD' | 'REMOVE' | string;
  virtualMemberId: string;
  displayName?: string;
  avatar?: string;
  sourceType: 'AUTO' | 'LEADER_MANUAL' | 'ADMIN_MANUAL' | string;
  createdByType: 'SYSTEM' | 'LEADER' | 'ADMIN' | string;
  createdById: string;
  createdAt: string;
  reason?: string;
}

export interface CourseGroupTeamCourseSummary {
  teamId: string;
  leaderInstanceId: string;
  extensionReady: boolean;
  extensionId?: string;
  extensionStatus?: string;
  totalLessons: number;
  completedLessons: number;
  pendingLessons: number;
  classAddress?: string;
  classStartTime?: string;
  classEndTime?: string;
  scheduleCount: number;
  completedScheduleCount: number;
  cancelledScheduleCount: number;
  teacherBoundScheduleCount: number;
  classroomBoundScheduleCount: number;
  capacityBoundScheduleCount: number;
  attendanceRecordCount: number;
  attendanceMarkedMemberCount: number;
  teamRuntimeStatus: string;
}

export interface CourseGroupTeamScheduleRow {
  scheduleId: string;
  date: string;
  startTime: string;
  endTime: string;
  lessons: number;
  teacherId?: string;
  teacherName?: string;
  classroomId?: string;
  classroomName?: string;
  location?: string;
  capacity?: number;
  serviceCapacity?: number;
  resourceSnapshot?: Record<string, unknown>;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | string;
  remark?: string;
}

export interface CourseGroupTeamAttendanceRow {
  attendanceId: string;
  memberId: string;
  memberName: string;
  memberMobile?: string;
  date: string;
  attended: boolean;
  remark?: string;
}

export interface CourseGroupTeamDetail extends CourseGroupTeamSummary {
  detailId: string;
  viewerRole: 'LEADER' | 'MEMBER' | 'VISITOR' | string;
  viewerJoined: boolean;
  viewerPaid: boolean;
  canShare: boolean;
  canJoin: boolean;
  teamStatusText: string;
  members: CourseGroupTeamMember[];
  revenueDescription?: string;
  inviteDescription?: string;
  virtualFillAudits?: CourseGroupVirtualFillAudit[];
}

export interface CourseGroupTeamListParams {
  tenantId?: string;
  status?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface CourseGroupTeamListResult {
  rows: CourseGroupTeamSummary[];
  total: number;
  pageNum: number;
  pageSize: number;
}

export interface ResolveFailurePayload {
  tenantId?: string;
  reason?: string;
}

export interface AddVirtualFillPayload {
  tenantId?: string;
  count?: number;
  reason?: string;
}

export interface RemoveVirtualFillPayload {
  tenantId?: string;
  reason?: string;
}

export interface MarkTeamAttendancePayload {
  tenantId?: string;
  memberId: string;
  date: string;
  remark?: string;
}

export function fetchCourseGroupTeamList(params?: CourseGroupTeamListParams) {
  return request<CourseGroupTeamListResult>({
    url: '/store/course-group/team/list',
    method: 'get',
    params,
  });
}

export function fetchCourseGroupTeamDetail(teamId: string, tenantId?: string) {
  return request<CourseGroupTeamDetail>({
    url: `/store/course-group/team/${teamId}`,
    method: 'get',
    params: {
      tenantId,
    },
  });
}

export function fetchCourseGroupTeamMembers(teamId: string, tenantId?: string) {
  return request<CourseGroupTeamMember[]>({
    url: `/store/course-group/team/${teamId}/members`,
    method: 'get',
    params: {
      tenantId,
    },
  });
}

export function fetchCourseGroupTeamCourseSummary(teamId: string, tenantId?: string) {
  return request<CourseGroupTeamCourseSummary>({
    url: `/store/course-group/team/${teamId}/course-summary`,
    method: 'get',
    params: {
      tenantId,
    },
  });
}

export function fetchCourseGroupTeamSchedules(teamId: string, tenantId?: string) {
  return request<CourseGroupTeamScheduleRow[]>({
    url: `/store/course-group/team/${teamId}/schedules`,
    method: 'get',
    params: {
      tenantId,
    },
  });
}

export function fetchCourseGroupTeamAttendances(teamId: string, tenantId?: string) {
  return request<CourseGroupTeamAttendanceRow[]>({
    url: `/store/course-group/team/${teamId}/attendances`,
    method: 'get',
    params: {
      tenantId,
    },
  });
}

export function fetchMarkCourseGroupTeamAttendance(teamId: string, payload: MarkTeamAttendancePayload) {
  return request<CourseGroupTeamAttendanceRow>({
    url: `/store/course-group/team/${teamId}/attendance`,
    method: 'post',
    data: payload,
  });
}

export function fetchCloseCourseGroupTeam(teamId: string, tenantId?: string) {
  return request({
    url: `/store/course-group/team/${teamId}/close`,
    method: 'post',
    data: {
      tenantId,
    },
  });
}

export function fetchStartCourseGroupTeamClass(teamId: string, tenantId?: string) {
  return request({
    url: `/store/course-group/team/${teamId}/start-class`,
    method: 'post',
    data: {
      tenantId,
    },
  });
}

export function fetchFinishCourseGroupTeamClass(teamId: string, tenantId?: string) {
  return request({
    url: `/store/course-group/team/${teamId}/finish-class`,
    method: 'post',
    data: {
      tenantId,
    },
  });
}

export function fetchResolveCourseGroupMemberFailure(
  teamId: string,
  memberRecordId: string,
  payload?: ResolveFailurePayload,
) {
  return request({
    url: `/store/course-group/team/${teamId}/member/${memberRecordId}/failure-resolution`,
    method: 'post',
    data: payload,
  });
}

export function fetchAddCourseGroupVirtualFill(teamId: string, payload?: AddVirtualFillPayload) {
  return request({
    url: `/store/course-group/team/${teamId}/virtual-fill`,
    method: 'post',
    data: payload,
  });
}

export function fetchRemoveCourseGroupVirtualFill(
  teamId: string,
  virtualMemberId: string,
  payload?: RemoveVirtualFillPayload,
) {
  return request({
    url: `/store/course-group/team/${teamId}/virtual-fill/${virtualMemberId}/remove`,
    method: 'post',
    data: payload,
  });
}
