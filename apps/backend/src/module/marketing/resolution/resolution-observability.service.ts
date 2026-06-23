import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from 'src/common/utils/error';
import { RedisService } from 'src/module/common/redis/redis.service';
import type Redis from 'ioredis';
import { PrismaService } from 'src/prisma/prisma.service';
import { MktTraceKind, MktTraceStatus } from '@prisma/client';

/**
 * 任意 observability 指标的写入入口都会把租户 sadd 到这个集合，让 ResolutionAlertScheduler
 * 能够精确识别"有过告警相关指标"的租户，避免 aggregate / compat 集合漏掉 scene-only 与
 * 缓存失效路径产生的告警（ultrareview rqxa0c2jb #bug_001）。
 */
export const MARKETING_OBSERVABILITY_TENANT_SET_KEY = 'mkt:obs:tenants';

type SceneResolveMetricInput = {
  tenantId: string;
  sceneCode: string;
  releaseNo?: number;
  moduleCount: number;
  /** 成功返回的模块中，商品数为 0 的模块数 */
  emptyModuleCount?: number;
  channel: string;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED';
  traceId?: string;
  explainSnapshot?: Record<string, unknown>;
};

type CacheInvalidationMetricInput = {
  tenantId: string;
  eventType: string;
  sceneCode?: string;
  deletedKeys: number;
  durationMs: number;
  traceId?: string;
};

export interface ResolutionTraceSceneResolveSample {
  date: string;
  traceId: string;
  hitCount: number;
  sceneCode: string;
  releaseNo?: number;
  moduleCount: number;
  emptyModuleCount: number;
  channel: string;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED';
  recordedAt: string;
  explainSnapshot?: Record<string, unknown>;
}

export interface ResolutionTraceCacheInvalidationSample {
  date: string;
  traceId: string;
  hitCount: number;
  eventType: string;
  sceneCode?: string;
  deletedKeys: number;
  durationMs: number;
  recordedAt: string;
}

export interface ResolutionTraceAuditSample {
  date: string;
  traceId: string;
  traceKind: 'SCENE_RESOLVE' | 'CACHE_INVALIDATION';
  sceneCode?: string;
  releaseNo?: number;
  channel?: string;
  status: 'SUCCESS' | 'FAILED';
  moduleCount?: number;
  emptyModuleCount?: number;
  eventType?: string;
  deletedKeys?: number;
  durationMs: number;
  recordedAt: string;
  explainSnapshot?: Record<string, unknown>;
}

export interface ResolutionTraceDiagnosticsSnapshot {
  tenantId: string;
  traceId: string;
  dates: string[];
  sceneResolve: ResolutionTraceSceneResolveSample[];
  cacheInvalidation: ResolutionTraceCacheInvalidationSample[];
  persistentTrace: ResolutionTraceAuditSample[];
}

export interface ResolutionMetricsAlert {
  code: 'SCENE_RESOLVE_FAILURE_RATE' | 'SCENE_RESOLVE_P95_LATENCY' | 'CACHE_INVALIDATION_DELETED_KEYS';
  level: 'WARN' | 'CRITICAL';
  message: string;
  threshold: number;
  actual: number;
  incidentSeed: {
    type: 'METRIC_ALERT';
    referenceId: string;
    defaultLevel: 'HIGH' | 'CRITICAL';
  };
}

export interface ResolutionMetricThresholds {
  failureRateWarnPercent: number;
  p95LatencyWarnMs: number;
  cacheDeletedKeysWarn: number;
}

export interface ResolutionSceneResolveOverview {
  total: number;
  success: number;
  failed: number;
  successRate: number;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
  avgLatencyMs: number | null;
  emptyModules: number;
}

export interface ResolutionCacheInvalidationOverview {
  events: number;
  deletedKeys: number;
  totalDurationMs: number;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  p99DurationMs: number | null;
}

export interface ResolutionMetricsOverview {
  date: string;
  thresholds: ResolutionMetricThresholds;
  sceneResolve: ResolutionSceneResolveOverview;
  cacheInvalidation: ResolutionCacheInvalidationOverview;
  alerts: ResolutionMetricsAlert[];
}

export interface ResolutionSceneMetricsItem {
  sceneCode: string;
  success: number;
  failed: number;
  total: number;
  successRate: number;
}

export interface ResolutionMetricsDashboard {
  overview: ResolutionMetricsOverview;
  topScenes: ResolutionSceneMetricsItem[];
}

@Injectable()
export class ResolutionObservabilityService {
  private readonly logger = new Logger(ResolutionObservabilityService.name);

  private readonly metricsPrefix = 'marketing:resolution:metrics';

  private readonly retentionSeconds = 86400 * 7;

  private readonly alertMessageDedupeMs = 60 * 60 * 1000;

  private readonly thresholds: ResolutionMetricThresholds = {
    failureRateWarnPercent: 5,
    p95LatencyWarnMs: 800,
    cacheDeletedKeysWarn: 2000,
  };

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async recordSceneResolve(input: SceneResolveMetricInput): Promise<void> {
    try {
      const now = new Date();
      const date = this.formatDate(now);
      const hour = this.formatHour(now);
      const statusKey = input.status.toLowerCase();
      const tenantPrefix = this.buildTenantPrefix(input.tenantId);

      const totalKey = `${tenantPrefix}:sceneResolve:total:${date}`;
      const statusTotalKey = `${tenantPrefix}:sceneResolve:${statusKey}:${date}`;
      const sceneStatusKey = `${tenantPrefix}:sceneResolve:scene:${input.sceneCode}:${statusKey}:${date}`;
      const releaseKey = `${tenantPrefix}:sceneResolve:release:${input.sceneCode}:${input.releaseNo ?? 0}:${date}`;
      const latencyKey = `${tenantPrefix}:sceneResolve:latency:${hour}`;
      const emptyModulesKey = `${tenantPrefix}:sceneResolve:emptyModules:${date}`;
      const traceKey = input.traceId ? `${tenantPrefix}:sceneResolve:trace:${input.traceId}:${date}` : null;
      const traceDetailKey = input.traceId ? `${tenantPrefix}:sceneResolve:traceDetail:${input.traceId}:${date}` : null;

      const client = this.redis.getClient();
      const sampleId = `${input.traceId ?? 'trace-missing'}:${Date.now()}-${Math.random()}`;
      const emptyDelta =
        input.status === 'SUCCESS' && typeof input.emptyModuleCount === 'number' && input.emptyModuleCount > 0
          ? input.emptyModuleCount
          : 0;
      await Promise.all([
        // 让 ResolutionAlertScheduler 能精确预筛"有过指标写入的租户"，覆盖直连 /scene 路径
        client.sadd(MARKETING_OBSERVABILITY_TENANT_SET_KEY, input.tenantId),
        client.incr(totalKey),
        client.expire(totalKey, this.retentionSeconds),
        client.incr(statusTotalKey),
        client.expire(statusTotalKey, this.retentionSeconds),
        client.incr(sceneStatusKey),
        client.expire(sceneStatusKey, this.retentionSeconds),
        client.incr(releaseKey),
        client.expire(releaseKey, this.retentionSeconds),
        client.zadd(latencyKey, input.durationMs, sampleId),
        client.expire(latencyKey, 86400),
        ...(emptyDelta > 0
          ? [client.incrby(emptyModulesKey, emptyDelta), client.expire(emptyModulesKey, this.retentionSeconds)]
          : []),
        ...(traceKey ? [client.incr(traceKey), client.expire(traceKey, this.retentionSeconds)] : []),
        ...(traceDetailKey && input.traceId
          ? [
              client.set(
                traceDetailKey,
                JSON.stringify({
                  date,
                  traceId: input.traceId,
                  sceneCode: input.sceneCode,
                  releaseNo: input.releaseNo,
                  moduleCount: input.moduleCount,
                  emptyModuleCount: input.emptyModuleCount ?? 0,
                  channel: input.channel,
                  durationMs: input.durationMs,
                  status: input.status,
                  recordedAt: now.toISOString(),
                  explainSnapshot: input.explainSnapshot ?? null,
                }),
                'EX',
                this.retentionSeconds,
              ),
            ]
          : []),
      ]);
      await this.persistSceneResolveTrace(input, now);
    } catch (error) {
      this.logger.warn(`记录场景裁决指标失败: ${getErrorMessage(error)}`);
    }
  }

  async recordCacheInvalidation(input: CacheInvalidationMetricInput): Promise<void> {
    try {
      const now = new Date();
      const date = this.formatDate(now);
      const hour = this.formatHour(now);
      const tenantPrefix = this.buildTenantPrefix(input.tenantId);
      const eventKey = `${tenantPrefix}:cacheInvalidation:event:${input.eventType}:${date}`;
      const totalDeletedKey = `${tenantPrefix}:cacheInvalidation:deletedKeys:${date}`;
      const totalDurationKey = `${tenantPrefix}:cacheInvalidation:durationTotal:${date}`;
      const durationKey = `${tenantPrefix}:cacheInvalidation:duration:${hour}`;
      const traceKey = input.traceId ? `${tenantPrefix}:cacheInvalidation:trace:${input.traceId}:${date}` : null;
      const traceDetailKey = input.traceId
        ? `${tenantPrefix}:cacheInvalidation:traceDetail:${input.traceId}:${date}`
        : null;
      const sceneKey = input.sceneCode ? `${tenantPrefix}:cacheInvalidation:scene:${input.sceneCode}:${date}` : null;

      const client = this.redis.getClient();
      const safeDurationMs = Math.max(0, Math.trunc(input.durationMs));
      const durationSampleId = `${input.traceId ?? 'trace-missing'}:${Date.now()}-${Math.random()}`;
      const tasks: Array<Promise<unknown>> = [
        // 让 ResolutionAlertScheduler 能精确预筛"有过指标写入的租户"，覆盖缓存失效事件路径
        client.sadd(MARKETING_OBSERVABILITY_TENANT_SET_KEY, input.tenantId),
        client.incr(eventKey),
        client.expire(eventKey, this.retentionSeconds),
        client.incrby(totalDeletedKey, input.deletedKeys),
        client.expire(totalDeletedKey, this.retentionSeconds),
        client.incrby(totalDurationKey, safeDurationMs),
        client.expire(totalDurationKey, this.retentionSeconds),
        client.zadd(durationKey, safeDurationMs, durationSampleId),
        client.expire(durationKey, 86400),
      ];

      if (sceneKey) {
        tasks.push(client.incrby(sceneKey, input.deletedKeys), client.expire(sceneKey, this.retentionSeconds));
      }
      if (traceKey) {
        tasks.push(client.incr(traceKey), client.expire(traceKey, this.retentionSeconds));
      }
      if (traceDetailKey && input.traceId) {
        tasks.push(
          client.set(
            traceDetailKey,
            JSON.stringify({
              date,
              traceId: input.traceId,
              eventType: input.eventType,
              sceneCode: input.sceneCode,
              deletedKeys: input.deletedKeys,
              durationMs: safeDurationMs,
              recordedAt: now.toISOString(),
            }),
            'EX',
            this.retentionSeconds,
          ),
        );
      }

      await Promise.all(tasks);
      await this.persistCacheInvalidationTrace(input, safeDurationMs, now);
    } catch (error) {
      this.logger.warn(`记录缓存失效指标失败: ${getErrorMessage(error)}`);
    }
  }

  async getTraceDiagnostics(input: {
    tenantId: string;
    traceId: string;
    days?: number;
  }): Promise<ResolutionTraceDiagnosticsSnapshot> {
    const traceId = input.traceId.trim();
    const days = this.clampDays(input.days);
    const dates = this.resolveRecentDates(days);
    const sceneResolve = await Promise.all(
      dates.map((date) => this.loadSceneResolveTrace(input.tenantId, traceId, date)),
    );
    const cacheInvalidation = await Promise.all(
      dates.map((date) => this.loadCacheInvalidationTrace(input.tenantId, traceId, date)),
    );
    const persistentTrace = await this.loadPersistentTrace(input.tenantId, traceId, days);

    return {
      tenantId: input.tenantId,
      traceId,
      dates,
      sceneResolve: sceneResolve.filter((item): item is ResolutionTraceSceneResolveSample => item !== null),
      cacheInvalidation: cacheInvalidation.filter(
        (item): item is ResolutionTraceCacheInvalidationSample => item !== null,
      ),
      persistentTrace,
    };
  }

  async getDashboard(tenantId: string): Promise<ResolutionMetricsDashboard> {
    const date = this.formatDate(new Date());
    const tenantPrefix = this.buildTenantPrefix(tenantId);
    const [
      total,
      success,
      failed,
      latency,
      emptyModules,
      cacheDeletedKeys,
      cacheEvents,
      cacheDurationTotalMs,
      cacheDurationMetrics,
      topScenes,
    ] = await Promise.all([
      this.getIntValue(`${tenantPrefix}:sceneResolve:total:${date}`),
      this.getIntValue(`${tenantPrefix}:sceneResolve:success:${date}`),
      this.getIntValue(`${tenantPrefix}:sceneResolve:failed:${date}`),
      this.collectLatencyMetrics(tenantId, date),
      this.getIntValue(`${tenantPrefix}:sceneResolve:emptyModules:${date}`),
      this.getIntValue(`${tenantPrefix}:cacheInvalidation:deletedKeys:${date}`),
      this.sumByPattern(`${tenantPrefix}:cacheInvalidation:event:*:${date}`),
      this.getIntValue(`${tenantPrefix}:cacheInvalidation:durationTotal:${date}`),
      this.collectCacheInvalidationDurationMetrics(tenantId, date),
      this.collectSceneMetrics(tenantId, date),
    ]);

    const successRate = total > 0 ? this.round((success / total) * 100) : 0;
    const overview: ResolutionMetricsOverview = {
      date,
      thresholds: this.thresholds,
      sceneResolve: {
        total,
        success,
        failed,
        successRate,
        p95LatencyMs: latency.p95,
        p99LatencyMs: latency.p99,
        avgLatencyMs: latency.avg,
        emptyModules,
      },
      cacheInvalidation: {
        events: cacheEvents,
        deletedKeys: cacheDeletedKeys,
        totalDurationMs: cacheDurationTotalMs,
        avgDurationMs: cacheDurationMetrics.avg,
        p95DurationMs: cacheDurationMetrics.p95,
        p99DurationMs: cacheDurationMetrics.p99,
      },
      alerts: this.buildAlerts({
        successRate,
        failed,
        total,
        p95LatencyMs: latency.p95,
        cacheDeletedKeys,
      }),
    };

    if (overview.alerts.length > 0) {
      await this.pushAlertsToMessageCenter(tenantId, overview);
    }

    this.logger.log(
      `[resolution.metrics.dashboard] tenant=${tenantId} date=${date} total=${total} ` +
        `failed=${failed} successRate=${successRate} p95=${latency.p95 ?? '-'} p99=${latency.p99 ?? '-'} ` +
        `emptyModules=${emptyModules} cacheDeleted=${cacheDeletedKeys} cacheDurationTotal=${cacheDurationTotalMs}`,
    );

    return {
      overview,
      topScenes,
    };
  }

  private async collectLatencyMetrics(
    tenantId: string,
    date: string,
  ): Promise<{ p95: number | null; p99: number | null; avg: number | null }> {
    const tenantPrefix = this.buildTenantPrefix(tenantId);
    const keys = await this.scanKeys(`${tenantPrefix}:sceneResolve:latency:${date}*`);
    if (keys.length === 0) {
      return { p95: null, p99: null, avg: null };
    }

    const client = this.redis.getClient();
    const values = await Promise.all(
      keys.map(async (key) => {
        const rows = await client.zrange(key, 0, -1, 'WITHSCORES');
        const scores: number[] = [];
        for (let index = 1; index < rows.length; index += 2) {
          const parsed = Number(rows[index]);
          if (Number.isFinite(parsed)) {
            scores.push(parsed);
          }
        }
        return scores;
      }),
    );

    const samples = values.flat();
    if (samples.length === 0) {
      return { p95: null, p99: null, avg: null };
    }

    samples.sort((a, b) => a - b);
    const p95Index = Math.max(0, Math.ceil(samples.length * 0.95) - 1);
    const p99Index = Math.max(0, Math.ceil(samples.length * 0.99) - 1);
    const p95 = this.round(samples[p95Index]);
    const p99 = this.round(samples[p99Index]);
    const avg = this.round(samples.reduce((sum, value) => sum + value, 0) / samples.length);
    return { p95, p99, avg };
  }

  private async collectCacheInvalidationDurationMetrics(
    tenantId: string,
    date: string,
  ): Promise<{ p95: number | null; p99: number | null; avg: number | null }> {
    const tenantPrefix = this.buildTenantPrefix(tenantId);
    const keys = await this.scanKeys(`${tenantPrefix}:cacheInvalidation:duration:${date}*`);
    if (keys.length === 0) {
      return { p95: null, p99: null, avg: null };
    }

    const client = this.redis.getClient();
    const values = await Promise.all(
      keys.map(async (key) => {
        const rows = await client.zrange(key, 0, -1, 'WITHSCORES');
        const scores: number[] = [];
        for (let index = 1; index < rows.length; index += 2) {
          const parsed = Number(rows[index]);
          if (Number.isFinite(parsed)) {
            scores.push(parsed);
          }
        }
        return scores;
      }),
    );

    const samples = values.flat();
    if (samples.length === 0) {
      return { p95: null, p99: null, avg: null };
    }

    samples.sort((a, b) => a - b);
    const p95Index = Math.max(0, Math.ceil(samples.length * 0.95) - 1);
    const p99Index = Math.max(0, Math.ceil(samples.length * 0.99) - 1);
    const p95 = this.round(samples[p95Index]);
    const p99 = this.round(samples[p99Index]);
    const avg = this.round(samples.reduce((sum, value) => sum + value, 0) / samples.length);
    return { p95, p99, avg };
  }

  private async collectSceneMetrics(tenantId: string, date: string): Promise<ResolutionSceneMetricsItem[]> {
    const [successMap, failedMap] = await Promise.all([
      this.collectSceneStatusMetrics(tenantId, date, 'success'),
      this.collectSceneStatusMetrics(tenantId, date, 'failed'),
    ]);
    const sceneCodes = new Set<string>([...successMap.keys(), ...failedMap.keys()]);
    const rows = [...sceneCodes].map((sceneCode) => {
      const success = successMap.get(sceneCode) ?? 0;
      const failed = failedMap.get(sceneCode) ?? 0;
      const total = success + failed;
      const successRate = total > 0 ? this.round((success / total) * 100) : 0;
      return { sceneCode, success, failed, total, successRate };
    });

    rows.sort((left, right) => {
      if (right.total !== left.total) return right.total - left.total;
      if (right.failed !== left.failed) return right.failed - left.failed;
      return left.sceneCode.localeCompare(right.sceneCode);
    });
    return rows.slice(0, 10);
  }

  private async collectSceneStatusMetrics(
    tenantId: string,
    date: string,
    status: 'success' | 'failed',
  ): Promise<Map<string, number>> {
    const tenantPrefix = this.buildTenantPrefix(tenantId);
    const pattern = `${tenantPrefix}:sceneResolve:scene:*:${status}:${date}`;
    const keys = await this.scanKeys(pattern);
    const map = new Map<string, number>();
    for (const key of keys) {
      const sceneCode = this.parseSceneCodeFromMetricKey(tenantId, key, status, date);
      if (!sceneCode) continue;
      const count = await this.getIntValue(key);
      map.set(sceneCode, count);
    }
    return map;
  }

  private parseSceneCodeFromMetricKey(
    tenantId: string,
    key: string,
    status: 'success' | 'failed',
    date: string,
  ): string | null {
    const prefix = `${this.buildTenantPrefix(tenantId)}:sceneResolve:scene:`;
    const suffix = `:${status}:${date}`;
    if (!key.startsWith(prefix) || !key.endsWith(suffix)) {
      return null;
    }
    const sceneCode = key.slice(prefix.length, key.length - suffix.length);
    return sceneCode.trim() ? sceneCode : null;
  }

  private async sumByPattern(pattern: string): Promise<number> {
    const keys = await this.scanKeys(pattern);
    if (keys.length === 0) {
      return 0;
    }
    const values = await Promise.all(keys.map((key) => this.getIntValue(key)));
    return values.reduce((sum, value) => sum + value, 0);
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const client: Redis = this.redis.getClient();
    let cursor = '0';
    const keys: string[] = [];
    do {
      const [nextCursor, part] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (Array.isArray(part) && part.length > 0) {
        keys.push(...part);
      }
    } while (cursor !== '0');
    return keys;
  }

  private async getIntValue(key: string): Promise<number> {
    const value = await this.redis.get(key);
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
    }
    return 0;
  }

  private buildAlerts(input: {
    successRate: number;
    failed: number;
    total: number;
    p95LatencyMs: number | null;
    cacheDeletedKeys: number;
  }): ResolutionMetricsAlert[] {
    const alerts: ResolutionMetricsAlert[] = [];

    const failureRate = input.total > 0 ? this.round(100 - input.successRate) : 0;
    if (failureRate >= this.thresholds.failureRateWarnPercent && input.failed > 0) {
      alerts.push({
        code: 'SCENE_RESOLVE_FAILURE_RATE',
        level: failureRate >= this.thresholds.failureRateWarnPercent * 2 ? 'CRITICAL' : 'WARN',
        threshold: this.thresholds.failureRateWarnPercent,
        actual: failureRate,
        message: `场景裁决失败率 ${failureRate}% 超过建议阈值 ${this.thresholds.failureRateWarnPercent}%`,
        incidentSeed: {
          type: 'METRIC_ALERT',
          referenceId: 'SCENE_RESOLVE_FAILURE_RATE',
          defaultLevel: failureRate >= this.thresholds.failureRateWarnPercent * 2 ? 'CRITICAL' : 'HIGH',
        },
      });
    }

    if (typeof input.p95LatencyMs === 'number' && input.p95LatencyMs >= this.thresholds.p95LatencyWarnMs) {
      alerts.push({
        code: 'SCENE_RESOLVE_P95_LATENCY',
        level: input.p95LatencyMs >= this.thresholds.p95LatencyWarnMs * 2 ? 'CRITICAL' : 'WARN',
        threshold: this.thresholds.p95LatencyWarnMs,
        actual: input.p95LatencyMs,
        message: `场景裁决 P95 ${input.p95LatencyMs}ms 超过建议阈值 ${this.thresholds.p95LatencyWarnMs}ms`,
        incidentSeed: {
          type: 'METRIC_ALERT',
          referenceId: 'SCENE_RESOLVE_P95_LATENCY',
          defaultLevel: input.p95LatencyMs >= this.thresholds.p95LatencyWarnMs * 2 ? 'CRITICAL' : 'HIGH',
        },
      });
    }

    if (input.cacheDeletedKeys >= this.thresholds.cacheDeletedKeysWarn) {
      alerts.push({
        code: 'CACHE_INVALIDATION_DELETED_KEYS',
        level: input.cacheDeletedKeys >= this.thresholds.cacheDeletedKeysWarn * 2 ? 'CRITICAL' : 'WARN',
        threshold: this.thresholds.cacheDeletedKeysWarn,
        actual: input.cacheDeletedKeys,
        message: `当日缓存失效键数量 ${input.cacheDeletedKeys} 超过建议阈值 ${this.thresholds.cacheDeletedKeysWarn}`,
        incidentSeed: {
          type: 'METRIC_ALERT',
          referenceId: 'CACHE_INVALIDATION_DELETED_KEYS',
          defaultLevel: input.cacheDeletedKeys >= this.thresholds.cacheDeletedKeysWarn * 2 ? 'CRITICAL' : 'HIGH',
        },
      });
    }

    return alerts;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private async loadSceneResolveTrace(
    tenantId: string,
    traceId: string,
    date: string,
  ): Promise<ResolutionTraceSceneResolveSample | null> {
    const tenantPrefix = this.buildTenantPrefix(tenantId);
    const detail = this.toRecord(await this.redis.get(`${tenantPrefix}:sceneResolve:traceDetail:${traceId}:${date}`));
    const hitCount = await this.getIntValue(`${tenantPrefix}:sceneResolve:trace:${traceId}:${date}`);
    if (hitCount <= 0 && Object.keys(detail).length === 0) {
      return null;
    }

    return {
      date,
      traceId,
      hitCount,
      sceneCode: this.readString(detail.sceneCode) ?? '',
      releaseNo: this.readNumber(detail.releaseNo) ?? undefined,
      moduleCount: this.readNumber(detail.moduleCount) ?? 0,
      emptyModuleCount: this.readNumber(detail.emptyModuleCount) ?? 0,
      channel: this.readString(detail.channel) ?? '',
      durationMs: this.readNumber(detail.durationMs) ?? 0,
      status: this.readString(detail.status) === 'FAILED' ? 'FAILED' : 'SUCCESS',
      recordedAt: this.readString(detail.recordedAt) ?? '',
      explainSnapshot: this.readExplainSnapshot(detail.explainSnapshot),
    };
  }

  private async loadCacheInvalidationTrace(
    tenantId: string,
    traceId: string,
    date: string,
  ): Promise<ResolutionTraceCacheInvalidationSample | null> {
    const tenantPrefix = this.buildTenantPrefix(tenantId);
    const detail = this.toRecord(
      await this.redis.get(`${tenantPrefix}:cacheInvalidation:traceDetail:${traceId}:${date}`),
    );
    const hitCount = await this.getIntValue(`${tenantPrefix}:cacheInvalidation:trace:${traceId}:${date}`);
    if (hitCount <= 0 && Object.keys(detail).length === 0) {
      return null;
    }

    return {
      date,
      traceId,
      hitCount,
      eventType: this.readString(detail.eventType) ?? '',
      sceneCode: this.readString(detail.sceneCode) ?? undefined,
      deletedKeys: this.readNumber(detail.deletedKeys) ?? 0,
      durationMs: this.readNumber(detail.durationMs) ?? 0,
      recordedAt: this.readString(detail.recordedAt) ?? '',
    };
  }

  private async persistSceneResolveTrace(input: SceneResolveMetricInput, now: Date): Promise<void> {
    if (!input.traceId) return;

    try {
      await this.prisma.mktSceneResolveTrace.create({
        data: {
          tenantId: input.tenantId,
          traceId: input.traceId,
          traceKind: MktTraceKind.SCENE_RESOLVE,
          sceneCode: input.sceneCode,
          releaseNo: input.releaseNo,
          channel: input.channel,
          status: input.status === 'FAILED' ? MktTraceStatus.FAILED : MktTraceStatus.SUCCESS,
          moduleCount: input.moduleCount,
          emptyModuleCount: input.emptyModuleCount ?? 0,
          durationMs: Math.max(0, Math.trunc(input.durationMs)),
          snapshotJson: {
            source: 'resolution-observability',
            recordedAt: now.toISOString(),
            explainSnapshot: input.explainSnapshot ?? null,
          },
        },
      });
    } catch (error) {
      this.logger.warn(`写入场景裁决 trace 长期审计失败: ${getErrorMessage(error)}`);
    }
  }

  private async persistCacheInvalidationTrace(
    input: CacheInvalidationMetricInput,
    safeDurationMs: number,
    now: Date,
  ): Promise<void> {
    if (!input.traceId) return;

    try {
      await this.prisma.mktSceneResolveTrace.create({
        data: {
          tenantId: input.tenantId,
          traceId: input.traceId,
          traceKind: MktTraceKind.CACHE_INVALIDATION,
          sceneCode: input.sceneCode,
          status: MktTraceStatus.SUCCESS,
          durationMs: safeDurationMs,
          eventType: input.eventType,
          deletedKeys: input.deletedKeys,
          snapshotJson: {
            source: 'resolution-cache-invalidation',
            recordedAt: now.toISOString(),
          },
        },
      });
    } catch (error) {
      this.logger.warn(`写入缓存失效 trace 长期审计失败: ${getErrorMessage(error)}`);
    }
  }

  private async loadPersistentTrace(
    tenantId: string,
    traceId: string,
    days: number,
  ): Promise<ResolutionTraceAuditSample[]> {
    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    since.setHours(0, 0, 0, 0);

    try {
      const rows = await this.prisma.mktSceneResolveTrace.findMany({
        where: {
          tenantId,
          traceId,
          createTime: { gte: since },
        },
        orderBy: { createTime: 'desc' },
        take: 100,
      });

      return rows.map((row) => {
        const snapshot = this.toRecord(row.snapshotJson);
        return {
          date: this.formatDate(row.createTime),
          traceId: row.traceId,
          traceKind: row.traceKind === MktTraceKind.CACHE_INVALIDATION ? 'CACHE_INVALIDATION' : 'SCENE_RESOLVE',
          sceneCode: row.sceneCode ?? undefined,
          releaseNo: row.releaseNo ?? undefined,
          channel: row.channel ?? undefined,
          status: row.status === MktTraceStatus.FAILED ? 'FAILED' : 'SUCCESS',
          moduleCount: row.moduleCount ?? undefined,
          emptyModuleCount: row.emptyModuleCount ?? undefined,
          eventType: row.eventType ?? undefined,
          deletedKeys: row.deletedKeys ?? undefined,
          durationMs: row.durationMs,
          recordedAt: row.createTime.toISOString(),
          explainSnapshot: this.readExplainSnapshot(snapshot.explainSnapshot),
        };
      });
    } catch (error) {
      this.logger.warn(`读取 trace 长期审计失败: ${getErrorMessage(error)}`);
      return [];
    }
  }

  private resolveRecentDates(days: number): string[] {
    const dates: string[] = [];
    const current = new Date();
    for (let index = 0; index < days; index += 1) {
      const date = new Date(current);
      date.setDate(current.getDate() - index);
      dates.push(this.formatDate(date));
    }
    return dates;
  }

  private clampDays(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 7;
    }
    return Math.min(7, Math.max(1, Math.trunc(value)));
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private readExplainSnapshot(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  }

  private buildTenantPrefix(tenantId: string): string {
    return `${this.metricsPrefix}:tenant:${tenantId}`;
  }

  private async pushAlertsToMessageCenter(tenantId: string, overview: ResolutionMetricsOverview): Promise<void> {
    for (const alert of overview.alerts) {
      try {
        const shouldPublish = await this.tryAcquireAlertMessageSlot(tenantId, alert.code);
        if (!shouldPublish) {
          continue;
        }

        await this.prisma.sysMessage.create({
          data: {
            title: this.toAlertTitle(alert.code),
            content: this.toAlertContent(overview, alert),
            type: 'SYSTEM',
            receiverId: tenantId,
            tenantId,
          },
        });
      } catch (error) {
        this.logger.warn(`写入消息中心失败 tenant=${tenantId} code=${alert.code}: ${getErrorMessage(error)}`);
      }
    }
  }

  private async tryAcquireAlertMessageSlot(
    tenantId: string,
    alertCode: ResolutionMetricsAlert['code'],
  ): Promise<boolean> {
    const hour = this.formatHour(new Date());
    const dedupeKey = `${this.buildTenantPrefix(tenantId)}:alertMessage:${alertCode}:${hour}`;
    const result = await this.redis.getClient().set(dedupeKey, '1', 'PX', this.alertMessageDedupeMs, 'NX');
    return result === 'OK';
  }

  private toAlertTitle(alertCode: ResolutionMetricsAlert['code']): string {
    if (alertCode === 'SCENE_RESOLVE_FAILURE_RATE') {
      return '营销场景裁决失败率告警';
    }
    if (alertCode === 'SCENE_RESOLVE_P95_LATENCY') {
      return '营销场景裁决延迟告警';
    }
    return '营销缓存失效波动告警';
  }

  private toAlertContent(overview: ResolutionMetricsOverview, alert: ResolutionMetricsAlert): string {
    return [
      `日期: ${overview.date}`,
      `告警等级: ${alert.level}`,
      `告警内容: ${alert.message}`,
      `阈值: ${alert.threshold}`,
      `当前值: ${alert.actual}`,
      `裁决总请求: ${overview.sceneResolve.total}`,
      `裁决成功率: ${overview.sceneResolve.successRate}%`,
      `裁决P95: ${overview.sceneResolve.p95LatencyMs ?? '-'}ms`,
      `缓存失效键数: ${overview.cacheInvalidation.deletedKeys}`,
    ].join('\n');
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private formatHour(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    return `${year}${month}${day}${hour}`;
  }
}
