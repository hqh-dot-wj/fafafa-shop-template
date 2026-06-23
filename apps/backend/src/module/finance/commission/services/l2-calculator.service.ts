import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { CommissionStatus, DistDistributorProfileStatus } from '@prisma/client';
import { CommissionValidatorService } from './commission-validator.service';
import { MemberForCommission, DistributionConfig, CommissionRecord } from 'src/common/types/finance.types';
import { LevelService } from 'src/module/store/distribution/services/level.service';
import { DistributorEligibilityService } from 'src/module/store/distribution/services/distributor-eligibility.service';
import { MemberQueryPort } from '../../ports/member-query.port';
import { DistributionQualificationQueryPort } from '../../ports/distribution-qualification-query.port';

/**
 * L2 佣金计算服务
 *
 * @description
 * 计算间推佣金。SKU 先形成佣金池，本服务只按 C2 等级团队比例切分佣金池。
 *
 * @architecture A-T2: 通过 MemberQueryPort 获取会员数据
 */
@Injectable()
export class L2CalculatorService {
  private readonly logger = new Logger(L2CalculatorService.name);

  constructor(
    private readonly validator: CommissionValidatorService,
    private readonly levelService: LevelService,
    private readonly memberQueryPort: MemberQueryPort,
    private readonly distributionQualificationQueryPort: DistributionQualificationQueryPort,
    private readonly distributorEligibilityService: DistributorEligibilityService,
  ) {}

  /**
   * 计算 L2 佣金 (间推)
   * 规则:
   * - 若L1是C1: L2 = L1的上级 (C2)
   * - 若L1是C2且无上级: L1已全拿，L2跳过
   * - 若是临时分享: L2 = 分享人的上级
   */
  async calculateL2(
    order: {
      id: string;
      tenantId: string;
      memberId: string;
      shareUserId: string | null;
      payAmount: Decimal;
    },
    member: MemberForCommission,
    config: DistributionConfig,
    baseAmount: Decimal,
    planSettleTime: Date,
    l1BeneficiaryId?: string,
    l1BeneficiaryLevel?: number,
    noL2Available?: boolean,
  ): Promise<CommissionRecord | null> {
    // C2全拿场景，L2跳过
    if (noL2Available) {
      this.logger.log(`[Commission] L2 skipped: C2 full take scenario`);
      return null;
    }

    // 确定 L2 受益人
    // 1. 若有临时分享，查分享人的上级
    // 2. 否则查绑定的 indirectParentId
    let beneficiaryId: string | null = null;

    if (l1BeneficiaryId) {
      const relation = await this.distributionQualificationQueryPort.findActiveRelation(
        l1BeneficiaryId,
        order.tenantId,
      );
      beneficiaryId = relation?.teamOwnerMemberId ?? null;
    }

    if (!beneficiaryId) {
      if (order.shareUserId && l1BeneficiaryId) {
        // 兼容旧关系：临时分享场景通过分享人的 parentId 找 C2。
        const sharer = await this.memberQueryPort.findMemberBrief(l1BeneficiaryId);
        beneficiaryId = sharer?.parentId || null;
      } else {
        // 兼容旧关系：绑定关系场景使用下单人的 indirectParentId。
        beneficiaryId = member.indirectParentId;
      }
    }

    // 1. 基础校验
    if (
      !beneficiaryId ||
      beneficiaryId === order.memberId ||
      beneficiaryId === l1BeneficiaryId || // 避免与L1重复
      beneficiaryId === order.shareUserId // 避免分享人下级获利
    )
      return null;

    if (!(await this.distributorEligibilityService.isActive(order.tenantId, beneficiaryId))) {
      this.logger.log(`[Commission] L2 user ${beneficiaryId} has no active distributor profile, skip`);
      return null;
    }

    // 2. 黑名单校验
    if (await this.validator.isUserBlacklisted(order.tenantId, beneficiaryId)) {
      this.logger.log(`[Commission] L2 user ${beneficiaryId} is blacklisted`);
      return null;
    }

    // 3. 优先使用新分销资格档案；无档案时兼容历史 levelId 投影。
    const profile = await this.distributionQualificationQueryPort.findProfile(beneficiaryId, order.tenantId);
    if (profile && profile.status !== DistDistributorProfileStatus.ACTIVE) {
      this.logger.log(`[Commission] L2 user ${beneficiaryId} profile is ${profile.status}, skip`);
      return null;
    }

    const beneficiary = await this.memberQueryPort.findMemberBrief(beneficiaryId);
    const beneficiaryLevel = profile?.levelId ?? beneficiary?.levelId ?? 0;
    const beneficiaryTenantId = profile?.tenantId ?? beneficiary?.tenantId;
    const canEarnL2 = profile?.canEarnL2 ?? beneficiaryLevel === 2;

    if (!beneficiaryTenantId || beneficiaryLevel !== 2 || !canEarnL2) {
      this.logger.log(`[Commission] L2 user ${beneficiaryId} is not C2, skip`);
      return null;
    }

    // 4. 跨店校验
    const isCrossTenant = beneficiaryTenantId !== order.tenantId;
    if (isCrossTenant && !config.enableCrossTenant) {
      return null;
    }

    // 5. 获取会员等级配置；LevelVo 费率为百分比字符串，需 /100
    const memberLevelVo = await this.levelService.findByLevelId(order.tenantId, beneficiaryLevel);
    let effectiveRate = this.parseLevelVoRate(memberLevelVo?.level2Rate) ?? new Decimal(0);
    if (isCrossTenant && config.crossTenantRate) {
      effectiveRate = effectiveRate.mul(config.crossTenantRate);
    }
    const totalAmount = baseAmount.mul(effectiveRate);

    if (totalAmount.lt(0.01)) return null;

    // 7. 限额校验
    if (isCrossTenant && config.crossMaxDaily) {
      const pass = await this.validator.checkDailyLimit(
        order.tenantId,
        beneficiaryId,
        totalAmount,
        config.crossMaxDaily,
      );
      if (!pass) return null;
    }

    return {
      orderId: order.id,
      tenantId: order.tenantId,
      beneficiaryId,
      level: 2,
      amount: totalAmount.toDecimalPlaces(2),
      rateSnapshot: effectiveRate.mul(100),
      status: 'FROZEN' as CommissionStatus,
      planSettleTime,
      isCrossTenant: !!isCrossTenant,
    };
  }

  private parseLevelVoRate(percentStr: string | undefined): Decimal | null {
    if (percentStr == null || percentStr === '') return null;
    try {
      const asDecimal = new Decimal(percentStr).div(100);
      return asDecimal.gte(0) ? asDecimal : null;
    } catch {
      return null;
    }
  }
}
