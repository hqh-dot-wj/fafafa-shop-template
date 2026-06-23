import { Injectable } from '@nestjs/common';
import { MktCampaign, MktCampaignStatus, MktTouchpointKind, Prisma } from '@prisma/client';
import { GenerateUUID } from 'src/common/utils';
import { BusinessException } from 'src/common/exceptions';
import { Result } from 'src/common/response/result';
import { PrismaService } from 'src/prisma/prisma.service';
import { resolveMarketingActivityStatus } from '../activity/activity-status';
import { ActivityCalendarQueryDto } from '../activity/dto/activity-calendar-query.dto';
import { ActivityQueryDto } from '../activity/dto/activity-query.dto';
import { CreateActivityDto } from '../activity/dto/create-activity.dto';
import { UpdateActivityDto } from '../activity/dto/update-activity.dto';
import { DistributionGrowthDto } from '../activity/dto/distribution-growth.dto';
import { TouchpointVo } from '../activity/vo/touchpoint.vo';
import { isPolicyCampaignType, resolveCampaignKind } from '../common/campaign-type';
import { CampaignRepository } from './campaign.repository';

type CampaignRow = MktCampaign & {
  tenantName?: string;
};

type CampaignItemRecord = {
  id: string;
  itemType: string;
  itemCode: string;
  itemName: string;
  enabled: boolean;
  sort: number;
  config: Record<string, unknown>;
  ext: Record<string, unknown>;
  createTime: string;
  updateTime: string;
};

const CAMPAIGN_ITEMS_KEY = 'activityItems';

@Injectable()
export class CampaignAdminService {
  constructor(
    private readonly repository: CampaignRepository,
    private readonly prisma: PrismaService,
  ) {}

  async list(query: ActivityQueryDto) {
    const hasDateRange = Boolean(query.startTimeFrom || query.startTimeTo);
    const page = await this.repository.search(
      hasDateRange
        ? ({
            ...query,
            pageNum: 1,
            pageSize: 1000,
          } as ActivityQueryDto)
        : query,
    );
    const rows = await this.attachTenantName(page.rows);
    const filtered = rows.filter((row) => this.matchesDateRange(row, query.startTimeFrom, query.startTimeTo));
    const currentPage = Number(query.pageNum || page.pageNum || 1);
    const currentSize = Number(query.pageSize || page.pageSize || 10);
    const start = (currentPage - 1) * currentSize;
    const paged = (hasDateRange ? filtered.slice(start, start + currentSize) : filtered).map((row) =>
      this.toActivityVo(row),
    );
    return Result.page(paged, hasDateRange ? filtered.length : page.total, currentPage, currentSize);
  }

  async calendar(query: ActivityCalendarQueryDto) {
    const rows = await this.loadRowsForCalendar(query);
    const range = this.resolveCalendarRange(query);
    const days: Array<{
      date: string;
      total: number;
      hasConflict: boolean;
      items: ReturnType<CampaignAdminService['toActivityVo']>[];
    }> = [];

    for (
      let cursor = new Date(range.start);
      cursor.getTime() <= range.end.getTime();
      cursor = this.addDays(cursor, 1)
    ) {
      const dayStart = new Date(cursor);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);
      const dayRows = rows.filter((row) => this.overlapsRange(row, dayStart, dayEnd));
      days.push({
        date: this.formatDate(dayStart),
        total: dayRows.length,
        hasConflict: dayRows.length > 1,
        items: dayRows.map((item) => this.toActivityVo(item)),
      });
    }

    return Result.ok({
      month: range.label,
      days,
      conflicts: days
        .filter((day) => day.hasConflict)
        .map((day) => ({
          date: day.date,
          count: day.total,
          activityIds: day.items.map((item) => item.id),
        })),
    });
  }

  async dashboard(query: ActivityCalendarQueryDto) {
    const rows = await this.loadRowsForCalendar(query);
    const trendBucket = new Map<
      string,
      { date: string; total: number; published: number; paused: number; archived: number; draft: number }
    >();
    const summary = { total: 0, published: 0, paused: 0, archived: 0, draft: 0 };

    for (const row of rows) {
      const status = this.resolveStatus(row);
      summary.total += 1;
      if (status === 'PUBLISHED') summary.published += 1;
      if (status === 'PAUSED') summary.paused += 1;
      if (status === 'ARCHIVED') summary.archived += 1;
      if (status === 'DRAFT') summary.draft += 1;

      const trendDate = this.getTrendDate(row);
      if (!trendDate) continue;
      const key = this.formatDate(trendDate);
      const item = trendBucket.get(key) || { date: key, total: 0, published: 0, paused: 0, archived: 0, draft: 0 };
      item.total += 1;
      if (status === 'PUBLISHED') item.published += 1;
      if (status === 'PAUSED') item.paused += 1;
      if (status === 'ARCHIVED') item.archived += 1;
      if (status === 'DRAFT') item.draft += 1;
      trendBucket.set(key, item);
    }

    return Result.ok({
      summary,
      trend: [...trendBucket.values()].sort((left, right) => left.date.localeCompare(right.date)),
    });
  }

  async create(dto: CreateActivityDto, operatorId: string) {
    const priority = dto.priority ?? 0;
    const foundation = this.toFoundationJson(dto.startTime, dto.endTime, dto.isEnabled ?? true, priority);
    const stages = this.toStagesJson(dto.rules, dto.distributionGrowth);
    const row = await this.repository.create({
      name: dto.name,
      type: dto.type,
      kind: resolveCampaignKind(dto.type),
      description: dto.description ?? null,
      status: (dto.isEnabled ?? true) ? MktCampaignStatus.PUBLISHED : MktCampaignStatus.DRAFT,
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      priority,
      policyJson: this.toPolicyJson(dto.type, dto.triggerCondition, stages, dto.rewards) as Prisma.InputJsonValue,
      foundationJson: foundation as Prisma.InputJsonValue,
      audienceJson: dto.triggerCondition as Prisma.InputJsonValue,
      rightsJson: dto.rewards as Prisma.InputJsonValue,
      stagesJson: stages as Prisma.InputJsonValue,
      deliveryJson: {},
      constraintsJson: {},
      ownerUserId: this.readOwnerUserId(dto.triggerCondition),
      createdBy: operatorId,
      updatedBy: operatorId,
    });
    return Result.ok(this.toActivityVo(row), '活动创建成功');
  }

  async findOne(campaignId: string) {
    const row = await this.repository.findOne({ id: campaignId });
    BusinessException.throwIfNull(row, '活动不存在');
    return Result.ok(this.toActivityVo(row!));
  }

  async update(campaignId: string, dto: UpdateActivityDto, operatorId: string) {
    const row = await this.repository.findOne({ id: campaignId });
    BusinessException.throwIfNull(row, '活动不存在');
    const current = row!;
    const currentFoundation = this.readFoundation(current);
    const foundation = this.toFoundationJson(
      dto.startTime ?? currentFoundation.startTime ?? undefined,
      dto.endTime ?? currentFoundation.endTime ?? undefined,
      dto.isEnabled ?? this.readIsEnabled(current),
      dto.priority ?? currentFoundation.priority,
    );
    const currentStages = this.readObject(current.stagesJson);
    const nextRules = (dto.rules ?? currentStages) as Record<string, unknown>;
    const stages = this.toStagesJson(nextRules, dto.distributionGrowth);
    const nextStatus =
      dto.isEnabled === undefined
        ? current.status
        : dto.isEnabled
          ? MktCampaignStatus.PUBLISHED
          : MktCampaignStatus.DRAFT;

    const updated = await this.repository.update(campaignId, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      status: nextStatus,
      ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
      ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.triggerCondition !== undefined ||
      dto.rewards !== undefined ||
      dto.rules !== undefined ||
      dto.distributionGrowth !== undefined
        ? {
            policyJson: this.toPolicyJson(
              current.type,
              dto.triggerCondition ?? this.readObject(current.audienceJson),
              stages,
              dto.rewards ?? this.readObject(current.rightsJson),
            ) as Prisma.InputJsonValue,
          }
        : {}),
      foundationJson: foundation as Prisma.InputJsonValue,
      ...(dto.triggerCondition !== undefined ? { audienceJson: dto.triggerCondition as Prisma.InputJsonValue } : {}),
      ...(dto.rewards !== undefined ? { rightsJson: dto.rewards as Prisma.InputJsonValue } : {}),
      ...(dto.rules !== undefined || dto.distributionGrowth !== undefined
        ? { stagesJson: stages as Prisma.InputJsonValue }
        : {}),
      ...(dto.triggerCondition !== undefined ? { ownerUserId: this.readOwnerUserId(dto.triggerCondition) } : {}),
      updatedBy: operatorId,
    });
    return Result.ok(this.toActivityVo(updated), '活动更新成功');
  }

  async publish(campaignId: string, operatorId: string) {
    return this.updateStatus(campaignId, MktCampaignStatus.PUBLISHED, operatorId, '活动已发布', true);
  }

  async pause(campaignId: string, operatorId: string) {
    return this.updateStatus(campaignId, MktCampaignStatus.PAUSED, operatorId, '活动已暂停', false);
  }

  async archive(campaignId: string, operatorId: string) {
    const result = await this.updateStatus(campaignId, MktCampaignStatus.ARCHIVED, operatorId, '活动已归档', false);
    return result;
  }

  async remove(campaignId: string) {
    const row = await this.repository.findOne({ id: campaignId });
    BusinessException.throwIfNull(row, '活动不存在');
    await this.repository.delete(campaignId);
    return Result.ok(null, '活动已删除');
  }

  async listItems(campaignId: string) {
    const row = await this.repository.findOne({ id: campaignId });
    BusinessException.throwIfNull(row, '活动不存在');
    const stages = this.readObject(row!.stagesJson);
    return Result.ok(this.readItems(stages));
  }

  async createItem(campaignId: string, dto: Record<string, unknown>, operatorId: string) {
    const row = await this.repository.findOne({ id: campaignId });
    BusinessException.throwIfNull(row, '活动不存在');
    const current = row!;
    const stages = this.readObject(current.stagesJson);
    const items = this.readItems(stages);
    const itemId = this.readString(dto.activityItemId) || GenerateUUID();
    BusinessException.throwIf(
      items.some((item) => item.id === itemId),
      `活动商品已存在: ${itemId}`,
    );

    const now = new Date().toISOString();
    const nextItem: CampaignItemRecord = {
      id: itemId,
      itemType: this.readString(dto.itemType) || 'GENERIC',
      itemCode: this.readString(dto.itemCode) || itemId,
      itemName: this.readString(dto.itemName) || '',
      enabled: this.readBoolean(dto.enabled) ?? true,
      sort: this.readNumber(dto.sort) ?? items.length + 1,
      config: this.readObject(dto.config),
      ext: this.readObject(dto.ext),
      createTime: now,
      updateTime: now,
    };
    const nextItems = [...items, nextItem].sort((left, right) => left.sort - right.sort);
    await this.saveItems(campaignId, current, nextItems, operatorId);
    return Result.ok(nextItem, '活动商品创建成功');
  }

  async updateItem(campaignId: string, itemId: string, dto: Record<string, unknown>, operatorId: string) {
    const row = await this.repository.findOne({ id: campaignId });
    BusinessException.throwIfNull(row, '活动不存在');
    const current = row!;
    const stages = this.readObject(current.stagesJson);
    const items = this.readItems(stages);
    const index = items.findIndex((item) => item.id === itemId);
    BusinessException.throwIf(index < 0, '活动商品不存在');
    const prev = items[index];
    const next: CampaignItemRecord = {
      ...prev,
      ...(dto.itemType !== undefined ? { itemType: this.readString(dto.itemType) || prev.itemType } : {}),
      ...(dto.itemCode !== undefined ? { itemCode: this.readString(dto.itemCode) || prev.itemCode } : {}),
      ...(dto.itemName !== undefined ? { itemName: this.readString(dto.itemName) || prev.itemName } : {}),
      ...(dto.enabled !== undefined ? { enabled: this.readBoolean(dto.enabled) ?? prev.enabled } : {}),
      ...(dto.sort !== undefined ? { sort: this.readNumber(dto.sort) ?? prev.sort } : {}),
      ...(dto.config !== undefined ? { config: this.readObject(dto.config) } : {}),
      ...(dto.ext !== undefined ? { ext: this.readObject(dto.ext) } : {}),
      updateTime: new Date().toISOString(),
    };
    const nextItems = [...items];
    nextItems[index] = next;
    nextItems.sort((left, right) => left.sort - right.sort);
    await this.saveItems(campaignId, current, nextItems, operatorId);
    return Result.ok(next, '活动商品更新成功');
  }

  async deleteItem(campaignId: string, itemId: string, operatorId: string) {
    const row = await this.repository.findOne({ id: campaignId });
    BusinessException.throwIfNull(row, '活动不存在');
    const current = row!;
    const stages = this.readObject(current.stagesJson);
    const items = this.readItems(stages);
    BusinessException.throwIf(!items.some((item) => item.id === itemId), '活动商品不存在');
    const nextItems = items.filter((item) => item.id !== itemId);
    await this.saveItems(campaignId, current, nextItems, operatorId);
    return Result.ok(null, '活动商品删除成功');
  }

  private async updateStatus(
    campaignId: string,
    status: MktCampaignStatus,
    operatorId: string,
    message: string,
    isEnabled: boolean,
  ) {
    const row = await this.repository.findOne({ id: campaignId });
    BusinessException.throwIfNull(row, '活动不存在');
    const current = row!;
    const foundation = this.readFoundation(current);
    if (status === MktCampaignStatus.ARCHIVED) {
      foundation.endTime = new Date().toISOString();
    }
    foundation.isEnabled = isEnabled;
    const updated = await this.repository.update(campaignId, {
      status,
      endTime: foundation.endTime ? new Date(foundation.endTime) : null,
      foundationJson: foundation as Prisma.InputJsonValue,
      updatedBy: operatorId,
    });
    return Result.ok(this.toActivityVo(updated), message);
  }

  private async loadRowsForCalendar(query: ActivityCalendarQueryDto) {
    const page = await this.repository.search({
      ...query,
      pageNum: 1,
      pageSize: 1000,
    } as ActivityQueryDto);
    const rows = await this.attachTenantName(page.rows);
    return rows.filter((row) => this.matchesDateRange(row, query.rangeStart, query.rangeEnd));
  }

  private async attachTenantName(rows: MktCampaign[]): Promise<CampaignRow[]> {
    if (rows.length === 0) return [];
    const tenantIds = [...new Set(rows.map((row) => row.tenantId))];
    const tenants = await this.prisma.sysTenant.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { tenantId: true, companyName: true },
    });
    const map = new Map(tenants.map((item) => [item.tenantId, item.companyName]));
    return rows.map((row) => ({ ...row, tenantName: map.get(row.tenantId) ?? undefined }));
  }

  private toActivityVo(row: CampaignRow) {
    const foundation = this.readFoundation(row);
    const triggerCondition = this.readObject(row.audienceJson);
    const rules = this.readObject(row.stagesJson);
    const rewards = this.readObject(row.rightsJson);
    const delivery = this.readObject(row.deliveryJson);
    return {
      id: row.id,
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      type: row.type,
      name: row.name,
      description: row.description ?? undefined,
      triggerCondition,
      rules,
      rewards,
      startTime: foundation.startTime,
      endTime: foundation.endTime,
      isEnabled: foundation.isEnabled,
      status: this.resolveStatus(row),
      touchpoints: this.readTouchpoints(delivery, row),
      distributionGrowth: this.readNullableObject(rules.distributionGrowth),
      priority: foundation.priority,
      createTime: row.createTime.toISOString(),
      updateTime: row.updateTime.toISOString(),
    };
  }

  private resolveStatus(row: MktCampaign) {
    if (row.status === MktCampaignStatus.PUBLISHED) return 'PUBLISHED' as const;
    if (row.status === MktCampaignStatus.PAUSED) return 'PAUSED' as const;
    if (row.status === MktCampaignStatus.ARCHIVED) return 'ARCHIVED' as const;
    const foundation = this.readFoundation(row);
    return resolveMarketingActivityStatus({
      startTime: foundation.startTime ? new Date(foundation.startTime) : null,
      endTime: foundation.endTime ? new Date(foundation.endTime) : null,
      isEnabled: foundation.isEnabled,
    });
  }

  private toFoundationJson(
    startTime?: Date | string | null,
    endTime?: Date | string | null,
    isEnabled: boolean = true,
    priority: number = 0,
  ) {
    return {
      startTime: startTime ? new Date(startTime).toISOString() : null,
      endTime: endTime ? new Date(endTime).toISOString() : null,
      isEnabled,
      priority,
    };
  }

  private toStagesJson(rules: Record<string, unknown>, distributionGrowth?: DistributionGrowthDto) {
    if (distributionGrowth === undefined) return rules;
    return {
      ...rules,
      distributionGrowth,
    };
  }

  private toPolicyJson(
    type: string,
    triggerCondition: Record<string, unknown>,
    rules: Record<string, unknown>,
    rewards: Record<string, unknown>,
  ): Record<string, unknown> | null {
    if (!isPolicyCampaignType(type)) return null;
    return {
      source: 'campaign-admin',
      type,
      triggerCondition,
      rules: this.normalizePolicyMoney(rules),
      rewards: this.normalizePolicyMoney(rewards),
    };
  }

  private readFoundation(row: MktCampaign) {
    const foundation = this.readObject(row.foundationJson);
    return {
      startTime: row.startTime?.toISOString() ?? this.readString(foundation.startTime) ?? null,
      endTime: row.endTime?.toISOString() ?? this.readString(foundation.endTime) ?? null,
      isEnabled: this.readBoolean(foundation.isEnabled) ?? row.status === MktCampaignStatus.PUBLISHED,
      priority: row.priority ?? this.readNumber(foundation.priority) ?? 0,
    };
  }

  private readOwnerUserId(triggerCondition: Record<string, unknown>) {
    return this.readString((triggerCondition || {}).ownerUserId) ?? null;
  }

  private readIsEnabled(row: MktCampaign) {
    const foundation = this.readFoundation(row);
    return foundation.isEnabled;
  }

  private resolveCalendarRange(query: ActivityCalendarQueryDto) {
    if (query.month) {
      const [yearText, monthText] = query.month.split('-');
      const year = Number(yearText);
      const month = Number(monthText);
      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      return { label: query.month, start, end };
    }
    const now = new Date();
    const start = this.toDate(query.rangeStart) ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const end = this.toDate(query.rangeEnd) ?? new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    return { label: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`, start, end };
  }

  private matchesDateRange(row: MktCampaign, startText?: string, endText?: string) {
    const start = this.toDate(startText);
    const end = this.toDate(endText);
    if (!start && !end) return true;
    const foundation = this.readFoundation(row);
    const value = this.toDate(foundation.startTime);
    if (!value) return false;
    if (start && value.getTime() < start.getTime()) return false;
    if (end && value.getTime() > end.getTime()) return false;
    return true;
  }

  private overlapsRange(row: MktCampaign, start: Date, end: Date) {
    const foundation = this.readFoundation(row);
    const startTime = this.toDate(foundation.startTime);
    const endTime = this.toDate(foundation.endTime);
    if (!startTime && !endTime) return false;
    const actualStart = startTime ?? endTime!;
    const actualEnd = endTime ?? startTime!;
    return actualStart.getTime() <= end.getTime() && actualEnd.getTime() >= start.getTime();
  }

  private getTrendDate(row: MktCampaign) {
    const foundation = this.readFoundation(row);
    return this.toDate(foundation.startTime) ?? row.createTime;
  }

  private toDate(value?: string | Date | null) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private formatDate(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private readObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private readNullableObject(value: unknown): Record<string, unknown> | null {
    const record = this.readObject(value);
    return Object.keys(record).length > 0 ? record : null;
  }

  private readTouchpoints(delivery: Record<string, unknown>, row: MktCampaign): TouchpointVo[] {
    const raw = delivery.touchpoints;
    if (!Array.isArray(raw)) return [];

    return raw
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => {
        const record = item as Record<string, unknown>;
        const kind = this.readString(record.kind);
        return {
          id: this.readString(record.id) ?? this.readString(record.code) ?? row.id,
          tenantId: this.readString(record.tenantId) ?? row.tenantId,
          activityId: this.readString(record.activityId) ?? this.readString(record.campaignId) ?? row.id,
          kind: kind === MktTouchpointKind.SHARE ? MktTouchpointKind.SHARE : MktTouchpointKind.MESSAGE,
          code: this.readString(record.code) ?? '',
          name: this.readString(record.name) ?? '',
          config: this.readObject(record.config),
          isEnabled: this.readBoolean(record.isEnabled) ?? true,
          createTime: this.readString(record.createTime) ?? row.createTime.toISOString(),
          updateTime: this.readString(record.updateTime) ?? row.updateTime.toISOString(),
        };
      });
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private readBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    return null;
  }

  private readNumber(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  private readItems(stages: Record<string, unknown>): CampaignItemRecord[] {
    const raw = stages[CAMPAIGN_ITEMS_KEY];
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => {
        const record = item as Record<string, unknown>;
        const now = new Date().toISOString();
        return {
          id: this.readString(record.id) || GenerateUUID(),
          itemType: this.readString(record.itemType) || 'GENERIC',
          itemCode: this.readString(record.itemCode) || this.readString(record.id) || GenerateUUID(),
          itemName: this.readString(record.itemName) || '',
          enabled: this.readBoolean(record.enabled) ?? true,
          sort: this.readNumber(record.sort) ?? 999,
          config: this.readObject(record.config),
          ext: this.readObject(record.ext),
          createTime: this.readString(record.createTime) || now,
          updateTime: this.readString(record.updateTime) || now,
        };
      });
  }

  private normalizePolicyMoney(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.normalizePolicyMoney(item));
    if (!value || typeof value !== 'object') return value;
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      next[key] =
        key === 'discountValue' && typeof child === 'number' ? String(child) : this.normalizePolicyMoney(child);
    }
    return next;
  }

  private async saveItems(campaignId: string, row: MktCampaign, items: CampaignItemRecord[], operatorId: string) {
    const stages = this.readObject(row.stagesJson);
    const next = {
      ...stages,
      [CAMPAIGN_ITEMS_KEY]: items,
    };
    await this.repository.update(campaignId, {
      stagesJson: next as Prisma.InputJsonValue,
      updatedBy: operatorId,
    });
  }
}
