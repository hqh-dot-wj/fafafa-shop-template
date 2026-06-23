import { Injectable } from '@nestjs/common';
import { DistDistributorProfileStatus, DistRelationStatus, Prisma } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  DistributionQualificationQueryPort,
  DistributionRelationForFinance,
  DistributorProfileForFinance,
} from '../ports/distribution-qualification-query.port';

@Injectable()
export class DistributionQualificationQueryAdapter extends DistributionQualificationQueryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {
    super();
  }

  async findProfile(memberId: string, tenantId?: string): Promise<DistributorProfileForFinance | null> {
    const profile = await this.prisma.sysDistDistributorProfile.findFirst({
      where: this.scopedProfileWhere({
        memberId,
        ...(tenantId ? { tenantId } : {}),
      }),
    });

    if (!profile) return null;

    return {
      memberId: profile.memberId,
      tenantId: profile.tenantId,
      levelId: profile.levelId,
      status: profile.status,
      canWithdraw: profile.canWithdraw,
      canBindRelation: profile.canBindRelation,
      canEarnL2: profile.canEarnL2,
      qualifiedAt: profile.qualifiedAt,
    };
  }

  async findActiveProfile(memberId: string, tenantId?: string): Promise<DistributorProfileForFinance | null> {
    const profile = await this.prisma.sysDistDistributorProfile.findFirst({
      where: this.scopedProfileWhere({
        memberId,
        ...(tenantId ? { tenantId } : {}),
        status: DistDistributorProfileStatus.ACTIVE,
      }),
    });

    if (!profile) return null;

    return {
      memberId: profile.memberId,
      tenantId: profile.tenantId,
      levelId: profile.levelId,
      status: profile.status,
      canWithdraw: profile.canWithdraw,
      canBindRelation: profile.canBindRelation,
      canEarnL2: profile.canEarnL2,
      qualifiedAt: profile.qualifiedAt,
    };
  }

  async findActiveRelation(
    distributorMemberId: string,
    tenantId?: string,
  ): Promise<DistributionRelationForFinance | null> {
    const relation = await this.prisma.sysDistRelation.findFirst({
      where: this.scopedRelationWhere({
        distributorMemberId,
        ...(tenantId ? { tenantId } : {}),
        status: DistRelationStatus.ACTIVE,
      }),
    });

    if (!relation) return null;

    return {
      distributorMemberId: relation.distributorMemberId,
      teamOwnerMemberId: relation.teamOwnerMemberId,
      inviterMemberId: relation.inviterMemberId,
    };
  }

  private scopedProfileWhere(where: Prisma.SysDistDistributorProfileWhereInput) {
    return this.tenantHelper.readWhereForDelegate(
      'sysDistDistributorProfile',
      where as object,
    ) as Prisma.SysDistDistributorProfileWhereInput;
  }

  private scopedRelationWhere(where: Prisma.SysDistRelationWhereInput) {
    return this.tenantHelper.readWhereForDelegate(
      'sysDistRelation',
      where as object,
    ) as Prisma.SysDistRelationWhereInput;
  }
}
