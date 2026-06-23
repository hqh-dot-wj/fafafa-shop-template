import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ClientNavigationController } from './client-navigation.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ClientNavigationController],
})
export class ClientNavigationModule {}
