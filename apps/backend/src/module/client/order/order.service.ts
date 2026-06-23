import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, OmsOrder, OmsOrderItem, OrderStatus, PayStatus } from '@prisma/client';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { ResponseCode, Result } from 'src/common/response';
import { BusinessException } from 'src/common/exceptions';
import { ClientInfoDto } from 'src/common/decorators/common.decorator';
import { CreateOrderDto, ListOrderDto, CancelOrderDto, OrderItemDto } from './dto/order.dto';
import { OrderDetailVo, OrderListItemVo, projectOrderAmountFields } from './vo/order.vo';
import { OrderRepository } from './order.repository';
import { OrderCheckoutService } from './services/order-checkout.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { FulfillmentService } from 'src/module/fulfillment/fulfillment.service';
import { OrderCreationApplicationService } from './services/order-creation-application.service';
import { OrderInventoryPort } from './ports/order-inventory.port';
import { OrderDomainEventPublisher } from './events/order-domain-event.publisher';

export interface SystemCancelOrderResult {
  orderId: string;
  status: 'cancelled' | 'not_found' | 'skipped' | 'conflict';
}

/**
 * C端订单服务
 * 提供订单的创建、查询、取消等功能
 */
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
    private readonly orderRepo: OrderRepository,
    private readonly checkoutService: OrderCheckoutService,
    private readonly orderCreationApplicationService: OrderCreationApplicationService,
    private readonly inventoryPort: OrderInventoryPort,
    private readonly orderEventPublisher: OrderDomainEventPublisher,
    private readonly fulfillmentService: FulfillmentService,
  ) {}

  /**
   * 结算预览 - 从购物车或直接购买获取结算信息
   *
   * @param memberId - 会员ID
   * @param tenantId - 租户ID
   * @param items - 订单项（含可选活动上下文）
   * @returns 结算预览
   */
  async getCheckoutPreview(memberId: string, tenantId: string, items: OrderItemDto[]) {
    return this.checkoutService.getCheckoutPreview(memberId, tenantId, items);
  }

  /**
   * 创建订单
   */
  async createOrder(memberId: string, dto: CreateOrderDto, clientInfo?: ClientInfoDto) {
    return this.orderCreationApplicationService.createOrder(memberId, dto, clientInfo);
  }

  /**
   * 获取订单列表
   */
  async getOrderList(memberId: string, dto: ListOrderDto) {
    const page = this.normalizePageQuery(dto);
    const where: Prisma.OmsOrderWhereInput = { memberId };
    const status = this.normalizeOrderStatus(dto.status);
    if (status) {
      where.status = status;
    }

    const [total, orders] = await Promise.all([
      this.orderRepo.count(where),
      this.orderRepo.findMany({
        where,
        include: {
          items: { take: 1 },
          _count: { select: { items: true } },
        },
        orderBy: { createTime: 'desc' },
        skip: (page.pageNum - 1) * page.pageSize,
        take: page.pageSize,
      }) as Promise<Array<OmsOrder & { items: OmsOrderItem[]; _count: { items: number } }>>,
    ]);

    const list: OrderListItemVo[] = orders.map((order) => ({
      id: order.id,
      orderSn: order.orderSn,
      status: order.status,
      payAmount: order.payAmount.toNumber(),
      itemCount: order._count?.items ?? order.items.length,
      coverImage: order.items[0]?.productImg || '',
      productName: order.items[0]?.productName || '',
      createTime: order.createTime,
    }));

    return Result.ok({ rows: list, total });
  }

  /**
   * 获取订单详情
   */
  async getOrderDetail(memberId: string, orderId: string): Promise<OrderDetailVo> {
    const order = (await this.orderRepo.findOne({ id: orderId, memberId }, { include: { items: true } })) as
      | (OmsOrder & { items: OmsOrderItem[] })
      | null;

    BusinessException.throwIfNull(order, '订单不存在');
    const validOrder = order; // 类型收窄：throwIfNull 保证非空
    const amounts = projectOrderAmountFields(validOrder);

    return {
      id: validOrder.id,
      orderSn: validOrder.orderSn,
      status: validOrder.status,
      payStatus: validOrder.payStatus,
      orderType: validOrder.orderType,
      totalAmount: amounts.totalAmount,
      freightAmount: amounts.freightAmount,
      discountAmount: amounts.discountAmount,
      payAmount: amounts.payAmount,
      receiverName: validOrder.receiverName || undefined,
      receiverPhone: validOrder.receiverPhone || undefined,
      receiverAddress: validOrder.receiverAddress || undefined,
      bookingTime: validOrder.bookingTime || undefined,
      serviceRemark: validOrder.serviceRemark || undefined,
      payTime: validOrder.payTime || undefined,
      createTime: validOrder.createTime,
      items: validOrder.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productImg: item.productImg,
        skuId: item.skuId,
        specData: item.specData as Record<string, string> | null,
        price: item.price.toNumber(),
        quantity: item.quantity,
        totalAmount: item.totalAmount.toNumber(),
        activityContextKey: item.activityContextKey,
        activityType: item.activityType,
        activityNameSnapshot: item.activityNameSnapshot,
        activityPriceSnapshot: item.activityPriceSnapshot?.toNumber() ?? null,
      })),
    };
  }

  /**
   * 取消订单
   */
  async cancelOrder(memberId: string, dto: CancelOrderDto) {
    const order = (await this.orderRepo.findOne({ id: dto.orderId, memberId }, { include: { items: true } })) as
      | (OmsOrder & { items: OmsOrderItem[] })
      | null;

    BusinessException.throwIfNull(order, '订单不存在');
    const validOrder = order; // 类型收窄：throwIfNull 保证非空
    if (validOrder.status === OrderStatus.CANCELLED) {
      return Result.ok(null, '订单已取消');
    }

    BusinessException.throwIf(
      validOrder.status !== OrderStatus.PENDING_PAY || validOrder.payStatus !== PayStatus.UNPAID,
      '只能取消待支付订单',
    );

    const cancelReason = this.normalizeCancelReason(dto.reason);
    // 1+2. CAS 关闭订单 + 恢复库存在同一事务中完成，保证原子性
    const { changed } = await this.cancelAndRestoreInventory(
      dto.orderId,
      validOrder.tenantId,
      validOrder.items,
      cancelReason,
      {
        orderSn: validOrder.orderSn,
        memberId,
        reason: cancelReason,
      },
    );
    if (!changed) {
      this.logger.warn(`订单取消状态冲突，已跳过后续处理: ${dto.orderId}`);
      return Result.ok(null, '订单状态已变化，请刷新后重试');
    }

    this.logger.log(`订单取消: ${validOrder.orderSn} `);

    return Result.ok(null, '订单已取消');
  }

  /**
   * 确认收货
   */
  async confirmReceipt(memberId: string, orderId: string) {
    return this.fulfillmentService.confirmProductReceiptForCustomer(memberId, orderId);
  }

  /**
   * 系统自动关闭订单
   */
  async cancelOrderBySystem(orderId: string, reason: string): Promise<SystemCancelOrderResult> {
    const order = (await this.orderRepo.findOne({ id: orderId }, { include: { items: true } })) as
      | (OmsOrder & { items: OmsOrderItem[] })
      | null;

    if (!order) {
      this.logger.warn(`Auto - cancel failed: Order ${orderId} not found`);
      return { orderId, status: 'not_found' };
    }

    // 必须同时保持待支付订单状态和未支付支付状态，防止支付回调已落库时仍释放库存。
    if (order.status !== OrderStatus.PENDING_PAY || order.payStatus !== PayStatus.UNPAID) {
      this.logger.log(`Auto - cancel skipped: Order ${orderId} status=${order.status}, payStatus=${order.payStatus}`);
      return { orderId, status: 'skipped' };
    }

    // 1+2. CAS 关闭订单 + 恢复库存在同一事务中完成，保证原子性
    const cancelReason = this.normalizeCancelReason(reason) || '超时未支付自动关闭';
    const { changed } = await this.cancelAndRestoreInventory(
      orderId,
      order.tenantId,
      order.items,
      this.buildSystemCancelRemark(order.remark, cancelReason),
      {
        orderSn: order.orderSn,
        memberId: order.memberId,
        reason: cancelReason,
      },
    );
    if (!changed) {
      this.logger.warn(`Auto-cancel conflict: Order ${orderId} status changed during CAS update`);
      return { orderId, status: 'conflict' };
    }

    this.logger.log(`Order ${orderId} auto - cancelled: ${cancelReason} `);
    return { orderId, status: 'cancelled' };
  }

  @Transactional()
  private async cancelAndRestoreInventory(
    orderId: string,
    tenantId: string,
    items: Pick<OmsOrderItem, 'skuId' | 'quantity'>[],
    remark?: string,
    event?: { orderSn: string; memberId: string; reason?: string },
  ): Promise<{ changed: boolean }> {
    const updateResult = await this.orderRepo.cancelUnpaidIfCurrent(orderId, remark);
    if (updateResult.count === 0) return { changed: false };
    await this.inventoryPort.releaseForOrderItems(tenantId, items);
    if (event) {
      await this.orderEventPublisher.publishCancelled({
        orderId,
        orderSn: event.orderSn,
        tenantId,
        memberId: event.memberId,
        reason: event.reason,
        cancelledAt: new Date(),
      });
    }
    return { changed: true };
  }

  private normalizeCancelReason(reason?: string | null) {
    const trimmed = reason?.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, 200);
  }

  private buildSystemCancelRemark(existingRemark: string | null | undefined, reason: string) {
    const cancelLine = `系统取消：${reason}`;
    if (!existingRemark) return cancelLine.slice(0, 500);

    const combined = `${existingRemark}\n${cancelLine}`;
    if (combined.length <= 500) return combined;

    const keepExistingLength = Math.max(0, 500 - cancelLine.length - 1);
    return `${existingRemark.slice(0, keepExistingLength)}\n${cancelLine}`;
  }

  private normalizePageQuery(dto: ListOrderDto) {
    const pageNum = Number(dto.pageNum ?? 1);
    const pageSize = Number(dto.pageSize ?? 10);
    BusinessException.throwIf(
      !Number.isInteger(pageNum) || pageNum < 1,
      '页码必须为大于等于 1 的整数',
      ResponseCode.PARAM_INVALID,
    );
    BusinessException.throwIf(
      !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50,
      '每页数量必须为 1 到 50 的整数',
      ResponseCode.PARAM_INVALID,
    );
    return { pageNum, pageSize };
  }

  private normalizeOrderStatus(status?: string): OrderStatus | undefined {
    const normalized = status?.trim();
    if (!normalized) return undefined;
    BusinessException.throwIf(
      !(Object.values(OrderStatus) as string[]).includes(normalized),
      '订单状态不合法',
      ResponseCode.PARAM_INVALID,
    );
    return normalized as OrderStatus;
  }
}
