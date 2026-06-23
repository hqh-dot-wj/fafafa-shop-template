import { Injectable, Logger } from '@nestjs/common';
import { DelFlag, MktCampaign, MktCampaignStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { Result } from 'src/common/response/result';
import { getErrorMessage } from 'src/common/utils/error';
import { PrismaService } from 'src/prisma/prisma.service';
import { resolveCampaignKind } from '../common/campaign-type';
import { MarketingLifecyclePolicyService } from '../protocol/lifecycle-policy.service';
import { PlayDispatcher } from '../play/play.dispatcher';
import { resolveMarketingActivityStatus } from './activity-status';
import { ActivityRepository } from './activity.repository';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { DistributionGrowthDto, DISTRIBUTION_GROWTH_SHARE_CHANNEL_VALUES } from './dto/distribution-growth.dto';
import { ListTouchpointDto } from './dto/list-touchpoint.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { UpsertTouchpointDto } from './dto/upsert-touchpoint.dto';
import { NEWCOMER_EXCLUSIVE_TYPE } from './handlers/newcomer.handler';
import { TouchpointService } from './touchpoint.service';
import { DistributionGrowthVo } from './vo/distribution-growth.vo';
import { TouchpointVo } from './vo/touchpoint.vo';

/**
 * 营销活动统一服务
 *
 * @description
 * 管理配置型营销活动的 CRUD、触发判定、奖励发放和价格覆盖。
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly repo: ActivityRepository,
    private readonly touchpointService: TouchpointService,
    private readonly playDispatcher: PlayDispatcher,
    private readonly prisma: PrismaService,
    private readonly lifecyclePolicy: MarketingLifecyclePolicyService,
  ) {}

  async create(dto: CreateActivityDto, operatorId: string) {
    const rules = this.mergeDistributionGrowthRules(dto.rules, dto.distributionGrowth);
    await this.validateActivityConfig(dto.type, dto.triggerCondition, rules, dto.rewards);

    const activity = await this.repo.create({
      type: dto.type,
      name: dto.name,
      description: dto.description,
      triggerCondition: dto.triggerCondition as Prisma.InputJsonValue,
      rules: rules as Prisma.InputJsonValue,
      rewards: dto.rewards as Prisma.InputJsonValue,
      startTime: dto.startTime,
      endTime: dto.endTime,
      isEnabled: dto.isEnabled ?? true,
      createdBy: operatorId,
    });

    return Result.ok(this.toActivityView(activity), '活动创建成功');
  }

  async update(id: string, dto: UpdateActivityDto, operatorId: string) {
    const existing = await this.repo.findById(id);
    BusinessException.throwIfNull(existing, '活动不存在');

    const currentTriggerCondition = this.asRecord(existing!.audienceJson) ?? {};
    const currentRules = this.asRecord(existing!.stagesJson) ?? {};
    const currentRewards = this.asRecord(existing!.rightsJson) ?? {};
    const nextTriggerCondition = dto.triggerCondition ?? currentTriggerCondition;
    const nextRules = this.mergeDistributionGrowthRules(dto.rules ?? currentRules, dto.distributionGrowth);
    const nextRewards = dto.rewards ?? currentRewards;

    if (dto.triggerCondition || dto.rules || dto.rewards || dto.distributionGrowth) {
      await this.validateActivityConfig(existing!.type, nextTriggerCondition, nextRules, nextRewards);
    }

    const { triggerCondition, rules, rewards, distributionGrowth, ...rest } = dto;
    const updateRules = this.mergeDistributionGrowthRules(rules ?? currentRules, distributionGrowth);
    const activity = await this.repo.update(id, {
      ...rest,
      ...(triggerCondition !== undefined && { triggerCondition: triggerCondition as Prisma.InputJsonValue }),
      ...((rules !== undefined || distributionGrowth !== undefined) && { rules: updateRules as Prisma.InputJsonValue }),
      ...(rewards !== undefined && { rewards: rewards as Prisma.InputJsonValue }),
      updatedBy: operatorId,
    });

    return Result.ok(this.toActivityView(activity), '活动更新成功');
  }

  async findAll(query: ActivityQueryDto) {
    const { rows, total } = await this.repo.findPage({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      type: query.type,
      isEnabled: query.isEnabled,
    });

    if (rows.length === 0) {
      return Result.page(rows, total, query.pageNum, query.pageSize);
    }

    const tenantIds = [...new Set(rows.map((row) => row.tenantId))];
    const tenants = await this.prisma.sysTenant.findMany({
      where: { tenantId: { in: tenantIds }, delFlag: DelFlag.NORMAL },
      select: { tenantId: true, companyName: true },
    });
    const tenantNameById = new Map(tenants.map((tenant) => [tenant.tenantId, tenant.companyName]));

    const enriched = rows.map((row) => this.toActivityView(row, tenantNameById.get(row.tenantId) ?? undefined));

    return Result.page(enriched, total, query.pageNum, query.pageSize);
  }

  async findOne(id: string) {
    const activity = await this.repo.findById(id);
    BusinessException.throwIfNull(activity, '活动不存在');

    const tenant = await this.prisma.sysTenant.findFirst({
      where: { tenantId: activity.tenantId, delFlag: DelFlag.NORMAL },
      select: { companyName: true },
    });
    const touchpoints = await this.touchpointService.findByActivityId(id);

    return Result.ok(this.toActivityView(activity, tenant?.companyName ?? undefined, touchpoints));
  }

  async listTouchpoints(activityId: string, query: ListTouchpointDto) {
    return this.touchpointService.list(activityId, query);
  }

  async upsertTouchpoint(activityId: string, dto: UpsertTouchpointDto, operatorId: string) {
    return this.touchpointService.upsert(activityId, dto, operatorId);
  }

  async toggle(id: string, operatorId: string) {
    const activity = await this.repo.findById(id);
    BusinessException.throwIfNull(activity, '活动不存在');

    const updated = await this.repo.update(id, {
      isEnabled: activity!.status !== MktCampaignStatus.PUBLISHED,
      updatedBy: operatorId,
    });

    const enabled = updated.status === MktCampaignStatus.PUBLISHED;
    return Result.ok(this.toActivityView(updated), enabled ? '活动已启用' : '活动已停用');
  }

  async setEnabled(id: string, enabled: boolean, operatorId: string) {
    const activity = await this.repo.findById(id);
    BusinessException.throwIfNull(activity, '活动不存在');

    const updated = await this.repo.update(id, {
      isEnabled: enabled,
      updatedBy: operatorId,
    });

    return Result.ok(this.toActivityView(updated), enabled ? '活动已发布' : '活动已暂停');
  }

  async publish(id: string, operatorId: string) {
    return this.setEnabled(id, true, operatorId);
  }

  async pause(id: string, operatorId: string) {
    return this.setEnabled(id, false, operatorId);
  }

  async archive(id: string, operatorId: string) {
    const activity = await this.repo.findById(id);
    BusinessException.throwIfNull(activity, '活动不存在');

    const updated = await this.repo.update(id, {
      isEnabled: false,
      endTime: new Date(),
      updatedBy: operatorId,
    });

    return Result.ok(this.toActivityView(updated), '活动已归档');
  }

  async remove(id: string) {
    const activity = await this.repo.findById(id);
    BusinessException.throwIfNull(activity, '活动不存在');

    const participationCount = await this.repo.countParticipations(id);
    const decision = this.lifecyclePolicy.decideDelete({
      approvalStatus: this.getActivityApprovalStatus(activity.stagesJson),
      hasExternalRefs: this.hasBoundActivityItems(activity.stagesJson),
      participationCount,
    });
    BusinessException.throwIf(decision.action !== 'ALLOW_DELETE', decision.reason);

    try {
      await this.repo.deleteById(id);
      return Result.ok(null, '活动已删除');
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        BusinessException.throwIf(true, '活动存在关联数据，当前不支持硬删除，请先归档活动');
      }
      throw error;
    }
  }

  async onPhoneBound(memberId: string): Promise<void> {
    try {
      await this.doTriggerActivity(NEWCOMER_EXCLUSIVE_TYPE, memberId);
    } catch (error) {
      this.logger.error({
        message: '新人礼包发放异常',
        memberId,
        error: getErrorMessage(error),
      });
    }
  }

  async getNewcomerPrice(memberId: string, skuId: string): Promise<Decimal | null> {
    const activity = await this.repo.findEnabledByType(NEWCOMER_EXCLUSIVE_TYPE);
    if (!activity) return null;

    const participation = await this.repo.findParticipation(activity.id, memberId);
    if (!participation) return null;

    const handler = this.playDispatcher.resolve(activity);
    return handler.resolvePrice({ campaign: activity, memberId, skuId });
  }

  async checkNewcomerStatus(memberId: string) {
    const activity = await this.repo.findEnabledByType(NEWCOMER_EXCLUSIVE_TYPE);

    if (!activity) {
      return Result.ok({
        isNewcomer: false,
        hasClaimed: false,
        activityEnabled: false,
      });
    }

    const participation = await this.repo.findParticipation(activity.id, memberId);

    return Result.ok({
      isNewcomer: !participation,
      hasClaimed: !!participation,
      activityEnabled: true,
    });
  }

  async claimNewcomerRewards(memberId: string) {
    await this.doTriggerActivity(NEWCOMER_EXCLUSIVE_TYPE, memberId);
    return Result.ok(null, '新人礼包领取成功');
  }

  async getNewcomerStatistics() {
    const activity = await this.repo.findEnabledByType(NEWCOMER_EXCLUSIVE_TYPE);
    if (!activity) {
      return Result.ok({ activityId: null, totalParticipants: 0, isEnabled: false });
    }

    const totalParticipants = await this.repo.countParticipations(activity.id);
    return Result.ok({
      activityId: activity.id,
      totalParticipants,
      isEnabled: activity.status === MktCampaignStatus.PUBLISHED,
    });
  }

  @Transactional()
  private async doTriggerActivity(type: string, memberId: string): Promise<void> {
    const activity = await this.repo.findEnabledByType(type);
    if (!activity) return;

    const handler = this.playDispatcher.resolve(activity);
    const eligible = await handler.checkEligibility({ campaign: activity, memberId });
    if (!eligible) return;

    await this.repo.createParticipation({
      tenantId: activity.tenantId,
      campaign: { connect: { id: activity.id } },
      memberId,
      rewardsSnapshot: activity.rightsJson,
    });

    await handler.applyRewards({ campaign: activity, memberId });
  }

  private toActivityView(activity: MktCampaign, tenantName?: string, touchpoints?: TouchpointVo[]) {
    const isEnabled = activity.status === MktCampaignStatus.PUBLISHED;
    const triggerCondition = this.asRecord(activity.audienceJson) ?? {};
    const rules = this.asRecord(activity.stagesJson) ?? {};
    const rewards = this.asRecord(activity.rightsJson) ?? {};
    return {
      ...activity,
      tenantName,
      touchpoints: touchpoints ?? [],
      triggerCondition,
      rules,
      rewards,
      isEnabled,
      distributionGrowth: this.readDistributionGrowth(rules),
      status:
        activity.status === MktCampaignStatus.ARCHIVED
          ? 'ARCHIVED'
          : resolveMarketingActivityStatus({
              startTime: activity.startTime,
              endTime: activity.endTime,
              isEnabled,
            }),
    };
  }

  private mergeDistributionGrowthRules(
    rules: unknown,
    distributionGrowth?: DistributionGrowthDto,
  ): Record<string, unknown> {
    const normalizedRules = this.asRecord(rules) ?? {};
    if (distributionGrowth === undefined) {
      return normalizedRules;
    }

    return {
      ...normalizedRules,
      distributionGrowth: this.normalizeDistributionGrowth(distributionGrowth),
    };
  }

  private normalizeDistributionGrowth(distributionGrowth: DistributionGrowthDto): DistributionGrowthVo {
    return {
      activityVersionId: distributionGrowth.activityVersionId,
      shareChannel: distributionGrowth.shareChannel,
      shareLandingPage: distributionGrowth.shareLandingPage,
      referralCodeEnabled: distributionGrowth.referralCodeEnabled,
      attributionWindowMinutes: distributionGrowth.attributionWindowMinutes,
      commissionBudgetTotal: distributionGrowth.commissionBudgetTotal,
      commissionBudgetAlertThreshold: distributionGrowth.commissionBudgetAlertThreshold,
      commissionBudgetFuseThreshold: distributionGrowth.commissionBudgetFuseThreshold,
      upgradeRule: distributionGrowth.upgradeRule,
      teamThresholdRule: distributionGrowth.teamThresholdRule,
    };
  }

  private readDistributionGrowth(rules: unknown): DistributionGrowthVo | null {
    const root = this.asRecord(rules);
    const distributionGrowth = this.asRecord(root?.distributionGrowth);
    if (!distributionGrowth) {
      return null;
    }

    const activityVersionId = this.asString(distributionGrowth.activityVersionId);
    const shareChannel = this.asString(distributionGrowth.shareChannel);
    const shareLandingPage = this.asString(distributionGrowth.shareLandingPage);
    const referralCodeEnabled = this.asBoolean(distributionGrowth.referralCodeEnabled);
    const attributionWindowMinutes = this.asNumber(distributionGrowth.attributionWindowMinutes);
    const commissionBudgetTotal = this.asNumber(distributionGrowth.commissionBudgetTotal);
    const commissionBudgetAlertThreshold = this.asNumber(distributionGrowth.commissionBudgetAlertThreshold);
    const commissionBudgetFuseThreshold = this.asNumber(distributionGrowth.commissionBudgetFuseThreshold);
    const upgradeRule = this.asRecord(distributionGrowth.upgradeRule);
    const teamThresholdRule = this.asRecord(distributionGrowth.teamThresholdRule);

    if (
      !activityVersionId ||
      !shareChannel ||
      !DISTRIBUTION_GROWTH_SHARE_CHANNEL_VALUES.includes(shareChannel as never) ||
      !shareLandingPage ||
      referralCodeEnabled === null ||
      attributionWindowMinutes === null ||
      commissionBudgetTotal === null ||
      commissionBudgetAlertThreshold === null ||
      commissionBudgetFuseThreshold === null ||
      !upgradeRule ||
      !teamThresholdRule
    ) {
      return null;
    }

    return {
      activityVersionId,
      shareChannel: shareChannel as DistributionGrowthVo['shareChannel'],
      shareLandingPage,
      referralCodeEnabled,
      attributionWindowMinutes,
      commissionBudgetTotal,
      commissionBudgetAlertThreshold,
      commissionBudgetFuseThreshold,
      upgradeRule,
      teamThresholdRule,
    };
  }

  private getActivityApprovalStatus(rules: unknown): 'DRAFT' | 'PENDING' | 'APPROVED' | 'PUBLISHED' {
    const root = this.asRecord(rules);
    const approval = this.asRecord(root?.approval);
    const status = this.asString(approval?.status);
    const normalizedStatus = status ? status.toUpperCase() : 'DRAFT';

    if (normalizedStatus === 'PENDING' || normalizedStatus === 'APPROVED' || normalizedStatus === 'PUBLISHED') {
      return normalizedStatus;
    }

    return 'DRAFT';
  }

  private hasBoundActivityItems(rules: unknown): boolean {
    const root = this.asRecord(rules);
    return this.hasNonEmptyArray(root?.activityItems);
  }

  private hasNonEmptyArray(value: unknown): boolean {
    return Array.isArray(value) && value.length > 0;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  private asString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private asBoolean(value: unknown): boolean | null {
    if (typeof value !== 'boolean') return null;
    return value;
  }

  private asNumber(value: unknown): number | null {
    if (typeof value !== 'number') return null;
    return Number.isFinite(value) ? value : null;
  }

  private async validateActivityConfig(
    type: string,
    triggerCondition: unknown,
    rules: unknown,
    rewards: unknown,
  ): Promise<void> {
    const handler = this.playDispatcher.resolve({
      type,
      kind: resolveCampaignKind(type),
      audienceJson: triggerCondition,
      stagesJson: rules,
      rightsJson: rewards,
      policyJson: { type, audience: triggerCondition, stages: rules, rights: rewards },
    });
    await handler.validateConfig({
      type,
      kind: resolveCampaignKind(type),
      audienceJson: triggerCondition,
      stagesJson: rules,
      rightsJson: rewards,
      policyJson: { type, audience: triggerCondition, stages: rules, rights: rewards },
    });
  }
}
