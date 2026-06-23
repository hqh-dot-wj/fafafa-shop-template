import { Injectable } from '@nestjs/common';
import {
  DistDistributorProfileStatus,
  DistPendingRewardStatus,
  DistQualificationApplicationStatus,
  DistQualificationEvidenceStatus,
  DistRelationStatus,
  DistShareEventType,
  DistShareTokenStatus,
  DistServicePolicyTargetType,
  OrderType,
  Prisma,
  SysDistServicePolicy,
} from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ListDistributionRelationDto,
  ListDistributorProfileDto,
  ListEvidenceDto,
  ListMyEvidenceDto,
  ListPendingRewardDto,
  ListQualificationApplicationDto,
  ListQualificationRuleDto,
  ListServicePolicyDto,
  UpsertQualificationRuleDto,
  UpsertServicePolicyDto,
} from './dto/qualification.dto';

@Injectable()
export class DistributionQualificationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  findProfile(tenantId: string, memberId: string) {
    return this.prisma.sysDistDistributorProfile.findFirst({
      where: this.scopedProfileWhere({
        tenantId,
        memberId,
      }),
    });
  }

  findActiveProfile(tenantId: string, memberId: string) {
    return this.prisma.sysDistDistributorProfile.findFirst({
      where: this.scopedProfileWhere({
        tenantId,
        memberId,
        status: DistDistributorProfileStatus.ACTIVE,
      }),
    });
  }

  findActiveRelation(tenantId: string, distributorMemberId: string) {
    return this.prisma.sysDistRelation.findFirst({
      where: this.scopedRelationWhere({
        tenantId,
        distributorMemberId,
        status: DistRelationStatus.ACTIVE,
      }),
    });
  }

  async sumPendingReward(tenantId: string, memberId: string): Promise<number> {
    const result = await this.prisma.sysDistPendingReward.aggregate({
      where: this.scopedPendingRewardWhere({
        tenantId,
        memberId,
        status: { in: [DistPendingRewardStatus.FROZEN, DistPendingRewardStatus.ELIGIBLE] },
      }),
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  findServiceOrderForEvidence(tenantId: string, orderId: string) {
    return this.prisma.omsOrder.findFirst({
      where: this.scopedOrderWhere({
        tenantId,
        id: orderId,
        orderType: OrderType.SERVICE,
      }),
      select: {
        id: true,
        tenantId: true,
        memberId: true,
        shareUserId: true,
        items: {
          select: {
            id: true,
            productId: true,
            skuId: true,
          },
        },
      },
    });
  }

  async findProductCategoryMap(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();

    const products = await this.prisma.pmsProduct.findMany({
      where: {
        productId: { in: [...new Set(productIds)] },
      },
      select: {
        productId: true,
        categoryId: true,
      },
    });

    return new Map(products.map((product) => [product.productId, product.categoryId]));
  }

  async findEligibleServicePolicies(input: {
    tenantId: string;
    productIds: string[];
    skuIds: string[];
    categoryIds: string[];
  }): Promise<SysDistServicePolicy[]> {
    const targetFilters: Prisma.SysDistServicePolicyWhereInput[] = [];

    if (input.skuIds.length > 0) {
      targetFilters.push({
        targetType: DistServicePolicyTargetType.SKU,
        targetId: { in: [...new Set(input.skuIds)] },
      });
    }

    if (input.productIds.length > 0) {
      targetFilters.push({
        targetType: DistServicePolicyTargetType.PRODUCT,
        targetId: { in: [...new Set(input.productIds)] },
      });
    }

    if (input.categoryIds.length > 0) {
      targetFilters.push({
        targetType: DistServicePolicyTargetType.CATEGORY,
        targetId: { in: [...new Set(input.categoryIds)] },
      });
    }

    if (targetFilters.length === 0) return [];

    return await this.prisma.sysDistServicePolicy.findMany({
      where: this.scopedServicePolicyWhere({
        tenantId: input.tenantId,
        isActive: true,
        qualificationEligible: true,
        OR: targetFilters,
      }),
    });
  }

  upsertQualificationEvidence(input: {
    tenantId: string;
    memberId: string;
    orderId: string;
    orderItemId: number;
    productId: string;
    skuId: string;
    servicePolicyId: number;
    sourceShareUserId: string | null;
    verifiedAt: Date;
  }) {
    return this.prisma.sysDistQualificationEvidence.upsert({
      where: {
        uk_dist_evidence_order_item: {
          tenantId: input.tenantId,
          orderId: input.orderId,
          orderItemId: input.orderItemId,
        },
      },
      create: {
        tenantId: input.tenantId,
        memberId: input.memberId,
        orderId: input.orderId,
        orderItemId: input.orderItemId,
        productId: input.productId,
        skuId: input.skuId,
        servicePolicyId: input.servicePolicyId,
        sourceShareUserId: input.sourceShareUserId,
        evidenceStatus: DistQualificationEvidenceStatus.ELIGIBLE,
        verifiedAt: input.verifiedAt,
      },
      update: {
        memberId: input.memberId,
        productId: input.productId,
        skuId: input.skuId,
        servicePolicyId: input.servicePolicyId,
        sourceShareUserId: input.sourceShareUserId,
        evidenceStatus: DistQualificationEvidenceStatus.ELIGIBLE,
        verifiedAt: input.verifiedAt,
        invalidReason: null,
      },
    });
  }

  /** 单笔事务内批量 upsert，避免 Service 层循环 await 单条写入 */
  upsertManyQualificationEvidence(
    inputs: Array<{
      tenantId: string;
      memberId: string;
      orderId: string;
      orderItemId: number;
      productId: string;
      skuId: string;
      servicePolicyId: number;
      sourceShareUserId: string | null;
      verifiedAt: Date;
    }>,
  ) {
    if (inputs.length === 0) {
      return Promise.resolve();
    }
    return this.prisma.$transaction(inputs.map((input) => this.upsertQualificationEvidence(input)));
  }

  markEvidenceRefunded(input: { tenantId: string; orderId: string; orderItemIds?: number[]; reason: string }) {
    return this.prisma.sysDistQualificationEvidence.updateMany({
      where: this.scopedEvidenceWhere({
        tenantId: input.tenantId,
        orderId: input.orderId,
        ...(input.orderItemIds?.length ? { orderItemId: { in: input.orderItemIds } } : {}),
        evidenceStatus: {
          in: [
            DistQualificationEvidenceStatus.PENDING_DELIVERY,
            DistQualificationEvidenceStatus.ELIGIBLE,
            DistQualificationEvidenceStatus.USED,
          ],
        },
      }),
      data: {
        evidenceStatus: DistQualificationEvidenceStatus.REFUNDED,
        invalidReason: input.reason,
      },
    });
  }

  voidPendingRewards(input: { tenantId: string; orderId: string; orderItemIds?: number[]; reason: string }) {
    return this.prisma.sysDistPendingReward.updateMany({
      where: this.scopedPendingRewardWhere({
        tenantId: input.tenantId,
        orderId: input.orderId,
        ...(input.orderItemIds?.length ? { orderItemId: { in: input.orderItemIds } } : {}),
        status: {
          in: [DistPendingRewardStatus.FROZEN, DistPendingRewardStatus.ELIGIBLE],
        },
      }),
      data: {
        status: DistPendingRewardStatus.VOIDED,
        voidReason: input.reason,
      },
    });
  }

  async listServicePolicies(tenantId: string, query: ListServicePolicyDto) {
    const where = this.scopedServicePolicyWhere({
      tenantId,
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: { contains: query.targetId } } : {}),
      ...(query.qualificationEligible !== undefined ? { qualificationEligible: query.qualificationEligible } : {}),
      ...(query.commissionEligible !== undefined ? { commissionEligible: query.commissionEligible } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    });
    const { skip, take } = this.getPagination(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sysDistServicePolicy.findMany({
        where,
        orderBy: { updateTime: 'desc' },
        skip,
        take,
      }),
      this.prisma.sysDistServicePolicy.count({ where }),
    ]);

    return { rows, total };
  }

  upsertServicePolicy(tenantId: string, dto: UpsertServicePolicyDto, operator: string) {
    const data = {
      commissionEligible: dto.commissionEligible,
      qualificationEligible: dto.qualificationEligible,
      allowLv0Share: dto.allowLv0Share ?? false,
      lv0RewardMode: dto.lv0RewardMode,
      requireRiskConfirm: dto.requireRiskConfirm ?? false,
      isActive: dto.isActive ?? true,
      updateBy: operator,
    };

    return this.prisma.sysDistServicePolicy.upsert({
      where: {
        uk_dist_service_policy_target: {
          tenantId,
          targetType: dto.targetType,
          targetId: dto.targetId,
        },
      },
      create: {
        tenantId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        ...data,
        createBy: operator,
      },
      update: data,
    });
  }

  updateServicePolicy(tenantId: string, id: number, dto: UpsertServicePolicyDto, operator: string) {
    return this.prisma.sysDistServicePolicy.update({
      where: { id },
      data: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        commissionEligible: dto.commissionEligible,
        qualificationEligible: dto.qualificationEligible,
        allowLv0Share: dto.allowLv0Share ?? false,
        lv0RewardMode: dto.lv0RewardMode,
        requireRiskConfirm: dto.requireRiskConfirm ?? false,
        isActive: dto.isActive ?? true,
        updateBy: operator,
      },
    });
  }

  findServicePolicyById(tenantId: string, id: number) {
    return this.prisma.sysDistServicePolicy.findFirst({
      where: this.scopedServicePolicyWhere({ tenantId, id }),
    });
  }

  async listRules(tenantId: string, query: ListQualificationRuleDto) {
    const where = this.scopedRuleWhere({
      tenantId,
      ...(query.targetLevelId ? { targetLevelId: query.targetLevelId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    });
    const { skip, take } = this.getPagination(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sysDistQualificationRule.findMany({
        where,
        orderBy: [{ targetLevelId: 'asc' }, { updateTime: 'desc' }],
        skip,
        take,
      }),
      this.prisma.sysDistQualificationRule.count({ where }),
    ]);

    return { rows, total };
  }

  upsertRule(tenantId: string, dto: UpsertQualificationRuleDto, operator: string) {
    const data = {
      requiredEvidenceCount: dto.requiredEvidenceCount ?? 1,
      requiredServicePolicyIds: dto.requiredServicePolicyIds ?? Prisma.JsonNull,
      requireManualReview: dto.requireManualReview ?? true,
      minOrderAmount: new Prisma.Decimal(dto.minOrderAmount ?? 0),
      minRegisterDays: dto.minRegisterDays ?? 0,
      requireRealName: dto.requireRealName ?? false,
      isActive: dto.isActive ?? true,
      updateBy: operator,
    };

    return this.prisma.sysDistQualificationRule.upsert({
      where: {
        uk_dist_qualification_rule_level: {
          tenantId,
          targetLevelId: dto.targetLevelId,
        },
      },
      create: {
        tenantId,
        targetLevelId: dto.targetLevelId,
        ...data,
        createBy: operator,
      },
      update: data,
    });
  }

  updateRule(tenantId: string, id: number, dto: UpsertQualificationRuleDto, operator: string) {
    return this.prisma.sysDistQualificationRule.update({
      where: { id },
      data: {
        targetLevelId: dto.targetLevelId,
        requiredEvidenceCount: dto.requiredEvidenceCount ?? 1,
        requiredServicePolicyIds: dto.requiredServicePolicyIds ?? Prisma.JsonNull,
        requireManualReview: dto.requireManualReview ?? true,
        minOrderAmount: new Prisma.Decimal(dto.minOrderAmount ?? 0),
        minRegisterDays: dto.minRegisterDays ?? 0,
        requireRealName: dto.requireRealName ?? false,
        isActive: dto.isActive ?? true,
        updateBy: operator,
      },
    });
  }

  findRuleById(tenantId: string, id: number) {
    return this.prisma.sysDistQualificationRule.findFirst({
      where: this.scopedRuleWhere({ tenantId, id }),
    });
  }

  findActiveRuleByLevel(tenantId: string, targetLevelId: number) {
    return this.prisma.sysDistQualificationRule.findFirst({
      where: this.scopedRuleWhere({
        tenantId,
        targetLevelId,
        isActive: true,
      }),
    });
  }

  async listEvidence(tenantId: string, query: ListEvidenceDto | ListMyEvidenceDto, memberId?: string) {
    const where = this.scopedEvidenceWhere({
      tenantId,
      ...(memberId ? { memberId } : {}),
      ...(!memberId && 'memberId' in query && query.memberId ? { memberId: query.memberId } : {}),
      ...('orderId' in query && query.orderId ? { orderId: query.orderId } : {}),
      ...(query.evidenceStatus ? { evidenceStatus: query.evidenceStatus } : {}),
    });
    const { skip, take } = this.getPagination(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sysDistQualificationEvidence.findMany({
        where,
        orderBy: { createTime: 'desc' },
        skip,
        take,
      }),
      this.prisma.sysDistQualificationEvidence.count({ where }),
    ]);

    return { rows, total };
  }

  findEvidenceByIds(tenantId: string, memberId: string, evidenceIds: string[]) {
    return this.prisma.sysDistQualificationEvidence.findMany({
      where: this.scopedEvidenceWhere({
        tenantId,
        memberId,
        id: { in: evidenceIds },
      }),
    });
  }

  async sumEvidenceOrderPayAmount(tenantId: string, memberId: string, orderIds: string[]) {
    const uniqueOrderIds = [...new Set(orderIds)];
    if (uniqueOrderIds.length === 0) return new Prisma.Decimal(0);

    const result = await this.prisma.omsOrder.aggregate({
      where: this.scopedOrderWhere({
        tenantId,
        memberId,
        id: { in: uniqueOrderIds },
      }),
      _sum: { payAmount: true },
    });

    return result._sum.payAmount ?? new Prisma.Decimal(0);
  }

  markEvidenceUsed(tenantId: string, memberId: string, evidenceIds: string[], applicationId: string) {
    return this.prisma.sysDistQualificationEvidence.updateMany({
      where: this.scopedEvidenceWhere({
        tenantId,
        memberId,
        id: { in: evidenceIds },
        evidenceStatus: DistQualificationEvidenceStatus.ELIGIBLE,
      }),
      data: {
        evidenceStatus: DistQualificationEvidenceStatus.USED,
        usedApplicationId: applicationId,
      },
    });
  }

  restoreApplicationEvidence(tenantId: string, applicationId: string) {
    return this.prisma.sysDistQualificationEvidence.updateMany({
      where: this.scopedEvidenceWhere({
        tenantId,
        usedApplicationId: applicationId,
        evidenceStatus: DistQualificationEvidenceStatus.USED,
      }),
      data: {
        evidenceStatus: DistQualificationEvidenceStatus.ELIGIBLE,
        usedApplicationId: null,
      },
    });
  }

  findMemberBasic(tenantId: string, memberId: string) {
    return this.prisma.umsMember.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsMember', {
        tenantId,
        memberId,
      }) as Prisma.UmsMemberWhereInput,
      select: {
        memberId: true,
        tenantId: true,
        levelId: true,
        mobile: true,
        createTime: true,
      },
    });
  }

  findPendingApplication(tenantId: string, memberId: string) {
    return this.prisma.sysDistQualificationApplication.findFirst({
      where: this.scopedApplicationWhere({
        tenantId,
        memberId,
        status: DistQualificationApplicationStatus.PENDING_REVIEW,
      }),
    });
  }

  createApplication(input: {
    tenantId: string;
    memberId: string;
    targetLevelId: number;
    evidenceIds: string[];
    applyReason?: string;
  }) {
    return this.prisma.sysDistQualificationApplication.create({
      data: {
        tenantId: input.tenantId,
        memberId: input.memberId,
        targetLevelId: input.targetLevelId,
        evidenceIds: input.evidenceIds,
        applyReason: input.applyReason,
      },
    });
  }

  findLatestApplication(tenantId: string, memberId: string) {
    return this.prisma.sysDistQualificationApplication.findFirst({
      where: this.scopedApplicationWhere({
        tenantId,
        memberId,
      }),
      orderBy: { createTime: 'desc' },
    });
  }

  findApplication(tenantId: string, applicationId: string) {
    return this.prisma.sysDistQualificationApplication.findFirst({
      where: this.scopedApplicationWhere({
        tenantId,
        id: applicationId,
      }),
    });
  }

  updateApplication(input: {
    tenantId: string;
    applicationId: string;
    data: Prisma.SysDistQualificationApplicationUpdateInput;
  }) {
    return this.prisma.sysDistQualificationApplication.update({
      where: { id: input.applicationId },
      data: input.data,
    });
  }

  async listApplications(tenantId: string, query: ListQualificationApplicationDto) {
    const where = this.scopedApplicationWhere({
      tenantId,
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.targetLevelId ? { targetLevelId: query.targetLevelId } : {}),
      ...(query.status ? { status: query.status } : {}),
    });
    const { skip, take } = this.getPagination(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sysDistQualificationApplication.findMany({
        where,
        orderBy: { createTime: 'desc' },
        skip,
        take,
      }),
      this.prisma.sysDistQualificationApplication.count({ where }),
    ]);

    return { rows, total };
  }

  upsertProfileForApproval(input: {
    tenantId: string;
    memberId: string;
    targetLevelId: number;
    applicationId: string;
    qualifiedAt: Date;
  }) {
    return this.prisma.sysDistDistributorProfile.upsert({
      where: {
        uk_dist_profile_member: {
          tenantId: input.tenantId,
          memberId: input.memberId,
        },
      },
      create: {
        tenantId: input.tenantId,
        memberId: input.memberId,
        status: DistDistributorProfileStatus.ACTIVE,
        levelId: input.targetLevelId,
        qualifiedAt: input.qualifiedAt,
        sourceApplicationId: input.applicationId,
        canWithdraw: true,
        canBindRelation: true,
        canEarnL2: input.targetLevelId >= 2,
      },
      update: {
        status: DistDistributorProfileStatus.ACTIVE,
        levelId: input.targetLevelId,
        qualifiedAt: input.qualifiedAt,
        sourceApplicationId: input.applicationId,
        canWithdraw: true,
        canBindRelation: true,
        canEarnL2: input.targetLevelId >= 2,
        frozenReason: null,
        revokedReason: null,
      },
    });
  }

  async upsertRelationForApproval(input: {
    tenantId: string;
    distributorMemberId: string;
    teamOwnerMemberId: string | null;
    inviterMemberId: string | null;
    applicationId: string;
    operator: string;
  }) {
    const existing = await this.prisma.sysDistRelation.findFirst({
      where: this.scopedRelationWhere({
        tenantId: input.tenantId,
        distributorMemberId: input.distributorMemberId,
      }),
    });
    const effectiveAt = new Date();

    const relation = await this.prisma.sysDistRelation.upsert({
      where: {
        uk_dist_relation_distributor: {
          tenantId: input.tenantId,
          distributorMemberId: input.distributorMemberId,
        },
      },
      create: {
        tenantId: input.tenantId,
        distributorMemberId: input.distributorMemberId,
        teamOwnerMemberId: input.teamOwnerMemberId,
        inviterMemberId: input.inviterMemberId,
        sourceApplicationId: input.applicationId,
        status: DistRelationStatus.ACTIVE,
        effectiveAt,
      },
      update: {
        teamOwnerMemberId: input.teamOwnerMemberId,
        inviterMemberId: input.inviterMemberId,
        sourceApplicationId: input.applicationId,
        status: DistRelationStatus.ACTIVE,
        effectiveAt,
      },
    });

    await this.prisma.sysDistRelationLog.create({
      data: {
        tenantId: input.tenantId,
        relationId: relation.id,
        distributorMemberId: input.distributorMemberId,
        fromTeamOwnerMemberId: existing?.teamOwnerMemberId ?? null,
        toTeamOwnerMemberId: input.teamOwnerMemberId,
        fromStatus: existing?.status ?? null,
        toStatus: DistRelationStatus.ACTIVE,
        changeType: existing ? 'APPROVAL_UPDATE' : 'APPROVAL_CREATE',
        reason: '资格审核通过',
        operator: input.operator,
      },
    });

    return relation;
  }

  updateMemberLevelProjection(tenantId: string, memberId: string, levelId: number) {
    return this.prisma.umsMember.updateMany({
      where: this.tenantHelper.readWhereForDelegate('umsMember', {
        tenantId,
        memberId,
      }) as Prisma.UmsMemberWhereInput,
      data: {
        levelId,
        upgradedAt: new Date(),
      },
    });
  }

  activatePendingRewardsForProfile(tenantId: string, memberId: string, profileId: string) {
    return this.prisma.sysDistPendingReward.updateMany({
      where: this.scopedPendingRewardWhere({
        tenantId,
        memberId,
        status: DistPendingRewardStatus.FROZEN,
      }),
      data: {
        status: DistPendingRewardStatus.ELIGIBLE,
        releaseProfileId: profileId,
      },
    });
  }

  async listProfiles(tenantId: string, query: ListDistributorProfileDto) {
    const where = this.scopedProfileWhere({
      tenantId,
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.levelId ? { levelId: query.levelId } : {}),
      ...(query.status ? { status: query.status } : {}),
    });
    const { skip, take } = this.getPagination(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sysDistDistributorProfile.findMany({
        where,
        orderBy: { qualifiedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.sysDistDistributorProfile.count({ where }),
    ]);

    return { rows, total };
  }

  updateProfileStatus(input: {
    tenantId: string;
    profileId: string;
    status: DistDistributorProfileStatus;
    reason?: string;
  }) {
    return this.prisma.sysDistDistributorProfile.update({
      where: { id: input.profileId },
      data: {
        status: input.status,
        canWithdraw: input.status === DistDistributorProfileStatus.ACTIVE,
        canBindRelation: input.status === DistDistributorProfileStatus.ACTIVE,
        ...(input.status === DistDistributorProfileStatus.FROZEN ? { frozenReason: input.reason ?? '后台冻结' } : {}),
        ...(input.status === DistDistributorProfileStatus.REVOKED ? { revokedReason: input.reason ?? '后台撤销' } : {}),
      },
    });
  }

  findProfileById(tenantId: string, profileId: string) {
    return this.prisma.sysDistDistributorProfile.findFirst({
      where: this.scopedProfileWhere({ tenantId, id: profileId }),
    });
  }

  updateRelationStatusByDistributor(input: {
    tenantId: string;
    distributorMemberId: string;
    status: DistRelationStatus;
    reason: string;
    operator: string;
  }) {
    return this.prisma.sysDistRelation.updateMany({
      where: this.scopedRelationWhere({
        tenantId: input.tenantId,
        distributorMemberId: input.distributorMemberId,
      }),
      data: {
        status: input.status,
      },
    });
  }

  async disableActiveShareTokensForDistributor(input: {
    tenantId: string;
    shareUserId: string;
    operator: string;
    reason: string;
  }) {
    const tokens = await this.prisma.sysDistShareToken.findMany({
      where: this.scopedShareTokenWhere({
        tenantId: input.tenantId,
        shareUserId: input.shareUserId,
        status: DistShareTokenStatus.ACTIVE,
      }),
      select: {
        sid: true,
        tenantId: true,
        shareUserId: true,
        bizType: true,
        bizId: true,
      },
    });

    if (tokens.length === 0) return { count: 0 };

    const updated = await this.prisma.sysDistShareToken.updateMany({
      where: this.scopedShareTokenWhere({
        tenantId: input.tenantId,
        shareUserId: input.shareUserId,
        status: DistShareTokenStatus.ACTIVE,
      }),
      data: {
        status: DistShareTokenStatus.DISABLED,
        updateBy: input.operator,
      },
    });

    if (updated.count > 0) {
      await this.prisma.sysDistShareEvent.createMany({
        data: tokens.map((token) => ({
          sid: token.sid,
          tenantId: token.tenantId,
          shareUserId: token.shareUserId,
          eventType: DistShareEventType.MANUAL_DISABLE,
          bizType: token.bizType,
          bizId: token.bizId,
          eventCode: 'DISTRIBUTOR_PROFILE_INACTIVE',
          eventMessage: input.reason,
          metadata: {
            source: 'distribution_qualification_profile_status',
            operator: input.operator,
          },
        })),
      });
    }

    return updated;
  }

  async listRelations(tenantId: string, query: ListDistributionRelationDto) {
    const where = this.scopedRelationWhere({
      tenantId,
      ...(query.distributorMemberId ? { distributorMemberId: query.distributorMemberId } : {}),
      ...(query.teamOwnerMemberId ? { teamOwnerMemberId: query.teamOwnerMemberId } : {}),
      ...(query.inviterMemberId ? { inviterMemberId: query.inviterMemberId } : {}),
      ...(query.status ? { status: query.status } : {}),
    });
    const { skip, take } = this.getPagination(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sysDistRelation.findMany({
        where,
        orderBy: { effectiveAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.sysDistRelation.count({ where }),
    ]);

    return { rows, total };
  }

  async listPendingRewards(tenantId: string, query: ListPendingRewardDto, memberId?: string) {
    const where = this.scopedPendingRewardWhere({
      tenantId,
      ...(memberId ? { memberId } : {}),
      ...(!memberId && query.memberId ? { memberId: query.memberId } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.status ? { status: query.status } : {}),
    });
    const { skip, take } = this.getPagination(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sysDistPendingReward.findMany({
        where,
        orderBy: { createTime: 'desc' },
        skip,
        take,
      }),
      this.prisma.sysDistPendingReward.count({ where }),
    ]);

    return { rows, total };
  }

  private scopedOrderWhere(where: Prisma.OmsOrderWhereInput) {
    return this.tenantHelper.readWhereForDelegate('omsOrder', where as object) as Prisma.OmsOrderWhereInput;
  }

  private scopedServicePolicyWhere(where: Prisma.SysDistServicePolicyWhereInput) {
    return this.tenantHelper.readWhereForDelegate(
      'sysDistServicePolicy',
      where as object,
    ) as Prisma.SysDistServicePolicyWhereInput;
  }

  private scopedEvidenceWhere(where: Prisma.SysDistQualificationEvidenceWhereInput) {
    return this.tenantHelper.readWhereForDelegate(
      'sysDistQualificationEvidence',
      where as object,
    ) as Prisma.SysDistQualificationEvidenceWhereInput;
  }

  private scopedRuleWhere(where: Prisma.SysDistQualificationRuleWhereInput) {
    return this.tenantHelper.readWhereForDelegate(
      'sysDistQualificationRule',
      where as object,
    ) as Prisma.SysDistQualificationRuleWhereInput;
  }

  private scopedApplicationWhere(where: Prisma.SysDistQualificationApplicationWhereInput) {
    return this.tenantHelper.readWhereForDelegate(
      'sysDistQualificationApplication',
      where as object,
    ) as Prisma.SysDistQualificationApplicationWhereInput;
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

  private scopedPendingRewardWhere(where: Prisma.SysDistPendingRewardWhereInput) {
    return this.tenantHelper.readWhereForDelegate(
      'sysDistPendingReward',
      where as object,
    ) as Prisma.SysDistPendingRewardWhereInput;
  }

  private scopedShareTokenWhere(where: Prisma.SysDistShareTokenWhereInput) {
    return this.tenantHelper.readWhereForDelegate(
      'sysDistShareToken',
      where as object,
    ) as Prisma.SysDistShareTokenWhereInput;
  }

  private getPagination(query: { pageNum?: number; pageSize?: number }) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    return {
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    };
  }
}
