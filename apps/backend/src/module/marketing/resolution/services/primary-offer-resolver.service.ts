import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserMarketingContext } from '../dto/user-marketing-context.dto';
import { ProductCandidate } from './scene-candidate-loader.service';
import { ActivityContextTokenService } from './activity-context-token.service';
import { OfferEligibilityService } from './offer-eligibility.service';
import { SecondaryBenefitMergerService } from './secondary-benefit-merger.service';
import { CourseGroupSceneExplainService } from './course-group-scene-explain.service';

export interface ResolvedProduct extends ProductCandidate {
  primaryOffer?: Record<string, unknown>;
  secondaryOffers?: Record<string, unknown>[];
}

@Injectable()
export class PrimaryOfferResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: ActivityContextTokenService,
    private readonly offerEligibility: OfferEligibilityService,
    private readonly secondaryBenefitMerger: SecondaryBenefitMergerService,
    private readonly courseGroupSceneExplain: CourseGroupSceneExplainService,
  ) {}

  /**
   * 根据 RESOLVER 策略为商品裁决主活动，并生成次级权益候选。
   * 裁决顺序：
   * 1) primaryOfferTypes 顺序（若配置）
   * 2) 租户活动优先级规则
   * 3) 活动 displayPriority
   */
  async resolveProducts(
    candidates: ProductCandidate[],
    resolverPolicyCode: string,
    ctx: UserMarketingContext,
  ): Promise<ResolvedProduct[]> {
    const resolverPolicy = await this.loadResolverPolicy(ctx.tenantId, resolverPolicyCode);
    const primaryOfferTypes = this.extractPrimaryOfferTypes(resolverPolicy);
    const conflictMatrix = this.extractConflictMatrix(resolverPolicy);
    const priorityMap = await this.loadPriorityMap(ctx.tenantId);

    const resolved = candidates.map((candidate): ResolvedProduct => {
      const activityCandidates = Array.isArray(candidate.activityCandidates) ? candidate.activityCandidates : [];
      const eligibleActivities = activityCandidates.filter((activity) =>
        this.offerEligibility.check(
          { templateCode: activity.templateCode, status: activity.status, rules: activity.rules },
          ctx,
        ),
      );
      if (eligibleActivities.length === 0) {
        return { ...candidate, primaryOffer: undefined };
      }

      const selected = [...eligibleActivities].sort((a, b) =>
        this.compareActivity(a, b, primaryOfferTypes, priorityMap),
      )[0];
      const secondaryOffers = this.buildSecondaryOffers(
        eligibleActivities,
        selected,
        conflictMatrix,
        ctx,
        resolverPolicyCode,
      );

      return {
        ...candidate,
        primaryOffer: this.buildPrimaryOffer(selected, ctx, resolverPolicyCode),
        secondaryOffers,
      };
    });

    const explained = await this.courseGroupSceneExplain.attach(resolved, ctx);
    return this.secondaryBenefitMerger.merge(explained, ctx);
  }

  private async loadPriorityMap(tenantId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.mktActivityPriorityRule.findMany({
      where: { tenantId },
      select: { activityType: true, priority: true },
    });
    return new Map(rows.map((row) => [row.activityType, row.priority]));
  }

  private async loadResolverPolicy(tenantId: string, resolverPolicyCode: string): Promise<Record<string, unknown>> {
    const code = resolverPolicyCode?.trim();
    if (!code) return {};
    const policy = await this.prisma.mktPolicy.findUnique({
      where: {
        tenantId_policyCode: {
          tenantId,
          policyCode: code,
        },
      },
      select: {
        policyType: true,
        status: true,
        config: true,
      },
    });
    if (!policy || policy.policyType !== 'RESOLVER' || policy.status !== 'ACTIVE') {
      return {};
    }
    return this.toRecord(policy.config);
  }

  private extractPrimaryOfferTypes(policyConfig: Record<string, unknown>): string[] {
    const value = policyConfig.primaryOfferTypes;
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private extractConflictMatrix(policyConfig: Record<string, unknown>): Map<string, Set<string>> {
    const matrix = new Map<string, Set<string>>();
    const raw = this.toRecord(policyConfig.conflictMatrix);
    for (const [activityType, value] of Object.entries(raw)) {
      const denied = new Set<string>();
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && item.trim()) {
            denied.add(item.trim());
          }
        }
      } else if (value && typeof value === 'object') {
        const record = this.toRecord(value);
        if (Array.isArray(record.deniedWith)) {
          for (const item of record.deniedWith) {
            if (typeof item === 'string' && item.trim()) denied.add(item.trim());
          }
        }
        if (record.allowPrimary === false) {
          denied.add(activityType);
        }
      }
      matrix.set(activityType, denied);
    }
    return matrix;
  }

  private compareActivity(
    a: NonNullable<ProductCandidate['activityCandidates']>[number],
    b: NonNullable<ProductCandidate['activityCandidates']>[number],
    primaryOfferTypes: string[],
    priorityMap: Map<string, number>,
  ): number {
    const aPolicyRank = this.policyRank(a.templateCode, primaryOfferTypes);
    const bPolicyRank = this.policyRank(b.templateCode, primaryOfferTypes);
    if (aPolicyRank !== bPolicyRank) return aPolicyRank - bPolicyRank;

    const aPriority = priorityMap.get(a.templateCode) ?? 0;
    const bPriority = priorityMap.get(b.templateCode) ?? 0;
    if (bPriority !== aPriority) return bPriority - aPriority;

    if ((b.displayPriority ?? 0) !== (a.displayPriority ?? 0)) {
      return (b.displayPriority ?? 0) - (a.displayPriority ?? 0);
    }

    const aPrice = this.extractActivityPrice(a.rules);
    const bPrice = this.extractActivityPrice(b.rules);
    if (aPrice !== bPrice) return aPrice - bPrice;

    return a.configId.localeCompare(b.configId);
  }

  private policyRank(templateCode: string, primaryOfferTypes: string[]): number {
    const index = primaryOfferTypes.indexOf(templateCode);
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
  }

  private buildSecondaryOffers(
    eligibleActivities: NonNullable<ProductCandidate['activityCandidates']>,
    selected: NonNullable<ProductCandidate['activityCandidates']>[number],
    conflictMatrix: Map<string, Set<string>>,
    ctx: UserMarketingContext,
    resolverPolicyCode: string,
  ): Record<string, unknown>[] {
    const denied = conflictMatrix.get(selected.templateCode) ?? new Set<string>();
    return eligibleActivities
      .filter((activity) => activity.configId !== selected.configId)
      .filter((activity) => !denied.has(activity.templateCode))
      .slice(0, 3)
      .map((activity) => ({
        activityContextKey: this.issueActivityContextToken(activity, ctx, resolverPolicyCode),
        activityType: activity.templateCode,
        configId: activity.configId,
        activityName: this.extractActivityName(activity.rules, activity.templateCode),
        displayPrice: this.extractActivityPrice(activity.rules),
        originalPrice: this.extractOriginalPrice(activity.rules),
      }));
  }

  private buildPrimaryOffer(
    activity: NonNullable<ProductCandidate['activityCandidates']>[number],
    ctx: UserMarketingContext,
    resolverPolicyCode: string,
  ): Record<string, unknown> {
    const rules = activity.rules;
    const activityContextKey = this.issueActivityContextToken(activity, ctx, resolverPolicyCode);
    return {
      activityContextKey,
      activityType: activity.templateCode,
      configId: activity.configId,
      activityName: this.extractActivityName(rules, activity.templateCode),
      displayPrice: this.extractActivityPrice(rules),
      originalPrice: this.extractOriginalPrice(rules),
      tagLabel: this.extractActivityName(rules, activity.templateCode),
      statusSummary: activity.status,
      countdownEndTime: this.extractCountdownEndTime(rules),
      remainingSlots: this.extractRemainingSlots(rules),
      classAddress: this.extractRuleString(rules, 'classAddress'),
      classStartTime: this.extractRuleString(rules, 'classStartTime'),
    };
  }

  private extractRuleString(rules: Record<string, unknown>, key: string): string | null {
    const value = rules[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private issueActivityContextToken(
    activity: NonNullable<ProductCandidate['activityCandidates']>[number],
    ctx: UserMarketingContext,
    resolverPolicyCode: string,
  ): string {
    return this.tokenService.issue({
      tenantId: ctx.tenantId,
      memberId: ctx.memberId ?? null,
      activityType: activity.templateCode,
      activityConfigId: activity.configId,
      activityVersionId: this.extractDistributionGrowthString(activity.rules, 'activityVersionId'),
      attributionWindowMinutes: this.extractDistributionGrowthNumber(activity.rules, 'attributionWindowMinutes'),
      shareChannel: ctx.shareChannel ?? this.extractDistributionGrowthString(activity.rules, 'shareChannel'),
      entrySceneCode: ctx.entrySceneCode,
      entryModuleCode: ctx.entryModuleCode,
      cardTemplateCode: ctx.cardTemplateCode,
      resolverPolicyCode: resolverPolicyCode || ctx.resolverPolicyCode,
      resolverReleaseNo: ctx.resolverReleaseNo,
    });
  }

  private extractActivityName(rules: Record<string, unknown>, fallback: string): string {
    const name = rules.name ?? rules.activityName;
    return typeof name === 'string' && name.trim() ? name.trim() : fallback;
  }

  private extractActivityPrice(rules: Record<string, unknown>): number {
    for (const key of ['discountPrice', 'flashPrice', 'price', 'memberPrice', 'newcomerPrice'] as const) {
      const value = this.toNumber(rules[key]);
      if (value !== null) return value;
    }
    return 0;
  }

  private extractOriginalPrice(rules: Record<string, unknown>): number {
    for (const key of ['originalPrice', 'guidePrice', 'marketPrice'] as const) {
      const value = this.toNumber(rules[key]);
      if (value !== null) return value;
    }
    return this.extractActivityPrice(rules);
  }

  private extractCountdownEndTime(rules: Record<string, unknown>): string | null {
    const endTime = rules.endTime;
    if (typeof endTime !== 'string' || !endTime.trim()) return null;
    return endTime;
  }

  private extractRemainingSlots(rules: Record<string, unknown>): number | null {
    const value = this.toNumber(rules.remainingStock ?? rules.totalStock);
    return value;
  }

  private extractDistributionGrowthString(rules: Record<string, unknown>, key: string): string | null {
    const growth = this.toRecord(rules.distributionGrowth);
    const value = growth[key] ?? rules[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private extractDistributionGrowthNumber(rules: Record<string, unknown>, key: string): number | null {
    const growth = this.toRecord(rules.distributionGrowth);
    const value = growth[key] ?? rules[key];
    return this.toNumber(value);
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }
}
