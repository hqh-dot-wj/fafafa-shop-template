import { Module } from '@nestjs/common';
import { OssStorageService } from './services/oss-storage.service';
import { VersionService } from './services/version.service';
import { UploadService } from './upload.service';

@Module({
  providers: [OssStorageService, UploadService, VersionService],
  exports: [OssStorageService, UploadService, VersionService],
})
export class UploadModule {}
