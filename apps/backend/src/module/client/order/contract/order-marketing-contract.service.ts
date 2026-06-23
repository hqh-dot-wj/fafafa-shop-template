import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderServiceContract } from '../order-service.token';
import { OrderForMarketing, OrderSummaryForMarketing } from './order-for-marketing.type';

@Injectable()
export class OrderMarketingContractService implements OrderServiceContract {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  async findByIdForMarketing(orderId: string, includeItems = false): Promise<OrderForMarketing | null> {
    return this.prisma.omsOrder.findFirst({
      where: this.tenantHelper.readWhereForDelegate('omsOrder', { id: orderId }) as Prisma.OmsOrderWhereInput,
      include: includeItems ? { items: true } : undefined,
    }) as Promise<OrderForMarketing | null>;
  }

  async findBySnForMarketing(orderSn: string): Promise<OrderSummaryForMarketing | null> {
    return this.prisma.omsOrder.findFirst({
      where: this.tenantHelper.readWhereForDelegate('omsOrder', { orderSn }) as Prisma.OmsOrderWhereInput,
      select: {
        id: true,
        tenantId: true,
        memberId: true,
        orderSn: true,
      },
    });
  }

  async updateOrderPointsEarned(
    orderId: string,
    itemPoints: Array<{ skuId: string; earnedPoints: number }>,
    totalPoints: number,
  ): Promise<void> {
    for (const item of itemPoints) {
      await this.prisma.omsOrderItem.updateMany({
        where: this.tenantHelper.readWhereForDelegate('omsOrderItem', {
          orderId,
          skuId: item.skuId,
        }) as Prisma.OmsOrderItemWhereInput,
        data: {
          earnedPoints: item.earnedPoints,
        },
      });
    }

    const result = await this.prisma.omsOrder.updateMany({
      where: this.tenantHelper.readWhereForDelegate('omsOrder', { id: orderId }) as Prisma.OmsOrderWhereInput,
      data: { pointsEarned: totalPoints },
    });

    if (result.count === 0) {
      BusinessException.throw(404, '订单不存在');
    }
  }
}
