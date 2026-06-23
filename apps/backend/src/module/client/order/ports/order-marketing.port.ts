import { Inject, Injectable, forwardRef, Logger } from '@nestjs/common';
import { OmsOrder, OmsOrderItem, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { Result, ResponseCode } from 'src/common/response';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { getErrorMessage } from 'src/common/utils/error';
import type { CalculateDiscountDto } from 'src/module/marketing/integration/dto/calculate-discount.dto';
import { OrderIntegrationService } from 'src/module/marketing/integration/integration.service';
import type { OrderDiscountVo } from 'src/module/marketing/integration/vo/order-discount.vo';
import { PlayInstanceService } from 'src/module/marketing/instance/instance.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrderDto, OrderItemDto } from '../dto/order.dto';
import { OrderItemAttributionService } from '../services/order-item-attribution.service';
import { CheckoutPreviewItemVo } from '../vo/order.vo';

type CheckoutPreviewForMarketing = {
  payAmount: number;
  items: CheckoutPreviewItemVo[];
};

type DiscountDecision = {
  couponDiscount: number;
  pointsDiscount: number;
  finalPayAmount: number;
};

@Injectable()
export class OrderMarketingPort {
  private readonly logger = new Logger(OrderMarketingPort.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
    private readonly orderItemAttributionService: OrderItemAttributionService,
    @Inject(forwardRef(() => OrderIntegrationService))
    private readonly orderIntegrationService: OrderIntegrationService,
    @Inject(forwardRef(() => PlayInstanceService))
    private readonly playInstanceService: PlayInstanceService,
  ) {}

  async calculateDiscountPreview(memberId: string, dto: CalculateDiscountDto): Promise<Result<OrderDiscountVo>> {
    return this.orderIntegrationService.calculateOrderDiscount(memberId, dto);
  }

  async calculateOrderDiscount(
    memberId: string,
    dto: Pick<CreateOrderDto, 'items' | 'userCouponId' | 'pointsUsed'>,
    preview: CheckoutPreviewForMarketing,
  ): Promise<DiscountDecision> {
    const decision: DiscountDecision = {
      couponDiscount: 0,
      pointsDiscount: 0,
      finalPayAmount: new Decimal(String(preview.payAmount)).toNumber(),
    };

    if (!dto.userCouponId && (!dto.pointsUsed || dto.pointsUsed <= 0)) return decision;

    try {
      const discountResult = await this.orderIntegrationService.calculateOrderDiscount(memberId, {
        items: dto.items.map((item) => {
          const previewItem = preview.items.find((candidate) => candidate.skuId === item.skuId);
          return {
            productId: previewItem?.productId || '',
            productName: previewItem?.productName || '',
            price: new Decimal(String(previewItem?.price ?? 0)).toNumber(),
            quantity: item.quantity,
          };
        }),
        userCouponId: dto.userCouponId,
        pointsUsed: dto.pointsUsed,
      });

      if (discountResult.data) {
        decision.couponDiscount = discountResult.data.couponDiscount;
        decision.pointsDiscount = discountResult.data.pointsDiscount;
        decision.finalPayAmount = discountResult.data.finalAmount;
      }
      return decision;
    } catch (error) {
      const msg = getErrorMessage(error);
      this.logger.error(`计算优惠失败: ${msg}`);
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, `优惠计算失败: ${msg}`);
    }
  }

  async writeOrderItemAttributions(
    orderItems: OmsOrderItem[],
    previewItems: CheckoutPreviewItemVo[],
    shareUserId: string | null,
    referrerId: string | null,
  ): Promise<void> {
    const previewBySkuId = new Map<string, CheckoutPreviewItemVo[]>();
    for (const previewItem of previewItems) {
      if (!previewBySkuId.has(previewItem.skuId)) {
        previewBySkuId.set(previewItem.skuId, []);
      }
      previewBySkuId.get(previewItem.skuId)!.push(previewItem);
    }

    const skuConsumedCount = new Map<string, number>();
    for (const orderItem of orderItems) {
      const skuCount = skuConsumedCount.get(orderItem.skuId) ?? 0;
      const candidates = previewBySkuId.get(orderItem.skuId) ?? [];
      const previewItem = candidates[skuCount] ?? candidates[0];
      skuConsumedCount.set(orderItem.skuId, skuCount + 1);

      if (!previewItem) continue;

      const attribution = await this.orderItemAttributionService.createFromPreview(
        { ...previewItem, channel: null },
        orderItem.id,
        previewItem.shareUserId ?? shareUserId,
        referrerId,
      );
      await this.orderItemAttributionService.writeOrderItemFact(orderItem, attribution);
    }
  }

  async ensureMemberUpgradePlayInstances(order: OmsOrder & { items: OmsOrderItem[] }, memberId: string) {
    for (const item of order.items) {
      if (item.activityType !== 'MEMBER_UPGRADE' || !item.activityConfigId) continue;

      const exists = await this.prisma.playInstance.findFirst({
        where: this.tenantHelper.readWhereForDelegate('playInstance', {
          orderItemId: item.id,
        }) as Prisma.PlayInstanceWhereInput,
      });
      if (exists) continue;

      const createRes = await this.playInstanceService.create({
        tenantId: order.tenantId,
        memberId,
        configId: item.activityConfigId,
        templateCode: 'MEMBER_UPGRADE',
        orderSn: order.orderSn,
        orderId: order.id,
        orderItemId: item.id,
        instanceData: { quantity: item.quantity, orderId: order.id },
      });

      await this.bindCreatedPlayInstance(item.id, createRes);
    }
  }

  async ensureCourseGroupPlayInstances(
    order: OmsOrder & { items: OmsOrderItem[] },
    dto: Pick<CreateOrderDto, 'items' | 'groupId' | 'isLeader'>,
    memberId: string,
  ) {
    const requestItemsBySku = new Map<string, OrderItemDto[]>();
    for (const item of dto.items) {
      if (!requestItemsBySku.has(item.skuId)) {
        requestItemsBySku.set(item.skuId, []);
      }
      requestItemsBySku.get(item.skuId)!.push(item);
    }

    for (const orderItem of order.items) {
      if (orderItem.activityType !== 'COURSE_GROUP_BUY' || !orderItem.activityConfigId) continue;

      const exists = await this.prisma.playInstance.findFirst({
        where: this.tenantHelper.readWhereForDelegate('playInstance', {
          orderItemId: orderItem.id,
        }) as Prisma.PlayInstanceWhereInput,
      });
      if (exists) continue;

      const candidateItems = requestItemsBySku.get(orderItem.skuId) ?? [];
      const requestItem = candidateItems.shift();
      const fallbackGroupId = dto.groupId && dto.groupId.trim().length > 0 ? dto.groupId.trim() : null;
      const groupId =
        requestItem?.groupId && requestItem.groupId.trim().length > 0 ? requestItem.groupId.trim() : fallbackGroupId;
      const rawIsLeader = requestItem?.isLeader ?? dto.isLeader;
      const isLeader = groupId ? false : (rawIsLeader ?? true);

      const createRes = await this.playInstanceService.create({
        tenantId: order.tenantId,
        memberId,
        configId: orderItem.activityConfigId,
        templateCode: 'COURSE_GROUP_BUY',
        orderSn: order.orderSn,
        orderId: order.id,
        orderItemId: orderItem.id,
        instanceData: {
          quantity: orderItem.quantity,
          orderId: order.id,
          orderSn: order.orderSn,
          skuId: orderItem.skuId,
          productId: orderItem.productId,
          groupId,
          parentId: groupId,
          isLeader,
          activityContextKey: orderItem.activityContextKey ?? null,
          activityType: orderItem.activityType ?? null,
        },
      });

      await this.bindCreatedPlayInstance(orderItem.id, createRes);
    }
  }

  private async bindCreatedPlayInstance(orderItemId: number, createRes: unknown) {
    if (!(createRes instanceof Result)) return;

    const created = createRes.data;
    if (created != null && typeof created === 'object' && 'id' in created) {
      const instanceId = (created as { id: unknown }).id;
      if (typeof instanceId === 'string') {
        await this.prisma.omsOrderItem.update({
          where: { id: orderItemId },
          data: { playInstanceId: instanceId },
        });
      }
    }
  }
}
