import { Module } from '@nestjs/common';
import { ClientShopController } from './shop.controller';
import { ClientShopService } from './shop.service';

@Module({
  controllers: [ClientShopController],
  providers: [ClientShopService],
  exports: [ClientShopService],
})
export class ClientShopModule {}
