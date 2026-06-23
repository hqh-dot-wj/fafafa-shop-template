import { Module } from '@nestjs/common';
import { MarketingProtocolController } from './protocol.controller';
import { MarketingProtocolService } from './protocol.service';

@Module({
  controllers: [MarketingProtocolController],
  providers: [MarketingProtocolService],
  exports: [MarketingProtocolService],
})
export class MarketingProtocolModule {}
