import { Module } from '@nestjs/common';
import { JobService } from './job.service';
import { JobController } from './job.controller';
import { TaskService } from './task.service';
import { JobLogService } from './job-log.service';
import { JobLogController } from './job-log.controller';
import { JobRepository } from './job.repository';
import { NoticeModule } from 'src/module/admin/system/notice/notice.module';
import { UploadModule } from 'src/module/admin/upload/upload.module';
import { JobDefinitionSyncService } from './services/job-definition-sync.service';

@Module({
  imports: [NoticeModule, UploadModule],
  controllers: [JobController, JobLogController],
  providers: [JobService, TaskService, JobLogService, JobRepository, JobDefinitionSyncService],
  exports: [JobService, TaskService],
})
export class JobModule {}
