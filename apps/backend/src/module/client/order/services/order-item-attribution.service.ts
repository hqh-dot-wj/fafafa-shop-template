import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OmsOrderItem, OmsOrderItemAttribution, Prisma } from '@prisma/client';
import { CheckoutPreviewItemVo } from '../vo/order.vo';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class OrderItemAttributionService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cls?: ClsService,
  ) {}

  private get client(): PrismaService | Prisma.TransactionClient {
    return this.cls?.get<Prisma.TransactionClient>('PRISMA_TX') ?? this.prisma;
  }

  async createFromPreview(
    previewItem: CheckoutPreviewItemVo & { channel?: string | null },
    orderItemId: number,
    shareUserId: string | null,
    referrerId: string | null,
  ) {
    const shareChannel = previewItem.shareChannel ?? previewItem.channel ?? null;
    const secondaryBenefits = (previewItem.secondaryBenefits ?? []) as unknown as Prisma.InputJsonValue;
    return this.client.omsOrderItemAttribution.create({
      data: {
        orderItemId,
        tenantId: previewItem.tenantId ?? '000000',
        sourceSceneCodeSnapshot: previewItem.entrySceneCode ?? null,
        sourceModuleCodeSnapshot: previewItem.entryModuleCode ?? null,
        sourceChannelSnapshot: shareChannel,
        shareUserIdSnapshot: shareUserId,
        referrerIdSnapshot: referrerId,
        cardTemplateCodeSnapshot: previewItem.cardTemplateCode ?? null,
        resolverPolicyCodeSnapshot: previewItem.resolverPolicyCode ?? null,
        resolverReleaseNoSnapshot: previewItem.resolverReleaseNoSnapshot ?? null,
        secondaryBenefitsSnapshot: secondaryBenefits,
        entryContextSnapshot: {
          activityContextKey: previewItem.activityContextKey ?? null,
          channel: previewItem.channel ?? null,
          sid: previewItem.sid ?? null,
          shareChannel,
          activityVersionId: previewItem.activityVersionId ?? null,
          attributionWindowMinutes: previewItem.attributionWindowMinutes ?? null,
        },
      },
    });
  }

  async writeOrderItemFact(orderItem: OmsOrderItem, attribution: OmsOrderItemAttribution | null) {
    await this.client.rptOrderItemMarketingFact.upsert({
      where: { orderItemId: orderItem.id },
      update: {
        sourceSceneCode: attribution?.sourceSceneCodeSnapshot ?? null,
        sourceModuleCode: attribution?.sourceModuleCodeSnapshot ?? null,
        primaryOfferType: orderItem.activityType ?? null,
        finalPaidAmount: orderItem.orderItemFinalPaid ?? orderItem.totalAmount,
      },
      create: {
        tenantId: orderItem.tenantId ?? '000000',
        orderItemId: orderItem.id,
        sourceSceneCode: attribution?.sourceSceneCodeSnapshot ?? null,
        sourceModuleCode: attribution?.sourceModuleCodeSnapshot ?? null,
        primaryOfferType: orderItem.activityType ?? null,
        finalPaidAmount: orderItem.orderItemFinalPaid ?? orderItem.totalAmount,
      },
    });
  }
}
