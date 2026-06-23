import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * 佣金基数计算服务
 * 职责：计算佣金基数（支持原价/实付/兑换商品）
 */
@Injectable()
export class BaseCalculatorService {
  private readonly logger = new Logger(BaseCalculatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 计算佣金基数
   *
   * @description
   * 支持四种计算策略：
   * 1. ORIGINAL_PRICE: 基于商品原价（优惠由平台承担）
   * 2. ACTUAL_PAID: 基于实付金额（优惠由推广者承担）
   * 3. ZERO: 兑换商品不分佣 / 活动禁佣
   * 4. 活动 FIXED_RATE: orderItemFinalPaid × activityCommissionRateSnapshot
   *
   * 对有 activityCommissionModeSnapshot 的订单项：
   * - NONE → 不参与分佣（跳过）
   * - FIXED_RATE → 佣金池 = orderItemFinalPaid × activityCommissionRateSnapshot
   * - INHERIT / null → 走现有 SKU 分销逻辑
   *
   * @returns { base: 分佣基数, type: 基数类型, activityPool: 活动佣金池 }
   */
  async calculateCommissionBase(
    order: {
      items: Array<{
        skuId: string;
        totalAmount: Decimal;
        quantity: number;
        activityCommissionModeSnapshot?: string | null;
        activityCommissionRateSnapshot?: Decimal | null;
        orderItemFinalPaid?: Decimal | null;
      }>;
      totalAmount: Decimal;
      payAmount: Decimal;
    },
    baseType: string = 'ORIGINAL_PRICE',
  ): Promise<{ base: Decimal; type: string; activityPool: Decimal }> {
    if (baseType === 'ZERO') {
      return { base: new Decimal(0), type: 'ZERO', activityPool: new Decimal(0) };
    }

    let totalBase = new Decimal(0);
    let activityPool = new Decimal(0);
    let hasExchangeProduct = false;
    let hasNormalProduct = false;

    // 收集需要走 SKU 逻辑的项（INHERIT / null）
    const skuItems: typeof order.items = [];

    for (const item of order.items) {
      const activityMode = item.activityCommissionModeSnapshot;

      if (activityMode === 'NONE') {
        continue;
      }

      if (activityMode === 'FIXED_RATE' && item.orderItemFinalPaid && item.activityCommissionRateSnapshot) {
        const pool = item.orderItemFinalPaid.mul(item.activityCommissionRateSnapshot);
        activityPool = activityPool.add(pool);
        hasNormalProduct = true;
        this.logger.debug(
          `[CommissionBase] Activity FIXED_RATE item: ` +
            `paid=${item.orderItemFinalPaid.toFixed(2)}, rate=${item.activityCommissionRateSnapshot.toFixed(4)}, ` +
            `pool=${pool.toFixed(2)}`,
        );
        continue;
      }

      // INHERIT / null → 走 SKU 分销逻辑
      skuItems.push(item);
    }

    // 批量查询需要走 SKU 逻辑的 SKU
    if (skuItems.length > 0) {
      const skuIds = skuItems.map((item) => item.skuId);
      const tenantSkus = await this.prisma.pmsTenantSku.findMany({
        where: this.tenantHelper.readWhereForDelegate('pmsTenantSku', {
          id: { in: skuIds },
        }),
        include: { globalSku: true },
      });

      const skuMap = new Map(tenantSkus.map((sku) => [sku.id, sku]));

      for (const item of skuItems) {
        const tenantSku = skuMap.get(item.skuId);

        if (!tenantSku || tenantSku.distMode === 'NONE') {
          continue;
        }

        if (tenantSku.isExchangeProduct) {
          hasExchangeProduct = true;
          continue;
        }

        hasNormalProduct = true;

        let itemBase = new Decimal(0);
        if (tenantSku.distMode === 'RATIO') {
          itemBase = item.totalAmount.mul(tenantSku.distRate);
        } else if (tenantSku.distMode === 'FIXED') {
          itemBase = tenantSku.distRate.mul(item.quantity);
        }

        totalBase = totalBase.add(itemBase);
      }
    }

    // 合并 SKU 分销基数 + 活动佣金池
    totalBase = totalBase.add(activityPool);

    if (hasExchangeProduct && !hasNormalProduct) {
      return { base: new Decimal(0), type: 'ZERO', activityPool };
    }

    if (baseType === 'ACTUAL_PAID' && hasNormalProduct) {
      const originalPrice = order.totalAmount;
      const actualPaid = order.payAmount;

      if (originalPrice.gt(0)) {
        // 仅对 SKU 分销部分做 ACTUAL_PAID 缩减；活动池已按实付计算不再缩减
        const skuBase = totalBase.sub(activityPool);
        const ratio = actualPaid.div(originalPrice);
        const adjustedSkuBase = skuBase.mul(ratio);
        totalBase = adjustedSkuBase.add(activityPool);

        this.logger.debug(
          `[CommissionBase] Adjusted by actual paid: ` +
            `original=${originalPrice.toFixed(2)}, paid=${actualPaid.toFixed(2)}, ` +
            `ratio=${ratio.toFixed(4)}`,
        );
      }

      return { base: totalBase, type: 'ACTUAL_PAID', activityPool };
    }

    return { base: totalBase, type: 'ORIGINAL_PRICE', activityPool };
  }
}
