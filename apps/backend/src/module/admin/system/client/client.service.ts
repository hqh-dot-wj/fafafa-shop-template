import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma, Status, SysClient } from '@prisma/client';
import { Result, ResponseCode } from 'src/common/response';
import { DelFlagEnum, StatusEnum } from 'src/common/enum/index';
import { ExportTable } from 'src/common/utils/export';
import { FormatDateFields } from 'src/common/utils/index';
import { PaginationHelper } from 'src/common/utils/pagination.helper';
import { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { BusinessException } from 'src/common/exceptions';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import {
  CreateClientDto,
  UpdateClientDto,
  ListClientDto,
  ChangeClientStatusDto,
} from './dto/index';

@Injectable()
export class ClientService {
  constructor(private readonly prisma: PrismaService) {}

  private joinGrantTypes(list: string[]): string {
    return list.map((s) => s.trim()).filter(Boolean).join(',');
  }

  private mapRow(row: SysClient) {
    const grantTypeList = row.grantTypeList ? row.grantTypeList.split(',').map((s) => s.trim()).filter(Boolean) : [];
    return {
      id: row.id,
      clientId: row.clientId,
      clientKey: row.clientKey,
      clientSecret: row.clientSecret,
      grantTypeList,
      grantType: grantTypeList[0] ?? 'password',
      deviceType: row.deviceType ?? 'pc',
      activeTimeout: row.activeTimeout,
      timeout: row.timeout,
      status: row.status === Status.NORMAL ? '0' : '1',
      delFlag: row.delFlag === DelFlagEnum.NORMAL ? '0' : '1',
    };
  }

  /**
   * 分页查询客户端列表
   *
   * @param query - 分页与筛选条件
   * @returns 分页数据
   */
  async findAll(query: ListClientDto) {
    const { skip, take, pageNum, pageSize } = PaginationHelper.getPagination(query);
    const where: Prisma.SysClientWhereInput = {};

    if (query.clientKey) {
      where.clientKey = { contains: query.clientKey };
    }
    if (query.clientSecret) {
      where.clientSecret = { contains: query.clientSecret };
    }
    if (query.status) {
      where.status = query.status as Status;
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.sysClient.findMany({
        where,
        skip,
        take,
        orderBy: [{ id: 'asc' }],
      }),
      this.prisma.sysClient.count({ where }),
    ]);

    const rows = FormatDateFields(list).map((row) => this.mapRow(row as SysClient));
    return Result.page(rows, total, pageNum, pageSize);
  }

  async create(dto: CreateClientDto & { createBy?: string; updateBy?: string }) {
    const dup = await this.prisma.sysClient.findFirst({
      where: { clientKey: dto.clientKey, delFlag: DelFlagEnum.NORMAL },
    });
    BusinessException.throwIf(Boolean(dup), '客户端 key 已存在');

    const grantJoined = this.joinGrantTypes(dto.grantTypeList);
    BusinessException.throwIf(!grantJoined, '授权类型不能为空');

    const clientId = randomBytes(16).toString('hex');
    await this.prisma.sysClient.create({
      data: {
        clientId,
        clientKey: dto.clientKey,
        clientSecret: dto.clientSecret,
        grantTypeList: grantJoined,
        deviceType: dto.deviceType,
        activeTimeout: dto.activeTimeout ?? 1800,
        timeout: dto.timeout ?? 86400,
        status: (dto.status ?? StatusEnum.NORMAL) as Status,
        delFlag: DelFlagEnum.NORMAL,
        createBy: dto.createBy ?? '',
        updateBy: dto.updateBy ?? '',
      },
    });
    return Result.ok();
  }

  async update(dto: UpdateClientDto & { updateBy?: string }) {
    const existing = await this.prisma.sysClient.findFirst({
      where: { id: dto.id, delFlag: DelFlagEnum.NORMAL },
    });
    BusinessException.throwIfNull(existing, '客户端不存在');
    BusinessException.throwIf(existing.clientId !== dto.clientId, '客户端标识不匹配');

    BusinessException.throwIf(dto.clientKey !== existing.clientKey, '不允许修改客户端 key');

    const grantJoined = this.joinGrantTypes(dto.grantTypeList);
    BusinessException.throwIf(!grantJoined, '授权类型不能为空');

    BusinessException.throwIf(
      existing.id === 1 && dto.status === StatusEnum.STOP,
      '内置客户端不可停用',
      ResponseCode.BAD_REQUEST,
    );

    await this.prisma.sysClient.update({
      where: { id: dto.id },
      data: {
        clientSecret: dto.clientSecret,
        grantTypeList: grantJoined,
        deviceType: dto.deviceType,
        activeTimeout: dto.activeTimeout ?? existing.activeTimeout,
        timeout: dto.timeout ?? existing.timeout,
        status: (dto.status ?? existing.status) as Status,
        updateBy: dto.updateBy ?? '',
      },
    });
    return Result.ok();
  }

  @Transactional()
  async remove(ids: number[]) {
    const unique = [...new Set(ids)];
    BusinessException.throwIf(unique.includes(1), '内置客户端不可删除');

    await this.prisma.sysClient.deleteMany({
      where: { id: { in: unique } },
    });
    return Result.ok();
  }

  async changeStatus(dto: ChangeClientStatusDto & { updateBy?: string }) {
    const row = await this.prisma.sysClient.findFirst({
      where: { clientId: dto.clientId, delFlag: DelFlagEnum.NORMAL },
    });
    BusinessException.throwIfNull(row, '客户端不存在');
    BusinessException.throwIf(row.id === 1, '内置客户端不可变更状态');

    await this.prisma.sysClient.update({
      where: { id: row.id },
      data: {
        status: dto.status,
        updateBy: dto.updateBy ?? '',
      },
    });
    return Result.ok();
  }

  /**
   * 导出客户端列表为 xlsx
   */
  async export(res: Response, body: ListClientDto) {
    delete body.pageNum;
    delete body.pageSize;
    const listResult = await this.findAll(body);
    const rows = listResult.data?.rows ?? [];
    const options = {
      sheetName: '客户端数据',
      data: rows,
      header: [
        { title: '主键', dataIndex: 'id' },
        { title: '客户端ID', dataIndex: 'clientId' },
        { title: '客户端Key', dataIndex: 'clientKey' },
        { title: '客户端秘钥', dataIndex: 'clientSecret' },
        { title: '设备类型', dataIndex: 'deviceType' },
        { title: '活跃超时(秒)', dataIndex: 'activeTimeout' },
        { title: '固定超时(秒)', dataIndex: 'timeout' },
        { title: '状态', dataIndex: 'status' },
      ],
    };
    return await ExportTable(options, res);
  }
}
