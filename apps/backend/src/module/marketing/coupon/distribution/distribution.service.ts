import { Injectable, Logger, Inject } from '@nestjs/common';
import { CouponStatus, CouponDistributionType, CouponValidityType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { BusinessException } from 'src/common/exceptions';
import { Result } from 'src/common/response/result';
import { ResponseCode } from 'src/common/response';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { FormatDateFields } from 'src/common/utils';
import { CouponTemplateRepository } from '../template/template.repository';
import { UserCouponRepository } from './user-coupon.repository';
import { ManualDistributionDto } from './dto/manual-distribution.dto';
import { getErrorMessage } from 'src/common/utils/error';
import { ORDER_SERVICE, OrderServiceContract } from 'src/module/client/order/order-service.token';
import { CouponErrorCode, CouponErrorMessages } from '../constants/error-codes';
import { MessageTouchpointDispatcher } from '../../events/message-touchpoint.dispatcher';
import { MarketingEventType } from '../../events/marketing-event.types';

const MANUAL_DISTRIBUTION_MEMBER_LIMIT = 500;

function isPrismaUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; meta?: { code?: unknown } };
  return candidate.code === 'P2002' || candidate.meta?.code === '23505';
}

/**
 * 优惠券发放服务
 *
 * @description 处理优惠券的发放、领取、赠送等操作，使用分布式锁保证并发安全
 */
@Injectable()
export class CouponDistributionService {
  private readonly logger = new Logger(CouponDistributionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateRepo: CouponTemplateRepository,
    private readonly userCouponRepo: UserCouponRepository,
    private readonly messageTouchpointDispatcher: MessageTouchpointDispatcher,
    @Inject(ORDER_SERVICE)
    private readonly orderService: OrderServiceContract,
  ) {}

  /**
   * 手动发放优惠券
   *
   * @param dto 发放数据
   * @returns 发放结果列表
   */
  @Transactional()
  async distributeManually(dto: ManualDistributionDto) {
    BusinessException.throwIf(
      dto.memberIds.length > MANUAL_DISTRIBUTION_MEMBER_LIMIT,
      CouponErrorMessages[CouponErrorCode.MANUAL_DISTRIBUTION_LIMIT_EXCEEDED],
    );

    // 1. 检查模板
    const template = await this.templateRepo.findById(dto.templateId);
    BusinessException.throwIfNull(template, CouponErrorMessages[CouponErrorCode.TEMPLATE_NOT_FOUND]);
    BusinessException.throwIf(
      template.status !== CouponStatus.ACTIVE,
      CouponErrorMessages[CouponErrorCode.TEMPLATE_INACTIVE],
    );

    // 2. 批量发放
    const results = [];
    for (const memberId of dto.memberIds) {
      try {
        const userCoupon = await this.claimCouponInternal(memberId, dto.templateId, CouponDistributionType.MANUAL);
        results.push({ memberId, success: true, couponId: userCoupon.id });
      } catch (error) {
        results.push({ memberId, success: false, error: getErrorMessage(error) });
      }
    }

    return Result.ok(results, '发放完成');
  }

  /**
   * 用户领取优惠券
   *
   * @param memberId 用户ID
   * @param templateId 模板ID
   * @returns 领取的优惠券
   */
  async claimCoupon(memberId: string, templateId: string) {
    const userCoupon = await this.claimCouponInternal(memberId, templateId, CouponDistributionType.ACTIVITY);
    return Result.ok(FormatDateFields(userCoupon), '领取成功');
  }

  /**
   * 订单赠送优惠券
   *
   * @param orderId 订单ID
   * @param templateIds 模板ID列表
   * @returns 赠送的优惠券列表
   */
  @Transactional()
  async grantByOrder(orderId: string, templateIds: string[]) {
    // 1. 检查订单
    const order = await this.orderService.findByIdForMarketing(orderId);
    BusinessException.throwIfNull(order, CouponErrorMessages[CouponErrorCode.ORDER_NOT_FOUND]);

    // 2. 批量赠送
    const coupons = [];
    for (const templateId of templateIds) {
      try {
        const userCoupon = await this.claimCouponInternal(order.memberId, templateId, CouponDistributionType.ORDER);
        coupons.push(userCoupon);
      } catch (error) {
        this.logger.warn({
          message: 'Failed to grant coupon by order',
          orderId,
          templateId,
          error: getErrorMessage(error),
        });
      }
    }

    return coupons;
  }

  /**
   * 检查用户是否可以领取优惠券
   *
   * @param memberId 用户ID
   * @param templateId 模板ID
   * @returns 资格检查结果
   */
  async checkEligibility(memberId: string, templateId: string) {
    // 1. 检查模板
    const template = await this.templateRepo.findById(templateId);
    if (!template || template.status !== CouponStatus.ACTIVE) {
      return Result.ok({ eligible: false, reason: '优惠券不存在或已停用' });
    }

    // 2. 检查库存
    if (template.remainingStock <= 0) {
      return Result.ok({ eligible: false, reason: '优惠券已抢光' });
    }

    // 3. 检查用户领取次数
    const userClaimedCount = await this.userCouponRepo.countUserCoupons(memberId, templateId);

    if (userClaimedCount >= template.limitPerUser) {
      return Result.ok({ eligible: false, reason: '已达到领取上限' });
    }

    return Result.ok({ eligible: true });
  }

  /**
   * 内部领取优惠券方法。
   *
   * 库存扣减与用户限领插入在同一 DB 事务内完成；用户维度并发由 per_user_ord 唯一约束兜底。
   */
  private async claimCouponInternal(memberId: string, templateId: string, distributionType: CouponDistributionType) {
    const { template, userCoupon } = await this.prisma.$transaction(async (tx) => {
      const template = await tx.mktCouponTemplate.findUnique({ where: { id: templateId } });
      BusinessException.throwIfNull(template, CouponErrorMessages[CouponErrorCode.TEMPLATE_NOT_FOUND]);
      BusinessException.throwIf(
        template.status !== CouponStatus.ACTIVE,
        CouponErrorMessages[CouponErrorCode.TEMPLATE_INACTIVE],
      );

      const updated = await tx.mktCouponTemplate.updateMany({
        where: {
          id: templateId,
          remainingStock: { gt: 0 },
        },
        data: {
          remainingStock: { decrement: 1 },
        },
      });

      if (updated.count === 0) {
        throw new BusinessException(
          ResponseCode.BUSINESS_ERROR,
          CouponErrorMessages[CouponErrorCode.STOCK_INSUFFICIENT],
        );
      }

      const { startTime, endTime } = this.calculateValidity(template);
      let userCoupon = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          userCoupon = await this.userCouponRepo.tryClaim(
            {
              tenantId: template.tenantId,
              memberId,
              templateId,
              couponName: template.name,
              couponType: template.type,
              discountAmount: template.discountAmount,
              discountPercent: template.discountPercent,
              maxDiscountAmount: template.maxDiscountAmount,
              minOrderAmount: template.minOrderAmount,
              startTime,
              endTime,
              distributionType,
              limitPerUser: template.limitPerUser,
            },
            tx,
          );
          break;
        } catch (error) {
          if (attempt === 0 && isPrismaUniqueViolation(error)) continue;
          throw error;
        }
      }

      if (!userCoupon) {
        throw new BusinessException(
          ResponseCode.BUSINESS_ERROR,
          CouponErrorMessages[CouponErrorCode.CLAIM_LIMIT_EXCEEDED],
        );
      }

      return { template, userCoupon };
    });

    this.logger.log({
      message: 'Coupon claimed successfully',
      memberId,
      templateId,
      userCouponId: userCoupon.id,
    });

    await this.messageTouchpointDispatcher.dispatch({
      type: MarketingEventType.COUPON_CLAIMED,
      tenantId: template.tenantId,
      instanceId: userCoupon.id,
      configId: templateId,
      memberId,
      payload: {
        templateId,
        distributionType,
        startTime: userCoupon.startTime,
        endTime: userCoupon.endTime,
      },
      timestamp: new Date(),
    });

    return userCoupon;
  }

  /**
   * 计算优惠券有效期
   *
   * @param template 优惠券模板
   * @returns 有效期起止时间
   */
  private calculateValidity(template: {
    validityType: string;
    startTime?: Date | null;
    endTime?: Date | null;
    validDays?: number | null;
  }): { startTime: Date; endTime: Date } {
    if (template.validityType === CouponValidityType.FIXED) {
      // 固定时间段
      return {
        startTime: template.startTime,
        endTime: template.endTime,
      };
    } else {
      // 相对时间（领取后N天）
      const now = new Date();
      const endTime = new Date(now);
      endTime.setDate(endTime.getDate() + template.validDays);
      return { startTime: now, endTime };
    }
  }
}
