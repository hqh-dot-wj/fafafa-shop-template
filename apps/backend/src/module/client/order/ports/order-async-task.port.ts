import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { OrderAutoCancelConfigService } from '../config/order-auto-cancel.config';

@Injectable()
export class OrderAsyncTaskPort {
  constructor(
    @InjectQueue('ORDER_NOTIFICATION') private readonly notificationQueue: Queue,
    @InjectQueue('ORDER_DELAY') private readonly orderDelayQueue: Queue,
    private readonly autoCancelConfig: OrderAutoCancelConfigService,
  ) {}

  async enqueueNotification(orderId: string) {
    await this.notificationQueue.add(
      { orderId },
      {
        jobId: `order_notification:${orderId}`,
        delay: 1000 * 60 * 2,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }

  async enqueueAutoCancel(orderId: string) {
    const options = this.autoCancelConfig.getOptions();
    await this.orderDelayQueue.add(
      'cancel_unpaid',
      {
        orderId,
        reason: options.reason,
        timeoutMinutes: options.timeoutMinutes,
        scheduledAt: new Date().toISOString(),
      },
      {
        jobId: `cancel_unpaid:${orderId}`,
        delay: options.timeoutMs,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }
}
