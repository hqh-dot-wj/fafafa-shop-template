import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ActivityRepository } from '../activity/activity.repository';
import { ActivityItemRepository } from './activity-item.repository';
import { ActivityItemService } from './activity-item.service';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [ActivityItemService, ActivityRepository, ActivityItemRepository],
})
export class ActivityItemModule {}
