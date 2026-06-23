import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { FinanceModule } from '../../finance/finance.module';
import { ClientOrderModule } from '../order/order.module';
import { PaymentModule as PaymentGatewayModule } from 'src/module/payment/payment.module';
import { FulfillmentModule } from 'src/module/fulfillment/fulfillment.module';
import { RefundReconciliationScheduler } from './refund-reconciliation.scheduler';
import { RefundRetryProcessor } from './refund-retry.processor';
import { PAYMENT_REFUND_RETRY_QUEUE, RefundRetryQueueService } from './refund-retry.queue';

@Module({
  imports: [
    FinanceModule,
    ClientOrderModule,
    PaymentGatewayModule,
    FulfillmentModule,
    BullModule.registerQueue({
      name: PAYMENT_REFUND_RETRY_QUEUE,
      limiter: { max: 40, duration: 1000 },
    }),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, RefundReconciliationScheduler, RefundRetryQueueService, RefundRetryProcessor],
  exports: [PaymentService],
})
export class PaymentModule {}
