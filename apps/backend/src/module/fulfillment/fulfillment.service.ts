import { Injectable, Logger } from '@nestjs/common';
import {
  FulfillmentActorType,
  FulfillmentAssignmentStatus,
  FulfillmentEventType,
  FulfillmentOrder,
  FulfillmentShipmentStatus,
  FulfillmentStatus,
  FulfillmentType,
  OrderStatus,
  OrderType,
  PayStatus,
  Prisma,
  ProductType,
  AuditStatus,
  WorkerStatus,
} from '@prisma/client';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { BusinessException } from 'src/common/exceptions';
import { Result, ResponseCode } from 'src/common/response';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { FormatDateFields } from 'src/common/utils';
import { PaginationHelper } from 'src/common/utils/pagination.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { FinanceCommandPort } from 'src/module/finance/ports/finance-command.port';
import { DistributionQualificationService } from 'src/module/store/distribution/qualification/qualification.service';
import {
  DiagnoseMissingFulfillmentDto,
  ListServiceDispatchDto,
  ListServiceWorkerCandidatesDto,
  ShipProductFulfillmentDto,
  ShipProductFulfillmentItemDto,
} from './dto/fulfillment.dto';
import {
  buildMissingFulfillmentBackfillPlan,
  initialFulfillmentStatusFor,
  skuTypeKey,
  toFulfillmentType,
} from './services/fulfillment-backfill-plan';

type OrderWithItemsAndFulfillments = Prisma.OmsOrderGetPayload<{
  include: {
    items: true;
    fulfillmentOrders: true;
  };
}>;

type FulfillmentWithOrderItem = Prisma.FulfillmentOrderGetPayload<{
  include: {
    orderItem: true;
  };
}>;

type FulfillmentEventPayload = Prisma.InputJsonObject | Prisma.InputJsonArray;

@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
    private readonly financeCommandPort: FinanceCommandPort,
    private readonly distributionQualificationService: DistributionQualificationService,
  ) {}

  @Transactional()
  async ensureForPaidOrder(orderId: string, tenantId?: string) {
    const order = await this.findOrderWithItemsAndFulfillments(orderId, tenantId);
    BusinessException.throwIfNull(order, '订单不存在');
    const validOrder = order;
    BusinessException.throwIf(
      ([OrderStatus.PENDING_PAY, OrderStatus.CANCELLED, OrderStatus.REFUNDED] as OrderStatus[]).includes(
        validOrder.status,
      ),
      '订单状态不允许创建履约单',
      ResponseCode.BUSINESS_ERROR,
    );

    const itemTypes = await this.resolveOrderItemTypes(validOrder, true);
    for (const item of validOrder.items) {
      const productType = itemTypes.get(item.id);
      BusinessException.throwIf(!productType, `订单项 ${item.id} 商品类型缺失，无法创建履约单`);

      const type = this.toFulfillmentType(productType);
      const existing = validOrder.fulfillmentOrders.find(
        (fulfillment) => fulfillment.orderItemId === item.id && fulfillment.type === type,
      );
      if (existing) continue;

      const status = this.initialStatusFor(type, validOrder.workerId);
      const fulfillment = await this.createFulfillmentOrder(validOrder, item.id, type, status);
      await this.recordEvent({
        tenantId: validOrder.tenantId,
        fulfillmentOrderId: fulfillment.id,
        orderId: validOrder.id,
        eventType: FulfillmentEventType.CREATE,
        toStatus: status,
        actorType: FulfillmentActorType.SYSTEM,
        payloadJson: {
          orderItemId: item.id,
          skuId: item.skuId,
          productType,
        },
      });

      if (type === FulfillmentType.SERVICE && validOrder.workerId != null) {
        await this.upsertAssignment(fulfillment.id, validOrder.tenantId, validOrder.workerId, '系统补建服务指派');
      }
    }

    return this.getOrderFulfillment(orderId, validOrder.tenantId);
  }

  async getOrderFulfillment(orderId: string, tenantId?: string) {
    const order = await this.prisma.omsOrder.findFirst({
      where: this.scopedStoreWhere({ id: orderId }, tenantId) as Prisma.OmsOrderWhereInput,
      include: {
        fulfillmentOrders: {
          orderBy: { createTime: 'asc' },
          include: {
            events: { orderBy: { createTime: 'asc' } },
            shipments: {
              orderBy: { createTime: 'asc' },
              include: { items: true },
            },
            assignments: { orderBy: { createTime: 'asc' } },
          },
        },
      },
    });
    BusinessException.throwIfNull(order, '订单不存在');

    return {
      orderId: order.id,
      orderSn: order.orderSn,
      orderStatus: order.status,
      orderType: order.orderType,
      fulfillments: order.fulfillmentOrders.map((fulfillment) => ({
        id: fulfillment.id,
        orderId: fulfillment.orderId,
        orderItemId: fulfillment.orderItemId,
        type: fulfillment.type,
        status: fulfillment.status,
        completedAt: fulfillment.completedAt,
        shipments: fulfillment.shipments.map((shipment) => ({
          id: shipment.id,
          carrierCode: shipment.carrierCode,
          carrierName: shipment.carrierName,
          trackingNo: shipment.trackingNo,
          status: shipment.status,
        })),
        assignments: fulfillment.assignments.map((assignment) => ({
          id: assignment.id,
          workerId: assignment.workerId,
          status: assignment.status,
        })),
        events: fulfillment.events.map((event) => ({
          id: event.id,
          eventType: event.eventType,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          actorType: event.actorType,
          createTime: event.createTime,
        })),
      })),
    };
  }

  async diagnoseMissingFulfillment(query: DiagnoseMissingFulfillmentDto) {
    const { skip, take, pageNum, pageSize } = PaginationHelper.getPagination(query);
    const where: Prisma.OmsOrderWhereInput = {
      items: {
        some: {
          fulfillmentOrders: { none: {} },
        },
      },
    };

    if (query.status) {
      where.status = query.status;
    } else {
      where.status = { in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED] };
    }
    if (query.orderSn) {
      where.orderSn = { contains: query.orderSn };
    }

    const scopedWhere = this.scopedStoreWhere(where) as Prisma.OmsOrderWhereInput;
    const [rows, total] = await Promise.all([
      this.prisma.omsOrder.findMany({
        where: scopedWhere,
        skip,
        take,
        orderBy: { createTime: 'desc' },
        include: {
          items: {
            include: {
              fulfillmentOrders: true,
            },
          },
          fulfillmentOrders: true,
        },
      }),
      this.prisma.omsOrder.count({ where: scopedWhere }),
    ]);

    const missingItems = rows.flatMap((order) => order.items.filter((item) => item.fulfillmentOrders.length === 0));
    const skuTypeMap = await this.loadSkuProductTypes(
      missingItems.map((item) => item.skuId),
      rows.map((order) => order.tenantId),
    );

    const resultRows = rows.map((order) => buildMissingFulfillmentBackfillPlan(order, skuTypeMap));

    return Result.page(resultRows, total, pageNum, pageSize);
  }

  async listServiceDispatch(query: ListServiceDispatchDto) {
    const { skip, take, pageNum, pageSize } = PaginationHelper.getPagination(query);
    const where: Prisma.OmsOrderWhereInput = {
      orderType: { in: [OrderType.SERVICE, OrderType.MIXED] },
      status: OrderStatus.PAID,
      workerId: null,
    };

    if (query.orderSn) where.orderSn = { contains: query.orderSn };
    if (query.receiverPhone) where.receiverPhone = { contains: query.receiverPhone };
    if (query.memberId) where.memberId = query.memberId;

    const scopedWhere = this.scopedStoreWhere(where) as Prisma.OmsOrderWhereInput;
    const [rows, total] = await Promise.all([
      this.prisma.omsOrder.findMany({
        where: scopedWhere,
        skip,
        take,
        include: {
          items: {
            take: 1,
            select: { productImg: true },
          },
          tenant: {
            select: { companyName: true },
          },
        },
        orderBy: [{ bookingTime: 'asc' }, { createTime: 'asc' }],
      }),
      this.prisma.omsOrder.count({ where: scopedWhere }),
    ]);

    const resultRows = rows.map((order) => ({
      ...order,
      productImg: order.items?.[0]?.productImg || '',
      commissionAmount: 0,
      remainingAmount: Number(order.payAmount),
      tenantName: order.tenant?.companyName || '',
    }));

    return Result.page(FormatDateFields(resultRows), total, pageNum, pageSize);
  }

  async listServiceWorkerCandidates(query: ListServiceWorkerCandidatesDto) {
    const tenantId = TenantContext.getTenantId();
    const { skip, take, pageNum, pageSize } = PaginationHelper.getPagination(query);
    const baseWhere: Prisma.SrvWorkerWhereInput = {
      status: { in: [WorkerStatus.WORKING, WorkerStatus.RESTING] },
      auditStatus: AuditStatus.APPROVED,
      tenantId,
    };

    const keyword = query.keyword?.trim();
    if (keyword) {
      baseWhere.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { nickName: { contains: keyword, mode: 'insensitive' } },
        { phone: { contains: keyword } },
      ];
    }

    const where = this.tenantHelper.readWhereForDelegate('srvWorker', baseWhere) as Prisma.SrvWorkerWhereInput;
    const [rows, total] = await Promise.all([
      this.prisma.srvWorker.findMany({
        where,
        skip,
        take,
        orderBy: { workerId: 'desc' },
        select: {
          workerId: true,
          name: true,
          nickName: true,
          phone: true,
          status: true,
          auditStatus: true,
          isOnline: true,
        },
      }),
      this.prisma.srvWorker.count({ where }),
    ]);

    return Result.page(rows, total, pageNum, pageSize);
  }

  @Transactional()
  async assignServiceForStore(
    orderId: string,
    workerId: number,
    operatorId: string,
    operationId?: string,
    remark?: string,
  ) {
    const order = await this.findStoreOrderForOperation(orderId);
    BusinessException.throwIfNull(order, '订单不存在');
    const validOrder = order;
    BusinessException.throwIf(
      validOrder.orderType !== OrderType.SERVICE && validOrder.orderType !== OrderType.MIXED,
      '订单不包含服务履约项',
      ResponseCode.BUSINESS_ERROR,
    );
    BusinessException.throwIf(
      validOrder.status !== OrderStatus.PAID && validOrder.status !== OrderStatus.SHIPPED,
      '订单状态不允许改派',
      ResponseCode.BUSINESS_ERROR,
    );

    await this.ensureForPaidOrder(orderId, validOrder.tenantId);
    const fulfillments = await this.findFulfillments(orderId, FulfillmentType.SERVICE, validOrder.tenantId);
    BusinessException.throwIf(fulfillments.length === 0, '订单不包含服务履约项');

    for (const fulfillment of fulfillments) {
      if (
        operationId &&
        (await this.hasOperation(fulfillment.tenantId, fulfillment.id, operationId, FulfillmentEventType.ASSIGN))
      ) {
        continue;
      }
      BusinessException.throwIf(
        ([FulfillmentStatus.FULFILLED, FulfillmentStatus.CANCELLED] as FulfillmentStatus[]).includes(
          fulfillment.status,
        ),
        '已完成或已取消的服务履约项不可改派',
      );

      const fromStatus = fulfillment.status;
      if (fromStatus !== FulfillmentStatus.ASSIGNED) {
        await this.transitionFulfillmentOrder(fulfillment, FulfillmentStatus.ASSIGNED, {
          eventType: FulfillmentEventType.ASSIGN,
          actorType: FulfillmentActorType.ADMIN,
          actorId: operatorId,
          operationId,
          remark,
          payloadJson: { workerId },
        });
      } else {
        await this.recordEvent({
          tenantId: fulfillment.tenantId,
          fulfillmentOrderId: fulfillment.id,
          orderId: fulfillment.orderId,
          eventType: FulfillmentEventType.ASSIGN,
          fromStatus,
          toStatus: fromStatus,
          actorType: FulfillmentActorType.ADMIN,
          actorId: operatorId,
          operationId,
          remark,
          payloadJson: { workerId },
        });
      }
      await this.upsertAssignment(fulfillment.id, fulfillment.tenantId, workerId, remark);
    }

    const updateResult = await this.prisma.omsOrder.updateMany({
      where: { id: orderId, tenantId: validOrder.tenantId },
      data: { workerId },
    });
    BusinessException.throwIf(updateResult.count === 0, '订单状态已变化，请刷新后重试', ResponseCode.BUSINESS_ERROR);

    return this.getOrderFulfillment(orderId, validOrder.tenantId);
  }

  @Transactional()
  async shipProductForStore(dto: ShipProductFulfillmentDto, operatorId: string) {
    const order = await this.findStoreOrderForOperation(dto.orderId);
    BusinessException.throwIfNull(order, '订单不存在');
    const validOrder = order;
    BusinessException.throwIf(
      validOrder.orderType !== OrderType.PRODUCT && validOrder.orderType !== OrderType.MIXED,
      '订单不包含实物履约项',
      ResponseCode.BUSINESS_ERROR,
    );
    const canShipByOrderStatus =
      validOrder.status === OrderStatus.PAID ||
      (validOrder.orderType === OrderType.MIXED && validOrder.status === OrderStatus.SHIPPED);
    BusinessException.throwIf(!canShipByOrderStatus, '仅「已支付待发货」状态的实物订单可发货');
    BusinessException.throwIf(validOrder.payStatus !== PayStatus.PAID, '订单未支付，不可发货');

    await this.ensureForPaidOrder(dto.orderId, validOrder.tenantId);
    const fulfillments = await this.findFulfillments(dto.orderId, FulfillmentType.PRODUCT, validOrder.tenantId);
    const selectedFulfillments = this.selectProductFulfillments(fulfillments, dto.items);
    BusinessException.throwIf(selectedFulfillments.length === 0, '订单不包含实物履约项');

    const shippedAt = dto.shippedAt ? new Date(dto.shippedAt) : new Date();
    let processedCount = 0;
    for (const fulfillment of selectedFulfillments) {
      if (
        dto.operationId &&
        (await this.hasOperation(fulfillment.tenantId, fulfillment.id, dto.operationId, FulfillmentEventType.SHIP))
      ) {
        continue;
      }
      BusinessException.throwIf(
        fulfillment.status !== FulfillmentStatus.PENDING_SHIPMENT &&
          fulfillment.status !== FulfillmentStatus.PARTIALLY_SHIPPED,
        '仅「已支付待发货」状态的实物订单可发货',
      );

      const shipment = await this.prisma.fulfillmentShipment.create({
        data: {
          tenantId: fulfillment.tenantId,
          fulfillmentOrderId: fulfillment.id,
          orderId: fulfillment.orderId,
          carrierCode: dto.carrierCode,
          carrierName: dto.carrierName,
          trackingNo: dto.trackingNo,
          shippedAt,
          status: FulfillmentShipmentStatus.SHIPPED,
          remark: dto.remark,
          createdBy: operatorId,
          items: {
            create: this.buildShipmentItems(fulfillment, dto.items),
          },
        },
      });

      await this.transitionFulfillmentOrder(fulfillment, FulfillmentStatus.SHIPPED, {
        eventType: FulfillmentEventType.SHIP,
        actorType: FulfillmentActorType.ADMIN,
        actorId: operatorId,
        operationId: dto.operationId,
        remark: dto.remark,
        payloadJson: {
          shipmentId: shipment.id,
          carrierCode: dto.carrierCode ?? null,
          carrierName: dto.carrierName ?? null,
          trackingNo: dto.trackingNo ?? null,
          shippedAt: shippedAt.toISOString(),
        },
      });
      processedCount++;
    }

    if (processedCount === 0) {
      return this.getOrderFulfillment(dto.orderId, validOrder.tenantId);
    }

    const line = dto.remark ? `管理员发货: ${dto.remark}` : '管理员发货';
    await this.syncMainOrderStatus(dto.orderId, validOrder.tenantId, line);
    this.logger.log(`订单 ${dto.orderId} 发货, 操作人: ${operatorId}`);
    return this.getOrderFulfillment(dto.orderId, validOrder.tenantId);
  }

  @Transactional()
  async confirmProductReceiptForStore(
    orderId: string,
    remark: string | undefined,
    operatorId: string,
    operationId?: string,
  ) {
    const order = await this.findStoreOrderForOperation(orderId);
    BusinessException.throwIfNull(order, '订单不存在');
    const validOrder = order;
    BusinessException.throwIf(
      validOrder.orderType !== OrderType.PRODUCT && validOrder.orderType !== OrderType.MIXED,
      '订单不包含实物履约项',
      ResponseCode.BUSINESS_ERROR,
    );
    BusinessException.throwIf(validOrder.payStatus !== PayStatus.PAID, '订单未支付，不可确认收货');

    const processed = await this.completeProductReceipt({
      orderId,
      tenantId: validOrder.tenantId,
      actorType: FulfillmentActorType.ADMIN,
      actorId: operatorId,
      remark,
      operationId,
      commissionFailureMode: 'throw',
      invalidStatusMessage: '仅「已发货」状态的实物订单可确认收货',
    });

    if (!processed) {
      return this.getOrderFulfillment(orderId, validOrder.tenantId);
    }

    const line = remark ? `管理员确认收货: ${remark}` : '管理员确认收货';
    await this.syncMainOrderStatus(orderId, validOrder.tenantId, line);
    this.logger.log(`订单 ${orderId} 管理员确认收货, 操作人: ${operatorId}`);
    return this.getOrderFulfillment(orderId, validOrder.tenantId);
  }

  @Transactional()
  async confirmProductReceiptForCustomer(memberId: string, orderId: string) {
    const order = await this.prisma.omsOrder.findFirst({
      where: this.scopedStoreWhere({ id: orderId, memberId }) as Prisma.OmsOrderWhereInput,
      select: { id: true, status: true, tenantId: true },
    });
    BusinessException.throwIfNull(order, '订单不存在');
    BusinessException.throwIf(order.status !== OrderStatus.SHIPPED, '订单状态不正确');

    await this.completeProductReceipt({
      orderId,
      tenantId: order.tenantId,
      actorType: FulfillmentActorType.CUSTOMER,
      actorId: memberId,
      remark: '用户确认收货',
      operationId: undefined,
      commissionFailureMode: 'log',
      invalidStatusMessage: '订单状态不正确',
    });

    await this.syncMainOrderStatus(orderId, order.tenantId);
    return Result.ok(null, '确认收货成功');
  }

  @Transactional()
  async verifyServiceForStore(orderId: string, remark: string | undefined, operatorId: string, operationId?: string) {
    const order = await this.findStoreOrderForOperation(orderId);
    BusinessException.throwIfNull(order, '订单不存在');
    const validOrder = order;
    BusinessException.throwIf(
      validOrder.orderType !== OrderType.SERVICE && validOrder.orderType !== OrderType.MIXED,
      '订单不包含服务履约项',
      ResponseCode.BUSINESS_ERROR,
    );
    BusinessException.throwIf(
      validOrder.status !== OrderStatus.SHIPPED,
      '订单状态不允许核销',
      ResponseCode.BUSINESS_ERROR,
    );

    await this.ensureForPaidOrder(orderId, validOrder.tenantId);
    const fulfillments = await this.findFulfillments(orderId, FulfillmentType.SERVICE, validOrder.tenantId);
    BusinessException.throwIf(fulfillments.length === 0, '订单不包含服务履约项');

    let processedCount = 0;
    for (const fulfillment of fulfillments) {
      if (
        operationId &&
        (await this.hasOperation(fulfillment.tenantId, fulfillment.id, operationId, FulfillmentEventType.VERIFY))
      ) {
        continue;
      }
      BusinessException.throwIf(
        ([FulfillmentStatus.FULFILLED, FulfillmentStatus.CANCELLED] as FulfillmentStatus[]).includes(
          fulfillment.status,
        ),
        '已完成或已取消的服务履约项不可核销',
      );

      let current: FulfillmentWithOrderItem | FulfillmentOrder = fulfillment;
      if (current.status !== FulfillmentStatus.SERVICE_DONE && current.status !== FulfillmentStatus.VERIFIED) {
        current = await this.transitionFulfillmentOrder(current, FulfillmentStatus.SERVICE_DONE, {
          eventType: FulfillmentEventType.DONE,
          actorType: FulfillmentActorType.ADMIN,
          actorId: operatorId,
          operationId,
          remark,
        });
      }
      current = await this.transitionFulfillmentOrder(current, FulfillmentStatus.VERIFIED, {
        eventType: FulfillmentEventType.VERIFY,
        actorType: FulfillmentActorType.ADMIN,
        actorId: operatorId,
        operationId,
        remark,
      });
      await this.transitionFulfillmentOrder(current, FulfillmentStatus.FULFILLED, {
        eventType: FulfillmentEventType.FULFILL,
        actorType: FulfillmentActorType.SYSTEM,
        actorId: operatorId,
        operationId,
        remark,
      });

      await this.prisma.fulfillmentAssignment.updateMany({
        where: {
          tenantId: fulfillment.tenantId,
          fulfillmentOrderId: fulfillment.id,
          status: { not: FulfillmentAssignmentStatus.CANCELLED },
        },
        data: {
          status: FulfillmentAssignmentStatus.DONE,
          doneAt: new Date(),
        },
      });
      processedCount++;
    }

    if (processedCount === 0) {
      return this.getOrderFulfillment(orderId, validOrder.tenantId);
    }

    await this.financeCommandPort.updateCommissionPlanSettleTime(orderId, 'VERIFY');
    await this.distributionQualificationService.markServiceOrderVerified(validOrder.tenantId, orderId);

    const line = remark ? `强制核销: ${remark}` : '强制核销';
    await this.syncMainOrderStatus(orderId, validOrder.tenantId, line);
    this.logger.log(`订单 ${orderId} 强制核销, 操作人: ${operatorId}`);
    return this.getOrderFulfillment(orderId, validOrder.tenantId);
  }

  private async completeProductReceipt(params: {
    orderId: string;
    tenantId: string;
    actorType: FulfillmentActorType;
    actorId: string;
    remark?: string;
    operationId?: string;
    commissionFailureMode: 'throw' | 'log';
    invalidStatusMessage: string;
  }): Promise<boolean> {
    await this.ensureForPaidOrder(params.orderId, params.tenantId);
    const fulfillments = await this.findFulfillments(params.orderId, FulfillmentType.PRODUCT, params.tenantId);
    BusinessException.throwIf(fulfillments.length === 0, params.invalidStatusMessage);

    let processedCount = 0;
    for (const fulfillment of fulfillments) {
      if (
        params.operationId &&
        (await this.hasOperation(
          fulfillment.tenantId,
          fulfillment.id,
          params.operationId,
          FulfillmentEventType.RECEIVE,
        ))
      ) {
        continue;
      }
      BusinessException.throwIf(
        fulfillment.status !== FulfillmentStatus.SHIPPED && fulfillment.status !== FulfillmentStatus.RECEIVED,
        params.invalidStatusMessage,
      );

      let current: FulfillmentWithOrderItem | FulfillmentOrder = fulfillment;
      if (current.status !== FulfillmentStatus.RECEIVED) {
        current = await this.transitionFulfillmentOrder(current, FulfillmentStatus.RECEIVED, {
          eventType: FulfillmentEventType.RECEIVE,
          actorType: params.actorType,
          actorId: params.actorId,
          operationId: params.operationId,
          remark: params.remark,
        });
      }
      await this.transitionFulfillmentOrder(current, FulfillmentStatus.FULFILLED, {
        eventType: FulfillmentEventType.FULFILL,
        actorType: FulfillmentActorType.SYSTEM,
        actorId: params.actorId,
        operationId: params.operationId,
        remark: params.remark,
      });
      processedCount++;
    }

    if (processedCount === 0) {
      return false;
    }

    try {
      await this.financeCommandPort.updateCommissionPlanSettleTime(params.orderId, 'CONFIRM');
    } catch (error) {
      if (params.commissionFailureMode === 'throw') throw error;
      this.logger.error(`Update commission settle time failed for order ${params.orderId}`, error);
    }
    return true;
  }

  private async findOrderWithItemsAndFulfillments(
    orderId: string,
    tenantId?: string,
  ): Promise<OrderWithItemsAndFulfillments | null> {
    // 内部履约补建也必须显式承接入口租户，避免后续复用退回裸 ID 读取。
    return this.prisma.omsOrder.findFirst({
      where: this.scopedStoreWhere({ id: orderId }, tenantId) as Prisma.OmsOrderWhereInput,
      include: {
        items: true,
        fulfillmentOrders: true,
      },
    });
  }

  private async findStoreOrderForOperation(orderId: string): Promise<OrderWithItemsAndFulfillments | null> {
    return this.prisma.omsOrder.findFirst({
      where: this.scopedStoreWhere({ id: orderId }) as Prisma.OmsOrderWhereInput,
      include: {
        items: true,
        fulfillmentOrders: true,
      },
    });
  }

  private async findFulfillments(
    orderId: string,
    type: FulfillmentType,
    tenantId?: string,
  ): Promise<FulfillmentWithOrderItem[]> {
    return this.prisma.fulfillmentOrder.findMany({
      where: this.scopedFulfillmentWhere({ orderId, type }, tenantId),
      orderBy: { createTime: 'asc' },
      include: { orderItem: true },
    });
  }

  private async resolveOrderItemTypes(
    order: OrderWithItemsAndFulfillments,
    persistSnapshot: boolean,
  ): Promise<Map<number, ProductType>> {
    const result = new Map<number, ProductType>();
    const missingItems = [];

    for (const item of order.items) {
      if (item.productTypeSnapshot) {
        result.set(item.id, item.productTypeSnapshot);
      } else {
        missingItems.push(item);
      }
    }
    if (missingItems.length === 0) return result;

    const skuTypeMap = await this.loadSkuProductTypes(
      missingItems.map((item) => item.skuId),
      [order.tenantId],
    );
    for (const item of missingItems) {
      const productType = skuTypeMap.get(this.skuTypeKey(order.tenantId, item.skuId));
      if (!productType) continue;
      result.set(item.id, productType);
      if (persistSnapshot) {
        await this.prisma.omsOrderItem.update({
          where: { id: item.id },
          data: {
            tenantId: item.tenantId ?? order.tenantId,
            productTypeSnapshot: productType,
          },
        });
      }
    }

    return result;
  }

  private async loadSkuProductTypes(skuIds: string[], tenantIds: string[]): Promise<Map<string, ProductType>> {
    const uniqueSkuIds = [...new Set(skuIds)];
    const uniqueTenantIds = [...new Set(tenantIds)];
    if (uniqueSkuIds.length === 0 || uniqueTenantIds.length === 0) return new Map();

    const rows = await this.prisma.pmsTenantSku.findMany({
      where: {
        id: { in: uniqueSkuIds },
        tenantId: { in: uniqueTenantIds },
      },
      include: {
        tenantProd: {
          include: { product: true },
        },
      },
    });

    return new Map(rows.map((row) => [skuTypeKey(row.tenantId, row.id), row.tenantProd.product.type]));
  }

  private skuTypeKey(tenantId: string, skuId: string): string {
    return skuTypeKey(tenantId, skuId);
  }

  private toFulfillmentType(productType: ProductType): FulfillmentType {
    return toFulfillmentType(productType);
  }

  private initialStatusFor(type: FulfillmentType, workerId: number | null): FulfillmentStatus {
    return initialFulfillmentStatusFor(type, workerId);
  }

  private async createFulfillmentOrder(
    order: OrderWithItemsAndFulfillments,
    orderItemId: number,
    type: FulfillmentType,
    status: FulfillmentStatus,
  ): Promise<FulfillmentOrder> {
    try {
      return await this.prisma.fulfillmentOrder.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          orderItemId,
          type,
          status,
        },
      });
    } catch (error) {
      if (this.isPrismaUniqueError(error)) {
        const existing = await this.prisma.fulfillmentOrder.findFirst({
          where: { tenantId: order.tenantId, orderId: order.id, orderItemId, type },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  private async transitionFulfillmentOrder(
    fulfillment: Pick<FulfillmentOrder, 'id' | 'tenantId' | 'orderId' | 'status'>,
    toStatus: FulfillmentStatus,
    options: {
      eventType: FulfillmentEventType;
      actorType: FulfillmentActorType;
      actorId?: string;
      operationId?: string;
      remark?: string;
      payloadJson?: FulfillmentEventPayload;
    },
  ): Promise<FulfillmentOrder> {
    const fromStatus = fulfillment.status;
    const completedAt = toStatus === FulfillmentStatus.FULFILLED ? new Date() : undefined;
    const result = await this.prisma.fulfillmentOrder.updateMany({
      where: { id: fulfillment.id, tenantId: fulfillment.tenantId, status: fromStatus },
      data: {
        status: toStatus,
        completedAt,
        version: { increment: 1 },
      },
    });
    BusinessException.throwIf(result.count === 0, '履约状态已变化，请刷新后重试', ResponseCode.BUSINESS_ERROR);

    await this.recordEvent({
      tenantId: fulfillment.tenantId,
      fulfillmentOrderId: fulfillment.id,
      orderId: fulfillment.orderId,
      eventType: options.eventType,
      fromStatus,
      toStatus,
      actorType: options.actorType,
      actorId: options.actorId,
      operationId: options.operationId,
      remark: options.remark,
      payloadJson: options.payloadJson,
    });

    return this.prisma.fulfillmentOrder.findFirstOrThrow({
      where: { id: fulfillment.id, tenantId: fulfillment.tenantId },
    });
  }

  private async recordEvent(args: {
    tenantId: string;
    fulfillmentOrderId: string;
    orderId: string;
    eventType: FulfillmentEventType;
    fromStatus?: FulfillmentStatus | null;
    toStatus?: FulfillmentStatus | null;
    actorType: FulfillmentActorType;
    actorId?: string;
    operationId?: string;
    remark?: string;
    payloadJson?: FulfillmentEventPayload;
  }) {
    try {
      await this.prisma.fulfillmentEvent.create({
        data: {
          tenantId: args.tenantId,
          fulfillmentOrderId: args.fulfillmentOrderId,
          orderId: args.orderId,
          eventType: args.eventType,
          fromStatus: args.fromStatus,
          toStatus: args.toStatus,
          actorType: args.actorType,
          actorId: args.actorId,
          operationId: args.operationId,
          payloadJson: args.payloadJson,
          remark: args.remark,
        },
      });
    } catch (error) {
      if (this.isPrismaUniqueError(error)) return;
      throw error;
    }
  }

  private async hasOperation(
    tenantId: string,
    fulfillmentOrderId: string,
    operationId: string,
    eventType: FulfillmentEventType,
  ): Promise<boolean> {
    const exists = await this.prisma.fulfillmentEvent.findFirst({
      where: {
        tenantId,
        fulfillmentOrderId,
        operationId,
        eventType,
      },
      select: { id: true },
    });
    return !!exists;
  }

  private async upsertAssignment(
    fulfillmentOrderId: string,
    tenantId: string,
    workerId: number,
    remark?: string,
  ): Promise<void> {
    await this.prisma.fulfillmentAssignment.upsert({
      where: {
        fulfillmentOrderId_workerId: {
          fulfillmentOrderId,
          workerId,
        },
      },
      update: {
        status: FulfillmentAssignmentStatus.ASSIGNED,
        assignedAt: new Date(),
        cancelledAt: null,
        remark,
      },
      create: {
        tenantId,
        fulfillmentOrderId,
        workerId,
        status: FulfillmentAssignmentStatus.ASSIGNED,
        assignedAt: new Date(),
        remark,
      },
    });
  }

  private selectProductFulfillments(
    fulfillments: FulfillmentWithOrderItem[],
    items?: ShipProductFulfillmentItemDto[],
  ): FulfillmentWithOrderItem[] {
    if (!items || items.length === 0) return fulfillments;
    const itemIds = new Set(items.flatMap((item) => (item.orderItemId == null ? [] : [item.orderItemId])));
    if (itemIds.size === 0) return fulfillments;
    return fulfillments.filter((fulfillment) => itemIds.has(fulfillment.orderItemId));
  }

  private buildShipmentItems(
    fulfillment: FulfillmentWithOrderItem,
    items?: ShipProductFulfillmentItemDto[],
  ): Prisma.FulfillmentShipmentItemCreateWithoutShipmentInput[] {
    const matched =
      items?.filter((item) => item.orderItemId == null || item.orderItemId === fulfillment.orderItemId) ?? [];
    const sourceItems = matched.length > 0 ? matched : [{} as ShipProductFulfillmentItemDto];
    return sourceItems.map((item) => ({
      fulfillmentOrder: { connect: { id: fulfillment.id } },
      orderItem: { connect: { id: fulfillment.orderItemId } },
      skuId: item.skuId ?? fulfillment.orderItem.skuId,
      quantity: item.quantity ?? fulfillment.orderItem.quantity,
      packageNo: item.packageNo,
    }));
  }

  private async syncMainOrderStatus(orderId: string, tenantId?: string, remarkLine?: string): Promise<void> {
    const order = await this.prisma.omsOrder.findFirst({
      where: this.scopedStoreWhere({ id: orderId }, tenantId) as Prisma.OmsOrderWhereInput,
      include: { fulfillmentOrders: true },
    });
    if (!order || order.fulfillmentOrders.length === 0) return;
    if (([OrderStatus.CANCELLED, OrderStatus.REFUNDED] as OrderStatus[]).includes(order.status)) return;

    let nextStatus: OrderStatus | undefined;
    const allFulfilled = order.fulfillmentOrders.every(
      (fulfillment) => fulfillment.status === FulfillmentStatus.FULFILLED,
    );
    const progressStatuses: FulfillmentStatus[] = [
      FulfillmentStatus.SHIPPED,
      FulfillmentStatus.RECEIVED,
      FulfillmentStatus.ACCEPTED,
      FulfillmentStatus.IN_SERVICE,
      FulfillmentStatus.SERVICE_DONE,
      FulfillmentStatus.VERIFIED,
      FulfillmentStatus.FULFILLED,
    ];
    const hasProgress = order.fulfillmentOrders.some((fulfillment) => progressStatuses.includes(fulfillment.status));

    if (allFulfilled) {
      nextStatus = OrderStatus.COMPLETED;
    } else if (hasProgress && order.status === OrderStatus.PAID) {
      nextStatus = OrderStatus.SHIPPED;
    }

    const data: Prisma.OmsOrderUpdateInput = {};
    if (nextStatus && order.status !== nextStatus) {
      data.status = nextStatus;
    }
    if (remarkLine) {
      data.remark = this.appendOrderRemarkLine(order.remark, remarkLine);
    }
    if (Object.keys(data).length === 0) return;

    const updateResult = await this.prisma.omsOrder.updateMany({
      where: { id: orderId, tenantId: order.tenantId },
      data,
    });
    BusinessException.throwIf(updateResult.count === 0, '订单状态已变化，请刷新后重试', ResponseCode.BUSINESS_ERROR);
  }

  private appendOrderRemarkLine(existing: string | null | undefined, line: string): string {
    const next = existing ? `${existing}\n${line}` : line;
    BusinessException.throwIf(next.length > 500, '备注合并后超过500字，请缩短内容');
    return next;
  }

  private scopedStoreWhere(where: Prisma.OmsOrderWhereInput, tenantId?: string): Prisma.OmsOrderWhereInput {
    if (tenantId) return { ...where, tenantId };
    if (TenantContext.isSuperTenant()) return where;
    const contextTenantId = TenantContext.getTenantId();
    if (!contextTenantId) return this.tenantHelper.readWhereForDelegate('omsOrder', where) as Prisma.OmsOrderWhereInput;
    return { ...where, tenantId: contextTenantId };
  }

  private scopedFulfillmentWhere(
    where: Prisma.FulfillmentOrderWhereInput,
    tenantId?: string,
  ): Prisma.FulfillmentOrderWhereInput {
    if (tenantId) return { ...where, tenantId };
    return this.tenantHelper.readWhereForDelegate('fulfillmentOrder', where) as Prisma.FulfillmentOrderWhereInput;
  }

  private isPrismaUniqueError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
  }
}
