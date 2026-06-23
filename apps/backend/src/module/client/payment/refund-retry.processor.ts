import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { FinRefund, FinRefundStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Job } from 'bull';
import { getErrorMessage } from 'src/common/utils/error';
import { FinRefundService } from 'src/module/finance/refund/fin-refund.service';
import { PaymentGatewayPort } from 'src/module/payment/ports/payment-gateway.port';
import { OrderRefundFinalizerService } from '../order/refund/order-refund-finalizer.service';
import {
  AUTO_CANCEL_REFUND_RETRY_JOB,
  AutoCancelRefundRetryJob,
  PAYMENT_REFUND_RETRY_QUEUE,
  REFUND_RETRY_ATTEMPTS,
  REFUND_RETRY_CONCURRENCY,
} from './refund-retry.queue';

@Processor(PAYMENT_REFUND_RETRY_QUEUE)
export class RefundRetryProcessor {
  private readonly logger = new Logger(RefundRetryProcessor.name);
  private readonly OPERATOR = 'payment.refundRetryJob';

  constructor(
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly finRefundService: FinRefundService,
    private readonly orderRefundFinalizer: OrderRefundFinalizerService,
  ) {}

  @Process({ name: AUTO_CANCEL_REFUND_RETRY_JOB, concurrency: REFUND_RETRY_CONCURRENCY })
  async handleAutoCancelRefund(job: Job<AutoCancelRefundRetryJob>) {
    const attempt = job.attemptsMade + 1;
    const { refundSn, orderSn, refundAmount, totalAmount, reason, tenantId } = job.data;

    this.logger.warn(
      `Auto-cancel refund retry started: refundSn=${refundSn}, tenantId=${tenantId}, attempt=${attempt}`,
    );

    const current = await this.finRefundService.findByRefundSn(refundSn);
    if (current && this.isTerminalStatus(current.status)) {
      if (current.status === FinRefundStatus.SUCCESS && !current.finalizedAt) {
        await this.orderRefundFinalizer.finalize(current);
      }

      this.logger.warn(
        `Auto-cancel refund retry skipped terminal refund: refundSn=${refundSn}, tenantId=${tenantId}, status=${current.status}`,
      );
      return { refundSn, status: current.status };
    }

    try {
      const refundResult = await this.paymentGateway.refund({
        orderSn,
        refundSn,
        refundAmount: new Decimal(refundAmount),
        totalAmount: new Decimal(totalAmount),
        reason,
      });
      const refundRecord = await this.finRefundService.recordGatewayResult({
        refundSn: refundResult.refundSn,
        refundId: refundResult.refundId,
        status: refundResult.status,
        amount: refundResult.amount,
        payerRefundAmount: refundResult.payerRefundAmount,
        settlementRefundAmount: refundResult.settlementRefundAmount,
        refundFeeAmount: refundResult.refundFeeAmount,
        discountRefundAmount: refundResult.discountRefundAmount,
        netAmount: refundResult.netAmount,
        successTime: refundResult.successTime,
        rawPayload: (refundResult.rawPayload ?? {
          refundSn: refundResult.refundSn,
          refundId: refundResult.refundId,
          status: refundResult.status,
          amount: refundResult.amount ?? null,
          payerRefundAmount: refundResult.payerRefundAmount ?? null,
          settlementRefundAmount: refundResult.settlementRefundAmount ?? null,
          refundFeeAmount: refundResult.refundFeeAmount ?? null,
          discountRefundAmount: refundResult.discountRefundAmount ?? null,
          netAmount: refundResult.netAmount ?? null,
        }) as Prisma.InputJsonValue,
        operator: this.OPERATOR,
      });

      if (refundRecord.status === FinRefundStatus.SUCCESS) {
        await this.orderRefundFinalizer.finalize(refundRecord);
      }

      this.logger.warn(
        `Auto-cancel refund retry recorded: refundSn=${refundSn}, tenantId=${tenantId}, status=${refundRecord.status}`,
      );
      return { refundSn, status: refundRecord.status };
    } catch (error) {
      const message = getErrorMessage(error);
      await this.recordRetryFailure(job, message);
      throw error;
    }
  }

  private isTerminalStatus(status: FinRefund['status']): boolean {
    return (
      status === FinRefundStatus.SUCCESS ||
      status === FinRefundStatus.FAILED ||
      status === FinRefundStatus.CLOSED ||
      status === FinRefundStatus.ABNORMAL
    );
  }

  private async recordRetryFailure(job: Job<AutoCancelRefundRetryJob>, message: string): Promise<void> {
    const attempt = job.attemptsMade + 1;
    const attempts = job.opts.attempts ?? REFUND_RETRY_ATTEMPTS;
    const { refundSn, tenantId, orderId, orderSn } = job.data;

    this.logger.error(
      `Auto-cancel refund retry failed: refundSn=${refundSn}, tenantId=${tenantId}, attempt=${attempt}/${attempts}, error=${message}`,
    );

    try {
      await this.finRefundService.recordGatewayFailure({
        refundSn,
        failReason: message,
        operator: this.OPERATOR,
        rawPayload: {
          refundSn,
          tenantId,
          orderId,
          orderSn,
          attempt,
          attempts,
          error: message,
        },
      });

      if (attempt >= attempts) {
        await this.finRefundService.markManualReviewRequired({
          refundSn,
          reason: `自动取消退款外呼重试耗尽: ${message}`,
          operator: this.OPERATOR,
          rawPayload: {
            refundSn,
            tenantId,
            orderId,
            orderSn,
            attempt,
            attempts,
            error: message,
          },
        });
      }
    } catch (recordError) {
      this.logger.error(
        `Failed to record auto-cancel refund retry failure: refundSn=${refundSn}, error=${getErrorMessage(recordError)}`,
      );
    }
  }
}
