import { DistDistributorProfileStatus } from '@prisma/client';

export interface DistributorProfileForFinance {
  memberId: string;
  tenantId: string;
  levelId: number;
  status: DistDistributorProfileStatus;
  canWithdraw: boolean;
  canBindRelation: boolean;
  canEarnL2: boolean;
  qualifiedAt: Date;
}

export interface DistributionRelationForFinance {
  distributorMemberId: string;
  teamOwnerMemberId: string | null;
  inviterMemberId: string | null;
}

/**
 * 分销资格查询端口。
 * 切片 1 仅建立端口，后续佣金计算再从 parentId/indirectParentId 切换到该端口。
 */
export abstract class DistributionQualificationQueryPort {
  abstract findProfile(memberId: string, tenantId?: string): Promise<DistributorProfileForFinance | null>;

  abstract findActiveProfile(memberId: string, tenantId?: string): Promise<DistributorProfileForFinance | null>;

  abstract findActiveRelation(
    distributorMemberId: string,
    tenantId?: string,
  ): Promise<DistributionRelationForFinance | null>;
}
