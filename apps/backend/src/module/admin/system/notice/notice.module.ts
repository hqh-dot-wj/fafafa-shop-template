import { Module } from '@nestjs/common';
import { NoticeService } from './notice.service';
import { NoticeController } from './notice.controller';
import { NoticeRepository } from './notice.repository';
import { NotificationModule } from 'src/module/notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [NoticeController],
  providers: [NoticeService, NoticeRepository],
  exports: [NoticeService],
})
export class NoticeModule {}
