import { Injectable } from '@nestjs/common';
import { PlayInstanceStatus } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { Result } from 'src/common/response';
import { FormatDateFields } from 'src/common/utils';
import { RedisService } from 'src/module/common/redis/redis.service';
import { MarketingEventType } from '../events/marketing-event.types';
import { InstanceProbeQueryDto } from './dto/instance-probe.dto';
import { PlayInstanceRepository } from './instance.repository';
import { InstanceProbeAbnormalityVo, InstanceProbeBaseVo, InstanceProbeTimelineVo, InstanceProbeVo } from './vo/instance-probe.vo';

interface RecentInstanceEventSnapshot {
  type: string;
  instanceId: string;
  configId?: string;
  memberId?: string;
  traceId?: string;
  sourceStep?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

type ProbeBaseRecord = {
  id: string;
  tenantId: string;
  memberId: string;
  configId: string;
  templateCode: string;
  orderSn?: string | null;
  orderId?: string | null;
  status: PlayInstanceStatus;
  createTime: Date | string;
  payTime?: Date | string | null;
  endTime?: Date | string | null;
  updateTime: Date | string;
  instanceData: Record<string, unknown>;
};

@Injectable()
export class InstanceProbeService {
  private readonly recentEventLimit = 100;

  constructor(
    private readonly repo: PlayInstanceRepository,
    private readonly redisService: RedisService,
  ) {}

  async getProbe(query: InstanceProbeQueryDto) {
    BusinessException.throwIf(!query.tenantId, '租户ID不能为空');
    BusinessException.throwIf(!query.instanceId, '实例ID不能为空');

    const [base, snapshots] = await Promise.all([
      this.repo.findProbeBase(query.tenantId, query.instanceId),
      this.loadRecentSnapshots(query.tenantId),
    ]);

    BusinessException.throwIfNull(base, '营销实例不存在');

    const timeline = snapshots
      .filter((snapshot) => snapshot.instanceId === query.instanceId)
      .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
      .map((snapshot) => this.buildTimelineItem(snapshot));

    const abnormalities = this.detectAbnormalities(base, timeline);
    const result: InstanceProbeVo = this.buildProbe(base as unknown as ProbeBaseRecord, timeline);

    return Result.ok(FormatDateFields(result));
  }

  async listAbnormalProbes(tenantId: string): Promise<
    Array<{
      instanceId: string;
      code: string;
      level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      message: string;
      traceId?: string;
      occurredAt?: string;
      context?: Record<string, unknown>;
    }>
  > {
    const snapshots = await this.loadRecentSnapshots(tenantId);
    if (snapshots.length === 0) {
      return [];
    }

    const grouped = snapshots.reduce((acc, snapshot) => {
      const list = acc.get(snapshot.instanceId) ?? [];
      list.push(snapshot);
      acc.set(snapshot.instanceId, list);
      return acc;
    }, new Map<string, RecentInstanceEventSnapshot[]>());

    const instanceIds = [...grouped.keys()];
    const bases = await Promise.all(instanceIds.map(instanceId => this.repo.findProbeBase(tenantId, instanceId)));

    const rows: Array<{
      instanceId: string;
      code: string;
      level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      message: string;
      traceId?: string;
      occurredAt?: string;
      context?: Record<string, unknown>;
    }> = [];

    for (const [index, instanceId] of instanceIds.entries()) {
      const base = bases[index] as ProbeBaseRecord | null;
      if (!base) {
        continue;
      }

      const timeline = (grouped.get(instanceId) ?? [])
        .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
        .map((snapshot) => this.buildTimelineItem(snapshot));
      const probe = this.buildProbe(base, timeline);

      for (const abnormality of probe.abnormalities) {
        rows.push({
          instanceId,
          code: abnormality.code,
          level: abnormality.level,
          message: abnormality.message,
          traceId: abnormality.traceId,
          occurredAt: abnormality.occurredAt,
          context: abnormality.context,
        });
      }
    }

    return rows;
  }

  private async loadRecentSnapshots(tenantId: string): Promise<RecentInstanceEventSnapshot[]> {
    const recentKey = `mkt:event:recent:${tenantId}`;
    const raw = await this.redisService.getClient().lrange(recentKey, 0, this.recentEventLimit - 1);
    if (!Array.isArray(raw) || raw.length === 0) {
      return [];
    }

    return raw
      .map((item) => this.parseSnapshot(item))
      .filter((item): item is RecentInstanceEventSnapshot => item !== null);
  }

  private parseSnapshot(raw: string): RecentInstanceEventSnapshot | null {
    try {
      const parsed = JSON.parse(raw) as Partial<RecentInstanceEventSnapshot>;
      if (
        typeof parsed.type !== 'string' ||
        typeof parsed.instanceId !== 'string' ||
        typeof parsed.timestamp !== 'string'
      ) {
        return null;
      }

      return {
        type: parsed.type,
        instanceId: parsed.instanceId,
        configId: typeof parsed.configId === 'string' ? parsed.configId : undefined,
        memberId: typeof parsed.memberId === 'string' ? parsed.memberId : undefined,
        traceId: typeof parsed.traceId === 'string' ? parsed.traceId : undefined,
        sourceStep: typeof parsed.sourceStep === 'string' ? parsed.sourceStep : undefined,
        payload: parsed.payload && typeof parsed.payload === 'object' ? (parsed.payload as Record<string, unknown>) : {},
        timestamp: parsed.timestamp,
      };
    } catch {
      return null;
    }
  }

  private buildTimelineItem(snapshot: RecentInstanceEventSnapshot): InstanceProbeTimelineVo {
    return {
      code: this.mapTimelineCode(snapshot.type),
      type: snapshot.type,
      sourceStep: snapshot.sourceStep,
      traceId: snapshot.traceId,
      timestamp: snapshot.timestamp,
      payload: snapshot.payload ?? {},
    };
  }

  private mapTimelineCode(type: string): InstanceProbeTimelineVo['code'] {
    switch (type) {
      case MarketingEventType.INSTANCE_CREATED:
        return 'INSTANCE_CREATED';
      case MarketingEventType.INSTANCE_PAID:
        return 'INSTANCE_PAID';
      case MarketingEventType.INSTANCE_SUCCESS:
        return 'INSTANCE_SUCCESS';
      case MarketingEventType.INSTANCE_FAILED:
        return 'INSTANCE_FAILED';
      case MarketingEventType.INSTANCE_TIMEOUT:
        return 'INSTANCE_TIMEOUT';
      case MarketingEventType.INSTANCE_REFUNDED:
        return 'INSTANCE_REFUNDED';
      default:
        return 'UNKNOWN';
    }
  }

  private detectAbnormalities(base: ProbeBaseRecord, timeline: InstanceProbeTimelineVo[]): InstanceProbeAbnormalityVo[] {
    const abnormalities: InstanceProbeAbnormalityVo[] = [];
    const codes = new Set(timeline.map((item) => item.code));
    const latest = timeline[timeline.length - 1];

    const appendAbnormality = (
      code: string,
      level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      message: string,
      context?: Record<string, unknown>,
    ) => {
      abnormalities.push({
        code,
        level,
        message,
        traceId: latest?.traceId,
        occurredAt: latest?.timestamp,
        context,
      });
    };

    if (!codes.has('INSTANCE_CREATED')) {
      appendAbnormality('PROBE_STEP_MISSING', 'HIGH', '缺少实例创建事件', { expectedStep: 'INSTANCE_CREATED' });
    }

    const shouldExpectPaid =
      base.status === PlayInstanceStatus.PAID ||
      base.status === PlayInstanceStatus.SUCCESS ||
      base.status === PlayInstanceStatus.REFUNDED ||
      Boolean(base.payTime) ||
      Boolean(base.orderId);

    if (shouldExpectPaid && !codes.has('INSTANCE_PAID')) {
      appendAbnormality('PROBE_STEP_MISSING', 'HIGH', '缺少实例支付事件', { expectedStep: 'INSTANCE_PAID' });
    }

    if (base.status === PlayInstanceStatus.SUCCESS && !codes.has('INSTANCE_SUCCESS')) {
      appendAbnormality('PROBE_STEP_MISSING', 'HIGH', '缺少实例成功事件', { expectedStep: 'INSTANCE_SUCCESS' });
    }

    if (base.status === PlayInstanceStatus.PAID && !base.payTime) {
      appendAbnormality('PROBE_DATA_INCONSISTENT', 'MEDIUM', '实例状态已支付但未记录支付时间');
    }

    if (base.status === PlayInstanceStatus.SUCCESS && !base.endTime) {
      appendAbnormality('PROBE_DATA_INCONSISTENT', 'MEDIUM', '实例状态已成功但未记录结束时间');
    }

    return abnormalities;
  }

  private buildProbe(base: ProbeBaseRecord, timeline: InstanceProbeTimelineVo[]): InstanceProbeVo {
    const abnormalities = this.detectAbnormalities(base, timeline);
    return {
      base: this.buildBaseVo(base),
      timeline,
      abnormalities,
      hasAbnormalities: abnormalities.length > 0,
    };
  }

  private buildBaseVo(base: ProbeBaseRecord): InstanceProbeBaseVo {
    return {
      id: String(base.id),
      tenantId: String(base.tenantId),
      memberId: String(base.memberId),
      configId: String(base.configId),
      templateCode: String(base.templateCode),
      orderSn: this.toNullableString(base.orderSn),
      orderId: this.toNullableString(base.orderId),
      status: base.status,
      createTime: this.toNullableString(base.createTime) ?? '',
      payTime: this.toNullableString(base.payTime),
      endTime: this.toNullableString(base.endTime),
      updateTime: this.toNullableString(base.updateTime) ?? '',
      instanceData: base.instanceData ?? {},
    };
  }

  private toNullableString(value: unknown): string | null {
    if (value == null) {
      return null;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return value;
    }
    return String(value);
  }
}
