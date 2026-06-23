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
 * L1 佣金计算服务
 *
 * @description
 * 计算直推佣金。SKU 先形成佣金池，本服务只按受益人等级比例切分佣金池。
 *
 * @architecture A-T2: 通过 MemberQueryPort 获取会员数据
 */
@Injectable()
export class L1CalculatorService {
  private readonly logger = new Logger(L1CalculatorService.name);

  constructor(
    private readonly validator: CommissionValidatorService,
    private readonly levelService: LevelService,
    private readonly memberQueryPort: MemberQueryPort,
    private readonly distributionQualificationQueryPort: DistributionQualificationQueryPort,
    private readonly distributorEligibilityService: DistributorEligibilityService,
  ) {}

  /**
   * 计算 L1 佣金 (直推)
   * 规则:
   * - 优先: order.shareUserId (临时分享)
   * - 其次: member.parentId (绑定关系)
   * - 受益人必须 levelId >= 1 (C1/C2)
   *
   * @returns { record, beneficiaryId, beneficiaryLevel, noL2Available }
   */
  async calculateL1(
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
  ): Promise<{
    record: CommissionRecord;
    beneficiaryId: string;
    beneficiaryLevel: number;
    noL2Available: boolean;
  } | null> {
    // 优先归属分享人，其次绑定的上级
    const beneficiaryId = order.shareUserId || member.parentId;

    // 1. 基础校验：无受益人或受益人为下单人本人
    if (!beneficiaryId || beneficiaryId === order.memberId) return null;

    if (!(await this.distributorEligibilityService.isActive(order.tenantId, beneficiaryId))) {
      this.logger.log(`[Commission] L1 user ${beneficiaryId} has no active distributor profile, skip`);
      return null;
    }

    // 2. 黑名单校验
    if (await this.validator.isUserBlacklisted(order.tenantId, beneficiaryId)) {
      this.logger.log(`[Commission] L1 user ${beneficiaryId} is blacklisted`);
      return null;
    }

    // 3. 优先使用新分销资格档案；无档案时兼容历史 levelId 投影。
    const profile = await this.distributionQualificationQueryPort.findProfile(beneficiaryId, order.tenantId);
    if (profile && profile.status !== DistDistributorProfileStatus.ACTIVE) {
      this.logger.log(`[Commission] L1 user ${beneficiaryId} profile is ${profile.status}, skip`);
      return null;
    }

    const beneficiary = await this.memberQueryPort.findMemberBrief(beneficiaryId);
    const beneficiaryLevel = profile?.levelId ?? beneficiary?.levelId ?? 0;
    const beneficiaryTenantId = profile?.tenantId ?? beneficiary?.tenantId;

    // 4. 身份校验：只有 C1(levelId=1) 或 C2(levelId=2) 才能获得分佣
    if (!beneficiaryTenantId || beneficiaryLevel < 1) {
      this.logger.log(`[Commission] L1 user ${beneficiaryId} is not C1/C2, skip`);
      return null;
    }

    // 5. 跨店校验
    const isCrossTenant = beneficiaryTenantId !== order.tenantId;
    if (isCrossTenant && !config.enableCrossTenant) {
      this.logger.log(`[Commission] Cross-tenant disabled, skip L1 for ${beneficiaryId}`);
      return null;
    }

    // 6. 判断是否有 L2 受益人 (C2全拿场景)
    //    - 如果L1是C2且无上级 → L2没人拿 → L1全拿
    //    - 如果L1是C1且有上级C2 → L2给C2
    const relation = await this.distributionQualificationQueryPort.findActiveRelation(beneficiaryId, order.tenantId);
    let hasL2 = relation?.teamOwnerMemberId != null;
    // 旧数据兼容：无资格档案关系时，检查 parentId 指向的用户是否真的是 C2 资质，
    // 避免 parentId 指向非 C2 用户导致 L1 不全拿、L2 也没人拿的静默丢佣问题。
    if (!hasL2 && beneficiary?.parentId) {
      const parentProfile = await this.distributionQualificationQueryPort.findProfile(
        beneficiary.parentId,
        order.tenantId,
      );
      hasL2 = parentProfile?.status === DistDistributorProfileStatus.ACTIVE && (parentProfile.levelId ?? 0) >= 2;
    }
    const isC2 = beneficiaryLevel === 2;
    const noL2Available = isC2 && !hasL2; // C2直推场景，L2无人

    // 7. 获取会员等级配置
    // findByLevelId：按 levelId 查；LevelVo 中费率为百分比字符串（如 "4.00" = 4%），需 /100 转为小数
    const memberLevelVo = await this.levelService.findByLevelId(order.tenantId, beneficiaryLevel);
    const levelL1Decimal = this.parseLevelVoRate(memberLevelVo?.level1Rate) ?? new Decimal(0);
    const levelL2Decimal = this.parseLevelVoRate(memberLevelVo?.level2Rate) ?? new Decimal(0);

    // baseAmount 是 BaseCalculatorService 基于 SKU distMode/distRate 汇总后的佣金池。
    let effectiveRate = levelL1Decimal;
    if (noL2Available) {
      effectiveRate = effectiveRate.add(levelL2Decimal);
    }
    if (isCrossTenant && config.crossTenantRate) {
      effectiveRate = effectiveRate.mul(config.crossTenantRate);
    }
    const totalAmount = baseAmount.mul(effectiveRate);

    if (noL2Available) {
      this.logger.log(`[Commission] C2 ${beneficiaryId} full take: L1+L2`);
    }

    if (totalAmount.lt(0.01)) return null;

    // 8. 跨店限额校验
    if (isCrossTenant && config.crossMaxDaily) {
      const pass = await this.validator.checkDailyLimit(
        order.tenantId,
        beneficiaryId,
        totalAmount,
        config.crossMaxDaily,
      );
      if (!pass) {
        this.logger.log(`[Commission] Daily limit exceeded for L1 ${beneficiaryId}`);
        return null;
      }
    }

    const record = {
      orderId: order.id,
      tenantId: order.tenantId,
      beneficiaryId,
      level: 1,
      amount: totalAmount.toDecimalPlaces(2),
      rateSnapshot: effectiveRate.mul(100),
      status: 'FROZEN' as CommissionStatus,
      planSettleTime,
      isCrossTenant: !!isCrossTenant,
    };

    return {
      record,
      beneficiaryId,
      beneficiaryLevel,
      noL2Available,
    };
  }

  /** LevelVo 费率：百分比数字符串 → 小数；0 表示明确不分配该层佣金。 */
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
