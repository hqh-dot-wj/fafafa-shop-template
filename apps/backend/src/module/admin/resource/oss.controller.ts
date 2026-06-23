import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Api } from 'src/common/decorators/api.decorator';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode, Result } from 'src/common/response';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { User } from 'src/module/admin/system/user/user.decorator';
import { UploadService } from 'src/module/admin/upload/upload.service';
import { ListOssDto } from './dto/list-oss.dto';
import { ListOssConfigDto } from './dto/list-oss-config.dto';
import { OssService } from './oss.service';

/**
 * 管理端「对象存储 / OSS 配置」接口（与 admin-web resource/oss/* 对齐）
 *
 * 使用独立前缀 `resource/oss`，避免与同模块 `@Controller('resource')` 的 SSE 控制器在路由合并上出现边界问题。
 *
 * @tenantScope TenantScoped
 */
@ApiTags('资源-OSS')
@Controller('resource/oss')
@ApiBearerAuth('Authorization')
export class OssController {
  constructor(
    private readonly ossService: OssService,
    private readonly uploadService: UploadService,
  ) {}

  @Get('list')
  @RequirePermission('system:oss:list')
  @Api({ summary: 'OSS 对象列表（数据来自 sys_upload）' })
  list(@Query() query: ListOssDto) {
    return this.ossService.list(query);
  }

  @Get('listByIds/:ossIds')
  @RequirePermission('system:oss:list')
  @Api({ summary: '按主键串查询 OSS 记录' })
  listByIds(@Param('ossIds') ossIds: string) {
    return this.ossService.listByIds(ossIds);
  }

  @Post('upload')
  @HttpCode(200)
  @RequirePermission('system:oss:list')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @Api({ summary: '上传文件（写入 sys_upload，本地或 OSS 由 FILE_IS_LOCAL 决定）' })
  async upload(@UploadedFile() file: Express.Multer.File) {
    BusinessException.throwIf(!file, '请选择文件');
    const r = await this.uploadService.singleFileUpload(file);
    return Result.ok(this.ossService.buildUploadVo(r));
  }

  @Get('download/:ossId')
  @RequirePermission('system:oss:list')
  @Api({ summary: '下载或跳转 OSS/本地文件' })
  async download(@Param('ossId') ossId: string, @Res({ passthrough: false }) res: Response) {
    await this.ossService.download(ossId, res);
  }

  private configNotImplemented() {
    return Result.fail(ResponseCode.NOT_IMPLEMENTED, '本项目 OSS 使用环境变量 OSS_* 配置，请在服务端 .env 维护');
  }

  // ---------- OSS 配置：占位（实际使用环境变量 OSS_*）；具体路由须在 `:ossIds` 之前注册 ----------

  @Get('config/list')
  @RequirePermission('system:ossConfig:list')
  @Api({ summary: 'OSS 配置列表（未实现，统一由环境变量维护）' })
  configList(@Query() _query: ListOssConfigDto) {
    return this.configNotImplemented();
  }

  @Post('config')
  @RequirePermission('system:ossConfig:list')
  @Api({ summary: '新增 OSS 配置（未实现）' })
  configCreate() {
    return this.configNotImplemented();
  }

  @Put('config')
  @RequirePermission('system:ossConfig:list')
  @Api({ summary: '修改 OSS 配置（未实现）' })
  configUpdate() {
    return this.configNotImplemented();
  }

  @Delete('config/:ossConfigIds')
  @RequirePermission('system:ossConfig:list')
  @Api({ summary: '删除 OSS 配置（未实现）' })
  configDelete() {
    return this.configNotImplemented();
  }

  @Put('config/changeStatus')
  @RequirePermission('system:ossConfig:list')
  @Api({ summary: '修改 OSS 配置状态（未实现）' })
  configChangeStatus(@Body() _body: Record<string, unknown>) {
    return this.configNotImplemented();
  }

  @Delete(':ossIds')
  @RequirePermission('system:oss:delete')
  @Api({ summary: '批量删除 OSS 记录（软删 sys_upload，与文件管理一致）' })
  remove(@Param('ossIds') ossIds: string, @User('userName') username: string) {
    return this.ossService.deleteByIdsCsv(ossIds, username);
  }
}
