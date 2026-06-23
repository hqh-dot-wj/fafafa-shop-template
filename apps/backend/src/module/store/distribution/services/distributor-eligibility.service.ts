import { Injectable } from '@nestjs/common';
import { DistDistributorProfileStatus, Prisma } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DistributorEligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  async isActive(tenantId: string, memberId: string | null | undefined): Promise<boolean> {
    const normalizedMemberId = memberId?.trim();
    if (!tenantId?.trim() || !normalizedMemberId) return false;

    const profile = await this.prisma.sysDistDistributorProfile.findFirst({
      where: this.scopedProfileWhere({
        tenantId,
        memberId: normalizedMemberId,
        status: DistDistributorProfileStatus.ACTIVE,
      }),
      select: { id: true },
    });
    return !!profile;
  }

  async assertActive(tenantId: string, memberId: string | null | undefined): Promise<void> {
    const active = await this.isActive(tenantId, memberId);
    BusinessException.throwIf(!active, '分销员资格不可用，无法继续操作', ResponseCode.BUSINESS_ERROR);
  }

  async filterActive(tenantId: string, memberIds: Array<string | null | undefined>): Promise<Set<string>> {
    const normalizedMemberIds = [
      ...new Set(memberIds.map((memberId) => memberId?.trim()).filter((memberId): memberId is string => !!memberId)),
    ];
    if (!tenantId?.trim() || normalizedMemberIds.length === 0) return new Set();

    const profiles = await this.prisma.sysDistDistributorProfile.findMany({
      where: this.scopedProfileWhere({
        tenantId,
        memberId: { in: normalizedMemberIds },
        status: DistDistributorProfileStatus.ACTIVE,
      }),
      select: { memberId: true },
    });

    return new Set(profiles.map((profile) => profile.memberId));
  }

  private scopedProfileWhere(where: Prisma.SysDistDistributorProfileWhereInput) {
    return this.tenantHelper.readWhereForDelegate(
      'sysDistDistributorProfile',
      where as object,
    ) as Prisma.SysDistDistributorProfileWhereInput;
  }
}
