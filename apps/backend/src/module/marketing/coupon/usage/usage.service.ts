import { Injectable, Logger, Inject } from '@nestjs/common';
import { CouponStatus, CouponType, UserCouponStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { Result } from 'src/common/response/result';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { FormatDateFields } from 'src/common/utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserCouponRepository } from '../distribution/user-coupon.repository';
import { CouponTemplateRepository } from '../template/template.repository';
import { CouponUsageRepository } from './usage.repository';
import { OrderContext } from './dto/validate-coupon.dto';
import { ORDER_SERVICE, OrderServiceContract } from 'src/module/client/order/order-service.token';
import { CouponErrorCode, CouponErrorMessages } from '../constants/error-codes';
import { MessageTouchpointDispatcher } from '../../events/message-touchpoint.dispatcher';
import { MarketingEventType } from '../../events/marketing-event.types';

/**
 * 优惠券使用服务
 *
 * @description 处理优惠券的验证、计算、锁定、使用、解锁、退还等操作
 */
@Injectable()
export class CouponUsageService {
  private readonly logger = new Logger(CouponUsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userCouponRepo: UserCouponRepository,
    private readonly templateRepo: CouponTemplateRepository,
    private readonly usageRepo: CouponUsageRepository,
    private readonly messageTouchpointDispatcher: MessageTouchpointDispatcher,
    @Inject(ORDER_SERVICE)
    private readonly orderService: OrderServiceContract,
  ) {}

  /**
   * 查询用户可用优惠券列表
   *
   * @param memberId 用户ID
   * @param orderContext 订单上下文
   * @returns 可用优惠券列表
   */
  async findAvailableCoupons(memberId: string, orderContext?: OrderContext) {
    const now = new Date();

    // 查询未使用且未过期的优惠券
    const coupons = await this.userCouponRepo.findAvailableCoupons(memberId, {
      minOrderAmount: orderContext?.orderAmount,
      productIds: orderContext?.productIds,
      categoryIds: orderContext?.categoryIds,
    });

    // 如果提供了订单上下文，进一步过滤（findAvailableCoupons 含 include: { template }）
    if (orderContext) {
      const couponsWithTemplate = coupons as Array<{
        minOrderAmount: string | number | Decimal;
        template?: { applicableProducts?: string[]; applicableCategories?: number[] };
      }>;
      const availableCoupons = coupons.filter((_, i) =>
        this.isApplicableToOrder(
          {
            minOrderAmount: couponsWithTemplate[i].minOrderAmount,
            applicableProducts: couponsWithTemplate[i].template?.applicableProducts,
            applicableCategories: couponsWithTemplate[i].template?.applicableCategories,
          },
          orderContext,
        ),
      );
      return Result.ok(FormatDateFields(availableCoupons));
    }

    return Result.ok(FormatDateFields(coupons));
  }

  /**
   * 验证优惠券是否可用
   *
   * @param userCouponId 用户优惠券ID
   * @param orderContext 订单上下文
   * @returns 验证结果
   */
  async validateCoupon(userCouponId: string, orderContext: OrderContext) {
    const coupon = await this.userCouponRepo.findById(userCouponId, {
      include: { template: true },
    });
    BusinessException.throwIfNull(coupon, CouponErrorMessages[CouponErrorCode.USER_COUPON_NOT_FOUND]);

    // 验证归属
    BusinessException.throwIf(
      coupon.memberId !== orderContext.memberId,
      CouponErrorMessages[CouponErrorCode.CLAIM_NOT_ELIGIBLE],
    );

    // 验证状态
    BusinessException.throwIf(
      coupon.status !== UserCouponStatus.UNUSED,
      CouponErrorMessages[CouponErrorCode.COUPON_USED],
    );

    // 验证有效期
    const now = new Date();
    BusinessException.throwIf(
      now < coupon.startTime || now > coupon.endTime,
      CouponErrorMessages[CouponErrorCode.COUPON_EXPIRED],
    );

    // 验证最低消费
    const minAmount = Number(coupon.minOrderAmount);
    BusinessException.throwIf(
      orderContext.orderAmount < minAmount,
      `${CouponErrorMessages[CouponErrorCode.ORDER_AMOUNT_TOO_LOW]}: ${minAmount}元`,
    );

    // 验证适用商品（如果有限制）
    const c = coupon as typeof coupon & {
      template?: { applicableProducts?: string[]; applicableCategories?: number[] };
    };
    if (
      !this.isApplicableToOrder(
        {
          minOrderAmount: coupon.minOrderAmount,
          applicableProducts: c.template?.applicableProducts,
          applicableCategories: c.template?.applicableCategories,
        },
        orderContext,
      )
    ) {
      BusinessException.throw(400, CouponErrorMessages[CouponErrorCode.COUPON_NOT_APPLICABLE]);
    }

    return Result.ok({ valid: true });
  }

  /**
   * 计算优惠券优惠金额
   *
   * @param userCouponId 用户优惠券ID
   * @param orderAmount 订单金额
   * @returns 优惠金额
   */
  async calculateDiscount(userCouponId: string, orderAmount: number) {
    const coupon = await this.userCouponRepo.findById(userCouponId);
    BusinessException.throwIfNull(coupon, CouponErrorMessages[CouponErrorCode.USER_COUPON_NOT_FOUND]);

    let discount = new Decimal(0);
    const amount = new Decimal(orderAmount);

    switch (coupon.couponType) {
      case CouponType.DISCOUNT:
        // 满减券：直接减免固定金额
        discount = new Decimal(coupon.discountAmount || 0);
        break;

      case CouponType.PERCENTAGE:
        // 折扣券：按百分比计算，不超过最高优惠金额
        discount = amount.mul(coupon.discountPercent || 0).div(100);
        if (coupon.maxDiscountAmount) {
          discount = Decimal.min(discount, new Decimal(coupon.maxDiscountAmount));
        }
        break;

      case CouponType.EXCHANGE:
        // 兑换券：优惠金额等于订单金额（全额抵扣）
        discount = amount;
        break;
    }

    // 确保优惠金额不超过订单金额
    discount = Decimal.min(discount, amount);

    return Number(discount.toFixed(2));
  }

  /**
   * 锁定优惠券（订单创建时）
   *
   * @param userCouponId 用户优惠券ID
   * @param orderId 订单ID
   */
  @Transactional()
  async lockCoupon(userCouponId: string, orderId: string) {
    return this.lockCouponInTx(userCouponId, orderId);
  }

  async lockCouponInTx(userCouponId: string, orderId: string) {
    const updated = await this.userCouponRepo.lockCoupon(userCouponId, orderId);

    BusinessException.throwIf(updated.count === 0, CouponErrorMessages[CouponErrorCode.COUPON_LOCKED]);

    this.logger.log({
      message: 'Coupon locked',
      userCouponId,
      orderId,
    });
  }

  /**
   * 使用优惠券（订单支付成功时）
   *
   * @param userCouponId 用户优惠券ID
   * @param orderId 订单ID
   * @param discountAmount 优惠金额
   */
  @Transactional()
  async useCoupon(userCouponId: string, orderId: string, discountAmount: number) {
    const coupon = await this.userCouponRepo.findById(userCouponId);
    BusinessException.throwIfNull(coupon, CouponErrorMessages[CouponErrorCode.USER_COUPON_NOT_FOUND]);
    let couponForUsage = coupon;

    // userCoupon LOCKED→USED 的 CAS：第一次返回 1，第二次（重复触发）返回 0；
    // 需要继续走幂等路径，由 mkt_coupon_usage 的 (userCouponId, orderId) 唯一约束兜底
    const updated = await this.userCouponRepo.useCoupon(userCouponId, orderId);
    const isReplay = updated.count === 0;
    if (isReplay) {
      // CAS 失败后的券状态必须重新读取；CAS 前快照可能还是 LOCKED，会误判并发重投。
      const currentCoupon = await this.userCouponRepo.findById(userCouponId);
      BusinessException.throwIfNull(currentCoupon, CouponErrorMessages[CouponErrorCode.USER_COUPON_NOT_FOUND]);
      const alreadyUsedSameOrder = currentCoupon.status === UserCouponStatus.USED && currentCoupon.orderId === orderId;
      BusinessException.throwIf(!alreadyUsedSameOrder, CouponErrorMessages[CouponErrorCode.COUPON_USED]);
      couponForUsage = currentCoupon;
    }

    // 获取订单金额
    const orderAmount = await this.getOrderAmount(orderId);

    // 创建使用记录 — 配合 (userCouponId, orderId) 唯一约束 + P2002 捕获实现重投幂等
    try {
      await this.usageRepo.create({
        tenantId: couponForUsage.tenantId,
        userCoupon: {
          connect: { id: userCouponId },
        },
        memberId: couponForUsage.memberId,
        orderId,
        discountAmount: new Decimal(discountAmount),
        orderAmount: new Decimal(orderAmount),
      });
    } catch (error) {
      // Prisma P2002：唯一约束冲突。说明同一 (userCouponId, orderId) 已有 usage 行，
      // 判定为重投幂等，不写入也不抛错
      const prismaError = error as { code?: string };
      if (prismaError?.code === 'P2002') {
        this.logger.log({
          message: 'Coupon usage duplicate suppressed by unique constraint (idempotent replay)',
          userCouponId,
          orderId,
        });
        return;
      }
      throw error;
    }

    await this.messageTouchpointDispatcher.dispatch({
      type: MarketingEventType.COUPON_USED,
      tenantId: couponForUsage.tenantId,
      instanceId: userCouponId,
      configId: couponForUsage.templateId,
      memberId: couponForUsage.memberId,
      payload: {
        orderId,
        discountAmount,
        orderAmount,
      },
      timestamp: new Date(),
    });

    this.logger.log({
      message: 'Coupon used',
      userCouponId,
      orderId,
      discountAmount,
    });
  }

  /**
   * 解锁优惠券（订单取消或支付失败时）
   *
   * @param userCouponId 用户优惠券ID
   */
  @Transactional()
  async unlockCoupon(userCouponId: string, orderId: string) {
    const updated = await this.userCouponRepo.unlockCoupon(userCouponId, orderId);
    BusinessException.throwIf(updated.count === 0, CouponErrorMessages[CouponErrorCode.COUPON_LOCKED]);

    this.logger.log({
      message: 'Coupon unlocked',
      userCouponId,
      orderId,
    });
  }

  /**
   * 返还优惠券（订单退款时）
   *
   * @description 业务决策 B3：
   * - 券未过期：常规回退 USED → UNUSED
   * - 券已过期 + 模板仍 ACTIVE：自动延期 refundExpireExtendDays（默认 7 天）后回退 UNUSED
   * - 券已过期 + 模板下架/停用：降级写入 MktCouponRefundCompensation 表，
   *   状态 PENDING 等运营人工处理（如发同类替代券、退现金）
   */
  @Transactional()
  async refundCoupon(userCouponId: string, orderId: string) {
    const coupon = await this.userCouponRepo.findById(userCouponId);
    BusinessException.throwIfNull(coupon, CouponErrorMessages[CouponErrorCode.USER_COUPON_NOT_FOUND]);

    const now = new Date();
    const isExpired = now > coupon.endTime;

    if (!isExpired) {
      // 常规路径：未过期直接回退
      const updated = await this.userCouponRepo.refundCoupon(userCouponId, orderId);
      BusinessException.throwIf(updated.count === 0, CouponErrorMessages[CouponErrorCode.COUPON_USED]);
      this.logger.log({ message: 'Coupon refunded', userCouponId, orderId });
      return;
    }

    // 已过期：根据模板状态决定走"延期"还是"降级补偿"
    const template = await this.templateRepo.findById(coupon.templateId);

    if (template?.status === CouponStatus.ACTIVE) {
      // B3 主路径：自动延期 N 天后回退 UNUSED
      const extendDays = template.refundExpireExtendDays ?? 7;
      const newEndTime = new Date(now.getTime() + extendDays * 24 * 60 * 60 * 1000);
      const updated = await this.userCouponRepo.refundCouponWithExtend(userCouponId, orderId, newEndTime);
      BusinessException.throwIf(updated.count === 0, CouponErrorMessages[CouponErrorCode.COUPON_USED]);
      this.logger.log({
        message: 'Coupon refunded with auto-extend (B3)',
        userCouponId,
        orderId,
        extendDays,
        newEndTime,
      });
      return;
    }

    // B3 降级：模板已下架/停用，无法自动延期 — 写补偿表交给运营处理
    await this.prisma.mktCouponRefundCompensation.upsert({
      where: {
        userCouponId_orderId: { userCouponId, orderId },
      },
      create: {
        tenantId: coupon.tenantId,
        memberId: coupon.memberId,
        userCouponId,
        templateId: coupon.templateId,
        orderId,
        originalEndTime: coupon.endTime,
        reason: 'TEMPLATE_INACTIVE',
      },
      update: {
        // 重投幂等：仅刷新 reason 和 updateTime；状态保持原值（不覆盖运营已处理结果）
        reason: 'TEMPLATE_INACTIVE',
      },
    });
    this.logger.warn({
      message: 'Coupon refund fallback to compensation (B3 downgrade B2): template inactive',
      userCouponId,
      orderId,
      templateId: coupon.templateId,
    });
  }

  /**
   * 判断优惠券是否适用于订单
   *
   * @param coupon 优惠券
   * @param orderContext 订单上下文
   * @returns 是否适用
   */
  private isApplicableToOrder(
    coupon: {
      minOrderAmount: string | number | Decimal;
      applicableProducts?: string[];
      applicableCategories?: number[];
    },
    orderContext: OrderContext,
  ): boolean {
    // 检查最低消费
    if (orderContext.orderAmount < Number(coupon.minOrderAmount)) {
      return false;
    }

    // 检查适用商品（如果有限制）
    if (coupon.applicableProducts && coupon.applicableProducts.length > 0) {
      if (!orderContext.productIds || orderContext.productIds.length === 0) {
        return false;
      }
      const hasApplicableProduct = orderContext.productIds.some((productId) =>
        coupon.applicableProducts.includes(productId),
      );
      if (!hasApplicableProduct) {
        return false;
      }
    }

    // 检查适用分类（如果有限制）
    if (coupon.applicableCategories && coupon.applicableCategories.length > 0) {
      if (!orderContext.categoryIds || orderContext.categoryIds.length === 0) {
        return false;
      }
      const hasApplicableCategory = orderContext.categoryIds.some((categoryId) =>
        coupon.applicableCategories.includes(categoryId),
      );
      if (!hasApplicableCategory) {
        return false;
      }
    }

    return true;
  }

  /**
   * 获取订单金额
   *
   * @param orderId 订单ID
   * @returns 订单金额
   */
  private async getOrderAmount(orderId: string): Promise<number> {
    const order = await this.orderService.findByIdForMarketing(orderId);
    return order?.totalAmount ? Number(order.totalAmount) : 0;
  }
}
