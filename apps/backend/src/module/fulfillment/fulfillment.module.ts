import { Module } from '@nestjs/common';
import { FinanceModule } from 'src/module/finance/finance.module';
import { DistributionQualificationModule } from 'src/module/store/distribution/qualification/qualification.module';
import { FulfillmentController } from './fulfillment.controller';
import { FulfillmentService } from './fulfillment.service';

@Module({
  imports: [FinanceModule, DistributionQualificationModule],
  controllers: [FulfillmentController],
  providers: [FulfillmentService],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
