import { Injectable } from '@nestjs/common';
import { NotificationChannel } from 'src/module/notification/interfaces/notification.types';
import { NotificationDispatchContext } from 'src/module/notification/interfaces/notification-dispatch-context.types';
import { NotificationService } from 'src/module/notification/notification.service';
import { ListTouchpointDto } from '../activity/dto/list-touchpoint.dto';
import { TouchpointService } from '../activity/touchpoint.service';
import { TouchpointVo } from '../activity/vo/touchpoint.vo';
import { getMarketingEventTypesByUsableScope } from './marketing-event.catalog';
import { MarketingEvent, MarketingEventType } from './marketing-event.types';

interface OrchestratorInput {
  event: MarketingEvent;
}

interface NotificationDispatchTask {
  target: string;
  channel: NotificationChannel;
  title?: string;
  content: string;
  template?: string;
  templateVersion?: string;
  params?: Record<string, string>;
  tenantId: string;
  dispatchContext: Partial<NotificationDispatchContext>;
}

interface OrchestratorOutput {
  matched: boolean;
  reason?: 'UNSUPPORTED_EVENT' | 'MISSING_TARGET' | 'DRY_RUN_ONLY';
  tasks: NotificationDispatchTask[];
}

const MESSAGE_EVENT_SET = new Set<MarketingEventType>(getMarketingEventTypesByUsableScope('TOUCHPOINT'));

@Injectable()
export class TouchpointOrchestratorService {
  constructor(
    private readonly touchpointService: TouchpointService,
    private readonly notificationService: NotificationService,
  ) {}

  async dispatch(input: OrchestratorInput): Promise<{ planned: number; sent: number; skipped: number }> {
    const planned = await this.plan(input);
    if (!planned.matched) {
      return { planned: 0, sent: 0, skipped: 0 };
    }

    let sent = 0;
    for (const task of planned.tasks) {
      await this.notificationService.send(task);
      sent += 1;
    }

    return {
      planned: planned.tasks.length,
      sent,
      skipped: Math.max(planned.tasks.length - sent, 0),
    };
  }

  async plan(input: OrchestratorInput): Promise<OrchestratorOutput> {
    const { event } = input;
    if (this.isDryRunOnlyEvent(event)) {
      return {
        matched: false,
        reason: 'DRY_RUN_ONLY',
        tasks: [],
      };
    }

    if (!MESSAGE_EVENT_SET.has(event.type)) {
      return {
        matched: false,
        reason: 'UNSUPPORTED_EVENT',
        tasks: [],
      };
    }

    const touchpoints = await this.resolveMessageTouchpoints(event);
    if (touchpoints.length === 0) {
      return { matched: true, tasks: [] };
    }

    const tasks: NotificationDispatchTask[] = [];
    for (const touchpoint of touchpoints) {
      const channels = this.resolveMessageChannels(touchpoint.config);
      if (channels.length === 0) {
        continue;
      }

      for (const channel of channels) {
        const task = this.buildDispatchTask(event, touchpoint, channel);
        if (task) {
          tasks.push(task);
        }
      }
    }

    if (tasks.length === 0) {
      return {
        matched: false,
        reason: 'MISSING_TARGET',
        tasks: [],
      };
    }

    return {
      matched: true,
      tasks,
    };
  }

  private async resolveMessageTouchpoints(event: MarketingEvent): Promise<TouchpointVo[]> {
    const query: ListTouchpointDto = { kind: 'MESSAGE', isEnabled: true };
    const byActivityId = await this.touchpointService.findByActivityId(event.configId, query);
    if (byActivityId.length > 0) {
      return byActivityId;
    }

    const activityType = this.asString(event.payload.activityType);
    if (!activityType) {
      return [];
    }

    return this.touchpointService.findRuntimeTouchpointsByActivityType(activityType);
  }

  private isDryRunOnlyEvent(event: MarketingEvent): boolean {
    const payload = this.asRecord(event.payload);
    return this.asBoolean(payload?.dryRunOnly) === true || this.asBoolean(payload?.simulation) === true;
  }

  private resolveMessageChannels(config: Record<string, unknown>): NotificationChannel[] {
    const channels = this.asStringArray(config.channels);
    return channels.filter(
      channel => channel === 'IN_APP' || channel === 'SMS' || channel === 'WECHAT_TEMPLATE' || channel === 'APP_PUSH',
    ) as NotificationChannel[];
  }

  private buildDispatchTask(
    event: MarketingEvent,
    touchpoint: TouchpointVo,
    channel: NotificationChannel,
  ): NotificationDispatchTask | null {
    const config = this.asRecord(touchpoint.config) ?? {};
    const payload = this.asRecord(event.payload) ?? {};
    const target = this.resolveTarget(payload, event.memberId);
    if (!target) {
      return null;
    }

    const templateCode = this.asString(config.templateCode);
    const templateVersion = this.asString(config.templateVersion);
    const title = this.asString(payload.title) ?? `营销事件通知：${event.type}`;
    const content = this.asString(payload.content) ?? `营销事件 ${event.type} 已触发`;
    const params = this.normalizeStringRecord(this.asRecord(payload.params));

    const tenantId = event.tenantId ?? '000000';
    const touchpointCode = this.mapEventToTouchpointCode(event.type) ?? touchpoint.code;
    const bizRefId = this.resolveBizRefId(payload, event.instanceId);
    const sceneCode = this.asString(payload.sceneCode) ?? this.asString(payload.activityType) ?? undefined;
    const quietHours = this.resolveQuietHours(config);
    const frequency = this.resolveFrequency(config, tenantId, event.configId, touchpointCode);
    const consentGranted = this.resolveConsentGranted(config, payload);
    const suppression = this.resolveSuppression(payload);

    return {
      target,
      channel,
      title,
      content,
      template: templateCode ?? undefined,
      templateVersion: templateVersion ?? undefined,
      params: params ?? undefined,
      tenantId,
      dispatchContext: {
        tenantId,
        bizType: 'MARKETING_ACTIVITY',
        bizRefId,
        activityId: event.configId,
        touchpointCode,
        touchpointKind: 'MESSAGE',
        sceneCode,
        channel,
        templateCode: templateCode ?? undefined,
        templateVersion: templateVersion ?? undefined,
        consentGranted,
        requestedAt: event.timestamp,
        quietHours,
        frequency,
        suppression,
      },
    };
  }

  private mapEventToTouchpointCode(type: MarketingEventType): string | null {
    const codeMap: Record<MarketingEventType, string> = {
      [MarketingEventType.INSTANCE_PAID]: 'INSTANCE_PAID',
      [MarketingEventType.INSTANCE_SUCCESS]: 'ACTIVITY_SUCCESS',
      [MarketingEventType.INSTANCE_FAILED]: 'ACTIVITY_FAILED',
      [MarketingEventType.INSTANCE_TIMEOUT]: 'ACTIVITY_TIMEOUT',
      [MarketingEventType.INSTANCE_REFUNDED]: 'REFUND_SUCCESS',
      [MarketingEventType.COUPON_CLAIMED]: 'COUPON_CLAIMED',
      [MarketingEventType.COUPON_USED]: 'COUPON_USED',
      [MarketingEventType.COUPON_EXPIRED]: 'COUPON_EXPIRED',
      [MarketingEventType.POINTS_EARNED]: 'POINTS_EARNED',
      [MarketingEventType.POINTS_USED]: 'POINTS_USED',
      [MarketingEventType.POINTS_EXPIRED]: 'POINTS_EXPIRED',
      [MarketingEventType.INTEGRATION_ORDER_DISCOUNT_CALCULATED]: 'ORDER_DISCOUNT_CALCULATED',
      [MarketingEventType.INTEGRATION_ORDER_CREATED]: 'ORDER_CREATED',
      [MarketingEventType.INTEGRATION_ORDER_PAID]: 'ORDER_PAID',
      [MarketingEventType.INTEGRATION_ORDER_CANCELLED]: 'ORDER_CANCELLED',
      [MarketingEventType.INTEGRATION_ORDER_REFUNDED]: 'ORDER_REFUNDED',
      [MarketingEventType.GROUP_FULL]: 'GROUP_FULL',
      [MarketingEventType.GROUP_FAILED]: 'GROUP_FAILED',
      [MarketingEventType.FLASH_SALE_SOLD_OUT]: 'FLASH_SALE_SOLD_OUT',
      [MarketingEventType.COURSE_OPEN]: 'COURSE_OPEN',
      [MarketingEventType.COURSE_GROUP_TEAM_CREATED]: 'COURSE_GROUP_TEAM_CREATED',
      [MarketingEventType.COURSE_GROUP_MEMBER_JOINED]: 'COURSE_GROUP_MEMBER_JOINED',
      [MarketingEventType.COURSE_GROUP_VIRTUAL_FILLED]: 'COURSE_GROUP_VIRTUAL_FILLED',
      [MarketingEventType.COURSE_GROUP_TEAM_FORMED]: 'COURSE_GROUP_TEAM_FORMED',
      [MarketingEventType.COURSE_GROUP_TEAM_FAILED]: 'COURSE_GROUP_TEAM_FAILED',
      [MarketingEventType.COURSE_GROUP_SCHEDULE_BOUND]: 'COURSE_GROUP_SCHEDULE_BOUND',
      [MarketingEventType.COURSE_GROUP_CLASS_STARTED]: 'COURSE_GROUP_CLASS_STARTED',
      [MarketingEventType.COURSE_GROUP_ATTENDANCE_CONFIRMED]: 'COURSE_GROUP_ATTENDANCE_CONFIRMED',
      [MarketingEventType.COURSE_GROUP_CLASS_FINISHED]: 'COURSE_GROUP_CLASS_FINISHED',
      [MarketingEventType.ACTIVITY_OFF_SHELF]: 'ACTIVITY_OFF_SHELF',
      [MarketingEventType.ACTIVITY_STOCK_DEPLETED]: 'ACTIVITY_STOCK_DEPLETED',
      [MarketingEventType.CONFIG_STATUS_CHANGED]: 'CONFIG_STATUS_CHANGED',
      [MarketingEventType.SCENE_RELEASE_PUBLISHED]: 'SCENE_RELEASE_PUBLISHED',
      [MarketingEventType.POLICY_CONFIG_CHANGED]: 'POLICY_CONFIG_CHANGED',
      [MarketingEventType.PRIORITY_RULE_CHANGED]: 'PRIORITY_RULE_CHANGED',
      [MarketingEventType.INSTANCE_CREATED]: 'INSTANCE_CREATED',
    };

    return codeMap[type] ?? null;
  }

  private resolveBizRefId(payload: Record<string, unknown>, fallback: string): string {
    return (
      this.asString(payload.bizRefId) ??
      this.asString(payload.groupId) ??
      this.asString(payload.courseId) ??
      this.asString(payload.orderId) ??
      this.asString(payload.orderSn) ??
      fallback
    );
  }

  private resolveTarget(payload: Record<string, unknown>, memberId: string): string | null {
    return this.asString(payload.target) ?? this.asString(memberId);
  }

  private resolveQuietHours(config: Record<string, unknown>) {
    const quietHours = this.asRecord(config.quietHours);
    if (!quietHours) return undefined;

    const start = this.asString(quietHours.start);
    const end = this.asString(quietHours.end);
    const timezone = this.asString(quietHours.timezone);
    if (!start || !end || !timezone) return undefined;

    return { start, end, timezone };
  }

  private resolveFrequency(config: Record<string, unknown>, tenantId: string, activityId: string, touchpointCode: string) {
    const frequencyLimit = this.asRecord(config.frequencyLimit);
    if (!frequencyLimit) return undefined;

    const perUserPerDay = this.asNumber(frequencyLimit.perUserPerDay);
    if (perUserPerDay === null || perUserPerDay <= 0) return undefined;

    return {
      key: `${tenantId}:${activityId}:${touchpointCode}`,
      limitPerDay: perUserPerDay,
      sentToday: 0,
    };
  }

  private resolveConsentGranted(config: Record<string, unknown>, payload: Record<string, unknown>): boolean | undefined {
    const consentRequired = this.asBoolean(config.consentRequired) === true;
    const payloadConsentGranted = this.asBoolean(payload.consentGranted);

    if (consentRequired) {
      return payloadConsentGranted === true;
    }

    return payloadConsentGranted ?? undefined;
  }

  private resolveSuppression(payload: Record<string, unknown>) {
    const suppression = this.asRecord(payload.suppression);
    if (!suppression) return undefined;
    const suppressed = this.asBoolean(suppression.suppressed);
    if (suppressed === null) return undefined;

    return {
      suppressed,
      reason: this.asString(suppression.reason) ?? undefined,
    };
  }

  private normalizeStringRecord(value: Record<string, unknown> | null): Record<string, string> | null {
    if (!value) return null;
    const entries = Object.entries(value).filter(([, item]) => typeof item === 'string') as Array<[string, string]>;
    if (entries.length === 0) return null;
    return Object.fromEntries(entries);
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
    return value.filter(item => typeof item === 'string') as string[];
  }

  private asNumber(value: unknown): number | null {
    if (typeof value !== 'number') return null;
    return Number.isFinite(value) ? value : null;
  }

  private asBoolean(value: unknown): boolean | null {
    if (typeof value !== 'boolean') return null;
    return value;
  }
}
