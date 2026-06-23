import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';

export interface OrderItemFactInput {
  orderItemId: number;
  tenantId: string;
  sourceSceneCode?: string | null;
  sourceModuleCode?: string | null;
  primaryOfferType?: string | null;
  finalPaidAmount: Decimal | number;
}

@Injectable()
export class ReportFactService {
  private readonly logger = new Logger(ReportFactService.name);

  constructor(private readonly prisma: PrismaService) {}

  async backfillFromOrder(orderId: string, items: OrderItemFactInput[]) {
    for (const item of items) {
      await this.prisma.rptOrderItemMarketingFact.upsert({
        where: { orderItemId: item.orderItemId },
        update: {
          sourceSceneCode: item.sourceSceneCode ?? null,
          sourceModuleCode: item.sourceModuleCode ?? null,
          primaryOfferType: item.primaryOfferType ?? null,
          finalPaidAmount: item.finalPaidAmount,
        },
        create: {
          tenantId: item.tenantId,
          orderItemId: item.orderItemId,
          sourceSceneCode: item.sourceSceneCode ?? null,
          sourceModuleCode: item.sourceModuleCode ?? null,
          primaryOfferType: item.primaryOfferType ?? null,
          finalPaidAmount: item.finalPaidAmount,
        },
      });
    }
    this.logger.debug(`Backfilled ${items.length} marketing facts for order ${orderId}`);
  }
}
