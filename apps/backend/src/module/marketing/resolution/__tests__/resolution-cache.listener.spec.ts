import { ResolutionCacheListener } from '../resolution-cache.listener';
import { RedisService } from 'src/module/common/redis/redis.service';
import { MarketingEventType, MarketingResolutionCachePayload } from '../../events/marketing-event.types';
import { ResolutionObservabilityService } from '../resolution-observability.service';

describe('ResolutionCacheListener', () => {
  let listener: ResolutionCacheListener;
  let redis: {
    del: jest.Mock;
    getClient: jest.Mock;
  };
  let observability: {
    recordCacheInvalidation: jest.Mock;
  };
  let scanResultByPattern: Record<string, string[]>;

  beforeEach(() => {
    scanResultByPattern = {
      'client:product:list:t1:*': ['client:product:list:t1:abc'],
      'client:product:detail:p-1:*': ['client:product:detail:p-1:t1:none'],
      'scene:release:t1:*': ['scene:release:t1:HOME_FEATURED:2'],
      'scene:release:t1:HOME_FEATURED:*': ['scene:release:t1:HOME_FEATURED:2'],
      'client:product:detail:*': ['client:product:detail:p-1:t1:none'],
    };
    const mockClient = {
      scan: jest.fn((_cursor: string, ...args: unknown[]) => {
        const pattern = String(args[1] ?? '');
        return Promise.resolve(['0', scanResultByPattern[pattern] ?? []] as [string, string[]]);
      }),
    };

    redis = {
      del: jest.fn().mockResolvedValue(1),
      getClient: jest.fn().mockReturnValue(mockClient),
    };
    observability = {
      recordCacheInvalidation: jest.fn().mockResolvedValue(undefined),
    };

    listener = new ResolutionCacheListener(
      redis as unknown as RedisService,
      observability as unknown as ResolutionObservabilityService,
    );
  });

  const payload: MarketingResolutionCachePayload = {
    configId: 'cfg-1',
    productId: 'p-1',
    tenantId: 't1',
    traceId: 'trace-cache-1',
  };

  it('onActivityOffShelf 应删除详情键并扫描删除列表缓存', async () => {
    await listener.onActivityOffShelf(payload);

    expect(redis.del).toHaveBeenCalledWith(`client:product:detail:${payload.productId}`);
    expect(redis.del).toHaveBeenCalledWith([`client:product:detail:${payload.productId}:t1:none`]);
    expect(redis.del).toHaveBeenCalledWith(['client:product:list:t1:abc']);
    expect(observability.recordCacheInvalidation).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        eventType: MarketingEventType.ACTIVITY_OFF_SHELF,
        traceId: 'trace-cache-1',
        durationMs: expect.any(Number),
      }),
    );
  });

  it('onActivityStockDepleted 与下架行为一致', async () => {
    await listener.onActivityStockDepleted(payload);

    expect(redis.del).toHaveBeenCalledWith(`client:product:detail:${payload.productId}`);
    expect(redis.del).toHaveBeenCalledWith([`client:product:detail:${payload.productId}:t1:none`]);
    expect(redis.getClient).toHaveBeenCalled();
  });

  it('onConfigStatusChanged 仅删除商品详情缓存', async () => {
    await listener.onConfigStatusChanged(payload);

    expect(redis.del).toHaveBeenCalledTimes(2);
    expect(redis.del).toHaveBeenCalledWith(`client:product:detail:${payload.productId}`);
    expect(redis.del).toHaveBeenCalledWith([`client:product:detail:${payload.productId}:t1:none`]);
    expect(redis.getClient).toHaveBeenCalled();
  });

  it('onSceneReleasePublished 应清理场景快照与聚合列表缓存', async () => {
    await listener.onSceneReleasePublished({
      tenantId: 't1',
      sceneCode: 'HOME_FEATURED',
      releaseNo: 2,
      publishedBy: 'admin',
      traceId: 'trace-scene-release-1',
    });
    expect(redis.getClient).toHaveBeenCalled();
    expect(observability.recordCacheInvalidation).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        sceneCode: 'HOME_FEATURED',
        eventType: MarketingEventType.SCENE_RELEASE_PUBLISHED,
        traceId: 'trace-scene-release-1',
        durationMs: expect.any(Number),
      }),
    );
  });

  it('使用 MarketingEventType 字符串与 @OnEvent 约定一致', () => {
    expect(MarketingEventType.ACTIVITY_OFF_SHELF).toBe('activity.manualOffShelf');
    expect(MarketingEventType.ACTIVITY_STOCK_DEPLETED).toBe('activity.stockDepleted');
    expect(MarketingEventType.CONFIG_STATUS_CHANGED).toBe('storePlayConfig.statusChanged');
    expect(MarketingEventType.SCENE_RELEASE_PUBLISHED).toBe('scene.release.published');
    expect(MarketingEventType.POLICY_CONFIG_CHANGED).toBe('policy.config.changed');
    expect(MarketingEventType.PRIORITY_RULE_CHANGED).toBe('resolution.priorityRule.changed');
  });
});
