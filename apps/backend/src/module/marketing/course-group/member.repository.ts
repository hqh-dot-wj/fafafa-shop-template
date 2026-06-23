import { Injectable } from '@nestjs/common';
import { PlayInstanceStatus, Prisma } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { COURSE_GROUP_INSTANCE_SELECT, type CourseGroupInstanceRecord } from './team.repository';

@Injectable()
export class MemberRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  async findTeamMembers(tenantId: string, configId: string, leaderId: string) {
    return this.prisma.playInstance.findMany({
      where: this.tenantHelper.readWhereForDelegate('playInstance', {
        tenantId,
        templateCode: 'COURSE_GROUP_BUY',
        configId,
        OR: [{ id: leaderId }, { instanceData: { path: ['parentId'], equals: leaderId } }],
      }) as Prisma.PlayInstanceWhereInput,
      select: COURSE_GROUP_INSTANCE_SELECT,
      orderBy: { createTime: 'asc' },
    });
  }

  async buildMemberViews(
    instances: CourseGroupInstanceRecord[],
    isPaidStatus: (status: PlayInstanceStatus) => boolean,
  ) {
    const memberIds = [...new Set(instances.map(instance => instance.memberId))];
    const members = memberIds.length
      ? await this.prisma.umsMember.findMany({
          where: this.tenantHelper.readWhereForDelegate('umsMember', {
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

    const memberMap = new Map(members.map(member => [member.memberId, member]));

    return instances.map(instance => {
      const member = memberMap.get(instance.memberId);
      const data = this.toRecord(instance.instanceData);
      const parentId = this.readString(data.parentId);
      const isLeader = this.readBoolean(data.isLeader) ?? false;

      return {
        memberId: instance.memberId,
        userId: instance.memberId,
        name: member?.nickname ?? `会员${instance.memberId.slice(-4)}`,
        avatar: member?.avatar ?? undefined,
        mobile: member?.mobile ?? undefined,
        role: isLeader || !parentId ? 'LEADER' : 'MEMBER',
        payStatus: isPaidStatus(instance.status) ? 'PAID' : 'WAIT_PAY',
        joinedAt: instance.createTime.toISOString(),
        paidAt: isPaidStatus(instance.status) ? instance.updateTime.toISOString() : undefined,
        remark: this.readString(data.remark) ?? undefined,
      };
    });
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private readBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
    }
    return null;
  }
}
