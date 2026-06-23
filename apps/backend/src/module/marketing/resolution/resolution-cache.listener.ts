import { Injectable, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { RedisService } from 'src/module/common/redis/redis.service';
import { resolveMarketingTraceId } from '../common/trace-id.util';
import {
  MarketingEventType,
  MarketingPolicyChangedPayload,
  MarketingPriorityRuleChangedPayload,
  MarketingResolutionCachePayload,
  MarketingSceneReleasePublishedPayload,
} from '../events/marketing-event.types';
import { ResolutionObservabilityService } from './resolution-observability.service';
import { SCENE_RELEASE_CACHE_KEY_PREFIX } from './scene-release.repository';

/**
 * 营销裁决 / C 端商品缓存失效监听器
 *
 * 约束：仅使用 SCAN + DEL，不引入 KEYS。
 */
@Injectable()
export class ResolutionCacheListener {
  private readonly logger = new Logger(ResolutionCacheListener.name);

  constructor(
    private readonly redis: RedisService,
    private readonly observability: ResolutionObservabilityService,
    @Optional() private readonly cls?: ClsService,
  ) {}

  @OnEvent(MarketingEventType.ACTIVITY_OFF_SHELF)
  async onActivityOffShelf(payload: MarketingResolutionCachePayload): Promise<void> {
    const traceId = this.resolveTraceId(payload.traceId);
    const startedAt = Date.now();
    try {
      const deletedKeys = await this.clearProductCaches(payload.tenantId, payload.productId);
      const durationMs = await this.recordInvalidationMetrics({
        tenantId: payload.tenantId,
        eventType: MarketingEventType.ACTIVITY_OFF_SHELF,
        deletedKeys,
        traceId,
        startedAt,
      });
      this.logger.log(
        `活动下架缓存清除: configId=${payload.configId}, productId=${payload.productId}, ` +
          `deletedKeys=${deletedKeys}, durationMs=${durationMs}, traceId=${traceId}`,
      );
    } catch (error) {
      this.logger.error(
        `[活动下架缓存清除失败] configId=${payload.configId}, productId=${payload.productId}, traceId=${traceId}, ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  @OnEvent(MarketingEventType.ACTIVITY_STOCK_DEPLETED)
  async onActivityStockDepleted(payload: MarketingResolutionCachePayload): Promise<void> {
    const traceId = this.resolveTraceId(payload.traceId);
    const startedAt = Date.now();
    try {
      const deletedKeys = await this.clearProductCaches(payload.tenantId, payload.productId);
      const durationMs = await this.recordInvalidationMetrics({
        tenantId: payload.tenantId,
        eventType: MarketingEventType.ACTIVITY_STOCK_DEPLETED,
        deletedKeys,
        traceId,
        startedAt,
      });
      this.logger.log(
        `活动库存耗尽缓存清除: configId=${payload.configId}, productId=${payload.productId}, ` +
          `deletedKeys=${deletedKeys}, durationMs=${durationMs}, traceId=${traceId}`,
      );
    } catch (error) {
      this.logger.error(
        `[活动库存耗尽缓存清除失败] configId=${payload.configId}, productId=${payload.productId}, traceId=${traceId}, ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  @OnEvent(MarketingEventType.CONFIG_STATUS_CHANGED)
  async onConfigStatusChanged(payload: MarketingResolutionCachePayload): Promise<void> {
    const traceId = this.resolveTraceId(payload.traceId);
    const startedAt = Date.now();
    try {
      const deletedKeys = await this.clearProductDetailCache(payload.productId);
      const durationMs = await this.recordInvalidationMetrics({
        tenantId: payload.tenantId,
        eventType: MarketingEventType.CONFIG_STATUS_CHANGED,
        deletedKeys,
        traceId,
        startedAt,
      });
      this.logger.log(
        `配置状态变更缓存清除: configId=${payload.configId}, deletedKeys=${deletedKeys}, ` +
          `durationMs=${durationMs}, traceId=${traceId}`,
      );
    } catch (error) {
      this.logger.error(
        `[配置状态变更缓存清除失败] configId=${payload.configId}, traceId=${traceId}, ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  @OnEvent(MarketingEventType.SCENE_RELEASE_PUBLISHED)
  async onSceneReleasePublished(payload: MarketingSceneReleasePublishedPayload): Promise<void> {
    const traceId = this.resolveTraceId(payload.traceId);
    const startedAt = Date.now();
    try {
      const [sceneReleaseDeleted, aggregateListDeleted] = await Promise.all([
        this.clearSceneReleaseCache(payload.tenantId, payload.sceneCode),
        this.clearAggregateListCache(payload.tenantId),
      ]);
      const deletedKeys = sceneReleaseDeleted + aggregateListDeleted;
      const durationMs = await this.recordInvalidationMetrics({
        tenantId: payload.tenantId,
        sceneCode: payload.sceneCode,
        eventType: MarketingEventType.SCENE_RELEASE_PUBLISHED,
        deletedKeys,
        traceId,
        startedAt,
      });
      this.logger.log(
        `场景发布缓存清除: scene=${payload.sceneCode}, releaseNo=${payload.releaseNo}, deletedKeys=${deletedKeys}, ` +
          `durationMs=${durationMs}, traceId=${traceId}`,
      );
    } catch (error) {
      this.logger.error(
        `[场景发布缓存清除失败] scene=${payload.sceneCode}, releaseNo=${payload.releaseNo}, traceId=${traceId}, ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  @OnEvent(MarketingEventType.POLICY_CONFIG_CHANGED)
  async onPolicyConfigChanged(payload: MarketingPolicyChangedPayload): Promise<void> {
    const traceId = this.resolveTraceId(payload.traceId);
    const startedAt = Date.now();
    try {
      const [sceneReleaseDeleted, aggregateListDeleted, productDetailDeleted] = await Promise.all([
        this.clearSceneReleaseCacheByTenant(payload.tenantId),
        this.clearAggregateListCache(payload.tenantId),
        this.clearAllProductDetailCache(),
      ]);
      const deletedKeys = sceneReleaseDeleted + aggregateListDeleted + productDetailDeleted;
      const durationMs = await this.recordInvalidationMetrics({
        tenantId: payload.tenantId,
        eventType: MarketingEventType.POLICY_CONFIG_CHANGED,
        deletedKeys,
        traceId,
        startedAt,
      });
      this.logger.log(
        `策略变更缓存清除: policyCode=${payload.policyCode}, type=${payload.policyType}, deletedKeys=${deletedKeys}, ` +
          `durationMs=${durationMs}, traceId=${traceId}`,
      );
    } catch (error) {
      this.logger.error(
        `[策略变更缓存清除失败] policyCode=${payload.policyCode}, traceId=${traceId}, ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  @OnEvent(MarketingEventType.PRIORITY_RULE_CHANGED)
  async onPriorityRuleChanged(payload: MarketingPriorityRuleChangedPayload): Promise<void> {
    const traceId = this.resolveTraceId(payload.traceId);
    const startedAt = Date.now();
    try {
      const [sceneReleaseDeleted, aggregateListDeleted, productDetailDeleted] = await Promise.all([
        this.clearSceneReleaseCacheByTenant(payload.tenantId),
        this.clearAggregateListCache(payload.tenantId),
        this.clearAllProductDetailCache(),
      ]);
      const deletedKeys = sceneReleaseDeleted + aggregateListDeleted + productDetailDeleted;
      const durationMs = await this.recordInvalidationMetrics({
        tenantId: payload.tenantId,
        eventType: MarketingEventType.PRIORITY_RULE_CHANGED,
        deletedKeys,
        traceId,
        startedAt,
      });
      this.logger.log(
        `优先级规则变更缓存清除: action=${payload.action}, activityType=${payload.activityType ?? '-'}, ` +
          `deletedKeys=${deletedKeys}, durationMs=${durationMs}, traceId=${traceId}`,
      );
    } catch (error) {
      this.logger.error(
        `[优先级规则变更缓存清除失败] action=${payload.action}, traceId=${traceId}, ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  private resolveTraceId(explicitTraceId?: string): string {
    return resolveMarketingTraceId(explicitTraceId, this.cls);
  }

  private async recordInvalidationMetrics(input: {
    tenantId: string;
    eventType: string;
    deletedKeys: number;
    traceId: string;
    startedAt: number;
    sceneCode?: string;
  }): Promise<number> {
    const durationMs = Math.max(0, Date.now() - input.startedAt);
    await this.observability.recordCacheInvalidation({
      tenantId: input.tenantId,
      eventType: input.eventType,
      deletedKeys: input.deletedKeys,
      sceneCode: input.sceneCode,
      durationMs,
      traceId: input.traceId,
    });
    return durationMs;
  }

  private async clearProductCaches(tenantId: string, productId: string): Promise<number> {
    const [detailDeleted, listDeleted] = await Promise.all([
      this.clearProductDetailCache(productId),
      this.clearAggregateListCache(tenantId),
    ]);
    return detailDeleted + listDeleted;
  }

  private async clearProductDetailCache(productId: string): Promise<number> {
    const legacyKey = `client:product:detail:${productId}`;
    const [legacyDeleted, scopedDeleted] = await Promise.all([
      this.redis.del(legacyKey),
      this.deleteByPattern(`client:product:detail:${productId}:*`),
    ]);
    return legacyDeleted + scopedDeleted;
  }

  /** 按租户清除 C 端商品列表缓存（与 ClientProductService key 前缀保持一致） */
  private async clearAggregateListCache(tenantId: string): Promise<number> {
    const pattern = `client:product:list:${tenantId}:*`;
    return await this.deleteByPattern(pattern);
  }

  private async clearAllProductDetailCache(): Promise<number> {
    return await this.deleteByPattern('client:product:detail:*');
  }

  private async clearSceneReleaseCacheByTenant(tenantId: string): Promise<number> {
    const pattern = `${SCENE_RELEASE_CACHE_KEY_PREFIX}:${tenantId}:*`;
    return await this.deleteByPattern(pattern);
  }

  private async clearSceneReleaseCache(tenantId: string, sceneCode: string): Promise<number> {
    const pattern = `${SCENE_RELEASE_CACHE_KEY_PREFIX}:${tenantId}:${sceneCode}:*`;
    return await this.deleteByPattern(pattern);
  }

  private async deleteByPattern(pattern: string): Promise<number> {
    const client = this.redis.getClient();
    let cursor = '0';
    const keysToDelete: string[] = [];

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (cursor !== '0');

    if (keysToDelete.length > 0) {
      return await this.redis.del(keysToDelete);
    }
    return 0;
  }
}
