import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NavigationController } from './navigation.controller';
import { NavigationRepository } from './navigation.repository';
import { NavigationService } from './navigation.service';

@Module({
  imports: [PrismaModule],
  controllers: [NavigationController],
  providers: [NavigationService, NavigationRepository],
  exports: [NavigationService],
})
export class NavigationModule {}
