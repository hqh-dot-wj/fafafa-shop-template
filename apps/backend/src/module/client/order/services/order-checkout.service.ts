import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { ResolutionService } from 'src/module/marketing/resolution/resolution.service';
import { BatchValidationService } from 'src/module/marketing/resolution/services/batch-validation.service';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { Decimal } from '@prisma/client/runtime/library';
import { DistShareTokenStatus, Prisma, PublishStatus, DelFlag, ProductType } from '@prisma/client';
import { OrderItemDto } from '../dto/order.dto';
import { CheckoutPreviewVo } from '../vo/order.vo';
import { CheckoutPreviewItemVo } from '../vo/order.vo';
import { AddressRepository } from '../../address/address.repository';
import { AdmissionService } from 'src/module/lbs/admission/admission.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { DistributorEligibilityService } from 'src/module/store/distribution/services/distributor-eligibility.service';
import { ShareTokenService } from 'src/module/store/distribution/services/share-token.service';

type CheckoutPreviewSkuRow = Prisma.PmsTenantSkuGetPayload<{
  include: {
    tenantProd: { include: { product: true } };
    globalSku: true;
  };
}>;

type CheckoutPreviewPreparedLine = {
  item: OrderItemDto;
  sku: CheckoutPreviewSkuRow;
  cartAttribution: CartAttributionSnapshot | null;
};

type CartAttributionSnapshot = {
  sid: string | null;
  shareUserId: string | null;
  shareChannel: string | null;
};

@Injectable()
export class OrderCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly batchValidationService: BatchValidationService,
    private readonly addressRepo: AddressRepository,
    private readonly admissionService: AdmissionService,
    private readonly tenantHelper: TenantHelper,
    private readonly shareTokenService: ShareTokenService,
    private readonly distributorEligibilityService: DistributorEligibilityService,
  ) {}

  /**
   * 校验配送范围（使用统一准入服务）
   */
  async checkLocation(tenantId: string, lat: number, lng: number) {
    await this.admissionService.checkLocationAdmission(tenantId, lat, lng);
  }

  /**
   * 结算预览 — 逐项校验活动上下文并确认活动价
   *
   * @param memberId - 会员ID
   * @param tenantId - 租户ID
   * @param items - 订单项列表（含可选活动上下文）
   * @returns 结算预览数据
   */
  async getCheckoutPreview(memberId: string, tenantId: string, items: OrderItemDto[]): Promise<CheckoutPreviewVo> {
    // 1. 批量查询 SKU 信息
    const skuIds = items.map((i) => i.skuId);
    const skus = await this.prisma.pmsTenantSku.findMany({
      where: this.tenantHelper.readWhereForDelegate('pmsTenantSku', { id: { in: skuIds }, isActive: true }),
      include: {
        tenantProd: {
          include: { product: true },
        },
        globalSku: true,
      },
    });

    // 2. 校验商品有效性 + Resolution 裁决
    const skuMap = new Map(skus.map((s) => [s.id, s]));
    const previewItems: CheckoutPreviewItemVo[] = [];
    let totalAmount = new Decimal(0);

    const cartAttributionByItemId = await this.loadCartAttributionByItemId(memberId, tenantId, items);
    const prepared: CheckoutPreviewPreparedLine[] = [];

    for (const item of items) {
      const sku = skuMap.get(item.skuId);
      BusinessException.throwIfNull(sku, `商品 ${item.skuId} 不存在或已下架`);
      BusinessException.throwIf(sku.tenantProd.tenantId !== tenantId, '商品不属于该门店');

      if (sku.stock >= 0 && sku.stock < item.quantity) {
        BusinessException.throwIf(true, `${sku.tenantProd.product.name} 库存不足`);
      }

      const product = sku.tenantProd.product;
      if (
        !sku.isActive ||
        sku.tenantProd.status !== PublishStatus.ON_SHELF ||
        product.delFlag === DelFlag.DELETE ||
        product.publishStatus !== PublishStatus.ON_SHELF
      ) {
        BusinessException.throw(ResponseCode.BUSINESS_ERROR, `商品 ${product.name} 已下架或暂停销售`);
      }

      prepared.push({ item, sku, cartAttribution: this.resolveCartAttribution(item, cartAttributionByItemId) });
    }

    const activityContexts = await this.batchValidationService.validateAndLockLines(
      prepared.map(({ item, sku }) => ({
        tenantId,
        memberId,
        productId: sku.tenantProd.productId,
        skuId: sku.id,
        activityContextKey: item.activityContextKey,
        scene: 'CHECKOUT_PREVIEW',
      })),
    );

    for (let i = 0; i < prepared.length; i += 1) {
      const { item, sku } = prepared[i];
      const activityContext = activityContexts[i] ?? null;
      const cartAttribution = prepared[i].cartAttribution;

      let finalPrice = sku.price;
      let activityContextKey: string | null = null;
      let activityType: string | null = null;
      let activityConfigId: string | null = null;
      let activityNameSnapshot: string | null = null;
      let activityPriceSnapshot: Decimal | null = null;
      let activityStatusSnapshot: string | null = null;
      let activityCommissionModeSnapshot: string | null = null;
      let activityCommissionRateSnapshot: Decimal | null = null;

      if (activityContext) {
        finalPrice = this.resolveActivityPrice(activityContext);
        activityContextKey = activityContext.activityContextKey;
        activityType = activityContext.activityType;
        activityConfigId = activityContext.configId;
        activityNameSnapshot = activityContext.activityName;
        activityPriceSnapshot = finalPrice;
        activityStatusSnapshot = activityContext.status;
        activityCommissionModeSnapshot = activityContext.commissionMode;
        activityCommissionRateSnapshot = activityContext.commissionRate;
      }

      const itemTotal = finalPrice.mul(item.quantity);
      totalAmount = totalAmount.add(itemTotal);

      previewItems.push({
        productId: sku.tenantProd.productId,
        productName: sku.tenantProd.product.name,
        productImg: sku.tenantProd.product.mainImages?.[0] || '',
        productType: sku.tenantProd.product.type,
        skuId: sku.id,
        specData: (sku.globalSku?.specValues as Record<string, string>) || null,
        price: finalPrice.toNumber(),
        quantity: item.quantity,
        totalAmount: itemTotal.toNumber(),
        originalPrice: sku.price.toNumber(),
        activityContextKey,
        activityType,
        activityConfigId,
        activityNameSnapshot,
        activityPriceSnapshot: activityPriceSnapshot?.toNumber() ?? null,
        activityStatusSnapshot,
        activityCommissionModeSnapshot,
        activityCommissionRateSnapshot: activityCommissionRateSnapshot?.toNumber() ?? null,
        tenantId,
        entrySceneCode: activityContext?.entrySceneCode ?? null,
        entryModuleCode: activityContext?.entryModuleCode ?? null,
        cardTemplateCode: activityContext?.cardTemplateCode ?? null,
        resolverPolicyCode: activityContext?.resolverPolicyCode ?? null,
        resolverReleaseNoSnapshot: activityContext?.resolverReleaseNo ?? null,
        activityVersionId: activityContext?.activityVersionId ?? null,
        attributionWindowMinutes: activityContext?.attributionWindowMinutes ?? null,
        sid: cartAttribution?.sid ?? null,
        shareUserId: cartAttribution?.shareUserId ?? null,
        shareChannel: cartAttribution?.shareChannel ?? activityContext?.shareChannel ?? null,
      });
    }

    // 3. 计算运费 (简化逻辑：暂时为0)
    const freightAmount = new Decimal(0);
    // 平台直降/商家补贴等折扣预留；优惠券抵扣在 OrderCreationApplicationService 下单时计算，积分抵扣同理
    const discountAmount = new Decimal(0);
    const payAmount = totalAmount.add(freightAmount).sub(discountAmount);

    // 4. LBS 距离验证（使用统一准入服务）
    let outOfRange = false;
    let defaultAddress = null;

    if (memberId) {
      defaultAddress = await this.addressRepo.findDefault(memberId);
    }

    if (defaultAddress && defaultAddress.latitude && defaultAddress.longitude) {
      outOfRange = !(await this.admissionService.isLocationInRange(
        tenantId,
        defaultAddress.latitude,
        defaultAddress.longitude,
      ));
    }

    // 5. 判断是否包含服务商品
    const hasService = skus.some((s) => s.tenantProd.product.type === ProductType.SERVICE);

    return {
      items: previewItems,
      totalAmount: totalAmount.toNumber(),
      freightAmount: freightAmount.toNumber(),
      discountAmount: discountAmount.toNumber(),
      payAmount: payAmount.toNumber(),
      defaultAddress: defaultAddress
        ? {
            name: defaultAddress.name,
            phone: defaultAddress.phone,
            address: `${defaultAddress.province}${defaultAddress.city}${defaultAddress.district}${defaultAddress.detail}`,
          }
        : undefined,
      hasService,
      outOfRange,
    };
  }

  /**
   * Helper: Calculate Distance
   */
  calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private resolveActivityPrice(activityContext: Awaited<ReturnType<ResolutionService['validateAndLock']>>): Decimal {
    return activityContext.activityPrice;
  }

  private async loadCartAttributionByItemId(
    memberId: string,
    tenantId: string,
    items: OrderItemDto[],
  ): Promise<Map<string, CartAttributionSnapshot | null>> {
    const cartItemIds = [...new Set(items.map((item) => item.cartItemId?.trim()).filter((id): id is string => !!id))];
    const result = new Map<string, CartAttributionSnapshot | null>();
    if (cartItemIds.length === 0) return result;

    const rows = await this.prisma.omsCartItem.findMany({
      where: this.tenantHelper.readWhereForDelegate('omsCartItem', {
        id: { in: cartItemIds },
        memberId,
        tenantId,
      }) as Prisma.OmsCartItemWhereInput,
      select: {
        id: true,
        sid: true,
        shareUserId: true,
      },
    });

    for (const row of rows) {
      result.set(row.id, await this.resolveCartAttributionSnapshot(row, tenantId));
    }
    return result;
  }

  private resolveCartAttribution(
    item: OrderItemDto,
    cartAttributionByItemId: Map<string, CartAttributionSnapshot | null>,
  ): CartAttributionSnapshot | null {
    const cartItemId = item.cartItemId?.trim();
    if (!cartItemId) return null;
    return cartAttributionByItemId.get(cartItemId) ?? null;
  }

  private async resolveCartAttributionSnapshot(
    row: { sid: string | null; shareUserId: string | null },
    tenantId: string,
  ): Promise<CartAttributionSnapshot | null> {
    const sid = row.sid?.trim();
    if (sid) {
      const token = await this.shareTokenService.findBySid(sid, tenantId);
      if (!token || token.status === DistShareTokenStatus.DISABLED) {
        return null;
      }
      if (!(await this.distributorEligibilityService.isActive(tenantId, token.shareUserId))) {
        return null;
      }
      return {
        sid: token.sid,
        shareUserId: token.shareUserId,
        shareChannel: this.resolveShareChannel(token.metadata),
      };
    }

    if (row.shareUserId?.trim()) {
      if (!(await this.distributorEligibilityService.isActive(tenantId, row.shareUserId.trim()))) {
        return null;
      }
      return {
        sid: null,
        shareUserId: row.shareUserId.trim(),
        shareChannel: null,
      };
    }
    return null;
  }

  private resolveShareChannel(metadata: unknown): string {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 'DIST_SHARE_TOKEN';
    const record = metadata as Record<string, unknown>;
    const channel = record.shareChannel ?? record.sourceChannel ?? record.channel;
    return typeof channel === 'string' && channel.trim() ? channel.trim() : 'DIST_SHARE_TOKEN';
  }
}
