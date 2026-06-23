import { Injectable } from '@nestjs/common';
import { MktCampaign, MktCampaignStatus, Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { BaseRepository } from 'src/common/repository/base.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityQueryDto } from '../activity/dto/activity-query.dto';

@Injectable()
export class CampaignRepository extends BaseRepository<
  MktCampaign,
  Prisma.MktCampaignCreateInput,
  Prisma.MktCampaignUpdateInput
> {
  constructor(prisma: PrismaService, cls: ClsService) {
    super(prisma, cls, 'mktCampaign', 'id', 'tenantId');
  }

  async search(query: ActivityQueryDto) {
    const where: Prisma.MktCampaignWhereInput = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.ownerUserId) {
      where.ownerUserId = { contains: query.ownerUserId.trim() };
    }

    if (query.status) {
      where.status = this.mapQueryStatus(query.status);
    }

    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [{ id: { contains: keyword } }, { name: { contains: keyword } }, { tenantId: { contains: keyword } }];
    }

    return this.findPage({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      where,
      orderBy: query.orderByColumn || 'updateTime',
      order: query.isAsc || 'desc',
    });
  }

  async findActivePublishedByType(type: string): Promise<MktCampaign | null> {
    const now = new Date();
    return this.delegate.findFirst({
      where: this.scopeReadWhere({
        type,
        status: MktCampaignStatus.PUBLISHED,
        OR: [{ startTime: null }, { startTime: { lte: now } }],
        AND: [{ OR: [{ endTime: null }, { endTime: { gt: now } }] }],
      }),
      orderBy: [{ priority: 'desc' }, { startTime: 'desc' }, { updateTime: 'desc' }],
    });
  }

  async findActivePublishedByTypes(types: string[]): Promise<MktCampaign[]> {
    if (types.length === 0) return [];
    const now = new Date();
    return this.delegate.findMany({
      where: this.scopeReadWhere({
        type: { in: types },
        status: MktCampaignStatus.PUBLISHED,
        OR: [{ startTime: null }, { startTime: { lte: now } }],
        AND: [{ OR: [{ endTime: null }, { endTime: { gt: now } }] }],
      }),
      orderBy: [{ priority: 'desc' }, { startTime: 'desc' }, { updateTime: 'desc' }],
    });
  }

  private mapQueryStatus(status: string): MktCampaignStatus {
    if (status === 'PUBLISHED') return MktCampaignStatus.PUBLISHED;
    if (status === 'PAUSED') return MktCampaignStatus.PAUSED;
    if (status === 'ARCHIVED') return MktCampaignStatus.ARCHIVED;
    return MktCampaignStatus.DRAFT;
  }
}
