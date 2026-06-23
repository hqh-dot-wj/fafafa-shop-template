import { Injectable } from '@nestjs/common';
import { MktCampaignTouchpoint, MktTouchpointKind, Prisma } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';
import { Result } from 'src/common/response';
import { ActivityRepository } from './activity.repository';
import { ListTouchpointDto } from './dto/list-touchpoint.dto';
import { TOUCHPOINT_KIND_VALUES, UpsertTouchpointDto } from './dto/upsert-touchpoint.dto';
import { TouchpointRepository } from './touchpoint.repository';
import { TouchpointVo } from './vo/touchpoint.vo';

const MESSAGE_CHANNEL_VALUES = ['IN_APP', 'SMS', 'WECHAT_TEMPLATE', 'APP_PUSH'] as const;
const SHARE_CHANNEL_VALUES = ['MINIAPP', 'H5', 'APP'] as const;
const SHARE_BINDING_MODE_VALUES = ['RECOMMEND_CODE', 'RELATION', 'BOTH'] as const;

@Injectable()
export class TouchpointService {
  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly touchpointRepository: TouchpointRepository,
  ) {}

  async upsert(activityId: string, dto: UpsertTouchpointDto, operatorId: string) {
    await this.assertActivityExists(activityId);
    this.validateInput(dto);

    const record = await this.touchpointRepository.upsert(activityId, {
      kind: dto.kind as MktTouchpointKind,
      code: dto.code,
      name: dto.name,
      config: dto.config as Prisma.InputJsonValue,
      isEnabled: dto.isEnabled ?? true,
    });

    const result = this.toVo(record);
    return Result.ok(result, `touchpoint upserted by ${operatorId}`);
  }

  async list(activityId: string, query: ListTouchpointDto) {
    await this.assertActivityExists(activityId);

    const rows = await this.findByActivityId(activityId, query);
    return Result.ok(rows);
  }

  async findByActivityId(activityId: string, query: ListTouchpointDto = {}): Promise<TouchpointVo[]> {
    const rows = await this.touchpointRepository.listByActivityId(activityId, {
      kind: query.kind as MktTouchpointKind | undefined,
      isEnabled: query.isEnabled,
    });

    return rows.map((item) => this.toVo(item));
  }

  async findRuntimeTouchpointsByActivityType(activityType: string): Promise<TouchpointVo[]> {
    const rows = await this.touchpointRepository.findRuntimeTouchpointsByActivityType(activityType);
    return rows.map((item) => this.toVo(item));
  }

  private async assertActivityExists(activityId: string) {
    const activity = await this.activityRepository.findById(activityId);
    BusinessException.throwIfNull(activity, '活动不存在');
  }

  private validateInput(dto: UpsertTouchpointDto) {
    BusinessException.throwIf(!TOUCHPOINT_KIND_VALUES.includes(dto.kind), `不支持的触点类型: ${dto.kind}`);

    if (dto.kind === 'MESSAGE') {
      this.validateMessageConfig(dto.config);
      return;
    }

    this.validateShareConfig(dto.config);
  }

  private validateMessageConfig(config: Record<string, unknown>) {
    const triggerMoment = this.asString(config.triggerMoment);
    BusinessException.throwIf(!triggerMoment, '消息触点缺少 triggerMoment');

    const channels = this.asStringArray(config.channels);
    BusinessException.throwIf(channels.length === 0, '消息触点至少需要一个 channels');
    BusinessException.throwIf(
      channels.some((item) => !MESSAGE_CHANNEL_VALUES.includes(item as never)),
      '消息触点 channels 非法',
    );

    const templateCode = this.asString(config.templateCode);
    BusinessException.throwIf(!templateCode, '消息触点缺少 templateCode');

    if (config.consentRequired !== undefined) {
      BusinessException.throwIf(typeof config.consentRequired !== 'boolean', '消息触点 consentRequired 非法');
    }

    const quietHours = this.asRecord(config.quietHours);
    if (quietHours) {
      const start = this.asString(quietHours.start);
      const end = this.asString(quietHours.end);
      const timezone = this.asString(quietHours.timezone);
      BusinessException.throwIf(!start || !end || !timezone, '消息触点 quietHours 配置不完整');
    }

    const frequencyLimit = this.asRecord(config.frequencyLimit);
    if (frequencyLimit) {
      const perUserPerDay = this.asNumber(frequencyLimit.perUserPerDay);
      const perActivityPerDay = this.asNumber(frequencyLimit.perActivityPerDay);
      BusinessException.throwIf(
        perUserPerDay === null || perUserPerDay < 0 || perActivityPerDay === null || perActivityPerDay < 0,
        '消息触点 frequencyLimit 非法',
      );
    }
  }

  private validateShareConfig(config: Record<string, unknown>) {
    const shareChannels = this.asStringArray(config.shareChannels);
    BusinessException.throwIf(shareChannels.length === 0, '分享触点至少需要一个 shareChannels');
    BusinessException.throwIf(
      shareChannels.some((item) => !SHARE_CHANNEL_VALUES.includes(item as never)),
      '分享触点 shareChannels 非法',
    );

    const landingPagePath = this.asString(config.landingPagePath);
    BusinessException.throwIf(!landingPagePath, '落地页不能为空');
    BusinessException.throwIf(!landingPagePath.startsWith('/'), '落地页路径必须以 / 开头');

    const attributionWindowMinutes = this.asNumber(config.attributionWindowMinutes);
    BusinessException.throwIf(
      attributionWindowMinutes === null || attributionWindowMinutes <= 0,
      '分享触点 attributionWindowMinutes 必须大于 0',
    );

    const bindingMode = this.asString(config.bindingMode);
    BusinessException.throwIf(
      !bindingMode || !SHARE_BINDING_MODE_VALUES.includes(bindingMode as never),
      '分享触点 bindingMode 非法',
    );

    const frequencyLimit = this.asRecord(config.frequencyLimit);
    if (frequencyLimit) {
      const perUserPerDay = this.asNumber(frequencyLimit.perUserPerDay);
      const perActivityPerDay = this.asNumber(frequencyLimit.perActivityPerDay);
      BusinessException.throwIf(
        perUserPerDay === null || perUserPerDay <= 0 || perActivityPerDay === null || perActivityPerDay <= 0,
        '分享触点 frequencyLimit 非法',
      );
    }

    const rawSuppressions = config.suppressions;
    if (rawSuppressions !== undefined) {
      BusinessException.throwIf(!Array.isArray(rawSuppressions), '分享触点 suppressions 非法');
      const suppressions = this.asStringArray(rawSuppressions);
      const rawLength = Array.isArray(rawSuppressions) ? rawSuppressions.length : -1;
      BusinessException.throwIf(suppressions.length !== rawLength, '分享触点 suppressions 非法');
    }
  }

  private toVo(record: MktCampaignTouchpoint): TouchpointVo {
    return {
      id: record.id,
      tenantId: record.tenantId,
      activityId: record.campaignId,
      kind: record.kind,
      code: record.code,
      name: record.name,
      config: this.asRecord(record.config) ?? {},
      isEnabled: record.isEnabled,
      createTime: record.createTime.toISOString(),
      updateTime: record.updateTime.toISOString(),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  private asString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private asNumber(value: unknown): number | null {
    if (typeof value !== 'number') return null;
    return Number.isFinite(value) ? value : null;
  }
}
