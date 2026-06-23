import { Module } from '@nestjs/common';
import { PlayInstanceModule } from 'src/module/marketing/instance/instance.module';
import { ClientPlayInstanceController } from './client-play-instance.controller';

@Module({
  imports: [PlayInstanceModule],
  controllers: [ClientPlayInstanceController],
})
export class ClientPlayInstanceModule {}
