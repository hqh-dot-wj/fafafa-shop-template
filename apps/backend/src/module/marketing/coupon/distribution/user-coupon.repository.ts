import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CouponDistributionType, CouponType, MktUserCoupon, Prisma, UserCouponStatus } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { BaseRepository } from 'src/common/repository/base.repository';
import { PrismaService } from 'src/prisma/prisma.service';

export type TryClaimCouponInput = {
  tenantId: string;
  memberId: string;
  templateId: string;
  couponName: string;
  couponType: CouponType;
  discountAmount?: Prisma.Decimal | number | string | null;
  discountPercent?: number | null;
  maxDiscountAmount?: Prisma.Decimal | number | string | null;
  minOrderAmount: Prisma.Decimal | number | string;
  startTime: Date;
  endTime: Date;
  distributionType: CouponDistributionType;
  limitPerUser: number;
};

type CouponClaimClient = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

/**
 * 用户优惠券仓储
 *
 * @description 继承 BaseRepository，自动处理租户隔离
 */
@Injectable()
export class UserCouponRepository extends BaseRepository<
  MktUserCoupon,
  Prisma.MktUserCouponCreateInput,
  Prisma.MktUserCouponUpdateInput
> {
  constructor(prisma: PrismaService, cls: ClsService) {
    super(prisma, cls, 'mktUserCoupon', 'id', 'tenantId');
  }

  /**
   * 查询用户已领取的优惠券数量
   *
   * @param memberId 用户ID
   * @param templateId 模板ID
   * @returns 已领取数量
   */
  async countUserCoupons(memberId: string, templateId: string): Promise<number> {
    return this.count({
      memberId,
      templateId,
    });
  }

  /**
   * 原子领取优惠券。
   *
   * 使用 INSERT ... SELECT ... HAVING 在单条 SQL 内完成同用户同模板领取序号派生与限领判断。
   * 并发下如果两个事务派生出相同 per_user_ord，由唯一索引裁决，上层可捕获并重试一次。
   */
  async tryClaim(input: TryClaimCouponInput, client?: CouponClaimClient) {
    const queryClient = client ?? (this.client as CouponClaimClient);
    const rows = await queryClient.$queryRaw<MktUserCoupon[]>`
      INSERT INTO "mkt_user_coupon" (
        "id",
        "tenant_id",
        "member_id",
        "template_id",
        "coupon_name",
        "coupon_type",
        "discount_amount",
        "discount_percent",
        "max_discount_amount",
        "min_order_amount",
        "start_time",
        "end_time",
        "status",
        "distribution_type",
        "per_user_ord",
        "receive_time"
      )
      SELECT
        ${randomUUID()},
        ${input.tenantId},
        ${input.memberId},
        ${input.templateId},
        ${input.couponName},
        CAST(${input.couponType} AS "CouponType"),
        ${input.discountAmount ?? null},
        ${input.discountPercent ?? null},
        ${input.maxDiscountAmount ?? null},
        ${input.minOrderAmount},
        ${input.startTime},
        ${input.endTime},
        CAST(${UserCouponStatus.UNUSED} AS "UserCouponStatus"),
        CAST(${input.distributionType} AS "CouponDistributionType"),
        COALESCE(MAX("per_user_ord"), 0) + 1,
        CURRENT_TIMESTAMP
      FROM "mkt_user_coupon"
      WHERE "member_id" = ${input.memberId}
        AND "template_id" = ${input.templateId}
      HAVING COALESCE(MAX("per_user_ord"), 0) + 1 <= ${input.limitPerUser}
      RETURNING *
    `;

    return rows[0] ?? null;
  }

  /**
   * 查询用户可用的优惠券列表
   *
   * @param memberId 用户ID
   * @param options 查询选项
   * @returns 可用优惠券列表
   */
  async findAvailableCoupons(
    memberId: string,
    options?: {
      minOrderAmount?: number;
      productIds?: string[];
      categoryIds?: number[];
    },
  ) {
    const where: Prisma.MktUserCouponWhereInput = {
      memberId,
      status: UserCouponStatus.UNUSED,
      startTime: { lte: new Date() },
      endTime: { gte: new Date() },
    };

    // 如果指定了订单金额，筛选满足条件的优惠券
    if (options?.minOrderAmount !== undefined) {
      where.template = {
        minOrderAmount: { lte: options.minOrderAmount },
      };
    }

    return this.findMany({
      where,
      include: {
        template: true,
      },
      orderBy: {
        createTime: 'desc',
      },
    });
  }

  /**
   * 查询用户的优惠券列表（分页）
   * 管理端不传 memberId 时查询全部用户优惠券（发放记录）
   *
   * @param memberId 用户ID（可选，不传则查全部）
   * @param status 状态筛选
   * @param pageNum 页码
   * @param pageSize 每页数量
   * @returns 分页结果
   */
  async findUserCouponsPage(memberId?: string, status?: UserCouponStatus, pageNum: number = 1, pageSize: number = 10) {
    const where: Prisma.MktUserCouponWhereInput = {};

    if (memberId) {
      where.memberId = memberId;
    }

    if (status) {
      where.status = status;
    }

    return this.findPage({
      pageNum,
      pageSize,
      where,
      include: {
        template: true,
      },
      orderBy: 'receiveTime',
      order: 'desc',
    });
  }

  /**
   * 锁定优惠券（订单创建时）
   *
   * @param couponId 优惠券ID
   * @param orderId 订单ID
   * @returns 更新结果
   */
  async lockCoupon(couponId: string, orderId: string) {
    return this.updateMany(
      {
        id: couponId,
        status: UserCouponStatus.UNUSED,
      },
      {
        status: UserCouponStatus.LOCKED,
        orderId: orderId,
      },
    );
  }

  /**
   * 使用优惠券（订单支付时）
   *
   * @param couponId 优惠券ID
   * @returns 更新结果
   */
  async useCoupon(couponId: string, orderId: string) {
    return this.updateMany(
      {
        id: couponId,
        status: UserCouponStatus.LOCKED,
        orderId,
      },
      {
        status: UserCouponStatus.USED,
        usedTime: new Date(),
      },
    );
  }

  /**
   * 解锁优惠券（订单取消时）
   *
   * @param couponId 优惠券ID
   * @returns 更新结果
   */
  async unlockCoupon(couponId: string, orderId: string) {
    return this.updateMany(
      {
        id: couponId,
        status: UserCouponStatus.LOCKED,
        orderId,
      },
      {
        status: UserCouponStatus.UNUSED,
        orderId: null,
      },
    );
  }

  /**
   * 退还优惠券（订单退款时）
   *
   * @param couponId 优惠券ID
   * @returns 更新结果
   */
  async refundCoupon(couponId: string, orderId: string) {
    return this.updateMany(
      {
        id: couponId,
        status: UserCouponStatus.USED,
        orderId,
      },
      {
        status: UserCouponStatus.UNUSED,
        orderId: null,
        usedTime: null,
      },
    );
  }

  /**
   * 退款时把已过期券同时延期 + 状态置回 UNUSED（业务决策 B3）
   *
   * @description 与 refundCoupon 的区别：本方法在状态回退的同时把 endTime 推迟 extendDays 天，
   * 用于退款时券已过 endTime 的场景，让用户拿回券继续使用。
   */
  async refundCouponWithExtend(couponId: string, orderId: string, newEndTime: Date) {
    return this.updateMany(
      {
        id: couponId,
        status: UserCouponStatus.USED,
        orderId,
      },
      {
        status: UserCouponStatus.UNUSED,
        orderId: null,
        usedTime: null,
        endTime: newEndTime,
      },
    );
  }

  /**
   * 批量过期优惠券
   *
   * @returns 更新数量
   */
  async expireCoupons() {
    const result = await this.updateMany(
      {
        status: UserCouponStatus.UNUSED,
        endTime: { lt: new Date() },
      },
      {
        status: UserCouponStatus.EXPIRED,
      },
    );

    return result.count;
  }

  /**
   * 分批查询待过期的优惠券 ID
   */
  async findExpiredCouponIds(limit: number): Promise<string[]> {
    const rows = await this.findMany({
      where: {
        status: UserCouponStatus.UNUSED,
        endTime: { lt: new Date() },
      },
      select: { id: true },
      orderBy: { endTime: 'asc' },
      take: limit,
    });

    return rows.map((row) => row.id);
  }

  /**
   * 按 ID 批量标记优惠券为已过期
   */
  async markCouponsExpiredByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.updateMany(
      {
        id: { in: ids },
        status: UserCouponStatus.UNUSED,
      },
      {
        status: UserCouponStatus.EXPIRED,
      },
    );

    return result.count;
  }

  /**
   * 按 ID 查询已过期优惠券（用于事件发送）
   */
  async findExpiredCouponsByIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    return this.findMany({
      where: {
        id: { in: ids },
        status: UserCouponStatus.EXPIRED,
      },
      select: {
        id: true,
        tenantId: true,
        memberId: true,
        templateId: true,
        endTime: true,
      },
    });
  }

  /**
   * 分批查询"已锁定但已过有效期"的券 ID（问题 13）
   *
   * @description LOCKED 状态的券正常会随订单生命周期被解锁或转 USED；
   * 若关联订单的 listener 出错、Bull 队列重投耗尽等导致挂死，
   * 该券会留在 LOCKED 直到 endTime 过期。这里把它们转为 EXPIRED
   * 让账面状态收敛，避免长期保留 LOCKED 影响统计。
   */
  async findLockedExpiredCouponIds(limit: number): Promise<string[]> {
    const rows = await this.findMany({
      where: {
        status: UserCouponStatus.LOCKED,
        endTime: { lt: new Date() },
      },
      select: { id: true },
      orderBy: { endTime: 'asc' },
      take: limit,
    });

    return rows.map((row) => row.id);
  }

  /**
   * 按 ID 批量标记 LOCKED 超时优惠券为 EXPIRED
   *
   * @description 仅对当前仍处于 LOCKED 状态的行起作用（CAS 兜底），
   * 防止与并发的 unlock/use 事件竞争状态。
   */
  async markLockedCouponsExpiredByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.updateMany(
      {
        id: { in: ids },
        status: UserCouponStatus.LOCKED,
      },
      {
        status: UserCouponStatus.EXPIRED,
      },
    );

    return result.count;
  }
}
