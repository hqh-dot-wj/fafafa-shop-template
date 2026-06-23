import { Injectable, Logger } from '@nestjs/common';
import { MktCampaign } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { BusinessException } from 'src/common/exceptions';
import { CouponDistributionService } from '../../coupon/distribution/distribution.service';
import { getErrorMessage } from 'src/common/utils/error';
import { IPlayHandler, PlayContext, PlaySubject } from '../../play/play-handler.interface';

/** 活动类型常量 */
export const NEWCOMER_EXCLUSIVE_TYPE = 'NEWCOMER_EXCLUSIVE';

interface NewcomerTriggerCondition {
  userType: 'NEW';
  requirePhone: boolean;
}

interface NewcomerRewards {
  couponTemplateIds: string[];
  points?: number;
}

interface NewcomerRules {
  newcomerPrices: Array<{
    skuId: string;
    originalPrice: number;
    newcomerPrice: number;
  }>;
}

/**
 * 新人专享活动处理器
 *
 * @description
 * 处理新人专享活动的资格校验、奖励发放和价格覆盖。
 * 触发条件：新用户绑定手机号后自动发放礼包（3张优惠券）。
 * 价格覆盖：新人可享受 SKU 级别的专享价。
 */
@Injectable()
export class NewcomerHandler implements IPlayHandler {
  readonly code = NEWCOMER_EXCLUSIVE_TYPE;
  readonly type = NEWCOMER_EXCLUSIVE_TYPE;
  private readonly logger = new Logger(NewcomerHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly couponDistributionService: CouponDistributionService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 校验用户是否满足新人专享触发条件
   *
   * @param activity 活动配置
   * @param memberId 用户ID
   * @returns 是否满足条件（新用户 + 已绑手机 + 未领取过）
   */
  async checkEligibility(ctx: PlayContext): Promise<boolean>;
  async checkEligibility(activity: MktCampaign, memberId: string): Promise<boolean>;
  async checkEligibility(ctxOrActivity: PlayContext | MktCampaign, memberId?: string): Promise<boolean> {
    const { activity, memberId: resolvedMemberId } = this.resolveActivityContext(ctxOrActivity, memberId);
    const condition = activity.audienceJson as unknown as NewcomerTriggerCondition;

    // 检查是否已参与过（幂等）
    const existing = await this.prisma.mktCampaignParticipation.findFirst({
      where: this.tenantHelper.readWhereForDelegate('mktCampaignParticipation', {
        campaignId_memberId: { campaignId: activity.id, memberId: resolvedMemberId },
      }) as Prisma.MktCampaignParticipationWhereInput,
    });
    if (existing) return false;

    // 检查手机号绑定
    if (condition.requirePhone) {
      const member = await this.prisma.umsMember.findFirst({
        where: this.tenantHelper.readWhereForDelegate('umsMember', {
          memberId: resolvedMemberId,
        }) as Prisma.UmsMemberWhereInput,
        select: { mobile: true },
      });
      if (!member?.mobile) return false;
    }

    return true;
  }

  /**
   * 发放新人礼包（优惠券列表）
   *
   * @param activity 活动配置
   * @param memberId 用户ID
   * @throws BusinessException 发放失败时
   */
  async applyRewards(ctx: PlayContext): Promise<void> {
    const activity = this.assertMktCampaign(ctx.campaign);
    await this.grantRewards(activity, ctx.memberId);
  }

  async grantRewards(activity: MktCampaign, memberId: string): Promise<void> {
    const rewards = activity.rightsJson as unknown as NewcomerRewards;

    const grantedCoupons: string[] = [];

    for (const templateId of rewards.couponTemplateIds) {
      try {
        await this.couponDistributionService.claimCoupon(memberId, templateId);
        grantedCoupons.push(templateId);
      } catch (error) {
        // 单张券发放失败不阻断整体流程，记录日志
        this.logger.warn({
          message: '新人礼包单张券发放失败',
          memberId,
          templateId,
          error: getErrorMessage(error),
        });
      }
    }

    this.logger.log({
      message: '新人礼包发放完成',
      memberId,
      activityId: activity.id,
      grantedCount: grantedCoupons.length,
      totalCount: rewards.couponTemplateIds.length,
    });
  }

  /**
   * 获取新人专享价格
   *
   * @param activity 活动配置
   * @param skuId SKU ID
   * @param _memberId 用户ID（本方法未使用，资格已在上层校验）
   * @returns 新人价或 null
   */
  async resolvePrice(ctx: PlayContext): Promise<Decimal | null> {
    const activity = this.assertMktCampaign(ctx.campaign);
    if (!ctx.skuId) return null;
    return this.getPrice(activity, ctx.skuId, ctx.memberId);
  }

  async getPrice(activity: MktCampaign, skuId: string, _memberId: string): Promise<Decimal | null> {
    // 优先从 PmsTenantSku.newcomerPrice 查询（高频查询走索引列）
    const sku = await this.prisma.pmsTenantSku.findFirst({
      where: this.tenantHelper.readWhereForDelegate('pmsTenantSku', {
        id: skuId,
        newcomerPrice: { not: null },
        tenantId: activity.tenantId,
      }) as Prisma.PmsTenantSkuWhereInput,
      select: { newcomerPrice: true },
    });

    if (sku?.newcomerPrice) {
      return sku.newcomerPrice;
    }

    return null;
  }

  /**
   * 校验新人专享活动配置合法性
   *
   * @param triggerCondition 触发条件
   * @param rules 规则
   * @param rewards 奖励
   * @throws BusinessException 配置不合法时
   */
  async validateConfig(campaign: PlaySubject): Promise<void>;
  async validateConfig(triggerCondition: unknown, rules: unknown, rewards: unknown): Promise<void>;
  async validateConfig(campaignOrTrigger: PlaySubject | unknown, _rules?: unknown, _rewards?: unknown): Promise<void> {
    const triggerCondition = this.isCampaignJsonSubject(campaignOrTrigger)
      ? campaignOrTrigger.audienceJson
      : campaignOrTrigger;
    const rewards = this.isCampaignJsonSubject(campaignOrTrigger) ? campaignOrTrigger.rightsJson : _rewards;
    const condition = triggerCondition as NewcomerTriggerCondition;
    BusinessException.throwIf(condition.userType !== 'NEW', '新人专享活动的 userType 必须为 NEW');

    const rewardsData = rewards as NewcomerRewards;
    BusinessException.throwIf(
      !rewardsData.couponTemplateIds || rewardsData.couponTemplateIds.length === 0,
      '新人专享活动必须配置至少一张优惠券模板',
    );
  }

  private resolveActivityContext(ctxOrActivity: PlayContext | MktCampaign, memberId?: string) {
    if ('campaign' in ctxOrActivity) {
      return {
        activity: this.assertMktCampaign(ctxOrActivity.campaign),
        memberId: ctxOrActivity.memberId,
      };
    }
    BusinessException.throwIf(!memberId, 'memberId 不能为空');
    return { activity: ctxOrActivity, memberId: memberId! };
  }

  private assertMktCampaign(campaign: PlaySubject): MktCampaign {
    BusinessException.throwIf(!('audienceJson' in campaign), '新人专享处理器需要 MktCampaign 上下文');
    return campaign as MktCampaign;
  }

  private isCampaignJsonSubject(value: unknown): value is PlaySubject & {
    audienceJson?: unknown;
    rightsJson?: unknown;
  } {
    return !!value && typeof value === 'object' && ('audienceJson' in value || 'rightsJson' in value);
  }
}
