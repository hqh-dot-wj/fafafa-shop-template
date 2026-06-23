import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';

export const PAYMENT_REFUND_RETRY_QUEUE = 'PAYMENT_REFUND_RETRY';
export const AUTO_CANCEL_REFUND_RETRY_JOB = 'auto-cancel-refund';

export const REFUND_RETRY_ATTEMPTS = 5;
export const REFUND_RETRY_INITIAL_DELAY_MS = 60_000;
export const REFUND_RETRY_CONCURRENCY = 5;

export interface AutoCancelRefundRetryJob {
  tenantId: string;
  orderId: string;
  orderSn: string;
  refundSn: string;
  refundAmount: string;
  totalAmount: string;
  reason: string;
  source: 'AUTO_CANCEL_PAYMENT_CALLBACK';
}

@Injectable()
export class RefundRetryQueueService {
  private readonly logger = new Logger(RefundRetryQueueService.name);

  constructor(
    @InjectQueue(PAYMENT_REFUND_RETRY_QUEUE)
    private readonly refundRetryQueue: Queue<AutoCancelRefundRetryJob>,
  ) {}

  async enqueueAutoCancelRefund(input: Omit<AutoCancelRefundRetryJob, 'source'>): Promise<string> {
    const jobData: AutoCancelRefundRetryJob = {
      ...input,
      source: 'AUTO_CANCEL_PAYMENT_CALLBACK',
    };
    const jobId = `${AUTO_CANCEL_REFUND_RETRY_JOB}:${input.refundSn}`;

    const job = await this.refundRetryQueue.add(AUTO_CANCEL_REFUND_RETRY_JOB, jobData, {
      jobId,
      delay: REFUND_RETRY_INITIAL_DELAY_MS,
      attempts: REFUND_RETRY_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: REFUND_RETRY_INITIAL_DELAY_MS,
      },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });

    this.logger.warn(
      `Auto-cancel refund retry enqueued: refundSn=${input.refundSn}, tenantId=${input.tenantId}, jobId=${job.id}`,
    );
    return String(job.id);
  }
}
