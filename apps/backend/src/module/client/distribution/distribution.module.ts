import { Module } from '@nestjs/common';
import { DistributionModule as StoreDistributionModule } from 'src/module/store/distribution/distribution.module';
import { ClientDistributionController } from './distribution.controller';

@Module({
  imports: [StoreDistributionModule],
  controllers: [ClientDistributionController],
})
export class ClientDistributionModule {}
