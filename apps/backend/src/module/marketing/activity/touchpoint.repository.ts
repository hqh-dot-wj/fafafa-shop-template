import { Injectable } from '@nestjs/common';
import { MktCampaignStatus, MktCampaignTouchpoint, MktTouchpointKind, Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';

interface UpsertTouchpointParams {
  kind: MktTouchpointKind;
  code: string;
  name: string;
  config: Prisma.InputJsonValue;
  isEnabled: boolean;
}

interface ListTouchpointParams {
  kind?: MktTouchpointKind;
  isEnabled?: boolean;
}

@Injectable()
export class TouchpointRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  private get tenantId(): string {
    return TenantContext.getTenantId() || this.cls.get('tenantId');
  }

  async upsert(activityId: string, params: UpsertTouchpointParams): Promise<MktCampaignTouchpoint> {
    const where = this.tenantHelper.readWhereForDelegate('mktCampaignTouchpoint', {
      tenantId: this.tenantId,
      campaignId: activityId,
      kind: params.kind,
      code: params.code,
    }) as Prisma.MktCampaignTouchpointWhereInput;

    const existing = await this.prisma.mktCampaignTouchpoint.findFirst({ where });

    if (existing) {
      return this.prisma.mktCampaignTouchpoint.update({
        where: { id: existing.id },
        data: {
          name: params.name,
          config: params.config,
          isEnabled: params.isEnabled,
        },
      });
    }

    return this.prisma.mktCampaignTouchpoint.create({
      data: {
        tenantId: this.tenantId,
        campaignId: activityId,
        kind: params.kind,
        code: params.code,
        name: params.name,
        config: params.config,
        isEnabled: params.isEnabled,
      },
    });
  }

  async findByActivityId(activityId: string, kind?: MktTouchpointKind): Promise<MktCampaignTouchpoint[]> {
    const where = this.tenantHelper.readWhereForDelegate('mktCampaignTouchpoint', {
      tenantId: this.tenantId,
      campaignId: activityId,
      ...(kind ? { kind } : {}),
    }) as Prisma.MktCampaignTouchpointWhereInput;

    return this.prisma.mktCampaignTouchpoint.findMany({
      where,
      orderBy: [{ kind: 'asc' }, { code: 'asc' }],
    });
  }

  async listByActivityId(activityId: string, query: ListTouchpointParams): Promise<MktCampaignTouchpoint[]> {
    const where = this.tenantHelper.readWhereForDelegate('mktCampaignTouchpoint', {
      tenantId: this.tenantId,
      campaignId: activityId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.isEnabled !== undefined ? { isEnabled: query.isEnabled } : {}),
    }) as Prisma.MktCampaignTouchpointWhereInput;

    return this.prisma.mktCampaignTouchpoint.findMany({
      where,
      orderBy: [{ kind: 'asc' }, { code: 'asc' }],
    });
  }

  async findRuntimeTouchpointsByActivityType(activityType: string): Promise<MktCampaignTouchpoint[]> {
    const where = this.tenantHelper.readWhereForDelegate('mktCampaignTouchpoint', {
      tenantId: this.tenantId,
      isEnabled: true,
      campaign: {
        type: activityType,
        status: MktCampaignStatus.PUBLISHED,
      },
    }) as Prisma.MktCampaignTouchpointWhereInput;

    return this.prisma.mktCampaignTouchpoint.findMany({
      where,
      orderBy: [{ kind: 'asc' }, { code: 'asc' }],
    });
  }
}
