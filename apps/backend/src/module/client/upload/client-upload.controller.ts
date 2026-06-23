import { Controller, HttpCode, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { BusinessException } from 'src/common/exceptions';
import { Result } from 'src/common/response';
import { AppConfigService } from 'src/config/app-config.service';
import { resolveUploadPublicUrl } from 'src/module/admin/resource/oss-display-url';
import { UploadService } from 'src/module/admin/upload/upload.service';
import { MemberAuthGuard } from '../common/guards/member-auth.guard';

export interface ClientUploadFileVo {
  ossId: string;
  url: string;
  size: number;
  mimeType: string;
  storageType: string;
}

/**
 * C 端通用文件上传（会员登录态，写入 sys_upload，本地或 OSS 由 FILE_IS_LOCAL 决定）
 *
 * @tenantScope TenantScoped
 */
@ApiTags('C端-上传')
@ApiBearerAuth()
@UseGuards(MemberAuthGuard)
@Controller('client/upload')
export class ClientUploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly config: AppConfigService,
  ) {}

  @Post('file')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @Api({ summary: '通用单文件上传（OSS/本地）', type: Object })
  async upload(@UploadedFile() file: Express.Multer.File): Promise<Result<ClientUploadFileVo>> {
    BusinessException.throwIf(!file, '请选择文件');
    const r = await this.uploadService.singleFileUpload(file);
    const url = resolveUploadPublicUrl(r.url, this.config.app.file.domain);
    return Result.ok({
      ossId: r.uploadId,
      url,
      size: r.size,
      mimeType: r.mimeType,
      storageType: r.storageType,
    });
  }
}
