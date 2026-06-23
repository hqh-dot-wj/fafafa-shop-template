import { Module } from '@nestjs/common';
import { ClientAggregateController } from './client-aggregate.controller';
import { ClientAggregateService } from './client-aggregate.service';
import { MarketingModule } from 'src/module/marketing/marketing.module';
import { ClientSceneModule } from '../scene/client-scene.module';

@Module({
  imports: [MarketingModule, ClientSceneModule],
  controllers: [ClientAggregateController],
  providers: [ClientAggregateService],
})
export class ClientAggregateModule {}
