import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CouponModule } from '../coupon/coupon.module';
import { PointsModule } from '../points/points.module';
import { PointsDegradationModule } from '../points/degradation/degradation.module';
import { OrderIntegrationService } from './integration.service';
import { MarketingEventsModule } from '../events/events.module';
import { PlayInstanceModule } from '../instance/instance.module';
import { FinanceModule } from 'src/module/finance/finance.module';
import { OrderMarketingEventProcessor } from './order-marketing-event.processor';
import { ORDER_MARKETING_QUEUE } from './order-marketing-event.contract';
import { DistributionModule } from 'src/module/store/distribution/distribution.module';
import { OrderContractModule } from 'src/module/client/order/contract/order-contract.module';

/**
 * 订单集成模块
 * C 端 calculate-discount Controller 已迁移至 module/client/order
 *
 * 注册 `order-marketing` Bull 队列，用于异步重投支付成功 / 订单取消 / 退款事件。
 */
@Module({
  imports: [
    CouponModule,
    PointsModule,
    PointsDegradationModule,
    MarketingEventsModule,
    BullModule.registerQueue({ name: ORDER_MARKETING_QUEUE }),
    FinanceModule,
    DistributionModule,
    OrderContractModule,
    forwardRef(() => PlayInstanceModule),
  ],
  controllers: [],
  providers: [OrderIntegrationService, OrderMarketingEventProcessor],
  exports: [OrderIntegrationService],
})
export class OrderIntegrationModule {}
