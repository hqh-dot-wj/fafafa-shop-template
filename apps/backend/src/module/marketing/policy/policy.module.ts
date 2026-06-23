import { Module } from '@nestjs/common';
import { MarketingPolicyController } from './policy.controller';
import { MarketingPolicyService } from './policy.service';
import { MarketingPolicyRepository } from './policy.repository';

@Module({
  controllers: [MarketingPolicyController],
  providers: [MarketingPolicyService, MarketingPolicyRepository],
  exports: [MarketingPolicyService],
})
export class MarketingPolicyModule {}
