import { Injectable } from '@nestjs/common';
import { FinRefund, FinRefundStatus, FinRefundType, OrderStatus, OrderType, PayStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { FinanceCommandPort } from 'src/module/finance/ports/finance-command.port';
import { FinRefundService } from 'src/module/finance/refund/fin-refund.service';
import { DistributionQualificationService } from 'src/module/store/distribution/qualification/qualification.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderDomainEventPublisher } from '../events/order-domain-event.publisher';
import { OrderRefundedDomainEvent } from '../events/order-domain-event.types';

interface RefundFinalizePayload {
  remark?: string | null;
  refundAmount?: string;
  refundRatio?: string;
  refundDetails?: Array<{ itemId: number; quantity: number; amount: string }>;
  fullyRefundedItemIds?: number[];
  isFullRefund?: boolean;
}

@Injectable()
export class OrderRefundFinalizerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeCommandPort: FinanceCommandPort,
    private readonly orderEventPublisher: OrderDomainEventPublisher,
    private readonly distributionQualificationService: DistributionQualificationService,
    private readonly finRefundService: FinRefundService,
  ) {}

  async finalize(refund: FinRefund): Promise<{ finalized: boolean }> {
    if (refund.status !== FinRefundStatus.SUCCESS || refund.finalizedAt) {
      return { finalized: false };
    }

    const payload = this.parsePayload(refund.finalizePayload);
    if (refund.refundType === FinRefundType.PARTIAL || (payload.refundDetails?.length ?? 0) > 0) {
      return this.finalizePartialRefund(refund, payload);
    }

    if (refund.refundType === FinRefundType.AUTO_CANCEL) {
      return this.finalizeAutoCancelRefund(refund);
    }

    return this.finalizeFullRefund(refund, payload);
  }

  @Transactional()
  private async finalizeFullRefund(refund: FinRefund, payload: RefundFinalizePayload) {
    const order = await this.loadOrder(refund);
    if (order.status === OrderStatus.REFUNDED) {
      await this.financeCommandPort.handleSuccessfulRefundSettlement(refund);
      await this.finRefundService.markFinalized(refund.id);
      return { finalized: false };
    }

    const updated = await this.prisma.omsOrder.updateMany({
      where: { id: refund.orderId, tenantId: refund.tenantId, status: { not: OrderStatus.REFUNDED } },
      data: {
        status: OrderStatus.REFUNDED,
        payStatus: PayStatus.REFUNDED,
        remark: payload.remark ? `退款: ${payload.remark}` : '订单退款',
      },
    });
    if (updated.count === 0) {
      await this.financeCommandPort.handleSuccessfulRefundSettlement(refund);
      await this.finRefundService.markFinalized(refund.id);
      return { finalized: false };
    }

    await this.financeCommandPort.cancelOrderCommissions(refund.orderId);

    if (order.orderType === OrderType.SERVICE) {
      await this.distributionQualificationService.markServiceOrderRefunded(refund.tenantId, refund.orderId);
    }

    await this.publishRefunded(refund, order, {
      refundReferenceId: refund.refundSn,
      refundPointsAmount: order.pointsUsed ?? 0,
      earnedPointsClawbackRatio: 1,
      refundCoupon: true,
      partialRefund: false,
    });
    await this.financeCommandPort.handleSuccessfulRefundSettlement(refund);
    await this.finRefundService.markFinalized(refund.id);
    return { finalized: true };
  }

  @Transactional()
  private async finalizePartialRefund(refund: FinRefund, payload: RefundFinalizePayload) {
    const order = await this.loadOrder(refund);
    // 免单订单（payAmount=0）触发部分退款时除零保护：视为 100% 退款比例。
    const fallbackRatio = order.payAmount.isZero() ? new Decimal(1) : refund.requestedAmount.div(order.payAmount);
    const refundRatio = new Decimal(payload.refundRatio ?? fallbackRatio.toString());
    const refundAmount = new Decimal(payload.refundAmount ?? refund.requestedAmount.toString());
    const refundDetails = payload.refundDetails ?? [];
    const fullyRefundedItemIds = payload.fullyRefundedItemIds ?? [];
    const isFullRefund = Boolean(payload.isFullRefund);

    if (order.partialRefundSn === refund.refundSn || order.status === OrderStatus.REFUNDED) {
      await this.financeCommandPort.handleSuccessfulRefundSettlement(refund);
      await this.finRefundService.markFinalized(refund.id);
      return { finalized: false };
    }

    const refundRemark = [
      `部分退款: ${payload.remark || ''}`,
      `退款单: ${refund.refundSn}`,
      `退款金额: ${refundAmount.toString()}`,
      `退款明细: ${JSON.stringify(refundDetails)}`,
    ].join('\n');

    // CAS 同时承担互斥（不同 refundSn 不得相互覆盖）与幂等（同 refundSn 重入幂等返回）：
    //   - status: { not: REFUNDED } 与 finalizeFullRefund 对齐，防御整退/部分退并发把 REFUNDED 订单再次写为部分退款；
    //   - partialRefundSn 命中 null 或同 SN 才允许 update；不同 SN 走 count=0 早退分支（避免覆盖前一笔 SN 链接）。
    const updated = await this.prisma.omsOrder.updateMany({
      where: {
        id: refund.orderId,
        tenantId: refund.tenantId,
        status: { not: OrderStatus.REFUNDED },
        OR: [{ partialRefundSn: null }, { partialRefundSn: refund.refundSn }],
      },
      data: {
        ...(isFullRefund ? { status: OrderStatus.REFUNDED, payStatus: PayStatus.REFUNDED } : {}),
        remark: order.remark ? `${order.remark}\n${refundRemark}` : refundRemark,
        partialRefundSn: refund.refundSn,
      },
    });
    if (updated.count === 0) {
      await this.financeCommandPort.handleSuccessfulRefundSettlement(refund);
      await this.finRefundService.markFinalized(refund.id);
      return { finalized: false };
    }

    await this.financeCommandPort.cancelCommissionsForOrderPartialRefund({
      orderId: refund.orderId,
      refundRatio,
      relatedId: refund.refundSn,
    });

    if (order.orderType === OrderType.SERVICE && fullyRefundedItemIds.length > 0) {
      await this.distributionQualificationService.markServiceOrderRefunded(
        refund.tenantId,
        refund.orderId,
        fullyRefundedItemIds,
      );
    }

    await this.publishRefunded(refund, order, {
      refundReferenceId: refund.refundSn,
      // 用 round 而非 floor，避免每次部分退款都向下截断造成用户积分长期短退（例如 100 * 0.999 = 99.9 → floor 99 少退 1）。
      refundPointsAmount: Math.round(Number(order.pointsUsed || 0) * Number(refundRatio)),
      earnedPointsClawbackRatio: Number(refundRatio),
      refundCoupon: isFullRefund,
      partialRefund: !isFullRefund,
    });
    await this.financeCommandPort.handleSuccessfulRefundSettlement(refund);
    await this.finRefundService.markFinalized(refund.id);
    return { finalized: true };
  }

  @Transactional()
  private async finalizeAutoCancelRefund(refund: FinRefund) {
    const order = await this.loadOrder(refund);
    await this.prisma.omsOrder.updateMany({
      where: { id: refund.orderId, tenantId: refund.tenantId },
      data: {
        payStatus: PayStatus.REFUNDED,
        remark: order.remark ? `${order.remark}\n自动退款成功: ${refund.refundSn}` : `自动退款成功: ${refund.refundSn}`,
      },
    });
    await this.finRefundService.markFinalized(refund.id);
    return { finalized: true };
  }

  private async loadOrder(refund: FinRefund) {
    const order = await this.prisma.omsOrder.findFirst({
      where: { id: refund.orderId, tenantId: refund.tenantId },
      select: {
        id: true,
        orderSn: true,
        tenantId: true,
        memberId: true,
        status: true,
        payStatus: true,
        orderType: true,
        payAmount: true,
        pointsUsed: true,
        remark: true,
        partialRefundSn: true,
      },
    });
    BusinessException.throwIfNull(order, '退款关联订单不存在', ResponseCode.DATA_NOT_FOUND);
    return order;
  }

  private async publishRefunded(
    refund: FinRefund,
    order: Awaited<ReturnType<OrderRefundFinalizerService['loadOrder']>>,
    event: Pick<
      OrderRefundedDomainEvent,
      'refundReferenceId' | 'refundPointsAmount' | 'earnedPointsClawbackRatio' | 'refundCoupon' | 'partialRefund'
    >,
  ) {
    await this.orderEventPublisher.publishRefunded({
      orderId: refund.orderId,
      orderSn: order.orderSn,
      tenantId: refund.tenantId,
      memberId: order.memberId,
      refundedAt: refund.successTime ?? new Date(),
      ...event,
    });
  }

  private parsePayload(payload: Prisma.JsonValue | null): RefundFinalizePayload {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }
    return payload as unknown as RefundFinalizePayload;
  }
}
