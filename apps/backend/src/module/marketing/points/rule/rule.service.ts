import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { ClsService } from 'nestjs-cls';
import { Result } from 'src/common/response/result';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { FormatDateFields } from 'src/common/utils';
import { TenantContext } from 'src/common/tenant';
import { PointsRuleRepository } from './rule.repository';
import { UpdatePointsRuleDto } from './dto/update-points-rule.dto';
import { PointsErrorCode, PointsErrorMessages } from '../constants/error-codes';

/**
 * 积分规则服务
 *
 * @description 提供积分规则的配置管理、积分计算、验证等功能
 */
@Injectable()
export class PointsRuleService {
  private readonly logger = new Logger(PointsRuleService.name);

  constructor(
    private readonly repo: PointsRuleRepository,
    private readonly cls: ClsService,
  ) {}

  /**
   * 查询当前租户积分规则原始记录（不自动创建默认值、不包装 Result）
   *
   * @description 用于 addPoints 等高频读取规则的内部场景，避免每次都触发默认规则写入。
   */
  async findRules() {
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
    return this.repo.findByTenantId(tenantId);
  }

  /**
   * 根据当前租户规则推导积分有效期：
   * 未启用或天数缺失时返回 null（永久），启用且 days>0 时返回 now + days。
   */
  async resolveExpireTime(now: Date = new Date()): Promise<Date | null> {
    const rules = await this.findRules();
    if (!rules || !rules.systemEnabled) return null;
    if (!rules.pointsValidityEnabled) return null;
    if (!rules.pointsValidityDays || rules.pointsValidityDays <= 0) return null;
    const expire = new Date(now.getTime());
    expire.setDate(expire.getDate() + rules.pointsValidityDays);
    return expire;
  }

  /**
   * 获取租户积分规则配置
   *
   * @returns 积分规则
   */
  async getRules() {
    // 租户ID 由 TenantMiddleware 从 header 'tenant-id' 提取，未提供时使用 SUPER_TENANT_ID
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
    let rules = await this.repo.findByTenantId(tenantId);

    // 如果不存在，创建默认规则
    if (!rules) {
      const userId = this.cls.get('user')?.userId ?? this.cls.get('userId') ?? 'system';
      rules = await this.repo.create({
        tenantId,
        orderPointsEnabled: true,
        orderPointsRatio: new Decimal(1),
        orderPointsBase: new Decimal(1),
        signinPointsEnabled: true,
        signinPointsAmount: 10,
        pointsValidityEnabled: false,
        pointsValidityDays: null,
        pointsRedemptionEnabled: true,
        pointsRedemptionRatio: new Decimal(100),
        pointsRedemptionBase: new Decimal(1),
        maxPointsPerOrder: null,
        maxDiscountPercentOrder: 50,
        systemEnabled: true,
        createBy: userId,
      });
    }

    return Result.ok(FormatDateFields(rules));
  }

  /**
   * 更新积分规则配置
   *
   * @param dto 更新数据
   * @returns 更新后的规则
   */
  async updateRules(dto: UpdatePointsRuleDto) {
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
    const userId = this.cls.get('user')?.userId ?? this.cls.get('userId') ?? 'system';

    // 验证配置
    this.validateRuleConfig(dto);

    const repoData = this.dtoToRepoData(dto);
    const rules = await this.repo.upsert(tenantId, repoData, userId);

    this.logger.log(`积分规则已更新: tenantId=${tenantId}`);

    return Result.ok(FormatDateFields(rules));
  }

  /**
   * 将 DTO 转为仓储层可接受的格式（number → Decimal）
   */
  private dtoToRepoData(dto: UpdatePointsRuleDto): Partial<import('@prisma/client').MktPointsRule> {
    const result: Partial<import('@prisma/client').MktPointsRule> = {};

    if (dto.orderPointsEnabled !== undefined) result.orderPointsEnabled = dto.orderPointsEnabled;
    if (dto.orderPointsRatio !== undefined) result.orderPointsRatio = new Decimal(dto.orderPointsRatio);
    if (dto.orderPointsBase !== undefined) result.orderPointsBase = new Decimal(dto.orderPointsBase);
    if (dto.signinPointsEnabled !== undefined) result.signinPointsEnabled = dto.signinPointsEnabled;
    if (dto.signinPointsAmount !== undefined) result.signinPointsAmount = dto.signinPointsAmount;
    if (dto.pointsValidityEnabled !== undefined) result.pointsValidityEnabled = dto.pointsValidityEnabled;
    if (dto.pointsValidityDays !== undefined) result.pointsValidityDays = dto.pointsValidityDays;
    if (dto.pointsRedemptionEnabled !== undefined) result.pointsRedemptionEnabled = dto.pointsRedemptionEnabled;
    if (dto.pointsRedemptionRatio !== undefined) result.pointsRedemptionRatio = new Decimal(dto.pointsRedemptionRatio);
    if (dto.pointsRedemptionBase !== undefined) result.pointsRedemptionBase = new Decimal(dto.pointsRedemptionBase);
    if (dto.maxPointsPerOrder !== undefined) result.maxPointsPerOrder = dto.maxPointsPerOrder;
    if (dto.maxDiscountPercentOrder !== undefined) result.maxDiscountPercentOrder = dto.maxDiscountPercentOrder;
    if (dto.systemEnabled !== undefined) result.systemEnabled = dto.systemEnabled;

    return result;
  }

  /**
   * 计算消费积分
   *
   * @param orderAmount 订单金额
   * @returns 应获得的积分数
   */
  async calculateOrderPoints(orderAmount: Decimal): Promise<number> {
    const tenantId = TenantContext.getTenantId();
    const rules = await this.repo.findByTenantId(tenantId);

    if (!rules || !rules.orderPointsEnabled || !rules.systemEnabled) {
      return 0;
    }

    // 计算公式: floor(orderAmount / orderPointsBase) * orderPointsRatio
    const points = orderAmount.div(rules.orderPointsBase).floor().mul(rules.orderPointsRatio);

    return Math.max(0, points.floor().toNumber());
  }

  /**
   * 按商品明细计算消费积分（新方法，防止积分套利）
   *
   * @param items 订单商品明细
   * @param baseAmount 积分计算基数（原价 - 优惠券抵扣，不包括积分抵扣）
   * @param totalAmount 订单原价
   * @returns 每个商品的积分明细
   */
  async calculateOrderPointsByItems(
    items: Array<{
      skuId: string;
      price: Decimal;
      quantity: number;
      pointsRatio: number;
    }>,
    baseAmount: Decimal,
    totalAmount: Decimal,
  ): Promise<Array<{ skuId: string; earnedPoints: number }>> {
    const tenantId = TenantContext.getTenantId();
    const rules = await this.repo.findByTenantId(tenantId);

    if (!rules || !rules.orderPointsEnabled || !rules.systemEnabled) {
      return items.map((item) => ({ skuId: item.skuId, earnedPoints: 0 }));
    }

    // 如果基数金额为0或负数，不产生积分
    if (baseAmount.lte(0) || totalAmount.lte(0)) {
      return items.map((item) => ({ skuId: item.skuId, earnedPoints: 0 }));
    }

    const result: Array<{ skuId: string; earnedPoints: number }> = [];

    for (const item of items) {
      // 计算该商品在订单中的金额占比
      const itemTotalAmount = item.price.mul(item.quantity);
      const itemRatio = itemTotalAmount.div(totalAmount);

      // 该商品应分摊的积分计算基数
      const itemBaseAmount = baseAmount.mul(itemRatio);

      // 计算该商品的基础积分
      const basePoints = itemBaseAmount.div(rules.orderPointsBase).floor().mul(rules.orderPointsRatio);

      // 应用商品的积分比例（0-100）
      const earnedPoints = basePoints.mul(new Decimal(item.pointsRatio).div(100)).floor();

      result.push({
        skuId: item.skuId,
        earnedPoints: Math.max(0, earnedPoints.toNumber()),
      });
    }

    return result;
  }

  /**
   * 计算积分抵扣金额
   *
   * @param points 使用的积分数
   * @returns 抵扣金额
   */
  async calculatePointsDiscount(points: number): Promise<Decimal> {
    const tenantId = TenantContext.getTenantId();
    const rules = await this.repo.findByTenantId(tenantId);

    if (!rules || !rules.pointsRedemptionEnabled || !rules.systemEnabled) {
      return new Decimal(0);
    }

    // 计算公式: floor(points / pointsRedemptionRatio) * pointsRedemptionBase
    const discount = new Decimal(points).div(rules.pointsRedemptionRatio).floor().mul(rules.pointsRedemptionBase);

    return Decimal.max(0, discount);
  }

  /**
   * 验证积分使用是否合法
   *
   * @param points 使用的积分数
   * @param originalAmount 订单原价（未扣券前）
   * @param couponDiscount 当前订单已应用的优惠券抵扣金额（默认 0）
   * @throws BusinessException 如果验证失败
   *
   * @description 业务决策 A2：maxDiscountPercentOrder 限制的是"券 + 积分"组合相对原价的总抵扣比例，
   * 故积分可抵扣上限 = originalAmount × pct% - couponDiscount。
   * 这样组合抵扣无法穿透护栏，符合运营/财务的"单笔最大让利占原价 X%" 直觉。
   */
  async validatePointsUsage(points: number, originalAmount: Decimal, couponDiscount: Decimal | number = 0) {
    const tenantId = TenantContext.getTenantId();
    const rules = await this.repo.findByTenantId(tenantId);

    if (!rules || !rules.pointsRedemptionEnabled || !rules.systemEnabled) {
      BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.REDEMPTION_DISABLED]);
    }

    // 验证单笔订单最多可使用积分数量
    if (rules.maxPointsPerOrder && points > rules.maxPointsPerOrder) {
      BusinessException.throw(
        400,
        `${PointsErrorMessages[PointsErrorCode.POINTS_EXCEED_LIMIT]}: ${rules.maxPointsPerOrder}`,
      );
    }

    // 验证最大抵扣比例（按原价基数）
    if (rules.maxDiscountPercentOrder) {
      const discount = await this.calculatePointsDiscount(points);
      const totalAllowedDiscount = originalAmount.mul(new Decimal(rules.maxDiscountPercentOrder).div(100));
      const maxDiscount = Decimal.max(0, totalAllowedDiscount.sub(couponDiscount));

      if (discount.gt(maxDiscount)) {
        BusinessException.throw(
          400,
          `${PointsErrorMessages[PointsErrorCode.DISCOUNT_EXCEED_LIMIT]}: ${rules.maxDiscountPercentOrder}%`,
        );
      }
    }
  }

  /**
   * 验证规则配置的合法性
   *
   * @param dto 规则配置
   * @throws BusinessException 如果配置不合法
   */
  private validateRuleConfig(dto: UpdatePointsRuleDto) {
    // 验证消费积分配置
    if (dto.orderPointsEnabled) {
      if (dto.orderPointsBase !== undefined && dto.orderPointsBase <= 0) {
        BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.RULE_CONFIG_INVALID]);
      }
      if (dto.orderPointsRatio !== undefined && dto.orderPointsRatio < 0) {
        BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.RULE_CONFIG_INVALID]);
      }
    }

    // 验证签到积分配置
    if (dto.signinPointsEnabled) {
      if (dto.signinPointsAmount !== undefined && dto.signinPointsAmount <= 0) {
        BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.RULE_CONFIG_INVALID]);
      }
    }

    // 验证积分有效期配置
    if (dto.pointsValidityEnabled) {
      if (dto.pointsValidityDays !== undefined && dto.pointsValidityDays <= 0) {
        BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.RULE_CONFIG_INVALID]);
      }
    }

    // 验证积分抵扣配置
    if (dto.pointsRedemptionEnabled) {
      if (dto.pointsRedemptionBase !== undefined && dto.pointsRedemptionBase <= 0) {
        BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.RULE_CONFIG_INVALID]);
      }
      if (dto.pointsRedemptionRatio !== undefined && dto.pointsRedemptionRatio < 0) {
        BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.RULE_CONFIG_INVALID]);
      }
      if (dto.maxPointsPerOrder !== undefined && dto.maxPointsPerOrder < 0) {
        BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.RULE_CONFIG_INVALID]);
      }
      if (
        dto.maxDiscountPercentOrder !== undefined &&
        (dto.maxDiscountPercentOrder < 1 || dto.maxDiscountPercentOrder > 100)
      ) {
        BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.RULE_CONFIG_INVALID]);
      }
    }
  }
}
