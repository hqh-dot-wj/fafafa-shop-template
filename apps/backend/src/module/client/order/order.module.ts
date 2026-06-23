import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderIntegrationController } from './order-integration.controller';
import { OrderService } from './order.service';
import { NotificationModule } from 'src/module/notification/notification.module';
import { LbsModule } from 'src/module/lbs/lbs.module';
import { BullModule } from '@nestjs/bull';
import { NotificationProcessor } from './notification.processor';
import { OrderDelayProcessor } from './order-delay.processor';
import { OrderRepository } from './order.repository';
import { CartRepository } from '../cart/cart.repository';
import { OrderCheckoutService } from './services/order-checkout.service';
import { OrderCreationApplicationService } from './services/order-creation-application.service';
import { AttributionService } from './services/attribution.service';
import { OrderItemAttributionService } from './services/order-item-attribution.service';
import { ClientAddressModule } from '../address/address.module';
import { ClientCartModule } from '../cart/cart.module';
import { FulfillmentModule } from 'src/module/fulfillment/fulfillment.module';
import { FinanceModule } from 'src/module/finance/finance.module';
import { OrderAsyncTaskPort } from './ports/order-async-task.port';
import { OrderCartPort } from './ports/order-cart.port';
import { OrderInventoryPort } from './ports/order-inventory.port';
import { OrderMarketingPort } from './ports/order-marketing.port';
import { OrderRiskPort } from './ports/order-risk.port';
import { OrderDomainEventPublisher } from './events/order-domain-event.publisher';
import { OrderOutboxDispatcher } from './events/order-outbox.dispatcher';
import { OrderOutboxMetricsService } from './events/order-outbox-metrics.service';
import { OrderOutboxWriter } from './events/order-outbox.writer';
import { StockModule } from 'src/module/store/stock/stock.module';
import { OrderAutoCancelConfigService } from './config/order-auto-cancel.config';
import { OrderAutoCancelScheduler } from './order-auto-cancel.scheduler';
import { ORDER_MARKETING_QUEUE } from 'src/module/marketing/integration/order-marketing-event.contract';
import { DistributionModule } from 'src/module/store/distribution/distribution.module';
import { OrderContractModule } from './contract/order-contract.module';
import { OrderIntegrationModule } from 'src/module/marketing/integration/integration.module';
import { CouponUsageModule } from 'src/module/marketing/coupon/usage/usage.module';
import { PointsAccountModule } from 'src/module/marketing/points/account/account.module';
import { PlayInstanceModule } from 'src/module/marketing/instance/instance.module';
import { ResolutionModule } from 'src/module/marketing/resolution/resolution.module';
import { OrderRefundFinalizerService } from './refund/order-refund-finalizer.service';

/**
 * C端订单模块
 */
@Module({
  imports: [
    NotificationModule,
    OrderContractModule,
    OrderIntegrationModule,
    CouponUsageModule,
    PointsAccountModule,
    PlayInstanceModule,
    ResolutionModule,
    FinanceModule,
    ClientAddressModule, // For AddressRepository
    ClientCartModule, // For CartService
    StockModule,
    FulfillmentModule,
    DistributionModule,
    LbsModule, // For AdmissionService
    BullModule.registerQueue({
      name: 'ORDER_NOTIFICATION',
    }),
    BullModule.registerQueue({
      name: 'ORDER_DELAY',
    }),
    BullModule.registerQueue({
      name: ORDER_MARKETING_QUEUE,
    }),
  ],
  controllers: [OrderController, OrderIntegrationController],
  providers: [
    OrderService,
    NotificationProcessor,
    OrderDelayProcessor,
    OrderAutoCancelScheduler,
    OrderRepository,
    CartRepository,
    OrderCheckoutService,
    OrderCreationApplicationService,
    AttributionService,
    OrderItemAttributionService,
    OrderInventoryPort,
    OrderMarketingPort,
    OrderCartPort,
    OrderRiskPort,
    OrderAsyncTaskPort,
    OrderAutoCancelConfigService,
    OrderOutboxWriter,
    OrderOutboxDispatcher,
    OrderOutboxMetricsService,
    OrderDomainEventPublisher,
    OrderRefundFinalizerService,
  ],

  exports: [
    OrderService,
    OrderRepository,
    OrderContractModule,
    OrderAutoCancelConfigService,
    OrderDomainEventPublisher,
    OrderRefundFinalizerService,
  ],
})
export class ClientOrderModule {}
