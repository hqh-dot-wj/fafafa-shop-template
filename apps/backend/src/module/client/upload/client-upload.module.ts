import { Module } from '@nestjs/common';
import { UploadModule } from 'src/module/admin/upload/upload.module';
import { ClientUploadController } from './client-upload.controller';

@Module({
  imports: [UploadModule],
  controllers: [ClientUploadController],
})
export class ClientUploadModule {}
