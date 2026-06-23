import { Module } from '@nestjs/common';
import { MarketingRuntimeLedgerController } from './marketing-runtime-ledger.controller';
import { MarketingRuntimeLedgerService } from './marketing-runtime-ledger.service';

@Module({
  controllers: [MarketingRuntimeLedgerController],
  providers: [MarketingRuntimeLedgerService],
  exports: [MarketingRuntimeLedgerService],
})
export class MarketingRuntimeLedgerModule {}
