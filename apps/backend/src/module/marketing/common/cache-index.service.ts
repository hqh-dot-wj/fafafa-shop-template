import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/module/common/redis/redis.service';

/** Redis Set 存储缓存索引的键前缀，格式：`marketing:cache:index:{scopedPrefix}` */
const CACHE_INDEX_KEY_PREFIX = 'marketing:cache:index:';

/**
 * 营销缓存索引服务
 *
 * @description
 * 维护"前缀 → 缓存键集合"的 Redis Set 映射，使 @CacheEvict 可按前缀精准删除，
 * 而无需 SCAN 全库扫描。索引 Set 的 TTL 与其跟踪的最长缓存键保持一致。
 */
@Injectable()
export class MarketingCacheIndexService {
  constructor(private readonly redis: RedisService) {}

  /**
   * 将 cacheKey 注册到对应前缀的索引 Set，并刷新索引的过期时间。
   * @param scopedPrefix - 含租户隔离的缓存前缀
   * @param cacheKey - 完整缓存键
   * @param ttlMs - 缓存键的存活时长（ms），用于设置索引 Set 的过期时间
   */
  async trackCacheKey(scopedPrefix: string, cacheKey: string, ttlMs: number): Promise<void> {
    const indexKey = this.buildIndexKey(scopedPrefix);
    const client = this.redis.getClient();
    await client.sadd(indexKey, cacheKey);
    await client.pexpire(indexKey, ttlMs);
  }

  /**
   * 删除指定前缀下的所有缓存键，并清除索引 Set。
   * @returns 实际删除的缓存键数量；索引不存在时返回 0（调用方可据此决定是否降级为 SCAN）
   */
  async evictByScopedPrefix(scopedPrefix: string): Promise<number> {
    const indexKey = this.buildIndexKey(scopedPrefix);
    const client = this.redis.getClient();
    const keys = await client.smembers(indexKey);
    let deletedCount = 0;
    if (keys.length > 0) {
      deletedCount = await this.redis.del(keys);
    }
    await client.del(indexKey);
    return deletedCount;
  }

  /** 构建索引 Set 在 Redis 中的完整键名 */
  private buildIndexKey(scopedPrefix: string): string {
    return `${CACHE_INDEX_KEY_PREFIX}${scopedPrefix}`;
  }
}

