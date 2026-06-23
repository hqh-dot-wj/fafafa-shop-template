import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { FinRefund, FinRefundStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getErrorMessage } from 'src/common/utils/error';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';
import { RedisService } from 'src/module/common/redis/redis.service';
import { FinRefundService } from 'src/module/finance/refund/fin-refund.service';
import { PaymentGatewayPort } from 'src/module/payment/ports/payment-gateway.port';
import { OrderRefundFinalizerService } from '../order/refund/order-refund-finalizer.service';

@Injectable()
export class RefundReconciliationScheduler {
  private readonly logger = new Logger(RefundReconciliationScheduler.name);
  private readonly LOCK_KEY = 'lock:payment:refund-reconciliation';
  private readonly LOCK_TTL = 300;
  private readonly BATCH_SIZE = 50;
  private readonly OPERATOR = 'payment.refundReconcileJob';
  private readonly MANUAL_REVIEW_AFTER_DAYS = 8;
  private readonly MANUAL_REVIEW_RETRY_THRESHOLD = this.MANUAL_REVIEW_AFTER_DAYS * 24 * 6;
  private readonly MANUAL_REVIEW_AFTER_MS = this.MANUAL_REVIEW_AFTER_DAYS * 24 * 60 * 60 * 1000;

  constructor(
    private readonly redis: RedisService,
    private readonly finRefundService: FinRefundService,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly orderRefundFinalizer: OrderRefundFinalizerService,
  ) {}

  @IgnoreTenant()
  @CodeManagedJob({
    key: 'payment.refundReconcileJob',
    name: '退款查询补偿',
    group: 'FINANCE',
    cron: CronExpression.EVERY_10_MINUTES,
    guardMode: 'self-managed',
  })
  @Task({ name: 'payment.refundReconcileJob', description: '退款查询补偿' })
  async reconcileJob() {
    const lockToken = await this.acquireLock();
    if (!lockToken) {
      this.logger.debug('Refund reconciliation skipped: another instance is running');
      return;
    }

    try {
      // Phase D2: doReconcile 跨租户扫描 finRefund 并联动 orderRefundFinalizer 写入；
      // cron path 无 Guard 触发，进入 super-tenant context 兜底，避免 tenantExtension
      // 在 getTenantId() 未定义时漏 filter 造成跨租户结果泄漏。
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        await this.doReconcile();
      });
    } finally {
      await this.releaseLock(lockToken);
    }
  }

  private async doReconcile() {
    await this.finalizeSuccessUnfinalized();

    const refunds = await this.finRefundService.findPendingForQuery(this.BATCH_SIZE);

    for (const refund of refunds) {
      try {
        const result = await this.paymentGateway.queryRefund(refund.refundSn);
        const updated = await this.finRefundService.recordQueryResult({
          refundSn: result.refundSn,
          refundId: result.refundId,
          status: result.status,
          amount: result.amount,
          payerRefundAmount: result.payerRefundAmount,
          settlementRefundAmount: result.settlementRefundAmount,
          refundFeeAmount: result.refundFeeAmount,
          discountRefundAmount: result.discountRefundAmount,
          netAmount: result.netAmount,
          successTime: result.successTime,
          rawPayload: (result.rawPayload ?? {
            refundSn: result.refundSn,
            refundId: result.refundId,
            status: result.status,
            amount: result.amount ?? null,
            payerRefundAmount: result.payerRefundAmount ?? null,
            settlementRefundAmount: result.settlementRefundAmount ?? null,
            refundFeeAmount: result.refundFeeAmount ?? null,
            discountRefundAmount: result.discountRefundAmount ?? null,
            netAmount: result.netAmount ?? null,
          }) as Prisma.InputJsonValue,
          operator: this.OPERATOR,
        });

        await this.finalizeIfSuccess(updated);
        await this.escalateIfPastProcessingWindow(updated, '退款查询超过处理窗口仍未进入终态');
      } catch (error) {
        const message = getErrorMessage(error);
        this.logger.error(`Refund reconciliation failed for ${refund.refundSn}: ${message}`, error);
        await this.recordQueryFailure(refund, message);
      }
    }

    if (refunds.length > 0) {
      this.logger.log(`Reconciled ${refunds.length} refund records`);
    }
  }

  private async finalizeSuccessUnfinalized(): Promise<void> {
    try {
      const refunds = await this.finRefundService.findSuccessUnfinalized(this.BATCH_SIZE);
      for (const refund of refunds) {
        await this.finalizeIfSuccess(refund);
      }
    } catch (error) {
      this.logger.error(`Failed to finalize successful refunds: ${getErrorMessage(error)}`, error);
    }
  }

  private async finalizeIfSuccess(refund: FinRefund): Promise<void> {
    if (refund.status !== FinRefundStatus.SUCCESS) {
      return;
    }

    try {
      await this.orderRefundFinalizer.finalize(refund);
    } catch (error) {
      this.logger.error(`Refund finalizer failed for ${refund.refundSn}: ${getErrorMessage(error)}`, error);
    }
  }

  private async acquireLock(): Promise<string | null> {
    try {
      const token = randomUUID();
      const result = await this.redis.getClient().set(this.LOCK_KEY, token, 'EX', this.LOCK_TTL, 'NX');
      return result === 'OK' ? token : null;
    } catch (error) {
      this.logger.error('Failed to acquire refund reconciliation lock', error);
      return null;
    }
  }

  private async recordQueryFailure(refund: FinRefund, message: string): Promise<void> {
    try {
      const updated = await this.finRefundService.recordQueryFailure({
        refundSn: refund.refundSn,
        failReason: message,
        operator: this.OPERATOR,
        rawPayload: {
          refundSn: refund.refundSn,
          status: refund.status,
          retryCount: refund.retryCount,
          error: message,
        } as Prisma.InputJsonValue,
      });
      await this.escalateIfPastProcessingWindow(updated, '退款查询异常超过处理窗口');
    } catch (recordError) {
      this.logger.error(
        `Failed to record refund query failure for ${refund.refundSn}: ${getErrorMessage(recordError)}`,
        recordError,
      );
    }
  }

  private async escalateIfPastProcessingWindow(refund: FinRefund, reason: string): Promise<void> {
    if (!this.shouldEscalateToManualReview(refund)) {
      return;
    }

    await this.finRefundService.markManualReviewRequired({
      refundSn: refund.refundSn,
      reason: `${reason}，retryCount=${refund.retryCount}`,
      operator: this.OPERATOR,
      rawPayload: {
        refundSn: refund.refundSn,
        status: refund.status,
        retryCount: refund.retryCount,
        createTime: refund.createTime.toISOString(),
        reason,
      } as Prisma.InputJsonValue,
    });
  }

  private shouldEscalateToManualReview(refund: Pick<FinRefund, 'status' | 'retryCount' | 'createTime'>): boolean {
    if (refund.status !== FinRefundStatus.CREATED && refund.status !== FinRefundStatus.PROCESSING) {
      return false;
    }

    return refund.retryCount >= this.MANUAL_REVIEW_RETRY_THRESHOLD || this.isPastProcessingWindow(refund.createTime);
  }

  private isPastProcessingWindow(createTime: Date): boolean {
    const timestamp = new Date(createTime).getTime();
    return Number.isFinite(timestamp) && Date.now() - timestamp >= this.MANUAL_REVIEW_AFTER_MS;
  }

  private async releaseLock(lockToken: string): Promise<void> {
    try {
      await this.redis
        .getClient()
        .eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          this.LOCK_KEY,
          lockToken,
        );
    } catch (error) {
      this.logger.error('Failed to release refund reconciliation lock', error);
    }
  }
}
