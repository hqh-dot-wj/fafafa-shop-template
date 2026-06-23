import { PlayInstanceStatus, Prisma } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { decimalToNumber, readBoolean, readString, toRecord } from './course-group-util';
import type { TeamDetailAudience, TeamFinancialSnapshot, TeamMemberView } from './course-group.types';
import type { CourseGroupInstanceRecord as CourseGroupInstance } from './team.repository';
import { TeamProjectionService } from './services/team-projection.service';

export type CourseGroupProductMap = Map<string, { productId: string; name: string; mainImages: string[] }>;
export type CourseGroupStoreMap = Map<string, string>;

export function isCourseGroupPaidStatus(status: PlayInstanceStatus): boolean {
  return (
    status === PlayInstanceStatus.PAID || status === PlayInstanceStatus.ACTIVE || status === PlayInstanceStatus.SUCCESS
  );
}

export function readBooleanByKeys(rec: Record<string, unknown>, keys: string[], fallback: boolean): boolean {
  for (const key of keys) {
    const value = readBoolean(rec[key]);
    if (value !== null) return value;
  }
  return fallback;
}

export function toTeamStatusText(status: string): string {
  switch (status) {
    case 'RECRUITING':
      return '招募中';
    case 'FORMED':
      return '已成团';
    case 'IN_CLASS':
      return '进行中';
    case 'FINISHED':
      return '已结课';
    case 'FAILED':
      return '已失败';
    case 'CLOSED':
      return '已关闭';
    default:
      return status;
  }
}

export function fallbackLeaderView(leader: CourseGroupInstance): TeamMemberView {
  return {
    memberId: leader.memberId,
    userId: leader.memberId,
    name: `会员${leader.memberId.slice(-4)}`,
    role: 'LEADER',
    payStatus: 'PAID',
    joinedAt: leader.createTime.toISOString(),
  };
}

export async function buildCourseGroupMemberViews(input: {
  prisma: PrismaService;
  tenantHelper: TenantHelper;
  teamProjectionService: TeamProjectionService;
  leader: CourseGroupInstance;
  instances: CourseGroupInstance[];
  audience: TeamDetailAudience;
}): Promise<TeamMemberView[]> {
  const memberIds = [...new Set(input.instances.map((instance) => instance.memberId))];
  const members = memberIds.length
    ? await input.prisma.umsMember.findMany({
        where: input.tenantHelper.readWhereForDelegate('umsMember', {
          memberId: { in: memberIds },
        }) as Prisma.UmsMemberWhereInput,
        select: {
          memberId: true,
          nickname: true,
          avatar: true,
          mobile: true,
        },
      })
    : [];
  const memberMap = new Map(members.map((member) => [member.memberId, member]));
  const realMembers = input.instances.map<TeamMemberView>((instance) => {
    const item = memberMap.get(instance.memberId);
    const data = toRecord(instance.instanceData);
    const parentId = readString(data.parentId);
    const isLeader = readBoolean(data.isLeader) ?? false;
    const baseView: TeamMemberView = {
      id: instance.id,
      memberRecordId: instance.id,
      memberId: instance.memberId,
      userId: instance.memberId,
      name: item?.nickname ?? `会员${instance.memberId.slice(-4)}`,
      avatar: item?.avatar ?? undefined,
      mobile: item?.mobile ?? undefined,
      role: isLeader || !parentId ? 'LEADER' : 'MEMBER',
      payStatus: isCourseGroupPaidStatus(instance.status) ? 'PAID' : 'WAIT_PAY',
      joinedAt: instance.createTime.toISOString(),
      paidAt: isCourseGroupPaidStatus(instance.status) ? instance.updateTime.toISOString() : undefined,
      remark: readString(data.remark) ?? undefined,
    };

    if (input.audience === 'admin') {
      baseView.memberType = 'REAL';
      baseView.participatesInOrder = true;
      baseView.participatesInAttendance = true;
      baseView.participatesInCommission = true;
    }

    return baseView;
  });

  const virtualMembers = input.teamProjectionService
    .listActiveVirtualMembers(input.leader.instanceData)
    .map<TeamMemberView>((member) => {
      const joinedAt = member.createdAt;
      if (input.audience === 'admin') {
        return {
          memberId: member.virtualMemberId,
          userId: member.virtualMemberId,
          name: member.displayName,
          avatar: member.avatar ?? undefined,
          role: 'MEMBER',
          payStatus: 'VIRTUAL',
          joinedAt,
          remark: '虚拟补位',
          memberType: 'VIRTUAL',
          sourceType: member.sourceType,
          virtualMemberId: member.virtualMemberId,
          participatesInOrder: false,
          participatesInAttendance: false,
          participatesInCommission: false,
        };
      }

      return {
        memberId: member.virtualMemberId,
        userId: member.virtualMemberId,
        name: member.displayName,
        avatar: member.avatar ?? undefined,
        role: 'MEMBER',
        payStatus: 'PAID',
        joinedAt,
      };
    });

  return [...realMembers, ...virtualMembers];
}

export async function loadCourseGroupProductMap(
  prisma: PrismaService,
  productId: string,
): Promise<CourseGroupProductMap> {
  return new Map(
    (
      await prisma.pmsProduct.findMany({
        where: { productId },
        select: { productId: true, name: true, mainImages: true },
      })
    ).map((product) => [product.productId, product]),
  );
}

export async function loadCourseGroupStoreMap(prisma: PrismaService, tenantId: string): Promise<CourseGroupStoreMap> {
  return new Map(
    (
      await prisma.sysTenant.findMany({
        where: { tenantId },
        select: { tenantId: true, companyName: true },
      })
    ).map((store) => [store.tenantId, store.companyName]),
  );
}

export async function loadTeamFinancialSnapshot(input: {
  prisma: PrismaService;
  tenantHelper: TenantHelper;
  tenantId: string;
  members: CourseGroupInstance[];
}): Promise<TeamFinancialSnapshot> {
  const paidMembers = input.members.filter((member) => isCourseGroupPaidStatus(member.status));
  const orderItemIds = paidMembers
    .map((member) => {
      const orderItemId = (member as CourseGroupInstance & { orderItemId?: number | null }).orderItemId;
      return typeof orderItemId === 'number' ? orderItemId : null;
    })
    .filter((itemId): itemId is number => itemId !== null);

  if (orderItemIds.length === 0) {
    return {
      realPaidAmount: 0,
      commissionBaseAmount: 0,
      commissionAmount: 0,
      financeEvidenceReady: paidMembers.length === 0,
    };
  }

  const [orderItems, commissions] = await Promise.all([
    input.prisma.omsOrderItem.findMany({
      where: input.tenantHelper.readWhereForDelegate('omsOrderItem', {
        tenantId: input.tenantId,
        id: { in: orderItemIds },
      }) as Prisma.OmsOrderItemWhereInput,
      select: { id: true, playInstanceId: true, totalAmount: true, orderItemFinalPaid: true },
    }),
    input.prisma.finCommission.findMany({
      where: input.tenantHelper.readWhereForDelegate('finCommission', {
        tenantId: input.tenantId,
        orderItemId: { in: orderItemIds },
      }) as Prisma.FinCommissionWhereInput,
      select: { orderItemId: true, playInstanceId: true, commissionBase: true, amount: true },
    }),
  ]);

  const realPaidAmount = orderItems.reduce(
    (sum, item) => sum + decimalToNumber(item.orderItemFinalPaid ?? item.totalAmount),
    0,
  );
  const commissionBaseByOrderItem = new Map<number, number>();
  const commissionAmount = commissions.reduce((sum, row) => {
    if (row.orderItemId !== null && !commissionBaseByOrderItem.has(row.orderItemId)) {
      commissionBaseByOrderItem.set(row.orderItemId, decimalToNumber(row.commissionBase));
    }
    return sum + decimalToNumber(row.amount);
  }, 0);

  return {
    realPaidAmount: Number(realPaidAmount.toFixed(2)),
    commissionBaseAmount: Number(
      [...commissionBaseByOrderItem.values()].reduce((sum, value) => sum + value, 0).toFixed(2),
    ),
    commissionAmount: Number(commissionAmount.toFixed(2)),
    financeEvidenceReady:
      paidMembers.length === orderItemIds.length && commissionBaseByOrderItem.size === orderItemIds.length,
  };
}
