import { Injectable } from '@nestjs/common';
import { Prisma, SysUpload } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import type { Response } from 'express';
import { DelFlagEnum } from 'src/common/enum';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode, Result } from 'src/common/response';
import { TenantContext } from 'src/common/tenant';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { FormatDateFields } from 'src/common/utils';
import { PaginationHelper } from 'src/common/utils/pagination.helper';
import { AppConfigService } from 'src/config/app-config.service';
import { FileManagerService } from 'src/module/admin/system/file-manager/file-manager.service';
import { UploadFileResult, UploadService } from 'src/module/admin/upload/upload.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListOssDto } from './dto/list-oss.dto';
import { resolveUploadPublicUrl } from './oss-display-url';

export interface OssListItemVo {
  ossId: string;
  tenantId: string;
  fileName: string;
  originalName: string;
  fileSuffix: string;
  url: string;
  ext1: string;
  service: string;
  createByName: string;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string;
}

/**
 * 管理端「对象存储」页：数据来自 sys_upload，与文件上传（本地/OSS）共用
 */
@Injectable()
export class OssService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
    private readonly config: AppConfigService,
    private readonly uploadService: UploadService,
    private readonly fileManagerService: FileManagerService,
  ) {}

  async list(query: ListOssDto): Promise<Result<{ rows: OssListItemVo[]; total: number }>> {
    const tenantId = TenantContext.getTenantId();
    const andFilters: Prisma.SysUploadWhereInput[] = [];

    if (query.fileName?.trim()) {
      const v = query.fileName.trim();
      andFilters.push({
        OR: [{ fileName: { contains: v } }, { newFileName: { contains: v } }],
      });
    }

    if (query.originalName?.trim()) {
      andFilters.push({ fileName: { contains: query.originalName.trim() } });
    }

    if (query.fileSuffix?.trim()) {
      const raw = query.fileSuffix.trim().toLowerCase();
      const withDot = raw.startsWith('.') ? raw : `.${raw}`;
      const noDot = withDot.replace(/^\./u, '');
      andFilters.push({
        OR: [{ ext: withDot }, { ext: noDot }],
      });
    }

    if (query.service?.trim()) {
      const s = query.service.trim();
      if (s === '阿里云' || s.toLowerCase() === 'aliyun') {
        andFilters.push({ storageType: 'oss' });
      } else if (s === '本地' || s.toLowerCase() === 'local') {
        andFilters.push({ storageType: 'local' });
      }
    }

    const where: Prisma.SysUploadWhereInput = {
      tenantId,
      delFlag: DelFlagEnum.NORMAL,
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    };

    const scopedWhere = this.tenantHelper.readWhereForDelegate(
      'sysUpload',
      where as object,
    ) as Prisma.SysUploadWhereInput;

    const dir = query.isAsc === 'ascending' ? 'asc' : 'desc';
    let orderField: 'createTime' | 'newFileName' | 'updateTime' = 'createTime';
    if (query.orderByColumn === 'fileName') {
      orderField = 'newFileName';
    } else if (query.orderByColumn === 'updateTime') {
      orderField = 'updateTime';
    }
    const orderBy: Prisma.SysUploadOrderByWithRelationInput = { [orderField]: dir };

    const { skip, take } = PaginationHelper.getPagination(query);

    const { rows, total } = await PaginationHelper.paginateWithTransaction(
      this.prisma,
      this.prisma.sysUpload,
      {
        where: scopedWhere,
        skip,
        take,
        orderBy,
      },
      { where: scopedWhere },
    );

    const vos = FormatDateFields(rows.map((r) => this.toOssVo(r))) as unknown as OssListItemVo[];
    return Result.ok({ rows: vos, total });
  }

  async listByIds(idCsv: string): Promise<Result<OssListItemVo[]>> {
    const ids = idCsv
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const tenantId = TenantContext.getTenantId();
    const rows = await this.prisma.sysUpload.findMany({
      where: this.tenantHelper.readWhereForDelegate('sysUpload', {
        uploadId: { in: ids },
        tenantId,
        delFlag: DelFlagEnum.NORMAL,
      }) as Prisma.SysUploadWhereInput,
      orderBy: { createTime: 'desc' },
    });
    const vos = FormatDateFields(rows.map((r) => this.toOssVo(r))) as unknown as OssListItemVo[];
    return Result.ok(vos);
  }

  /**
   * 上传完成后的响应体（与 admin-web FileUpload 解析字段一致）
   */
  buildUploadVo(r: UploadFileResult): Record<string, unknown> {
    const ext = path.extname(r.newFileName);
    const tenantId = TenantContext.getTenantId();
    return FormatDateFields({
      ossId: r.uploadId,
      tenantId,
      fileName: r.newFileName,
      originalName: r.fileName,
      fileSuffix: ext,
      url: resolveUploadPublicUrl(r.url, this.config.app.file.domain),
      ext1: '',
      /** 机器可读：与列表项 `service` 对应，便于排查「成功但未上 OSS」多为 FILE_IS_LOCAL=true */
      storageType: r.storageType,
      service: r.storageType === 'oss' ? '阿里云' : '本地',
      createByName: '—',
      createBy: '',
      updateBy: '',
      createTime: new Date(),
      updateTime: new Date(),
    });
  }

  async deleteByIdsCsv(idCsv: string, username: string) {
    const ids = idCsv
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    BusinessException.throwIf(ids.length === 0, '请选择要删除的文件');
    return this.fileManagerService.deleteFiles(ids, username);
  }

  async download(ossId: string, res: Response): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    const file = await this.prisma.sysUpload.findFirst({
      where: this.tenantHelper.readWhereForDelegate('sysUpload', {
        uploadId: ossId,
        tenantId,
        delFlag: DelFlagEnum.NORMAL,
      }) as Prisma.SysUploadWhereInput,
    });

    if (!file) {
      throw new BusinessException(ResponseCode.DATA_NOT_FOUND, '文件不存在');
    }

    if (
      file.storageType === 'oss' ||
      file.url.startsWith('http://') ||
      file.url.startsWith('https://')
    ) {
      const target = file.url.startsWith('http://') || file.url.startsWith('https://')
        ? file.url
        : resolveUploadPublicUrl(file.url, this.config.app.file.domain);
      res.redirect(302, target);
      return;
    }

    const baseDir = path.join(process.cwd(), this.config.app.file.location);
    const serveRoot = this.config.app.file.serveRoot;
    const relativePath = file.url.split(serveRoot)[1];
    if (!relativePath) {
      throw new BusinessException(ResponseCode.PARAM_INVALID, '文件路径无效');
    }

    const filePath = path.join(baseDir, relativePath);
    if (!fs.existsSync(filePath)) {
      throw new BusinessException(ResponseCode.DATA_NOT_FOUND, '文件不存在');
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  private toOssVo(row: SysUpload): Record<string, unknown> {
    const ext = (row.ext || '').trim();
    const fileSuffix = ext.startsWith('.') ? ext : ext ? `.${ext}` : '';
    const service = row.storageType === 'oss' ? '阿里云' : '本地';
    const domain = this.config.app.file.domain;
    return {
      ossId: row.uploadId,
      tenantId: row.tenantId,
      fileName: row.newFileName,
      originalName: row.fileName,
      fileSuffix,
      url: resolveUploadPublicUrl(row.url, domain),
      ext1: '',
      service,
      createByName: row.createBy || '—',
      createBy: row.createBy ?? '',
      updateBy: row.updateBy ?? '',
      createTime: row.createTime,
      updateTime: row.updateTime,
    };
  }
}
