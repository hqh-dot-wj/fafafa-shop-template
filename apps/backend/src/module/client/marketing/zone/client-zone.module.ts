import { Module } from '@nestjs/common';
import { ClientZoneController } from './client-zone.controller';
import { ClientZoneService } from './client-zone.service';
import { MarketingModule } from 'src/module/marketing/marketing.module';
import { ClientSceneModule } from '../scene/client-scene.module';

@Module({
  imports: [MarketingModule, ClientSceneModule],
  controllers: [ClientZoneController],
  providers: [ClientZoneService],
})
export class ClientZoneModule {}
