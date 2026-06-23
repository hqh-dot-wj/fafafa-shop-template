import { Injectable } from '@nestjs/common';
import { FinRefund, FinRefundEventType, FinRefundStatus, FinRefundType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { PrismaService } from 'src/prisma/prisma.service';
import { RefundStatus } from 'src/module/payment/interfaces/payment-provider.interface';

type MoneyInput = Decimal.Value;

export interface CreateFinRefundInput {
  tenantId: string;
  orderId: string;
  orderSn: string;
  refundSn: string;
  refundType: FinRefundType;
  requestedAmount: MoneyInput;
  payerTotalAmount?: MoneyInput;
  settlementTotalAmount?: MoneyInput;
  channelType?: string;
  fundsAccount?: string;
  reason?: string;
  operator?: string;
  finalizePayload?: Prisma.InputJsonValue;
}

export interface RecordRefundGatewayResultInput {
  refundSn: string;
  refundId?: string;
  status: RefundStatus | string;
  // 所有金额字段单位为「分」。undefined 表示该字段在渠道响应中缺失，将跳过对应 DB 字段的更新（保留原值）。
  amount?: number;
  payerRefundAmount?: number;
  settlementRefundAmount?: number;
  refundFeeAmount?: number;
  discountRefundAmount?: number;
  netAmount?: number;
  successTime?: Date;
  failReason?: string;
  rawPayload?: Prisma.InputJsonValue;
  operator?: string;
  eventType?: FinRefundEventType;
}

export interface RecordRefundQueryFailureInput {
  refundSn: string;
  failReason: string;
  rawPayload?: Prisma.InputJsonValue;
  operator?: string;
}

export type RecordRefundGatewayFailureInput = RecordRefundQueryFailureInput;

export interface MarkRefundManualReviewInput {
  refundSn: string;
  reason: string;
  rawPayload?: Prisma.InputJsonValue;
  operator?: string;
}

@Injectable()
export class FinRefundService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequested(input: CreateFinRefundInput): Promise<FinRefund> {
    const existing = await this.prisma.finRefund.findUnique({
      where: { refundSn: input.refundSn },
    });
    if (existing) {
      this.assertSameRefund(existing, input);
      return existing;
    }

    return this.prisma.finRefund.create({
      data: {
        tenantId: input.tenantId,
        orderId: input.orderId,
        orderSn: input.orderSn,
        refundSn: input.refundSn,
        channelType: input.channelType ?? 'WECHAT',
        status: FinRefundStatus.CREATED,
        refundType: input.refundType,
        requestedAmount: this.toMoney(input.requestedAmount),
        payerTotalAmount: input.payerTotalAmount == null ? undefined : this.toMoney(input.payerTotalAmount),
        settlementTotalAmount:
          input.settlementTotalAmount == null ? undefined : this.toMoney(input.settlementTotalAmount),
        fundsAccount: input.fundsAccount,
        reason: input.reason,
        finalizePayload: input.finalizePayload,
        events: {
          create: {
            eventType: FinRefundEventType.REQUEST,
            toStatus: FinRefundStatus.CREATED,
            operator: input.operator,
            payload: this.requestPayload(input),
          },
        },
      },
    });
  }

  async recordGatewayResult(input: RecordRefundGatewayResultInput): Promise<FinRefund> {
    return this.recordStatusUpdate({
      ...input,
      eventType: input.eventType ?? FinRefundEventType.SYNC_RESPONSE,
    });
  }

  async recordNotifyResult(input: Omit<RecordRefundGatewayResultInput, 'eventType'>): Promise<FinRefund> {
    return this.recordStatusUpdate({
      ...input,
      eventType: FinRefundEventType.NOTIFY,
    });
  }

  async recordQueryResult(input: Omit<RecordRefundGatewayResultInput, 'eventType'>): Promise<FinRefund> {
    return this.recordStatusUpdate({
      ...input,
      eventType: FinRefundEventType.QUERY,
    });
  }

  async recordQueryFailure(input: RecordRefundQueryFailureInput): Promise<FinRefund> {
    return this.recordNonTerminalFailure({
      ...input,
      eventType: FinRefundEventType.QUERY,
    });
  }

  async recordGatewayFailure(input: RecordRefundGatewayFailureInput): Promise<FinRefund> {
    return this.recordNonTerminalFailure({
      ...input,
      eventType: FinRefundEventType.SYNC_RESPONSE,
    });
  }

  private async recordNonTerminalFailure(
    input: RecordRefundQueryFailureInput & { eventType: FinRefundEventType },
  ): Promise<FinRefund> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.finRefund.findUnique({
        where: { refundSn: input.refundSn },
      });
      BusinessException.throwIfNull(current, '退款单不存在', ResponseCode.DATA_NOT_FOUND);

      if (this.isTerminal(current) && current.status !== FinRefundStatus.ABNORMAL) {
        return current;
      }

      const payload = input.rawPayload ?? this.queryFailurePayload(input);
      const updated = await tx.finRefund.update({
        where: { id: current.id },
        data: {
          failReason: input.failReason,
          lastQueryTime: new Date(),
          retryCount: { increment: 1 },
          rawPayload: payload,
        },
      });

      await tx.finRefundEvent.create({
        data: {
          refundRecordId: current.id,
          eventType: input.eventType,
          fromStatus: current.status,
          toStatus: current.status,
          operator: input.operator,
          payload,
        },
      });

      return updated;
    });
  }

  async markManualReviewRequired(input: MarkRefundManualReviewInput): Promise<FinRefund> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.finRefund.findUnique({
        where: { refundSn: input.refundSn },
      });
      BusinessException.throwIfNull(current, '退款单不存在', ResponseCode.DATA_NOT_FOUND);

      if (current.status === FinRefundStatus.ABNORMAL) {
        return current;
      }

      if (this.isTerminal(current)) {
        return current;
      }

      const payload = input.rawPayload ?? this.manualReviewPayload(input, current);
      const updated = await tx.finRefund.update({
        where: { id: current.id },
        data: {
          status: FinRefundStatus.ABNORMAL,
          failReason: input.reason,
          lastQueryTime: new Date(),
          rawPayload: payload,
        },
      });

      await tx.finRefundEvent.create({
        data: {
          refundRecordId: current.id,
          eventType: FinRefundEventType.MANUAL,
          fromStatus: current.status,
          toStatus: FinRefundStatus.ABNORMAL,
          operator: input.operator,
          payload,
        },
      });

      return updated;
    });
  }

  findPendingForQuery(limit = 50): Promise<FinRefund[]> {
    return this.prisma.finRefund.findMany({
      where: {
        status: {
          in: [FinRefundStatus.CREATED, FinRefundStatus.PROCESSING],
        },
      },
      orderBy: { createTime: 'asc' },
      take: limit,
    });
  }

  findSuccessUnfinalized(limit = 50): Promise<FinRefund[]> {
    return this.prisma.finRefund.findMany({
      where: {
        status: FinRefundStatus.SUCCESS,
        finalizedAt: null,
      },
      orderBy: { updateTime: 'asc' },
      take: limit,
    });
  }

  findByRefundSn(refundSn: string): Promise<FinRefund | null> {
    return this.prisma.finRefund.findUnique({
      where: { refundSn },
    });
  }

  async markFinalized(refundId: string): Promise<void> {
    await this.prisma.finRefund.update({
      where: { id: refundId },
      data: {
        finalizedAt: new Date(),
      },
    });
  }

  private async recordStatusUpdate(
    input: Required<Pick<RecordRefundGatewayResultInput, 'eventType'>> & RecordRefundGatewayResultInput,
  ): Promise<FinRefund> {
    const toStatus = this.toFinRefundStatus(input.status);
    // 渠道侧字段缺失（== null）时返回 undefined，让 Prisma 不更新该字段；
    // 仅在显式收到数字时才折算成元。避免兜底 0 把已落库金额清零（参见 RefundCallbackPayload 注释）。
    // 三类金额（gross amount / payerRefund / settlementRefund）是不同概念，差一个退款手续费——
    // 不能用 amount 当 payer/settlement 的 fallback，否则任何只填 amount 的调用方都会污染另两列。
    const payerRefundAmount = input.payerRefundAmount == null ? undefined : this.fenToYuan(input.payerRefundAmount);
    const settlementRefundAmount =
      input.settlementRefundAmount == null
        ? input.netAmount == null
          ? undefined
          : this.fenToYuan(input.netAmount)
        : this.fenToYuan(input.settlementRefundAmount);
    const refundFeeAmount = input.refundFeeAmount == null ? undefined : this.fenToYuan(input.refundFeeAmount);
    const discountRefundAmount =
      input.discountRefundAmount == null ? undefined : this.fenToYuan(input.discountRefundAmount);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.finRefund.findUnique({
        where: { refundSn: input.refundSn },
      });
      BusinessException.throwIfNull(current, '退款单不存在', ResponseCode.DATA_NOT_FOUND);

      if (this.shouldIgnoreStatusUpdate(current.status, toStatus)) {
        await tx.finRefundEvent.create({
          data: {
            refundRecordId: current.id,
            eventType: input.eventType,
            fromStatus: current.status,
            toStatus: current.status,
            operator: input.operator,
            payload: input.rawPayload ?? this.gatewayPayload(input),
          },
        });
        return current;
      }

      const updated = await tx.finRefund.update({
        where: { id: current.id },
        data: {
          refundId: input.refundId,
          status: toStatus,
          payerRefundAmount,
          settlementRefundAmount,
          refundFeeAmount,
          discountRefundAmount,
          failReason: input.failReason,
          successTime: toStatus === FinRefundStatus.SUCCESS ? input.successTime : undefined,
          lastQueryTime: input.eventType === FinRefundEventType.QUERY ? new Date() : undefined,
          retryCount: input.eventType === FinRefundEventType.QUERY ? { increment: 1 } : undefined,
          rawPayload: input.rawPayload ?? this.gatewayPayload(input),
        },
      });

      await tx.finRefundEvent.create({
        data: {
          refundRecordId: current.id,
          eventType: input.eventType,
          fromStatus: current.status,
          toStatus,
          operator: input.operator,
          payload: input.rawPayload ?? this.gatewayPayload(input),
        },
      });

      return updated;
    });
  }

  isSuccess(refund: Pick<FinRefund, 'status'>): boolean {
    return refund.status === FinRefundStatus.SUCCESS;
  }

  isFailureTerminal(refund: Pick<FinRefund, 'status'>): boolean {
    return (
      refund.status === FinRefundStatus.FAILED ||
      refund.status === FinRefundStatus.CLOSED ||
      refund.status === FinRefundStatus.ABNORMAL
    );
  }

  private isTerminal(refund: Pick<FinRefund, 'status'>): boolean {
    return this.isSuccess(refund) || this.isFailureTerminal(refund);
  }

  private shouldIgnoreStatusUpdate(currentStatus: FinRefundStatus, toStatus: FinRefundStatus): boolean {
    if (currentStatus === toStatus) {
      return false;
    }

    if (currentStatus === FinRefundStatus.ABNORMAL) {
      return (
        toStatus !== FinRefundStatus.SUCCESS &&
        toStatus !== FinRefundStatus.FAILED &&
        toStatus !== FinRefundStatus.CLOSED
      );
    }

    return this.isTerminal({ status: currentStatus });
  }

  private toFinRefundStatus(status: RefundStatus | string): FinRefundStatus {
    switch (String(status)) {
      case 'SUCCESS':
        return FinRefundStatus.SUCCESS;
      case 'PROCESSING':
        return FinRefundStatus.PROCESSING;
      case 'CLOSE':
      case 'CLOSED':
        return FinRefundStatus.CLOSED;
      case 'FAILED':
        return FinRefundStatus.FAILED;
      case 'ABNORMAL':
        return FinRefundStatus.ABNORMAL;
      default:
        throw new BusinessException(ResponseCode.BUSINESS_ERROR, `未知退款状态: ${status}`);
    }
  }

  private assertSameRefund(existing: FinRefund, input: CreateFinRefundInput) {
    const requestedAmount = this.toMoney(input.requestedAmount);
    BusinessException.throwIf(
      existing.tenantId !== input.tenantId ||
        existing.orderId !== input.orderId ||
        !new Decimal(existing.requestedAmount).eq(requestedAmount),
      '退款单号已被其他退款请求占用',
      ResponseCode.BUSINESS_ERROR,
    );
  }

  private toMoney(value: MoneyInput) {
    return new Decimal(value).toDecimalPlaces(2);
  }

  private fenToYuan(value: number) {
    return new Decimal(value).div(100).toDecimalPlaces(2);
  }

  private requestPayload(input: CreateFinRefundInput): Prisma.InputJsonObject {
    return {
      orderSn: input.orderSn,
      refundSn: input.refundSn,
      refundType: input.refundType,
      requestedAmount: this.toMoney(input.requestedAmount).toFixed(2),
      payerTotalAmount: input.payerTotalAmount == null ? null : this.toMoney(input.payerTotalAmount).toFixed(2),
      settlementTotalAmount:
        input.settlementTotalAmount == null ? null : this.toMoney(input.settlementTotalAmount).toFixed(2),
      fundsAccount: input.fundsAccount ?? null,
      reason: input.reason ?? null,
    };
  }

  private gatewayPayload(input: RecordRefundGatewayResultInput): Prisma.InputJsonObject {
    return {
      refundSn: input.refundSn,
      refundId: input.refundId ?? null,
      status: String(input.status),
      amountFen: input.amount ?? null,
      payerRefundAmountFen: input.payerRefundAmount ?? null,
      settlementRefundAmountFen: input.settlementRefundAmount ?? null,
      refundFeeAmountFen: input.refundFeeAmount ?? null,
      discountRefundAmountFen: input.discountRefundAmount ?? null,
      netAmountFen: input.netAmount ?? null,
      failReason: input.failReason ?? null,
      successTime: input.successTime?.toISOString() ?? null,
    };
  }

  private queryFailurePayload(input: RecordRefundQueryFailureInput): Prisma.InputJsonObject {
    return {
      refundSn: input.refundSn,
      failReason: input.failReason,
    };
  }

  private manualReviewPayload(input: MarkRefundManualReviewInput, current: FinRefund): Prisma.InputJsonObject {
    return {
      refundSn: input.refundSn,
      fromStatus: current.status,
      reason: input.reason,
      retryCount: current.retryCount,
      lastQueryTime: current.lastQueryTime?.toISOString() ?? null,
    };
  }
}
