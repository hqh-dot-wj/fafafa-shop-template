import { Injectable, Logger } from '@nestjs/common';
import { DelFlag, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfigService } from 'src/config/app-config.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { getErrorMessage } from 'src/common/utils/error';
import { OssStorageService } from './oss-storage.service';

interface VersionFileRecord {
  url: string;
  storageType: string;
  fileName: string;
  uploadId: string;
  version?: number;
  parentFileId?: string | null;
}

@Injectable()
export class VersionService {
  private readonly logger = new Logger(VersionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
    private readonly config: AppConfigService,
    private readonly ossStorage: OssStorageService,
  ) {}

  async deletePhysicalFile(file: VersionFileRecord): Promise<void> {
    if (file.storageType === 'oss') {
      if (!this.ossStorage.isConfigured()) {
        this.logger.warn(`OSS 未配置，跳过删除远端对象: ${file.fileName}`);
        return;
      }
      try {
        await this.ossStorage.deleteObjectByPublicUrl(file.url);
        this.logger.log(`已删除 OSS 对象: ${file.fileName}`);
      } catch (error) {
        this.logger.warn(`删除 OSS 对象失败: ${file.fileName}, ${getErrorMessage(error)}`);
      }
      return;
    }

    if (file.storageType !== 'local') {
      return;
    }

    const filePath = this.resolveLocalFilePath(file.url);
    if (!filePath) {
      return;
    }

    try {
      await fs.promises.unlink(filePath);
      this.logger.log(`已删除物理文件: ${file.fileName}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`删除物理文件失败: ${file.fileName}, ${getErrorMessage(error)}`);
      }
    }
  }

  async checkAndCleanOldVersions(baseId: string): Promise<void> {
    const autoCleanConfig = await this.prisma.sysConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('sysConfig', {
        configKey: 'sys.file.autoCleanVersions',
        delFlag: DelFlag.NORMAL,
      }) as Prisma.SysConfigWhereInput,
    });

    if (autoCleanConfig?.configValue !== 'true') {
      return;
    }

    const maxVersionsConfig = await this.prisma.sysConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('sysConfig', {
        configKey: 'sys.file.maxVersions',
        delFlag: DelFlag.NORMAL,
      }) as Prisma.SysConfigWhereInput,
    });

    const maxVersions = Number.parseInt(maxVersionsConfig?.configValue || '5', 10);
    if (!Number.isFinite(maxVersions) || maxVersions < 1) {
      return;
    }

    const versions = await this.prisma.sysUpload.findMany({
      where: this.tenantHelper.readWhereForDelegate('sysUpload', {
        OR: [{ uploadId: baseId }, { parentFileId: baseId }],
        delFlag: DelFlag.NORMAL,
      }) as Prisma.SysUploadWhereInput,
      orderBy: { version: 'desc' },
    });

    for (const version of versions.slice(maxVersions)) {
      try {
        await this.deletePhysicalFile(version);
        await this.prisma.sysUpload.delete({
          where: { uploadId: version.uploadId },
        });
        this.logger.log(`已清理旧版本: ${version.uploadId}`);
      } catch (error) {
        this.logger.error(`清理旧版本失败: ${version.uploadId}, ${getErrorMessage(error)}`);
      }
    }
  }

  private resolveLocalFilePath(fileUrl: string): string | null {
    const serveRoot = this.config.app.file.serveRoot;
    const relativePath = fileUrl.split(serveRoot)[1];

    if (!relativePath) {
      return null;
    }

    return path.join(process.cwd(), this.config.app.file.location, relativePath);
  }
}
