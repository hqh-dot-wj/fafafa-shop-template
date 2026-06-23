import { Module } from '@nestjs/common';
import { StoreOrderController } from './store-order.controller';
import { StoreOrderService } from './store-order.service';
import { FinanceModule } from 'src/module/finance/finance.module';
import { StoreOrderRepository } from './store-order.repository';
import { PaymentModule } from 'src/module/payment/payment.module';
import { DistributionQualificationModule } from '../distribution/qualification/qualification.module';
import { FulfillmentModule } from 'src/module/fulfillment/fulfillment.module';
import { ClientOrderModule } from 'src/module/client/order/order.module';

/**
 * Store端订单管理模块
 */
@Module({
  imports: [FinanceModule, ClientOrderModule, PaymentModule, DistributionQualificationModule, FulfillmentModule],
  controllers: [StoreOrderController],
  providers: [StoreOrderService, StoreOrderRepository],
  exports: [StoreOrderService],
})
export class StoreOrderModule {}
