import { Injectable } from '@nestjs/common';
import { MktCampaign } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { DISTRIBUTION_GROWTH_SHARE_CHANNEL_VALUES } from '../dto/distribution-growth.dto';
import { IPlayHandler, PlayContext, PlaySubject } from '../../play/play-handler.interface';

export const DISTRIBUTION_GROWTH_TYPE = 'DISTRIBUTION_GROWTH';

@Injectable()
export class DistributionGrowthHandler implements IPlayHandler {
  readonly code = DISTRIBUTION_GROWTH_TYPE;
  readonly type = DISTRIBUTION_GROWTH_TYPE;

  async checkEligibility(_ctx: PlayContext): Promise<boolean>;
  async checkEligibility(_activity: MktCampaign, _memberId: string): Promise<boolean>;
  async checkEligibility(_ctxOrActivity: PlayContext | MktCampaign, _memberId?: string): Promise<boolean> {
    // 分销成长由分销/升级链路驱动，不走通用活动参与资格判定
    return false;
  }

  async applyRewards(_ctx: PlayContext): Promise<void> {
    // 分销成长奖励由分销与佣金域处理，这里不直接发放
  }

  async grantRewards(_activity: MktCampaign, _memberId: string): Promise<void> {
    // 分销成长奖励由分销与佣金域处理，这里不直接发放
  }

  async resolvePrice(_ctx: PlayContext): Promise<Decimal | null> {
    return null;
  }

  async validateConfig(campaign: PlaySubject): Promise<void>;
  async validateConfig(triggerCondition: unknown, rules: unknown, rewards: unknown): Promise<void>;
  async validateConfig(
    campaignOrTrigger: PlaySubject | unknown,
    rulesArg?: unknown,
    rewardsArg?: unknown,
  ): Promise<void> {
    const campaign = this.isCampaignJsonSubject(campaignOrTrigger) ? campaignOrTrigger : null;
    const triggerCondition = campaign ? campaign.audienceJson : campaignOrTrigger;
    const rules = campaign ? campaign.stagesJson : rulesArg;
    const rewards = campaign ? campaign.rightsJson : rewardsArg;
    const trigger = this.asRecord(triggerCondition);
    const reward = this.asRecord(rewards);
    const rootRules = this.asRecord(rules);
    const distributionGrowth = this.asRecord(rootRules?.distributionGrowth);

    BusinessException.throwIf(!trigger, '分销成长活动缺少 triggerCondition');
    BusinessException.throwIf(!reward, '分销成长活动缺少 rewards');
    BusinessException.throwIf(!distributionGrowth, '分销成长活动缺少 distributionGrowth 配置');

    const activityVersionId = this.asString(distributionGrowth.activityVersionId);
    BusinessException.throwIf(!activityVersionId, '分销成长活动缺少 activityVersionId');

    const shareChannel = this.asString(distributionGrowth.shareChannel);
    BusinessException.throwIf(!shareChannel, '分销成长活动缺少 shareChannel');
    BusinessException.throwIf(
      !DISTRIBUTION_GROWTH_SHARE_CHANNEL_VALUES.includes(shareChannel as never),
      '分销成长活动 shareChannel 非法',
    );

    const shareLandingPage = this.asString(distributionGrowth.shareLandingPage);
    BusinessException.throwIf(!shareLandingPage, '分销成长活动缺少 shareLandingPage');
    BusinessException.throwIf(!shareLandingPage.startsWith('/'), '分销成长活动 shareLandingPage 必须以 / 开头');

    const referralCodeEnabled = this.asBoolean(distributionGrowth.referralCodeEnabled);
    BusinessException.throwIf(referralCodeEnabled === null, '分销成长活动 referralCodeEnabled 非法');
    if (referralCodeEnabled) {
      BusinessException.throwIf(!shareLandingPage, '启用推荐码时必须配置 shareLandingPage');
    }

    const attributionWindowMinutes = this.asNumber(distributionGrowth.attributionWindowMinutes);
    BusinessException.throwIf(
      attributionWindowMinutes === null || attributionWindowMinutes <= 0,
      '分销成长活动 attributionWindowMinutes 必须大于 0',
    );

    const commissionBudgetTotal = this.asNumber(distributionGrowth.commissionBudgetTotal);
    BusinessException.throwIf(
      commissionBudgetTotal === null || commissionBudgetTotal <= 0,
      '分销成长活动 commissionBudgetTotal 必须大于 0',
    );

    const commissionBudgetAlertThreshold = this.asNumber(distributionGrowth.commissionBudgetAlertThreshold);
    const commissionBudgetFuseThreshold = this.asNumber(distributionGrowth.commissionBudgetFuseThreshold);
    BusinessException.throwIf(
      commissionBudgetAlertThreshold === null ||
        commissionBudgetFuseThreshold === null ||
        commissionBudgetAlertThreshold <= 0 ||
        commissionBudgetAlertThreshold > 100 ||
        commissionBudgetFuseThreshold <= 0 ||
        commissionBudgetFuseThreshold > 100 ||
        commissionBudgetAlertThreshold >= commissionBudgetFuseThreshold,
      '分销成长活动预算阈值非法',
    );

    const upgradeRule = this.asRecord(distributionGrowth.upgradeRule);
    const teamThresholdRule = this.asRecord(distributionGrowth.teamThresholdRule);
    BusinessException.throwIf(!upgradeRule || Object.keys(upgradeRule).length === 0, '分销成长活动缺少 upgradeRule');
    BusinessException.throwIf(
      !teamThresholdRule || Object.keys(teamThresholdRule).length === 0,
      '分销成长活动缺少 teamThresholdRule',
    );
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

  private isCampaignJsonSubject(value: unknown): value is PlaySubject & {
    audienceJson?: unknown;
    stagesJson?: unknown;
    rightsJson?: unknown;
  } {
    return (
      !!value &&
      typeof value === 'object' &&
      ('audienceJson' in value || 'stagesJson' in value || 'rightsJson' in value)
    );
  }
}
