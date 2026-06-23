import { Injectable, Logger, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TenantContext } from 'src/common/tenant';
import { getErrorMessage } from 'src/common/utils/error';
import { RedisService } from 'src/module/common/redis/redis.service';
import { CACHE_EVICT_METADATA, CACHE_KEY_METADATA, CACHE_TTL_METADATA } from './cache.decorator';
import { MarketingCacheIndexService } from './cache-index.service';

/**
 * 营销模块缓存拦截器
 *
 * @description
 * 配合 @Cacheable / @CacheEvict 装饰器使用：
 * - @Cacheable：读取 Redis 缓存，命中则直接返回；未命中时执行原方法并写入缓存，同时写入缓存索引以支持前缀失效
 * - @CacheEvict：方法执行成功后按前缀批量清除缓存
 *
 * 缓存键格式：`{prefix}{tenantId}:{ClassName}:{handlerName}:{argsHash}`
 * 所有 Redis 操作失败时静默降级，不影响主逻辑。
 */
@Injectable()
export class MarketingCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MarketingCacheInterceptor.name);
  /** 未显式指定 TTL 时的默认缓存时间（秒） */
  private readonly defaultTtlSeconds = 300;
  /** TTL 抖动范围（秒），防止大量缓存同时过期引发缓存雪崩 */
  private readonly jitterRangeSeconds = 30;

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    private readonly cacheIndex: MarketingCacheIndexService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const cacheKeyPrefix = this.reflector.getAllAndOverride<string>(CACHE_KEY_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    const cacheTtlSeconds =
      this.reflector.getAllAndOverride<number>(CACHE_TTL_METADATA, [context.getHandler(), context.getClass()]) ??
      this.defaultTtlSeconds;
    const evictKeyPrefixes =
      this.reflector.getAllAndOverride<string[]>(CACHE_EVICT_METADATA, [context.getHandler(), context.getClass()]) ??
      [];

    if (!cacheKeyPrefix && evictKeyPrefixes.length === 0) {
      return next.handle();
    }

    if (cacheKeyPrefix) {
      return await this.handleCacheable(context, next, cacheKeyPrefix, cacheTtlSeconds);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          void this.evictByPrefixes(evictKeyPrefixes);
        },
      }),
    );
  }

  /** 处理带缓存的请求：先读 Redis，命中直接返回；未命中执行原方法并异步写入缓存 */
  private async handleCacheable(
    context: ExecutionContext,
    next: CallHandler,
    cacheKeyPrefix: string,
    cacheTtlSeconds: number,
  ): Promise<Observable<unknown>> {
    const scopedPrefix = this.addTenantPrefix(cacheKeyPrefix);
    const cacheKey = this.buildCacheKey(context, scopedPrefix);

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null && cached !== undefined) {
        return of(cached);
      }
    } catch (error) {
      this.logger.warn(`读取缓存失败，继续执行原逻辑: ${getErrorMessage(error)}`);
    }

    return next.handle().pipe(
      tap({
        next: (result) => {
          if (result === undefined) {
            return;
          }

          const ttlMs = this.toTtlMs(cacheTtlSeconds);
          void this.redis
            .set(cacheKey, result, ttlMs)
            .then(() => this.cacheIndex.trackCacheKey(scopedPrefix, cacheKey, ttlMs))
            .catch((error) => {
              this.logger.warn(`写入缓存失败，忽略缓存异常: ${getErrorMessage(error)}`);
            });
        },
      }),
    );
  }

  /** 按前缀列表批量清除缓存：优先走缓存索引精准删除，索引为空时降级为 SCAN+DEL 全量扫描 */
  private async evictByPrefixes(prefixes: string[]): Promise<void> {
    if (prefixes.length === 0) {
      return;
    }

    for (const prefix of prefixes) {
      const scopedPrefix = this.addTenantPrefix(prefix);
      const pattern = scopedPrefix.includes('*') ? scopedPrefix : `${scopedPrefix}*`;

      try {
        const indexedDeleted = await this.cacheIndex.evictByScopedPrefix(scopedPrefix);
        if (indexedDeleted === 0) {
          await this.redis.scanAndDeleteByMatch(pattern);
        }
      } catch (error) {
        this.logger.warn(`清理缓存失败，pattern=${pattern}: ${getErrorMessage(error)}`);
      }
    }
  }

  /** 构建完整缓存键：`{scopedPrefix}{ClassName}:{handlerName}:{argsHash}` */
  private buildCacheKey(context: ExecutionContext, scopedPrefix: string): string {
    const className = context.getClass().name;
    const handlerName = context.getHandler().name;
    const argsDigest = this.hashArgs(context.getArgs());
    return `${scopedPrefix}${className}:${handlerName}:${argsDigest}`;
  }

  /** 将租户ID注入到缓存前缀，实现租户间缓存隔离；无租户上下文时原样返回 */
  private addTenantPrefix(prefix: string): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      return prefix;
    }
    return `${prefix}${tenantId}:`;
  }

  /**
   * 对请求参数计算 SHA-1 摘要，用于区分同一接口不同入参的缓存键。
   * 使用 WeakSet 检测循环引用，避免 JSON.stringify 栈溢出。
   */
  private hashArgs(args: unknown[]): string {
    const seen = new WeakSet<object>();
    const raw = JSON.stringify(args, (_key, value) => {
      if (typeof value === 'function') {
        return `[Function:${value.name || 'anonymous'}]`;
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });
    return createHash('sha1')
      .update(raw ?? '[]')
      .digest('hex');
  }

  /** 将秒级 TTL 转换为毫秒，并附加随机抖动，防止缓存同时到期 */
  private toTtlMs(ttlSeconds: number): number {
    const jitter = Math.floor(Math.random() * this.jitterRangeSeconds);
    return (ttlSeconds + jitter) * 1000;
  }
}
