import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { OrderAutoCancelConfigService } from './config/order-auto-cancel.config';
import { OrderService } from './order.service';

interface OrderDelayJob {
  orderId: string;
  reason?: string;
  timeoutMinutes?: number;
  scheduledAt?: string;
}

@Processor('ORDER_DELAY')
export class OrderDelayProcessor {
  private readonly logger = new Logger(OrderDelayProcessor.name);

  constructor(
    private readonly orderService: OrderService,
    private readonly autoCancelConfig: OrderAutoCancelConfigService,
  ) {}

  @Process('cancel_unpaid')
  async handleCancelUnpaid(job: Job<OrderDelayJob>) {
    const { orderId, timeoutMinutes, scheduledAt } = job.data;
    const reason = job.data.reason?.trim() || this.autoCancelConfig.getOptions().reason;
    this.logger.log(
      `Processing auto-cancellation for order ${orderId}, timeoutMinutes=${timeoutMinutes ?? 'default'}, scheduledAt=${scheduledAt ?? 'unknown'}`,
    );

    try {
      await this.orderService.cancelOrderBySystem(orderId, reason);
    } catch (error) {
      this.logger.error(`Failed to auto-cancel order ${orderId}`, error);
      throw error;
    }
  }
}
