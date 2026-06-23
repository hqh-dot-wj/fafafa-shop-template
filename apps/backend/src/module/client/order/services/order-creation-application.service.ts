import { Injectable, Logger } from '@nestjs/common';
import { OmsOrder, OmsOrderItem, OrderType, Prisma, ProductType } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';
import { ClientInfoDto } from 'src/common/decorators/common.decorator';
import { ResponseCode, Result } from 'src/common/response';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { GenerateUUID } from 'src/common/utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { CouponUsageService } from 'src/module/marketing/coupon/usage/usage.service';
import { PointsAccountService } from 'src/module/marketing/points/account/account.service';
import { DistributorEligibilityService } from 'src/module/store/distribution/services/distributor-eligibility.service';
import { CreateOrderDto, OrderItemDto } from '../dto/order.dto';
import { OrderAsyncTaskPort } from '../ports/order-async-task.port';
import { OrderCartPort } from '../ports/order-cart.port';
import { OrderInventoryPort } from '../ports/order-inventory.port';
import { OrderMarketingPort } from '../ports/order-marketing.port';
import { OrderRiskPort } from '../ports/order-risk.port';
import { OrderDomainEventPublisher } from '../events/order-domain-event.publisher';
import { OrderCheckoutService } from './order-checkout.service';
import { AttributionService } from './attribution.service';

type CheckoutPreviewResult = Awaited<ReturnType<OrderCheckoutService['getCheckoutPreview']>>;

interface CreateOrderInTxParams {
  memberId: string;
  dto: CreateOrderDto;
  preview: CheckoutPreviewResult;
  orderType: OrderType;
  shareUserId: string | null;
  referrerId: string | null;
  orderSn: string;
  couponDiscount: number;
  pointsDiscount: number;
  finalPayAmount: number;
}

@Injectable()
export class OrderCreationApplicationService {
  private readonly logger = new Logger(OrderCreationApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
    private readonly checkoutService: OrderCheckoutService,
    private readonly attributionService: AttributionService,
    private readonly inventoryPort: OrderInventoryPort,
    private readonly marketingPort: OrderMarketingPort,
    private readonly cartPort: OrderCartPort,
    private readonly riskPort: OrderRiskPort,
    private readonly asyncTaskPort: OrderAsyncTaskPort,
    private readonly orderEventPublisher: OrderDomainEventPublisher,
    private readonly couponUsageService: CouponUsageService,
    private readonly pointsAccountService: PointsAccountService,
    private readonly distributorEligibilityService: DistributorEligibilityService,
  ) {}

  async createOrder(memberId: string, dto: CreateOrderDto, clientInfo?: ClientInfoDto) {
    BusinessException.throwIf(!memberId, '请先登录');
    this.assertCreateOrderInput(dto);

    await this.riskPort.checkOrderRisk(memberId, dto.tenantId, clientInfo);

    const preview = await this.checkoutService.getCheckoutPreview(memberId, dto.tenantId, dto.items);
    await this.assertLocationAdmission(dto, preview);

    const orderType = this.resolveOrderType(preview);
    const lastTouchShareUserId = this.resolvePreviewLastTouchShareUserId(preview);
    const previewSkuIds = preview.items.map((item) => item.skuId).filter((id): id is string => !!id);
    const shareUserId = await this.resolveEligibleShareUserId(
      memberId,
      dto.tenantId,
      lastTouchShareUserId,
      previewSkuIds,
    );

    const member = await this.prisma.umsMember.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { memberId }) as Prisma.UmsMemberWhereInput,
    });
    const referrerId = member?.parentId || null;
    const orderSn = this.generateOrderSn();
    const discount = await this.marketingPort.calculateOrderDiscount(memberId, dto, preview);

    const order = await this.createOrderInTransaction({
      memberId,
      dto,
      preview,
      orderType,
      shareUserId,
      referrerId,
      orderSn,
      couponDiscount: discount.couponDiscount,
      pointsDiscount: discount.pointsDiscount,
      finalPayAmount: discount.finalPayAmount,
    });

    await this.handleOrderPostCommitEffects(order.id, order.orderSn, memberId, dto.tenantId);

    this.logger.log(`订单创建成功: ${order.orderSn}, 会员: ${memberId} `);

    return Result.ok(
      {
        orderId: order.id,
        orderSn: order.orderSn,
        payAmount: order.payAmount,
      },
      '订单创建成功',
    );
  }

  @Transactional()
  private async createOrderInTransaction(params: CreateOrderInTxParams): Promise<OmsOrder & { items: OmsOrderItem[] }> {
    const { memberId, dto, preview, orderType, shareUserId, referrerId, orderSn, couponDiscount, pointsDiscount } =
      params;
    const pointsRatioBySkuId = await this.buildPointsRatioMap(preview.items.map((item) => item.skuId));
    const totalDiscountAmount = this.resolveTotalDiscountAmount(preview.discountAmount, couponDiscount, pointsDiscount);
    this.assertOrderAmountInvariant({
      totalAmount: preview.totalAmount,
      freightAmount: preview.freightAmount,
      discountAmount: totalDiscountAmount,
      finalPayAmount: params.finalPayAmount,
    });

    const order = await this.prisma.omsOrder.create({
      data: {
        orderSn,
        memberId,
        tenantId: dto.tenantId,
        orderType,
        totalAmount: preview.totalAmount,
        freightAmount: preview.freightAmount,
        discountAmount: totalDiscountAmount,
        payAmount: params.finalPayAmount,
        userCouponId: dto.userCouponId,
        couponDiscount,
        pointsUsed: dto.pointsUsed || 0,
        pointsDiscount,
        receiverName: dto.receiverName,
        receiverPhone: dto.receiverPhone,
        receiverAddress: dto.receiverAddress,
        receiverLat: dto.receiverLat,
        receiverLng: dto.receiverLng,
        bookingTime: dto.bookingTime,
        serviceRemark: dto.serviceRemark,
        shareUserId,
        referrerId,
        remark: dto.remark,
        items: {
          create: preview.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            productImg: item.productImg,
            tenantId: dto.tenantId,
            productTypeSnapshot: item.productType,
            skuId: item.skuId,
            specData: item.specData || undefined,
            price: item.price,
            quantity: item.quantity,
            totalAmount: item.totalAmount,
            pointsRatio: pointsRatioBySkuId.get(item.skuId) ?? 100,
            activityContextKey: item.activityContextKey || null,
            activityType: item.activityType || null,
            activityConfigId: item.activityConfigId || null,
            activityNameSnapshot: item.activityNameSnapshot || null,
            activityPriceSnapshot: item.activityPriceSnapshot ?? null,
            activityStatusSnapshot: item.activityStatusSnapshot || null,
            activityCommissionModeSnapshot: item.activityCommissionModeSnapshot || null,
            activityCommissionRateSnapshot: item.activityCommissionRateSnapshot ?? null,
          })),
        },
      },
      include: { items: true },
    });

    await this.marketingPort.writeOrderItemAttributions(order.items, preview.items, shareUserId, referrerId);
    await this.marketingPort.ensureMemberUpgradePlayInstances(order, memberId);
    await this.marketingPort.ensureCourseGroupPlayInstances(order, dto, memberId);

    // 先完成库存与购物车消费，再冻结券/积分；前置步骤失败时不产生营销资产副作用。
    await this.inventoryPort.deductForOrderItems(dto.tenantId, dto.items, preview.items);
    await this.cartPort.consumeCheckedOutItems(memberId, dto.tenantId, dto.items);
    await this.applyOrderMarketingAssetLocks(order.id, memberId, dto);
    await this.publishOrderCreatedForMarketing(order.id, orderSn, memberId, dto);

    return order;
  }

  private resolveTotalDiscountAmount(previewDiscount: number, couponDiscount: number, pointsDiscount: number) {
    return new Prisma.Decimal(previewDiscount || 0)
      .add(couponDiscount || 0)
      .add(pointsDiscount || 0)
      .toNumber();
  }

  private assertOrderAmountInvariant(input: {
    totalAmount: number;
    freightAmount: number;
    discountAmount: number;
    finalPayAmount: number;
  }) {
    const expectedPayAmount = new Prisma.Decimal(input.totalAmount).add(input.freightAmount).sub(input.discountAmount);
    const actualPayAmount = new Prisma.Decimal(input.finalPayAmount);
    if (actualPayAmount.sub(expectedPayAmount).abs().gte(0.01)) {
      this.logger.error({
        message: 'Order amount invariant broken',
        totalAmount: input.totalAmount,
        freightAmount: input.freightAmount,
        discountAmount: input.discountAmount,
        finalPayAmount: input.finalPayAmount,
        expectedPayAmount: expectedPayAmount.toNumber(),
      });
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, '订单金额计算异常，请联系客服');
    }
  }

  private async applyOrderMarketingAssetLocks(
    orderId: string,
    memberId: string,
    dto: Pick<CreateOrderDto, 'userCouponId' | 'pointsUsed'>,
  ) {
    if (dto.userCouponId) {
      await this.couponUsageService.lockCouponInTx(dto.userCouponId, orderId);
    }

    if (dto.pointsUsed && dto.pointsUsed > 0) {
      await this.pointsAccountService.freezePointsInTx(memberId, dto.pointsUsed, orderId);
    }
  }

  private async publishOrderCreatedForMarketing(
    orderId: string,
    orderSn: string,
    memberId: string,
    dto: Pick<CreateOrderDto, 'tenantId' | 'userCouponId' | 'pointsUsed'>,
  ) {
    await this.orderEventPublisher.publishCreated({
      orderId,
      orderSn,
      tenantId: dto.tenantId,
      memberId,
      userCouponId: dto.userCouponId,
      pointsUsed: dto.pointsUsed,
      createdAt: new Date(),
    });
  }

  private async assertLocationAdmission(dto: CreateOrderDto, preview: CheckoutPreviewResult) {
    if (dto.receiverLat && dto.receiverLng) {
      await this.checkoutService.checkLocation(dto.tenantId, Number(dto.receiverLat), Number(dto.receiverLng));
      return;
    }

    if (preview.outOfRange) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, '超出服务范围，无法配送/服务');
    }
  }

  private async handleOrderPostCommitEffects(orderId: string, orderSn: string, memberId: string, tenantId: string) {
    try {
      await this.cartPort.syncCartToRedis(memberId, tenantId);
    } catch (error) {
      this.logger.error(`Sync cart to redis failed for order ${orderSn}`, error);
    }

    try {
      await this.asyncTaskPort.enqueueNotification(orderId);
    } catch (error) {
      this.logger.error(`Add notification job failed for ${orderSn}`, error);
    }

    try {
      await this.asyncTaskPort.enqueueAutoCancel(orderId);
    } catch (error) {
      this.logger.error(`Add auto-cancel job failed for ${orderSn}`, error);
    }
  }

  private assertCreateOrderInput(dto: CreateOrderDto) {
    BusinessException.throwIf(!dto.tenantId?.trim(), '租户ID不能为空', ResponseCode.PARAM_INVALID);
    BusinessException.throwIf(
      !Array.isArray(dto.items) || dto.items.length === 0,
      '订单商品不能为空',
      ResponseCode.PARAM_INVALID,
    );
    BusinessException.throwIf(dto.items.length > 50, '订单商品不能超过50项', ResponseCode.PARAM_INVALID);

    for (const item of dto.items) {
      BusinessException.throwIf(!item.skuId?.trim(), 'SKU不能为空', ResponseCode.PARAM_INVALID);
      const quantity = Number(item.quantity);
      BusinessException.throwIf(
        !Number.isInteger(quantity) || quantity <= 0,
        '订单商品数量必须大于0',
        ResponseCode.PARAM_INVALID,
      );
    }
  }

  private generateOrderSn(): string {
    const date = new Date();
    const prefix = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
    ].join('');
    return `${prefix}${GenerateUUID().slice(0, 8).toUpperCase()}`;
  }

  private resolveOrderType(preview: CheckoutPreviewResult): OrderType {
    const itemTypes = preview.items.map((item) => item.productType).filter((type): type is ProductType => !!type);
    const hasTypedItems = itemTypes.length > 0;
    const hasService = hasTypedItems ? itemTypes.includes(ProductType.SERVICE) : preview.hasService;
    const hasProduct = hasTypedItems ? itemTypes.includes(ProductType.REAL) : !preview.hasService;

    if (hasService && hasProduct) return OrderType.MIXED;
    if (hasService) return OrderType.SERVICE;
    return OrderType.PRODUCT;
  }

  private resolvePreviewLastTouchShareUserId(preview: CheckoutPreviewResult): string | null {
    // 设计稿 P0-04 §3.3.2：取 preview.items 中**最后一个**有 sid 的项作为结算时刻 last-touch；
    // 之前用 .find() 取的是第一个，等价于 first-touch，会让用户最近选中的归因被早期项覆盖。
    for (let i = preview.items.length - 1; i >= 0; i -= 1) {
      const shareUserId = preview.items[i]?.shareUserId?.trim();
      if (shareUserId) return shareUserId;
    }
    return null;
  }

  private async resolveEligibleShareUserId(
    memberId: string,
    tenantId: string,
    preferredShareUserId: string | null,
    cartSkuIds: string[],
  ): Promise<string | null> {
    if (preferredShareUserId && (await this.distributorEligibilityService.isActive(tenantId, preferredShareUserId))) {
      return preferredShareUserId;
    }

    // 仅限制在本次 preview 涉及的 sku 对应的 cart 行内查找 last-touch sid，
    // 避免 direct-buy / 不同购物车快照被会员历史 cart 的 sid 污染（设计稿 P0-04 §3.6）。
    const fallbackShareUserId = await this.attributionService.getFinalShareUserId(memberId, undefined, {
      tenantId,
      cartSkuIds,
    });
    if (fallbackShareUserId && (await this.distributorEligibilityService.isActive(tenantId, fallbackShareUserId))) {
      return fallbackShareUserId;
    }

    return null;
  }

  private async buildPointsRatioMap(skuIds: string[]): Promise<Map<string, number>> {
    if (skuIds.length === 0) return new Map();
    const uniqueSkuIds = [...new Set(skuIds)];
    type PointsRatioRow = { id: string; pointsRatio: number | null };
    type TenantSkuDelegate = {
      findMany?: (args: {
        where: Prisma.PmsTenantSkuWhereInput;
        select: { id: true; pointsRatio: true };
      }) => Promise<PointsRatioRow[]>;
      findFirst?: (args: {
        where: Prisma.PmsTenantSkuWhereInput;
        select: { pointsRatio: true };
      }) => Promise<{ pointsRatio: number | null } | null>;
    };

    const delegate = this.prisma.pmsTenantSku as unknown as TenantSkuDelegate;

    if (typeof delegate.findMany === 'function') {
      const rows = await delegate.findMany({
        where: this.tenantHelper.readWhereForDelegate('pmsTenantSku', {
          id: { in: uniqueSkuIds },
        }) as Prisma.PmsTenantSkuWhereInput,
        select: {
          id: true,
          pointsRatio: true,
        },
      });
      return new Map(rows.map((row) => [row.id, row.pointsRatio ?? 100]));
    }

    const pointsRatioMap = new Map<string, number>();
    if (typeof delegate.findFirst === 'function') {
      for (const skuId of uniqueSkuIds) {
        const row = await delegate.findFirst({
          where: this.tenantHelper.readWhereForDelegate('pmsTenantSku', {
            id: skuId,
          }) as Prisma.PmsTenantSkuWhereInput,
          select: {
            pointsRatio: true,
          },
        });
        pointsRatioMap.set(skuId, row?.pointsRatio ?? 100);
      }
    }
    return pointsRatioMap;
  }
}
