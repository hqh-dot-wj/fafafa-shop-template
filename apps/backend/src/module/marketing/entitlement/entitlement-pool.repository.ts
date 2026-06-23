import { Injectable } from '@nestjs/common';
import { MktEntitlementPool, Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { BaseRepository } from 'src/common/repository/base.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListEntitlementPoolDto } from './dto/list-entitlement-pool.dto';

@Injectable()
export class EntitlementPoolRepository extends BaseRepository<
  MktEntitlementPool,
  Prisma.MktEntitlementPoolCreateInput,
  Prisma.MktEntitlementPoolUpdateInput
> {
  constructor(prisma: PrismaService, cls: ClsService) {
    super(prisma, cls, 'mktEntitlementPool', 'id', 'tenantId');
  }

  async search(query: ListEntitlementPoolDto) {
    const where: Prisma.MktEntitlementPoolWhereInput = {};

    if (query.poolType) {
      where.poolType = query.poolType;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.keyword) {
      where.OR = [
        { id: { contains: query.keyword } },
        { name: { contains: query.keyword } },
        { sourceKey: { contains: query.keyword } },
        { templateId: { contains: query.keyword } },
        { templateName: { contains: query.keyword } },
        { taskId: { contains: query.keyword } },
        { taskName: { contains: query.keyword } },
      ];
    }

    return this.findPage({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      where,
      orderBy: query.orderByColumn || 'updateTime',
      order: query.isAsc || 'desc',
    });
  }
}

