import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { MktCampaign, MktCampaignStatus, Prisma } from '@prisma/client';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { isPolicyCampaignType, resolveCampaignKind } from '../common/campaign-type';

export interface FindCenterRowsParams {
  type?: string;
}

/**
 * 营销活动仓储
 *
 * @description 兼容旧 ActivityService 入口，实际读写 MktCampaign 和 MktCampaignParticipation。
 */
@Injectable()
export class ActivityRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  private get tenantId(): string {
    return TenantContext.getTenantId() || this.cls.get('tenantId');
  }

  async findEnabledByType(type: string): Promise<MktCampaign | null> {
    const now = new Date();
    return this.prisma.mktCampaign.findFirst({
      where: this.tenantHelper.readWhereForDelegate('mktCampaign', {
        tenantId: this.tenantId,
        type,
        status: MktCampaignStatus.PUBLISHED,
        OR: [{ startTime: null }, { startTime: { lte: now } }],
        AND: [{ OR: [{ endTime: null }, { endTime: { gt: now } }] }],
      }) as Prisma.MktCampaignWhereInput,
      orderBy: [{ priority: 'desc' }, { startTime: 'desc' }, { updateTime: 'desc' }],
    });
  }

  async findById(id: string): Promise<MktCampaign | null> {
    return this.prisma.mktCampaign.findFirst({
      where: this.tenantHelper.readWhereForDelegate('mktCampaign', {
        id,
        tenantId: this.tenantId,
      }) as Prisma.MktCampaignWhereInput,
    });
  }

  async findPage(params: { pageNum: number; pageSize: number; type?: string; isEnabled?: boolean }) {
    const where: Prisma.MktCampaignWhereInput = {
      tenantId: this.tenantId,
    };
    if (params.type) where.type = params.type;
    if (params.isEnabled !== undefined) {
      where.status = params.isEnabled ? MktCampaignStatus.PUBLISHED : { not: MktCampaignStatus.PUBLISHED };
    }

    const scopedWhere = this.tenantHelper.readWhereForDelegate(
      'mktCampaign',
      where as object,
    ) as Prisma.MktCampaignWhereInput;

    const [rows, total] = await Promise.all([
      this.prisma.mktCampaign.findMany({
        where: scopedWhere,
        skip: (params.pageNum - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { createTime: 'desc' },
      }),
      this.prisma.mktCampaign.count({ where: scopedWhere }),
    ]);

    return { rows, total };
  }

  async findCenterRows(params: FindCenterRowsParams = {}): Promise<MktCampaign[]> {
    const where: Prisma.MktCampaignWhereInput = {
      tenantId: this.tenantId,
    };

    if (params.type) {
      where.type = params.type;
    }

    const scopedWhere = this.tenantHelper.readWhereForDelegate(
      'mktCampaign',
      where as object,
    ) as Prisma.MktCampaignWhereInput;

    return this.prisma.mktCampaign.findMany({
      where: scopedWhere,
      orderBy: [{ updateTime: 'desc' }, { createTime: 'desc' }],
    });
  }

  async create(data: {
    tenantId?: string;
    type: string;
    name: string;
    description?: string | null;
    triggerCondition: Prisma.InputJsonValue;
    rules: Prisma.InputJsonValue;
    rewards: Prisma.InputJsonValue;
    startTime?: Date | string | null;
    endTime?: Date | string | null;
    isEnabled?: boolean;
    priority?: number;
    createdBy?: string | null;
    updatedBy?: string | null;
  }): Promise<MktCampaign> {
    const tenantId = data.tenantId || this.tenantId;
    const startTime = this.toDate(data.startTime);
    const endTime = this.toDate(data.endTime);
    const priority = data.priority ?? 0;
    return this.prisma.mktCampaign.create({
      data: {
        tenantId,
        type: data.type,
        kind: resolveCampaignKind(data.type),
        name: data.name,
        description: data.description,
        status: (data.isEnabled ?? true) ? MktCampaignStatus.PUBLISHED : MktCampaignStatus.DRAFT,
        startTime,
        endTime,
        priority,
        policyJson: this.toPolicyJson(data.type, data.triggerCondition, data.rules, data.rewards),
        foundationJson: this.toFoundationJson(startTime, endTime, data.isEnabled ?? true, priority),
        audienceJson: data.triggerCondition,
        stagesJson: data.rules,
        rightsJson: data.rewards,
        deliveryJson: {},
        constraintsJson: {},
        ownerUserId: this.readOwnerUserId(data.triggerCondition),
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
      },
    });
  }

  async update(id: string, data: Record<string, unknown>): Promise<MktCampaign> {
    const current = await this.findById(id);
    const nextStartTime = data.startTime !== undefined ? this.toDate(data.startTime) : current?.startTime;
    const nextEndTime = data.endTime !== undefined ? this.toDate(data.endTime) : current?.endTime;
    const nextIsEnabled =
      typeof data.isEnabled === 'boolean' ? data.isEnabled : current?.status === MktCampaignStatus.PUBLISHED;
    const nextPriority = typeof data.priority === 'number' ? data.priority : (current?.priority ?? 0);
    const nextAudience = (data.triggerCondition ?? current?.audienceJson ?? {}) as Prisma.InputJsonValue;
    const nextStages = (data.rules ?? current?.stagesJson ?? {}) as Prisma.InputJsonValue;
    const nextRights = (data.rewards ?? current?.rightsJson ?? {}) as Prisma.InputJsonValue;
    const nextType = current?.type ?? '';

    return this.prisma.mktCampaign.update({
      where: { id },
      data: {
        ...(typeof data.name === 'string' ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description as string | null } : {}),
        ...(data.startTime !== undefined ? { startTime: nextStartTime } : {}),
        ...(data.endTime !== undefined ? { endTime: nextEndTime } : {}),
        ...(typeof data.isEnabled === 'boolean'
          ? { status: data.isEnabled ? MktCampaignStatus.PUBLISHED : MktCampaignStatus.DRAFT }
          : {}),
        ...(typeof data.priority === 'number' ? { priority: nextPriority } : {}),
        ...(data.triggerCondition !== undefined ? { audienceJson: nextAudience } : {}),
        ...(data.rules !== undefined ? { stagesJson: nextStages } : {}),
        ...(data.rewards !== undefined ? { rightsJson: nextRights } : {}),
        ...(data.triggerCondition !== undefined || data.rules !== undefined || data.rewards !== undefined
          ? { policyJson: this.toPolicyJson(nextType, nextAudience, nextStages, nextRights) }
          : {}),
        foundationJson: this.toFoundationJson(nextStartTime, nextEndTime, nextIsEnabled, nextPriority),
        ...(typeof data.updatedBy === 'string' ? { updatedBy: data.updatedBy } : {}),
      },
    });
  }

  async deleteById(id: string): Promise<MktCampaign> {
    return this.prisma.mktCampaign.delete({ where: { id } });
  }

  async findParticipation(activityId: string, memberId: string) {
    return this.prisma.mktCampaignParticipation.findFirst({
      where: this.tenantHelper.readWhereForDelegate('mktCampaignParticipation', {
        campaignId_memberId: { campaignId: activityId, memberId },
      }) as Prisma.MktCampaignParticipationWhereInput,
    });
  }

  async createParticipation(data: Prisma.MktCampaignParticipationCreateInput) {
    return this.prisma.mktCampaignParticipation.create({ data });
  }

  async countParticipations(activityId: string): Promise<number> {
    return this.prisma.mktCampaignParticipation.count({
      where: this.tenantHelper.readWhereForDelegate('mktCampaignParticipation', {
        campaignId: activityId,
      }) as Prisma.MktCampaignParticipationWhereInput,
    });
  }

  private toDate(value: unknown): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toFoundationJson(
    startTime: Date | null | undefined,
    endTime: Date | null | undefined,
    isEnabled: boolean,
    priority: number,
  ): Prisma.InputJsonObject {
    return {
      startTime: startTime?.toISOString() ?? null,
      endTime: endTime?.toISOString() ?? null,
      isEnabled,
      priority,
    };
  }

  private toPolicyJson(
    type: string,
    triggerCondition: Prisma.InputJsonValue,
    rules: Prisma.InputJsonValue,
    rewards: Prisma.InputJsonValue,
  ): Prisma.InputJsonObject | undefined {
    if (!isPolicyCampaignType(type)) return undefined;
    return {
      source: 'activity-compat',
      type,
      triggerCondition,
      rules,
      rewards,
    };
  }

  private readOwnerUserId(value: Prisma.InputJsonValue): string | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const ownerUserId = (value as Record<string, unknown>).ownerUserId;
    return typeof ownerUserId === 'string' && ownerUserId.trim() ? ownerUserId.trim() : null;
  }
}
