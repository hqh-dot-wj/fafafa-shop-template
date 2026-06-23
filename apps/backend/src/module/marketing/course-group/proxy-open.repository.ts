import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  type CourseGroupProxyOpenAuditRecord,
  readCourseGroupTeamState,
  writeCourseGroupTeamState,
} from './services/team-projection.service';

@Injectable()
export class ProxyOpenRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  async appendProxyOpenAudit(input: {
    teamId: string;
    tenantId: string;
    operatorUserId: string;
    leaderUserId: string;
    productId: string;
    activityContextKey?: string;
    reason?: string;
  }) {
    const leader = await this.prisma.playInstance.findFirst({
      where: this.tenantHelper.readWhereForDelegate('playInstance', {
        id: input.teamId,
        tenantId: input.tenantId,
        templateCode: 'COURSE_GROUP_BUY',
      }) as Prisma.PlayInstanceWhereInput,
      select: {
        id: true,
        instanceData: true,
      },
    });

    if (!leader) {
      return;
    }

    const record = this.toRecord(leader.instanceData);
    const courseGroupTeam = readCourseGroupTeamState(leader.instanceData);
    const nextRecord: CourseGroupProxyOpenAuditRecord = {
      teamId: input.teamId,
      operatorUserId: input.operatorUserId,
      operatorRole: 'STORE_STAFF',
      leaderUserId: input.leaderUserId,
      productId: input.productId,
      activityContextKey: input.activityContextKey ?? null,
      reason: input.reason ?? '门店代开团',
      createdAt: new Date().toISOString(),
    };
    const nextProxyOpenAudits = [...courseGroupTeam.facts.audits.proxyOpen, nextRecord].slice(-20);
    const nextLegacyProxyOpenRecords = Array.isArray(record.proxyOpenRecords) ? [...record.proxyOpenRecords, nextRecord] : [nextRecord];
    const nextCourseGroupTeam = {
      ...courseGroupTeam,
      facts: {
        ...courseGroupTeam.facts,
        audits: {
          ...courseGroupTeam.facts.audits,
          proxyOpen: nextProxyOpenAudits,
        },
      },
    };

    await this.prisma.playInstance.update({
      where: { id: leader.id },
      data: {
        instanceData: writeCourseGroupTeamState(
          {
            ...record,
            proxyOpenRecords: nextLegacyProxyOpenRecords.slice(-20),
            latestProxyOpenAt: nextRecord.createdAt,
          },
          nextCourseGroupTeam,
        ) as Prisma.InputJsonValue,
      },
    });
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }
}
