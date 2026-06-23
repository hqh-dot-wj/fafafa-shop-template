import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { DelFlagEnum, StatusEnum } from 'src/common/enum';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { GenerateUUID } from 'src/common/utils';
import { getErrorMessage } from 'src/common/utils/error';
import { AppConfigService } from 'src/config/app-config.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { appendAliyunOssPutDeniedGuidance } from './oss-put-error-hint';
import { OssStorageService } from './services/oss-storage.service';

/**
 * Multer/busboy 在部分环境下把 UTF-8 文件名字节按 latin1 解码，存库后显示为「æ¥...」「ï¿½ï¿½...」等乱码。
 * - 已是正常 UTF-8 中文：不修改。
 * - 纯 ASCII：不处理。
 * - 其余尝试 latin1 → UTF-8 字节还原；若还原后出现中文而原文无中文，采用还原结果。
 */
export function recoverOriginalFilenameFromMultipart(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const name = raw.trim();
  if (!name) {
    return name;
  }

  if (/^[\u0020-\u007e.]+$/.test(name)) {
    return name;
  }

  const origCjk = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(name);
  const hasMojibakeMarker = name.includes('ï¿½') || /Ã[\u0080-\u00ff]|Â[\u0080-\u00ff]/.test(name);

  if (origCjk && !hasMojibakeMarker) {
    return name;
  }

  try {
    const recovered = Buffer.from(name, 'latin1').toString('utf8').trim();
    if (!recovered || recovered.includes('\uFFFD')) {
      return name;
    }
    const recCjk = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(recovered);
    if (recCjk && !origCjk) {
      return recovered;
    }
    if (hasMojibakeMarker && recovered !== name) {
      return recovered;
    }
    return name;
  } catch {
    return name;
  }
}

export interface UploadFileResult {
  uploadId: string;
  fileName: string;
  newFileName: string;
  url: string;
  size: number;
  mimeType: string;
  storageType: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  /** 与 `schema.prisma` 中 SysUpload 字段长度一致，超长时落库会失败并曾表现为 HTTP 500 */
  private static readonly UPLOAD_DB_LIMITS = {
    url: 500,
    fileName: 255,
    newFileName: 255,
    mimeType: 100,
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
    private readonly config: AppConfigService,
    private readonly ossStorage: OssStorageService,
  ) {}

  /**
   * 由内存 Buffer 上传（与 multipart 单文件上传共用落库与 OSS 逻辑）
   */
  async uploadFromBuffer(params: { buffer: Buffer; originalName: string; mimeType: string }): Promise<UploadFileResult> {
    const { buffer, originalName, mimeType } = params;
    const file = {
      fieldname: 'file',
      originalname: originalName,
      encoding: '7bit',
      mimetype: mimeType,
      size: buffer.length,
      buffer,
      destination: '',
      filename: '',
      path: '',
    } as Express.Multer.File;
    return this.singleFileUpload(file);
  }

  async singleFileUpload(file: Express.Multer.File): Promise<UploadFileResult> {
    if (!file) {
      throw new BusinessException(ResponseCode.PARAM_INVALID, '上传文件不能为空');
    }

    const fileBuffer = await this.getFileBuffer(file);
    const uploadId = GenerateUUID();
    const ext = this.resolveExtension(file);
    const relativeDir = this.buildRelativeDirectory(new Date());
    const newFileName = `${uploadId}${ext}`;
    const relativePath = path.posix.join(relativeDir, newFileName);
    const absoluteDir = path.resolve(process.cwd(), this.config.app.file.location, relativeDir);
    const absolutePath = path.join(absoluteDir, newFileName);
    const tenantId = this.tenantHelper.getTenantId();
    const fileName = this.normalizeOriginalName(file.originalname, newFileName);
    const mimeType = file.mimetype || 'application/octet-stream';

    const useOss = !this.config.app.file.isLocal;
    if (useOss && !this.ossStorage.isConfigured()) {
      throw new BusinessException(
        ResponseCode.PARAM_INVALID,
        '已关闭本地上传但未完整配置阿里云 OSS，请检查 OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET、OSS_REGION、OSS_BUCKET、OSS_ENDPOINT、OSS_PUBLIC_BASE_URL',
      );
    }

    let url: string;
    let storageType: string;

    if (useOss) {
      const objectKey = this.ossStorage.buildObjectKey(relativePath);
      url = this.ossStorage.buildPublicUrl(objectKey);
      storageType = 'oss';
      this.assertUploadRecordFitsSchema(url, fileName, newFileName, mimeType);
      try {
        await this.ossStorage.putObject(objectKey, fileBuffer, mimeType);
      } catch (error) {
        const detail = appendAliyunOssPutDeniedGuidance(getErrorMessage(error));
        this.logger.error(`上传至 OSS 失败: ${fileName}, ${detail}`);
        throw new BusinessException(ResponseCode.BUSINESS_ERROR, `上传至 OSS 失败：${detail}`);
      }
    } else {
      url = this.buildLocalProfileUrl(relativePath);
      storageType = 'local';
      this.assertUploadRecordFitsSchema(url, fileName, newFileName, mimeType);
    }

    try {
      if (!useOss) {
        await fs.promises.mkdir(absoluteDir, { recursive: true });
        await fs.promises.writeFile(absolutePath, fileBuffer);
      }

      await this.prisma.sysUpload.create({
        data: this.tenantHelper.setTenantId({
          uploadId,
          folderId: 0,
          size: fileBuffer.length,
          fileName,
          newFileName,
          url,
          ext: ext || null,
          mimeType,
          storageType,
          fileMd5: createHash('md5').update(fileBuffer).digest('hex'),
          thumbnail: null,
          parentFileId: null,
          version: 1,
          isLatest: true,
          downloadCount: 0,
          status: StatusEnum.NORMAL,
          delFlag: DelFlagEnum.NORMAL,
          createBy: '',
          updateBy: '',
        }),
      });

      await this.incrementTenantStorageUsage(tenantId, fileBuffer.length);

      return {
        uploadId,
        fileName,
        newFileName,
        url,
        size: fileBuffer.length,
        mimeType,
        storageType,
      };
    } catch (error) {
      if (useOss) {
        try {
          await this.ossStorage.deleteObjectByPublicUrl(url);
        } catch (rollbackErr) {
          this.logger.warn(`回滚 OSS 对象失败: ${url}, ${getErrorMessage(rollbackErr)}`);
        }
      } else {
        await this.safeDelete(absolutePath);
      }
      this.logger.error(`文件上传失败: ${fileName}, ${getErrorMessage(error)}`);
      if (error instanceof BusinessException) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2000') {
          throw new BusinessException(
            ResponseCode.PARAM_INVALID,
            '文件记录保存失败：访问地址或文件名超出数据库长度限制，请缩短 OSS_PUBLIC_BASE_URL 或 OSS_PREFIX，或缩短原始文件名',
          );
        }
        throw new BusinessException(
          ResponseCode.OPERATION_FAILED,
          `文件记录保存失败（${error.code}），请稍后重试`,
        );
      }
      throw new BusinessException(ResponseCode.OPERATION_FAILED, `文件上传失败：${getErrorMessage(error)}`);
    }
  }

  private assertUploadRecordFitsSchema(url: string, fileName: string, newFileName: string, mimeType: string): void {
    const L = UploadService.UPLOAD_DB_LIMITS;
    if (url.length > L.url) {
      throw new BusinessException(
        ResponseCode.PARAM_INVALID,
        `文件访问地址过长（${url.length} > ${L.url}），请缩短环境变量 OSS_PUBLIC_BASE_URL 或 OSS_PREFIX`,
      );
    }
    if (fileName.length > L.fileName) {
      throw new BusinessException(ResponseCode.PARAM_INVALID, `原始文件名过长（>${L.fileName} 字符）`);
    }
    if (newFileName.length > L.newFileName) {
      throw new BusinessException(ResponseCode.PARAM_INVALID, `存储文件名异常过长（>${L.newFileName} 字符）`);
    }
    if (mimeType.length > L.mimeType) {
      throw new BusinessException(ResponseCode.PARAM_INVALID, `文件类型字段过长（>${L.mimeType} 字符）`);
    }
  }

  private async getFileBuffer(file: Express.Multer.File): Promise<Buffer> {
    if (Buffer.isBuffer(file.buffer) && file.buffer.length > 0) {
      return file.buffer;
    }

    if (file.path) {
      return fs.promises.readFile(file.path);
    }

    throw new BusinessException(ResponseCode.PARAM_INVALID, '上传文件内容为空');
  }

  private buildRelativeDirectory(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  /** 本地静态托管路径（与 main.ts useStaticAssets 的 /profile 一致） */
  private buildLocalProfileUrl(relativePath: string): string {
    const serveRoot = this.config.app.file.serveRoot.replace(/\/+$/, '');
    return `${serveRoot}/${relativePath}`.replace(/\\/g, '/');
  }

  private resolveExtension(file: Express.Multer.File): string {
    const originalExt = path.extname(file.originalname || '');
    if (originalExt) {
      return originalExt.toLowerCase();
    }

    const mimeParts = (file.mimetype || '').split('/');
    const mimeExt = mimeParts[1];
    return mimeExt ? `.${mimeExt.toLowerCase()}` : '';
  }

  private normalizeOriginalName(originalName: string | undefined, fallbackName: string): string {
    if (!originalName) {
      return fallbackName;
    }

    const decoded = recoverOriginalFilenameFromMultipart(originalName) ?? originalName;
    const sanitizedName = path.basename(decoded).trim();
    return sanitizedName || fallbackName;
  }

  private async incrementTenantStorageUsage(tenantId: string, fileSize: number): Promise<void> {
    const fileSizeMB = Math.ceil(fileSize / 1024 / 1024);
    await this.prisma.sysTenant.updateMany({
      where: { tenantId },
      data: {
        storageUsed: { increment: fileSizeMB },
      },
    });
  }

  private async safeDelete(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`回滚上传文件失败: ${filePath}, ${getErrorMessage(error)}`);
      }
    }
  }
}
