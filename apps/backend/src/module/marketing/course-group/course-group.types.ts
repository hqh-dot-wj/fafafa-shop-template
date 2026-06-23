import type { PlayInstanceStatus } from '@prisma/client';
import type { CourseGroupJoinBlockReasonCode } from './services/team-state.service';

export type TeamSummary = {
  teamId: string;
  productId: string;
  productName: string;
  productImg: string;
  skuId?: string;
  tenantId: string;
  tenantName: string;
  activityContextKey: string;
  activityConfigId: string;
  teamStatus: string;
  leader: {
    userId: string;
    name: string;
    avatar?: string;
    mobile?: string;
  };
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
  joinBlockReasonCode: CourseGroupJoinBlockReasonCode;
  joinBlockReasonText: string;
  storeReady: boolean;
  ruleSummary?: string;
  revenueHint?: string;
  shareTitle?: string;
  latestVirtualFillAt?: string;
  latestVirtualFillSource?: string;
  createTime?: string;
};

export type TeamMemberView = {
  id?: string;
  memberRecordId?: string;
  memberId: string;
  userId: string;
  name: string;
  avatar?: string;
  mobile?: string;
  role: 'LEADER' | 'MEMBER' | string;
  payStatus: 'PAID' | 'WAIT_PAY' | 'VIRTUAL' | string;
  joinedAt: string;
  paidAt?: string;
  remark?: string;
  memberType?: 'REAL' | 'VIRTUAL';
  sourceType?: string;
  virtualMemberId?: string;
  participatesInOrder?: boolean;
  participatesInAttendance?: boolean;
  participatesInCommission?: boolean;
};

export type ClientTeamMemberInspect = {
  memberId: string;
  name: string;
  role: 'LEADER' | 'MEMBER' | string;
  memberType: 'REAL' | 'VIRTUAL';
  isVirtual: boolean;
  sourceType?: string;
  participatesInOrder: boolean;
  participatesInAttendance: boolean;
  participatesInCommission: boolean;
};

export type TeamDetailAudience = 'client' | 'admin';

export type TeamFinancialSnapshot = {
  realPaidAmount: number;
  commissionBaseAmount: number;
  commissionAmount: number;
  financeEvidenceReady: boolean;
};

export type CourseGroupRuntimeStatus = 'IN_CLASS' | 'FINISHED' | 'CLOSED';

export type CourseGroupInstanceLike = {
  status: PlayInstanceStatus;
};
