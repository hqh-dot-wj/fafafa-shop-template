import { Injectable } from '@nestjs/common';
import { GenerateUUID } from 'src/common/utils';
import { Result } from 'src/common/response/result';
import { BusinessException } from 'src/common/exceptions';
import { ActivityRepository } from '../activity/activity.repository';
import { ActivityItemRepository } from './activity-item.repository';
import { CreateActivityItemDto } from './dto/create-activity-item.dto';
import { UpdateActivityItemDto } from './dto/update-activity-item.dto';

type ActivityItemRecord = {
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

const ACTIVITY_ITEMS_KEY = 'activityItems';

@Injectable()
export class ActivityItemService {
  private readonly repository: ActivityItemRepository;

  constructor(
    private readonly activityRepo: ActivityRepository,
    activityItemRepository?: ActivityItemRepository,
  ) {
    this.repository = activityItemRepository ?? new ActivityItemRepository(activityRepo);
  }

  async list(activityId: string) {
    const activity = await this.getActivity(activityId);
    const rules = this.toRecord(activity.stagesJson);
    const items = this.readItems(rules);
    return Result.ok(items);
  }

  async create(activityId: string, dto: CreateActivityItemDto, operatorId: string) {
    const activity = await this.getActivity(activityId);
    const rules = this.toRecord(activity.stagesJson);
    const items = this.readItems(rules);

    const itemId = dto.activityItemId?.trim() || GenerateUUID();
    BusinessException.throwIf(
      items.some((item) => item.id === itemId),
      `活动商品已存在: ${itemId}`,
    );

    const now = new Date().toISOString();
    const created: ActivityItemRecord = {
      id: itemId,
      itemType: dto.itemType,
      itemCode: dto.itemCode?.trim() || itemId,
      itemName: dto.itemName?.trim() || '',
      enabled: dto.enabled ?? true,
      sort: dto.sort ?? items.length + 1,
      config: dto.config ?? {},
      ext: dto.ext ?? {},
      createTime: now,
      updateTime: now,
    };

    const nextItems = [...items, created].sort((left, right) => left.sort - right.sort);
    await this.updateRules(activityId, rules, nextItems, operatorId);

    return Result.ok(created, '活动商品创建成功');
  }

  async update(activityId: string, activityItemId: string, dto: UpdateActivityItemDto, operatorId: string) {
    const activity = await this.getActivity(activityId);
    const rules = this.toRecord(activity.stagesJson);
    const items = this.readItems(rules);

    const index = items.findIndex((item) => item.id === activityItemId);
    BusinessException.throwIf(index < 0, '活动商品不存在');

    const now = new Date().toISOString();
    const previous = items[index];
    const next: ActivityItemRecord = {
      ...previous,
      ...(dto.itemType !== undefined ? { itemType: dto.itemType } : {}),
      ...(dto.itemCode !== undefined ? { itemCode: dto.itemCode.trim() } : {}),
      ...(dto.itemName !== undefined ? { itemName: dto.itemName.trim() } : {}),
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.sort !== undefined ? { sort: dto.sort } : {}),
      ...(dto.config !== undefined ? { config: dto.config } : {}),
      ...(dto.ext !== undefined ? { ext: dto.ext } : {}),
      updateTime: now,
    };

    const nextItems = [...items];
    nextItems[index] = next;
    nextItems.sort((left, right) => left.sort - right.sort);
    await this.updateRules(activityId, rules, nextItems, operatorId);

    return Result.ok(next, '活动商品更新成功');
  }

  async remove(activityId: string, activityItemId: string, operatorId: string) {
    const activity = await this.getActivity(activityId);
    const rules = this.toRecord(activity.stagesJson);
    const items = this.readItems(rules);

    const existed = items.some((item) => item.id === activityItemId);
    BusinessException.throwIf(!existed, '活动商品不存在');

    const nextItems = items.filter((item) => item.id !== activityItemId);
    await this.updateRules(activityId, rules, nextItems, operatorId);

    return Result.ok(null, '活动商品删除成功');
  }

  private async getActivity(activityId: string) {
    const activity = await this.repository.findActivityById(activityId);
    BusinessException.throwIfNull(activity, '活动不存在');
    return activity!;
  }

  private readItems(rules: Record<string, unknown>): ActivityItemRecord[] {
    const raw = rules[ACTIVITY_ITEMS_KEY];
    if (!Array.isArray(raw)) {
      return [];
    }
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
          sort: this.readInt(record.sort) ?? 999,
          config: this.toRecord(record.config),
          ext: this.toRecord(record.ext),
          createTime: this.readString(record.createTime) || now,
          updateTime: this.readString(record.updateTime) || now,
        };
      });
  }

  private async updateRules(
    activityId: string,
    currentRules: Record<string, unknown>,
    items: ActivityItemRecord[],
    operatorId: string,
  ) {
    await this.repository.saveActivityItems(activityId, currentRules, items, operatorId);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private readBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
    }
    return null;
  }

  private readInt(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.floor(value);
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return Math.floor(parsed);
      }
    }
    return null;
  }
}
