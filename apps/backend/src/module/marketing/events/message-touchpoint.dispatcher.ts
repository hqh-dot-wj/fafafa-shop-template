import { Injectable, Logger } from '@nestjs/common';
import { getMarketingEventTypesByUsableScope } from './marketing-event.catalog';
import { MarketingEvent, MarketingEventType } from './marketing-event.types';
import { TouchpointOrchestratorService } from './touchpoint-orchestrator.service';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { RedisService } from 'src/module/common/redis/redis.service';

const MESSAGE_TOUCHPOINT_EVENT_SET = new Set<MarketingEventType>(getMarketingEventTypesByUsableScope('TOUCHPOINT'));
const EVENT_STATS_TTL_SECONDS = 60 * 60 * 24 * 7;

@Injectable()
export class MessageTouchpointDispatcher {
  private readonly logger = new Logger(MessageTouchpointDispatcher.name);
  private readonly eventStatsTtlSeconds = EVENT_STATS_TTL_SECONDS;
  private readonly recentEventLimit = 100;

  constructor(
    private readonly redisService: RedisService,
    private readonly touchpointOrchestrator: TouchpointOrchestratorService,
  ) {}

  async dispatch(event: MarketingEvent): Promise<void> {
    await this.recordEventStatsSafely(event);

    if (!MESSAGE_TOUCHPOINT_EVENT_SET.has(event.type)) {
      return;
    }

    try {
      const result = await this.touchpointOrchestrator.dispatch({ event });
      if (result.planned > 0) {
        this.logger.debug(
          `[触点编排] 事件: ${event.type}, 活动: ${event.configId}, 计划: ${result.planned}, 已发送: ${result.sent}, 跳过: ${result.skipped}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[触点编排失败] 事件: ${event.type}, 活动: ${event.configId}, 错误: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
    }
  }

  private async recordEventStatsSafely(event: MarketingEvent): Promise<void> {
    try {
      await this.recordCriticalEvent(event);
    } catch (error) {
      this.logger.warn(
        `[事件统计失败] 事件: ${event.type}, 实例: ${event.instanceId}, 错误: ${getErrorMessage(error)}`,
      );
    }
  }

  private async recordCriticalEvent(event: MarketingEvent): Promise<void> {
    const tenantId = event.tenantId || '000000';
    const dateKey = this.formatDate(event.timestamp);
    const statsPrefix = `mkt:event:stats:${tenantId}:${dateKey}`;
    const totalKey = `${statsPrefix}:total`;
    const typeKey = `${statsPrefix}:${event.type}`;
    const recentKey = `mkt:event:recent:${tenantId}`;
    const snapshot = JSON.stringify({
      type: event.type,
      instanceId: event.instanceId,
      configId: event.configId,
      memberId: event.memberId,
      traceId: event.traceId,
      sourceStep: event.sourceStep,
      payload: event.payload,
      timestamp: event.timestamp.toISOString(),
    });

    const redisClient = this.redisService.getClient();
    await redisClient
      .multi()
      .incr(totalKey)
      .incr(typeKey)
      .lpush(recentKey, snapshot)
      .ltrim(recentKey, 0, this.recentEventLimit - 1)
      .expire(totalKey, this.eventStatsTtlSeconds)
      .expire(typeKey, this.eventStatsTtlSeconds)
      .expire(recentKey, this.eventStatsTtlSeconds)
      .exec();
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }
}
