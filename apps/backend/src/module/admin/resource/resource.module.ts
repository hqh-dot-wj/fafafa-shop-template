import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FileManagerModule } from 'src/module/admin/system/file-manager/file-manager.module';
import { UploadModule } from 'src/module/admin/upload/upload.module';
import { AppConfigService } from 'src/config/app-config.service';
import { OssController } from './oss.controller';
import { OssService } from './oss.service';
import { SseController } from './sse.controller';
import { SseService } from './sse.service';

@Module({
  imports: [
    UploadModule,
    FileManagerModule,
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwt.secretkey,
        signOptions: { expiresIn: config.jwt.expiresin },
      }),
    }),
  ],
  controllers: [SseController, OssController],
  providers: [SseService, OssService],
  exports: [SseService],
})
export class ResourceModule {}
