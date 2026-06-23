import { Injectable, Logger } from '@nestjs/common';
import {
  DistDistributorProfileStatus,
  DistPendingRewardStatus,
  DistQualificationApplicationStatus,
  DistRelationStatus,
  DistServicePolicyTargetType,
  Prisma,
  SysDistDistributorProfile,
  SysDistQualificationApplication,
  SysDistQualificationEvidence,
  SysDistQualificationRule,
  SysDistServicePolicy,
} from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';
import { Result } from 'src/common/response';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { DistributionQualificationRepository } from './qualification.repository';
import {
  ListDistributionRelationDto,
  ListDistributorProfileDto,
  ListEvidenceDto,
  ListMyEvidenceDto,
  ListPendingRewardDto,
  ListQualificationApplicationDto,
  ListQualificationRuleDto,
  ListServicePolicyDto,
  QualificationReviewResult,
  ReviewQualificationApplicationDto,
  SubmitQualificationApplicationDto,
  UpdateProfileStatusDto,
  UpsertQualificationRuleDto,
  UpsertServicePolicyDto,
} from './dto/qualification.dto';
import {
  DistributionRelationVo,
  DistributorProfileVo,
  PendingRewardVo,
  QualificationApplicationVo,
  QualificationEvidenceVo,
  QualificationRuleVo,
  QualificationServicePolicyVo,
} from './vo/qualification.vo';

export type DistributionProfileStatus = DistDistributorProfileStatus | 'NONE';

export interface DistributionCapabilitySnapshot {
  memberId: string;
  tenantId: string;
  levelId: number;
  profileStatus: DistributionProfileStatus;
  canShare: boolean;
  canEarnCommission: boolean;
  canWithdraw: boolean;
  canBindRelation: boolean;
  canEarnL2: boolean;
  pendingRewardAmount: number;
}

export interface DistributionEvidenceMutationResult {
  evidenceCount: number;
  pendingRewardCount?: number;
}

interface ServiceEvidenceOrderItem {
  id: number;
  productId: string;
  skuId: string;
}

@Injectable()
export class DistributionQualificationService {
  private readonly logger = new Logger(DistributionQualificationService.name);

  constructor(private readonly qualificationRepo: DistributionQualificationRepository) {}

  /**
   * 资格能力快照。
   * 注意：切片 1 只建立新事实源读取口，不切换现有分销、提现或佣金行为。
   */
  async getCapability(tenantId: string, memberId: string): Promise<DistributionCapabilitySnapshot> {
    const [profile, pendingRewardAmount] = await Promise.all([
      this.qualificationRepo.findProfile(tenantId, memberId),
      this.qualificationRepo.sumPendingReward(tenantId, memberId),
    ]);

    if (!profile || profile.status !== DistDistributorProfileStatus.ACTIVE) {
      return {
        memberId,
        tenantId,
        levelId: 0,
        profileStatus: profile?.status ?? 'NONE',
        canShare: true,
        canEarnCommission: false,
        canWithdraw: false,
        canBindRelation: false,
        canEarnL2: false,
        pendingRewardAmount,
      };
    }

    return {
      memberId,
      tenantId,
      levelId: profile.levelId,
      profileStatus: profile.status,
      canShare: true,
      canEarnCommission: true,
      canWithdraw: profile.canWithdraw,
      canBindRelation: profile.canBindRelation,
      canEarnL2: profile.canEarnL2,
      pendingRewardAmount,
    };
  }

  /**
   * 服务核销后的资格材料维护。
   * 这里仅把“已完成服务”写成可申请材料，不授予资格、不释放佣金、不写钱包。
   */
  async markServiceOrderVerified(tenantId: string, orderId: string): Promise<DistributionEvidenceMutationResult> {
    const order = await this.qualificationRepo.findServiceOrderForEvidence(tenantId, orderId);
    if (!order || order.items.length === 0) {
      return { evidenceCount: 0 };
    }

    const categoryMap = await this.qualificationRepo.findProductCategoryMap(order.items.map((item) => item.productId));
    const policies = await this.qualificationRepo.findEligibleServicePolicies({
      tenantId,
      productIds: order.items.map((item) => item.productId),
      skuIds: order.items.map((item) => item.skuId),
      categoryIds: [...new Set([...categoryMap.values()].map((categoryId) => String(categoryId)))],
    });
    const policyByTarget = this.buildPolicyTargetMap(policies);

    const verifiedAt = new Date();
    const evidenceInputs = order.items.flatMap((item) => {
      const policy = this.findPolicyForItem(item, categoryMap, policyByTarget);
      if (!policy) return [];

      return [
        {
          tenantId,
          memberId: order.memberId,
          orderId: order.id,
          orderItemId: item.id,
          productId: item.productId,
          skuId: item.skuId,
          servicePolicyId: policy.id,
          sourceShareUserId: order.shareUserId,
          verifiedAt,
        },
      ];
    });

    if (evidenceInputs.length > 0) {
      await this.qualificationRepo.upsertManyQualificationEvidence(evidenceInputs);
    }

    return { evidenceCount: evidenceInputs.length };
  }

  /**
   * 退款后的资格材料维护。
   * 已退款服务不能继续作为资格申请材料；LV0 待激活收益也必须作废，且不进入钱包。
   */
  async markServiceOrderRefunded(
    tenantId: string,
    orderId: string,
    orderItemIds?: number[],
  ): Promise<DistributionEvidenceMutationResult> {
    const normalizedItemIds = orderItemIds?.length ? [...new Set(orderItemIds)] : undefined;
    const reason = '服务订单退款，资格申请材料失效';

    const evidenceResult = await this.qualificationRepo.markEvidenceRefunded({
      tenantId,
      orderId,
      orderItemIds: normalizedItemIds,
      reason,
    });

    const pendingRewardResult = await this.qualificationRepo.voidPendingRewards({
      tenantId,
      orderId,
      orderItemIds: normalizedItemIds,
      reason,
    });

    return {
      evidenceCount: evidenceResult.count,
      pendingRewardCount: pendingRewardResult.count,
    };
  }

  async listServicePolicies(tenantId: string, query: ListServicePolicyDto) {
    const { rows, total } = await this.qualificationRepo.listServicePolicies(tenantId, query);
    return Result.page(
      rows.map((row) => this.toServicePolicyVo(row)),
      total,
      query.pageNum,
      query.pageSize,
    );
  }

  async createServicePolicy(tenantId: string, dto: UpsertServicePolicyDto, operator: string) {
    const row = await this.qualificationRepo.upsertServicePolicy(tenantId, dto, operator);
    return Result.ok(this.toServicePolicyVo(row), '服务策略已保存');
  }

  async updateServicePolicy(tenantId: string, id: number, dto: UpsertServicePolicyDto, operator: string) {
    const existing = await this.qualificationRepo.findServicePolicyById(tenantId, id);
    BusinessException.throwIfNull(existing, '服务策略不存在');
    const row = await this.qualificationRepo.updateServicePolicy(tenantId, id, dto, operator);
    return Result.ok(this.toServicePolicyVo(row), '服务策略已更新');
  }

  async listRules(tenantId: string, query: ListQualificationRuleDto) {
    const { rows, total } = await this.qualificationRepo.listRules(tenantId, query);
    return Result.page(
      rows.map((row) => this.toRuleVo(row)),
      total,
      query.pageNum,
      query.pageSize,
    );
  }

  async createRule(tenantId: string, dto: UpsertQualificationRuleDto, operator: string) {
    const row = await this.qualificationRepo.upsertRule(tenantId, dto, operator);
    return Result.ok(this.toRuleVo(row), '资格规则已保存');
  }

  async updateRule(tenantId: string, id: number, dto: UpsertQualificationRuleDto, operator: string) {
    const existing = await this.qualificationRepo.findRuleById(tenantId, id);
    BusinessException.throwIfNull(existing, '资格规则不存在');
    const row = await this.qualificationRepo.updateRule(tenantId, id, dto, operator);
    return Result.ok(this.toRuleVo(row), '资格规则已更新');
  }

  async listEvidence(tenantId: string, query: ListEvidenceDto) {
    const { rows, total } = await this.qualificationRepo.listEvidence(tenantId, query);
    return Result.page(
      rows.map((row) => this.toEvidenceVo(row)),
      total,
      query.pageNum,
      query.pageSize,
    );
  }

  async listMyEvidence(tenantId: string, memberId: string, query: ListMyEvidenceDto) {
    const { rows, total } = await this.qualificationRepo.listEvidence(tenantId, query, memberId);
    return Result.page(
      rows.map((row) => this.toEvidenceVo(row)),
      total,
      query.pageNum,
      query.pageSize,
    );
  }

  async getLatestApplication(tenantId: string, memberId: string) {
    const application = await this.qualificationRepo.findLatestApplication(tenantId, memberId);
    return Result.ok(application ? this.toApplicationVo(application) : null);
  }

  @Transactional()
  async submitApplication(tenantId: string, memberId: string, dto: SubmitQualificationApplicationDto) {
    const evidenceIds = [...new Set(dto.evidenceIds)];
    const member = await this.qualificationRepo.findMemberBasic(tenantId, memberId);
    BusinessException.throwIfNull(member, '会员不存在');

    const activeProfile = await this.qualificationRepo.findActiveProfile(tenantId, memberId);
    BusinessException.throwIf(
      !!activeProfile && activeProfile.levelId >= dto.targetLevelId,
      '当前分销资格已满足目标等级，无需重复申请',
    );

    const pendingApplication = await this.qualificationRepo.findPendingApplication(tenantId, memberId);
    BusinessException.throwIf(!!pendingApplication, '已有待审核申请，请勿重复提交');

    const rule = await this.qualificationRepo.findActiveRuleByLevel(tenantId, dto.targetLevelId);
    const evidence = await this.qualificationRepo.findEvidenceByIds(tenantId, memberId, evidenceIds);
    await this.assertEvidenceMatchesRule(tenantId, memberId, evidenceIds, evidence, rule);
    this.assertMemberMatchesRule(member, rule);

    const application = await this.qualificationRepo.createApplication({
      tenantId,
      memberId,
      targetLevelId: dto.targetLevelId,
      evidenceIds,
      applyReason: dto.applyReason,
    });

    const usedResult = await this.qualificationRepo.markEvidenceUsed(tenantId, memberId, evidenceIds, application.id);
    BusinessException.throwIf(usedResult.count !== evidenceIds.length, '部分资格材料已被占用，请刷新后重试');

    return Result.ok(this.toApplicationVo(application), '资格申请已提交');
  }

  async listApplications(tenantId: string, query: ListQualificationApplicationDto) {
    const { rows, total } = await this.qualificationRepo.listApplications(tenantId, query);
    return Result.page(
      rows.map((row) => this.toApplicationVo(row)),
      total,
      query.pageNum,
      query.pageSize,
    );
  }

  @Transactional()
  async reviewApplication(
    tenantId: string,
    applicationId: string,
    dto: ReviewQualificationApplicationDto,
    reviewerId: string,
  ) {
    const application = await this.qualificationRepo.findApplication(tenantId, applicationId);
    BusinessException.throwIfNull(application, '资格申请不存在');
    BusinessException.throwIf(
      application.status !== DistQualificationApplicationStatus.PENDING_REVIEW,
      '当前申请状态不可审核',
    );

    if (dto.result === QualificationReviewResult.REJECTED) {
      const rejected = await this.qualificationRepo.updateApplication({
        tenantId,
        applicationId,
        data: {
          status: DistQualificationApplicationStatus.REJECTED,
          reviewerId,
          reviewTime: new Date(),
          reviewRemark: dto.remark,
        },
      });
      await this.qualificationRepo.restoreApplicationEvidence(tenantId, application.id);
      return Result.ok(this.toApplicationVo(rejected), '资格申请已驳回');
    }

    const approvedAt = new Date();
    const relationTarget = await this.resolveRelationTarget(tenantId, application);
    const profile = await this.qualificationRepo.upsertProfileForApproval({
      tenantId,
      memberId: application.memberId,
      targetLevelId: application.targetLevelId,
      applicationId: application.id,
      qualifiedAt: approvedAt,
    });

    await this.qualificationRepo.upsertRelationForApproval({
      tenantId,
      distributorMemberId: application.memberId,
      teamOwnerMemberId: relationTarget.teamOwnerMemberId,
      inviterMemberId: relationTarget.inviterMemberId,
      applicationId: application.id,
      operator: reviewerId,
    });
    await this.qualificationRepo.updateMemberLevelProjection(tenantId, application.memberId, application.targetLevelId);
    await this.qualificationRepo.activatePendingRewardsForProfile(tenantId, application.memberId, profile.id);

    const approved = await this.qualificationRepo.updateApplication({
      tenantId,
      applicationId,
      data: {
        status: DistQualificationApplicationStatus.APPROVED,
        reviewerId,
        reviewTime: approvedAt,
        reviewRemark: dto.remark,
        approvedProfileId: profile.id,
      },
    });

    this.logger.log(
      `[DistributionQualification] approved member=${application.memberId}, level=${application.targetLevelId}, profile=${profile.id}`,
    );
    return Result.ok(this.toApplicationVo(approved), '资格申请已通过');
  }

  async listProfiles(tenantId: string, query: ListDistributorProfileDto) {
    const { rows, total } = await this.qualificationRepo.listProfiles(tenantId, query);
    return Result.page(
      rows.map((row) => this.toProfileVo(row)),
      total,
      query.pageNum,
      query.pageSize,
    );
  }

  @Transactional()
  async freezeProfile(tenantId: string, profileId: string, dto: UpdateProfileStatusDto, operator: string) {
    const profile = await this.qualificationRepo.findProfileById(tenantId, profileId);
    BusinessException.throwIfNull(profile, '分销资格档案不存在');
    const updated = await this.qualificationRepo.updateProfileStatus({
      tenantId,
      profileId,
      status: DistDistributorProfileStatus.FROZEN,
      reason: dto.reason,
    });
    await this.qualificationRepo.updateRelationStatusByDistributor({
      tenantId,
      distributorMemberId: profile.memberId,
      status: DistRelationStatus.FROZEN,
      reason: dto.reason ?? '后台冻结资格',
      operator,
    });
    await this.qualificationRepo.disableActiveShareTokensForDistributor({
      tenantId,
      shareUserId: profile.memberId,
      operator,
      reason: dto.reason ?? '分销资格冻结，分享凭证已禁用',
    });
    return Result.ok(this.toProfileVo(updated), '分销资格已冻结');
  }

  @Transactional()
  async revokeProfile(tenantId: string, profileId: string, dto: UpdateProfileStatusDto, operator: string) {
    const profile = await this.qualificationRepo.findProfileById(tenantId, profileId);
    BusinessException.throwIfNull(profile, '分销资格档案不存在');
    const updated = await this.qualificationRepo.updateProfileStatus({
      tenantId,
      profileId,
      status: DistDistributorProfileStatus.REVOKED,
      reason: dto.reason,
    });
    await this.qualificationRepo.updateRelationStatusByDistributor({
      tenantId,
      distributorMemberId: profile.memberId,
      status: DistRelationStatus.CANCELLED,
      reason: dto.reason ?? '后台撤销资格',
      operator,
    });
    await this.qualificationRepo.disableActiveShareTokensForDistributor({
      tenantId,
      shareUserId: profile.memberId,
      operator,
      reason: dto.reason ?? '分销资格撤销，分享凭证已禁用',
    });
    await this.qualificationRepo.updateMemberLevelProjection(tenantId, profile.memberId, 0);
    return Result.ok(this.toProfileVo(updated), '分销资格已撤销');
  }

  async listRelations(tenantId: string, query: ListDistributionRelationDto) {
    const { rows, total } = await this.qualificationRepo.listRelations(tenantId, query);
    return Result.page(
      rows.map((row) => this.toRelationVo(row)),
      total,
      query.pageNum,
      query.pageSize,
    );
  }

  async listPendingRewards(tenantId: string, query: ListPendingRewardDto) {
    const { rows, total } = await this.qualificationRepo.listPendingRewards(tenantId, query);
    return Result.page(
      rows.map((row) => this.toPendingRewardVo(row)),
      total,
      query.pageNum,
      query.pageSize,
    );
  }

  async listMyPendingRewards(tenantId: string, memberId: string, query: ListPendingRewardDto) {
    const { rows, total } = await this.qualificationRepo.listPendingRewards(tenantId, query, memberId);
    return Result.page(
      rows.map((row) => this.toPendingRewardVo(row)),
      total,
      query.pageNum,
      query.pageSize,
    );
  }

  private buildPolicyTargetMap(policies: SysDistServicePolicy[]) {
    const policyByTarget = new Map<string, SysDistServicePolicy>();
    for (const policy of policies) {
      policyByTarget.set(this.policyTargetKey(policy.targetType, policy.targetId), policy);
    }
    return policyByTarget;
  }

  private findPolicyForItem(
    item: ServiceEvidenceOrderItem,
    categoryMap: Map<string, number>,
    policyByTarget: Map<string, SysDistServicePolicy>,
  ) {
    const skuPolicy = policyByTarget.get(this.policyTargetKey(DistServicePolicyTargetType.SKU, item.skuId));
    if (skuPolicy) return skuPolicy;

    const productPolicy = policyByTarget.get(this.policyTargetKey(DistServicePolicyTargetType.PRODUCT, item.productId));
    if (productPolicy) return productPolicy;

    const categoryId = categoryMap.get(item.productId);
    if (!categoryId) return null;
    return policyByTarget.get(this.policyTargetKey(DistServicePolicyTargetType.CATEGORY, String(categoryId))) ?? null;
  }

  private policyTargetKey(targetType: DistServicePolicyTargetType, targetId: string) {
    return `${targetType}:${targetId}`;
  }

  private async assertEvidenceMatchesRule(
    tenantId: string,
    memberId: string,
    evidenceIds: string[],
    evidence: SysDistQualificationEvidence[],
    rule: SysDistQualificationRule | null,
  ) {
    BusinessException.throwIf(evidence.length !== evidenceIds.length, '资格材料不存在或不属于当前会员');
    BusinessException.throwIf(
      evidence.some((item) => item.evidenceStatus !== 'ELIGIBLE'),
      '仅可选择已完成且未使用的资格材料',
    );

    const requiredCount = rule?.requiredEvidenceCount ?? 1;
    BusinessException.throwIf(evidence.length < requiredCount, `至少需要 ${requiredCount} 个可用资格材料`);

    const requiredPolicyIds = this.parseRequiredPolicyIds(rule?.requiredServicePolicyIds);
    if (requiredPolicyIds.length > 0) {
      const matchedCount = evidence.filter(
        (item) => item.servicePolicyId && requiredPolicyIds.includes(item.servicePolicyId),
      ).length;
      BusinessException.throwIf(matchedCount < requiredCount, '所选资格材料不满足服务策略要求');
    }

    const minOrderAmount = Number(rule?.minOrderAmount ?? 0);
    if (minOrderAmount > 0) {
      const orderAmount = await this.qualificationRepo.sumEvidenceOrderPayAmount(
        tenantId,
        memberId,
        evidence.map((item) => item.orderId),
      );
      BusinessException.throwIf(orderAmount.lt(minOrderAmount), `资格服务订单金额需达到 ${minOrderAmount} 元`);
    }
  }

  private assertMemberMatchesRule(member: { createTime: Date }, rule: SysDistQualificationRule | null) {
    if (!rule) return;

    if (rule.minRegisterDays > 0) {
      const registerDays = Math.floor((Date.now() - member.createTime.getTime()) / (1000 * 60 * 60 * 24));
      BusinessException.throwIf(registerDays < rule.minRegisterDays, `注册满 ${rule.minRegisterDays} 天后才可申请`);
    }

    BusinessException.throwIf(rule.requireRealName, '当前会员实名信息不可验证，请关闭实名要求或补充实名数据');
  }

  private async resolveRelationTarget(tenantId: string, application: SysDistQualificationApplication) {
    const evidenceIds = this.parseEvidenceIds(application.evidenceIds);
    const evidence = await this.qualificationRepo.findEvidenceByIds(tenantId, application.memberId, evidenceIds);
    const inviterMemberId = evidence
      .map((item) => item.sourceShareUserId)
      .find(
        (sourceShareUserId): sourceShareUserId is string =>
          !!sourceShareUserId && sourceShareUserId !== application.memberId,
      );

    if (!inviterMemberId) {
      return { inviterMemberId: null, teamOwnerMemberId: null };
    }

    const inviterProfile = await this.qualificationRepo.findActiveProfile(tenantId, inviterMemberId);
    if (!inviterProfile || !inviterProfile.canBindRelation) {
      return { inviterMemberId: null, teamOwnerMemberId: null };
    }

    if (application.targetLevelId >= 2) {
      return { inviterMemberId, teamOwnerMemberId: null };
    }

    if (inviterProfile.levelId >= 2) {
      return { inviterMemberId, teamOwnerMemberId: inviterMemberId };
    }

    const inviterRelation = await this.qualificationRepo.findActiveRelation(tenantId, inviterMemberId);
    return {
      inviterMemberId,
      teamOwnerMemberId: inviterRelation?.teamOwnerMemberId ?? null,
    };
  }

  private parseRequiredPolicyIds(value: Prisma.JsonValue | null | undefined): number[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => Number(item)).filter((item) => Number.isInteger(item));
  }

  private parseEvidenceIds(value: Prisma.JsonValue | null | undefined): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item)).filter(Boolean);
  }

  private toServicePolicyVo(row: SysDistServicePolicy): QualificationServicePolicyVo {
    return {
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      commissionEligible: row.commissionEligible,
      qualificationEligible: row.qualificationEligible,
      allowLv0Share: row.allowLv0Share,
      lv0RewardMode: row.lv0RewardMode,
      requireRiskConfirm: row.requireRiskConfirm,
      riskConfirmedAt: row.riskConfirmedAt?.toISOString(),
      riskConfirmedBy: row.riskConfirmedBy ?? undefined,
      isActive: row.isActive,
      createTime: row.createTime.toISOString(),
      updateTime: row.updateTime.toISOString(),
    };
  }

  private toRuleVo(row: SysDistQualificationRule): QualificationRuleVo {
    return {
      id: row.id,
      targetLevelId: row.targetLevelId,
      requiredEvidenceCount: row.requiredEvidenceCount,
      requiredServicePolicyIds: this.parseRequiredPolicyIds(row.requiredServicePolicyIds),
      requireManualReview: row.requireManualReview,
      minOrderAmount: Number(row.minOrderAmount),
      minRegisterDays: row.minRegisterDays,
      requireRealName: row.requireRealName,
      isActive: row.isActive,
      createTime: row.createTime.toISOString(),
      updateTime: row.updateTime.toISOString(),
    };
  }

  private toEvidenceVo(row: SysDistQualificationEvidence): QualificationEvidenceVo {
    return {
      id: row.id,
      memberId: row.memberId,
      orderId: row.orderId,
      orderItemId: row.orderItemId ?? undefined,
      productId: row.productId ?? undefined,
      skuId: row.skuId ?? undefined,
      servicePolicyId: row.servicePolicyId ?? undefined,
      sourceShareUserId: row.sourceShareUserId ?? undefined,
      evidenceStatus: row.evidenceStatus,
      verifiedAt: row.verifiedAt?.toISOString(),
      usedApplicationId: row.usedApplicationId ?? undefined,
      invalidReason: row.invalidReason ?? undefined,
      createTime: row.createTime.toISOString(),
    };
  }

  private toApplicationVo(row: SysDistQualificationApplication): QualificationApplicationVo {
    return {
      id: row.id,
      memberId: row.memberId,
      targetLevelId: row.targetLevelId,
      evidenceIds: this.parseEvidenceIds(row.evidenceIds),
      status: row.status,
      reviewerId: row.reviewerId ?? undefined,
      reviewTime: row.reviewTime?.toISOString(),
      reviewRemark: row.reviewRemark ?? undefined,
      approvedProfileId: row.approvedProfileId ?? undefined,
      applyReason: row.applyReason ?? undefined,
      createTime: row.createTime.toISOString(),
    };
  }

  private toProfileVo(row: SysDistDistributorProfile): DistributorProfileVo {
    return {
      id: row.id,
      memberId: row.memberId,
      status: row.status,
      levelId: row.levelId,
      qualifiedAt: row.qualifiedAt.toISOString(),
      sourceApplicationId: row.sourceApplicationId ?? undefined,
      canWithdraw: row.canWithdraw,
      canBindRelation: row.canBindRelation,
      canEarnL2: row.canEarnL2,
      frozenReason: row.frozenReason ?? undefined,
      revokedReason: row.revokedReason ?? undefined,
      createTime: row.createTime.toISOString(),
    };
  }

  private toRelationVo(row: {
    id: string;
    distributorMemberId: string;
    teamOwnerMemberId: string | null;
    inviterMemberId: string | null;
    sourceApplicationId: string | null;
    status: string;
    effectiveAt: Date;
  }): DistributionRelationVo {
    return {
      id: row.id,
      distributorMemberId: row.distributorMemberId,
      teamOwnerMemberId: row.teamOwnerMemberId ?? undefined,
      inviterMemberId: row.inviterMemberId ?? undefined,
      sourceApplicationId: row.sourceApplicationId ?? undefined,
      status: row.status,
      effectiveAt: row.effectiveAt.toISOString(),
    };
  }

  private toPendingRewardVo(row: {
    id: string;
    memberId: string;
    orderId: string;
    orderItemId: number | null;
    amount: Prisma.Decimal;
    status: DistPendingRewardStatus;
    releaseProfileId: string | null;
    voidReason: string | null;
    createTime: Date;
  }): PendingRewardVo {
    return {
      id: row.id,
      memberId: row.memberId,
      orderId: row.orderId,
      orderItemId: row.orderItemId ?? undefined,
      amount: Number(row.amount),
      status: row.status,
      releaseProfileId: row.releaseProfileId ?? undefined,
      voidReason: row.voidReason ?? undefined,
      createTime: row.createTime.toISOString(),
    };
  }
}
