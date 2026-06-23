import { Module } from '@nestjs/common';
import { ORDER_SERVICE } from '../order-service.token';
import { OrderMarketingContractService } from './order-marketing-contract.service';

@Module({
  providers: [
    OrderMarketingContractService,
    {
      provide: ORDER_SERVICE,
      useExisting: OrderMarketingContractService,
    },
  ],
  exports: [OrderMarketingContractService, ORDER_SERVICE],
})
export class OrderContractModule {}
