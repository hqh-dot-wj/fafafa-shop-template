import { ResolutionObservabilityService } from '../resolution-observability.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';

type TraceAuditRow = {
  id: string;
  tenantId: string;
  traceId: string;
  traceKind: 'SCENE_RESOLVE' | 'CACHE_INVALIDATION';
  sceneCode?: string | null;
  releaseNo?: number | null;
  channel?: string | null;
  status: 'SUCCESS' | 'FAILED';
  moduleCount?: number | null;
  emptyModuleCount?: number | null;
  durationMs: number;
  eventType?: string | null;
  deletedKeys?: number | null;
  snapshotJson?: Record<string, unknown> | null;
  createTime: Date;
};

describe('ResolutionObservabilityService', () => {
  const tenantId = 't1';
  const date = '20260415';
  const prefix = `marketing:resolution:metrics:tenant:${tenantId}`;
  const latencyKey = `${prefix}:sceneResolve:latency:${date}17`;
  const cacheDurationKey = `${prefix}:cacheInvalidation:duration:${date}17`;
  const eventKey = `${prefix}:cacheInvalidation:event:scene.release.published:${date}`;
  const successSceneKey = `${prefix}:sceneResolve:scene:HOME_FEATURED:success:${date}`;
  const failedSceneKey = `${prefix}:sceneResolve:scene:HOME_FEATURED:failed:${date}`;

  let service: ResolutionObservabilityService;
  let valueMap: Map<string, number | string | Record<string, unknown>>;
  let redisService: {
    get: jest.Mock;
    getClient: jest.Mock;
  };
  let redisClient: {
    scan: jest.Mock;
    zrange: jest.Mock;
    incr: jest.Mock;
    incrby: jest.Mock;
    expire: jest.Mock;
    zadd: jest.Mock;
    set: jest.Mock;
    sadd: jest.Mock;
  };
  let traceAuditRows: TraceAuditRow[];
  let prismaService: {
    sysMessage: {
      create: jest.Mock;
    };
    mktSceneResolveTrace: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    valueMap = new Map<string, number | string | Record<string, unknown>>([
      [`${prefix}:sceneResolve:total:${date}`, 100],
      [`${prefix}:sceneResolve:success:${date}`, 90],
      [`${prefix}:sceneResolve:failed:${date}`, 10],
      [`${prefix}:sceneResolve:emptyModules:${date}`, 4],
      [`${prefix}:cacheInvalidation:deletedKeys:${date}`, 2500],
      [`${prefix}:cacheInvalidation:durationTotal:${date}`, 150],
      [eventKey, 3],
      [successSceneKey, 90],
      [failedSceneKey, 10],
    ]);

    redisClient = {
      scan: jest.fn(async (_cursor: string, _match: string, pattern: string) => {
        if (pattern.includes(':cacheInvalidation:event:')) {
          return ['0', [eventKey]];
        }
        if (pattern.includes(':sceneResolve:scene:*:success:')) {
          return ['0', [successSceneKey]];
        }
        if (pattern.includes(':sceneResolve:scene:*:failed:')) {
          return ['0', [failedSceneKey]];
        }
        if (pattern.includes(':sceneResolve:latency:')) {
          return ['0', [latencyKey]];
        }
        if (pattern.includes(':cacheInvalidation:duration:')) {
          return ['0', [cacheDurationKey]];
        }
        return ['0', []];
      }),
      zrange: jest.fn(async (key: string) => {
        if (key === latencyKey) {
          return ['s1', '900', 's2', '1100', 's3', '700'];
        }
        if (key === cacheDurationKey) {
          return ['c1', '20', 'c2', '50', 'c3', '80'];
        }
        return [];
      }),
      incr: jest.fn(async (key: string) => {
        const next = Number(valueMap.get(key) ?? 0) + 1;
        valueMap.set(key, next);
        return next;
      }),
      incrby: jest.fn(async (key: string, delta: number) => {
        const next = Number(valueMap.get(key) ?? 0) + delta;
        valueMap.set(key, next);
        return next;
      }),
      expire: jest.fn(),
      zadd: jest.fn(),
      sadd: jest.fn(async () => 1),
      set: jest.fn(async (key: string, value: string) => {
        try {
          valueMap.set(key, JSON.parse(value));
        } catch {
          valueMap.set(key, value);
        }
        return 'OK';
      }),
    };

    redisService = {
      get: jest.fn(async (key: string) => valueMap.get(key) ?? null),
      getClient: jest.fn(() => redisClient),
    };

    traceAuditRows = [];
    prismaService = {
      sysMessage: {
        create: jest.fn(async () => ({ id: 1 })),
      },
      mktSceneResolveTrace: {
        create: jest.fn(async ({ data }: { data: Omit<TraceAuditRow, 'id' | 'createTime'> }) => {
          const row: TraceAuditRow = {
            id: `trace-audit-${traceAuditRows.length + 1}`,
            ...data,
            createTime: new Date(),
          };
          traceAuditRows.push(row);
          return row;
        }),
        findMany: jest.fn(async () => traceAuditRows),
      },
    };

    service = new ResolutionObservabilityService(
      redisService as unknown as RedisService,
      prismaService as unknown as PrismaService,
    );
    jest.useFakeTimers().setSystemTime(new Date('2026-04-15T17:00:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('getDashboard 返回汇总、场景排行与阈值告警', async () => {
    const dashboard = await service.getDashboard(tenantId);

    expect(dashboard.overview.date).toBe(date);
    expect(dashboard.overview.sceneResolve.total).toBe(100);
    expect(dashboard.overview.sceneResolve.successRate).toBe(90);
    expect(dashboard.overview.sceneResolve.p95LatencyMs).toBe(1100);
    expect(dashboard.overview.sceneResolve.p99LatencyMs).toBe(1100);
    expect(dashboard.overview.sceneResolve.emptyModules).toBe(4);
    expect(dashboard.overview.cacheInvalidation.deletedKeys).toBe(2500);
    expect(dashboard.overview.cacheInvalidation.totalDurationMs).toBe(150);
    expect(dashboard.overview.cacheInvalidation.avgDurationMs).toBe(50);
    expect(dashboard.overview.cacheInvalidation.p95DurationMs).toBe(80);
    expect(dashboard.overview.cacheInvalidation.p99DurationMs).toBe(80);
    expect(dashboard.overview.alerts.length).toBe(3);
    expect(dashboard.overview.alerts[0]?.incidentSeed).toMatchObject({
      type: 'METRIC_ALERT',
    });
    expect(dashboard.topScenes[0]).toMatchObject({
      sceneCode: 'HOME_FEATURED',
      total: 100,
      successRate: 90,
    });
    expect(prismaService.sysMessage.create).toHaveBeenCalledTimes(3);
  });

  it('记录 trace 详情后可以按 traceId 查询诊断快照', async () => {
    await service.recordSceneResolve({
      tenantId,
      traceId: 'trace-1',
      sceneCode: 'HOME_FEATURED',
      releaseNo: 3,
      moduleCount: 2,
      emptyModuleCount: 1,
      channel: 'MINIAPP',
      durationMs: 128,
      status: 'SUCCESS',
      explainSnapshot: {
        modules: [
          {
            moduleCode: 'M1',
            candidateSnapshot: [{ productId: 'p1' }],
            selectedSnapshot: [{ productId: 'p1' }],
          },
        ],
      },
    });
    await service.recordCacheInvalidation({
      tenantId,
      traceId: 'trace-1',
      sceneCode: 'HOME_FEATURED',
      eventType: 'scene.release.published',
      deletedKeys: 12,
      durationMs: 36,
    });

    const snapshot = await service.getTraceDiagnostics({ tenantId, traceId: 'trace-1', days: 1 });

    expect(snapshot.sceneResolve[0]).toMatchObject({
      traceId: 'trace-1',
      sceneCode: 'HOME_FEATURED',
      releaseNo: 3,
      hitCount: 1,
      emptyModuleCount: 1,
      status: 'SUCCESS',
      explainSnapshot: expect.objectContaining({
        modules: expect.arrayContaining([expect.objectContaining({ moduleCode: 'M1' })]),
      }),
    });
    expect(snapshot.cacheInvalidation[0]).toMatchObject({
      traceId: 'trace-1',
      eventType: 'scene.release.published',
      deletedKeys: 12,
      hitCount: 1,
    });
    expect(snapshot.persistentTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ traceId: 'trace-1', traceKind: 'SCENE_RESOLVE' }),
        expect.objectContaining({ traceId: 'trace-1', traceKind: 'CACHE_INVALIDATION' }),
      ]),
    );
    expect(snapshot.persistentTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          traceId: 'trace-1',
          traceKind: 'SCENE_RESOLVE',
          explainSnapshot: expect.objectContaining({
            modules: expect.arrayContaining([expect.objectContaining({ moduleCode: 'M1' })]),
          }),
        }),
      ]),
    );
  });

  // ultrareview rqxa0c2jb #bug_001：scene-only / cache-event-only 租户不会写 aggregate/compat 集合，
  // 必须由 observability 自身在写指标时 sadd 到 mkt:obs:tenants，让 ResolutionAlertScheduler 能预筛到。
  describe('告警观测活跃租户集合（mkt:obs:tenants）', () => {
    it('recordSceneResolve 写入指标时同步 sadd 该租户到 mkt:obs:tenants', async () => {
      await service.recordSceneResolve({
        tenantId,
        sceneCode: 'HOME_FEATURED',
        moduleCount: 1,
        channel: 'MINIAPP',
        durationMs: 100,
        status: 'SUCCESS',
      });

      expect(redisClient.sadd).toHaveBeenCalledWith('mkt:obs:tenants', tenantId);
    });

    it('recordCacheInvalidation 写入指标时同步 sadd 该租户到 mkt:obs:tenants', async () => {
      await service.recordCacheInvalidation({
        tenantId,
        eventType: 'scene.release.published',
        deletedKeys: 5,
        durationMs: 20,
      });

      expect(redisClient.sadd).toHaveBeenCalledWith('mkt:obs:tenants', tenantId);
    });
  });
});
