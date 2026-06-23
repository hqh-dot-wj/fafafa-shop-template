import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderQueryPort, OrderForCommission, OrderItemForCommission } from '../ports/order-query.port';

/**
 * 订单查询适配器
 *
 * @description
 * 实现 OrderQueryPort，封装对 omsOrder 表的访问。
 * Finance 模块通过此适配器获取订单数据，而非直接访问 Prisma。
 *
 * @architecture A-T1: Commission 消除对 omsOrder 表的直接访问
 */
@Injectable()
export class OrderQueryAdapter extends OrderQueryPort {
  private readonly logger = new Logger(OrderQueryAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {
    super();
  }

  /**
   * 根据订单ID获取订单信息（含商品明细）
   */
  async findOrderForCommission(orderId: string): Promise<OrderForCommission | null> {
    const order = await this.prisma.omsOrder.findFirst({
      where: this.tenantHelper.readWhereForDelegate('omsOrder', { id: orderId }) as Prisma.OmsOrderWhereInput,
      include: { items: true },
    });

    if (!order) return null;

    return this.mapToOrderForCommission(order);
  }

  /**
   * 批量获取订单信息
   */
  async findOrdersForCommission(orderIds: string[]): Promise<Map<string, OrderForCommission>> {
    if (orderIds.length === 0) return new Map();

    const orders = await this.prisma.omsOrder.findMany({
      where: this.tenantHelper.readWhereForDelegate('omsOrder', { id: { in: orderIds } }),
      include: { items: true },
    });

    const result = new Map<string, OrderForCommission>();
    for (const order of orders) {
      result.set(order.id, this.mapToOrderForCommission(order));
    }

    return result;
  }

  /**
   * 查询时间窗口内缺少佣金记录的已支付订单（供补偿调度器使用）
   */
  async findPaidOrdersMissingCommissions(
    windowStart: Date,
    windowEnd: Date,
    limit: number,
  ): Promise<Array<{ id: string; tenantId: string }>> {
    return this.prisma.omsOrder.findMany({
      where: this.tenantHelper.readWhereForDelegate('omsOrder', {
        status: 'PAID',
        payTime: { gte: windowStart, lte: windowEnd },
        commissions: { none: {} },
      }) as Prisma.OmsOrderWhereInput,
      select: { id: true, tenantId: true },
      take: limit,
      orderBy: { payTime: 'asc' },
    });
  }

  /**
   * 映射订单数据到 OrderForCommission
   */
  private mapToOrderForCommission(order: {
    id: string;
    tenantId: string;
    memberId: string;
    shareUserId: string | null;
    orderType: string;
    status: string;
    totalAmount: Decimal | number | string;
    payAmount: Decimal | number | string;
    couponDiscount: Decimal | number | string | null;
    pointsDiscount: Decimal | number | string | null;
    items: Array<{
      id: number;
      skuId: string;
      productId: string | null;
      quantity: number;
      price: Decimal | number | string;
      activityCommissionModeSnapshot?: string | null;
      activityCommissionRateSnapshot?: Decimal | number | string | null;
      orderItemFinalPaid?: Decimal | number | string | null;
      activityType?: string | null;
      activityConfigId?: string | null;
      playInstanceId?: string | null;
    }>;
  }): OrderForCommission {
    return {
      id: order.id,
      tenantId: order.tenantId,
      memberId: order.memberId,
      shareUserId: order.shareUserId,
      orderType: order.orderType as OrderForCommission['orderType'],
      status: order.status as OrderForCommission['status'],
      totalAmount: this.toDecimal(order.totalAmount),
      payAmount: this.toDecimal(order.payAmount),
      couponDiscount: this.toDecimal(order.couponDiscount ?? 0),
      pointsDiscount: this.toDecimal(order.pointsDiscount ?? 0),
      items: order.items.map((item) => this.mapToOrderItem(item)),
    };
  }

  /**
   * 映射订单项数据（含活动佣金快照）
   */
  private mapToOrderItem(item: {
    id: number;
    skuId: string;
    productId: string | null;
    quantity: number;
    price: Decimal | number | string;
    activityCommissionModeSnapshot?: string | null;
    activityCommissionRateSnapshot?: Decimal | number | string | null;
    orderItemFinalPaid?: Decimal | number | string | null;
    activityType?: string | null;
    activityConfigId?: string | null;
    playInstanceId?: string | null;
  }): OrderItemForCommission {
    const price = this.toDecimal(item.price);
    const totalAmount = price.mul(item.quantity);
    return {
      skuId: item.skuId,
      productId: item.productId || '',
      quantity: item.quantity,
      price,
      totalAmount,
      id: item.id,
      activityCommissionModeSnapshot: item.activityCommissionModeSnapshot ?? null,
      activityCommissionRateSnapshot: item.activityCommissionRateSnapshot
        ? this.toDecimal(item.activityCommissionRateSnapshot)
        : null,
      orderItemFinalPaid: item.orderItemFinalPaid ? this.toDecimal(item.orderItemFinalPaid) : null,
      activityType: item.activityType ?? null,
      activityConfigId: item.activityConfigId ?? null,
      playInstanceId: item.playInstanceId ?? null,
    };
  }

  /**
   * 安全转换为 Decimal
   */
  private toDecimal(value: Decimal | number | string): Decimal {
    if (value instanceof Decimal) return value;
    return new Decimal(String(value));
  }
}
