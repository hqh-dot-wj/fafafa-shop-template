import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage as ThrottlerStorageToken, ThrottlerStorageService } from '@nestjs/throttler';
import { RedisService } from 'src/module/common/redis/redis.service';

/**
 * 使用 Redis 存储限流计数，保证多实例限流一致性。
 * Redis 异常时自动降级为进程内存存储，避免影响可用性。
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorageToken {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly memoryFallback = new ThrottlerStorageService();

  constructor(private readonly redisService: RedisService) {}

  private readonly luaScript = `
local counterKey = KEYS[1]
local blockKey = KEYS[2]
local ttlMs = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockMs = tonumber(ARGV[3])

local blockedTtl = redis.call('PTTL', blockKey)
if blockedTtl > 0 then
  local current = tonumber(redis.call('GET', counterKey) or '0')
  local counterTtl = redis.call('PTTL', counterKey)
  if counterTtl < 0 then
    counterTtl = 0
  end
  return { current, counterTtl, 1, blockedTtl }
end

local total = redis.call('INCR', counterKey)
if total == 1 then
  redis.call('PEXPIRE', counterKey, ttlMs)
end

local counterTtl = redis.call('PTTL', counterKey)
if counterTtl < 0 then
  counterTtl = ttlMs
end

if total > limit then
  redis.call('SET', blockKey, '1', 'PX', blockMs)
  redis.call('PEXPIRE', counterKey, blockMs)
  return { total, counterTtl, 1, blockMs }
end

return { total, counterTtl, 0, 0 }
`;

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const safeTtl = Math.max(1, Math.trunc(ttl));
    const safeLimit = Math.max(1, Math.trunc(limit));
    const safeBlockDuration = Math.max(1, Math.trunc(blockDuration || ttl));

    const baseKey = `throttle:${throttlerName}:${key}`;
    const counterKey = `${baseKey}:hits`;
    const blockKey = `${baseKey}:block`;

    try {
      const raw = (await this.redisService.getClient().eval(
        this.luaScript,
        2,
        counterKey,
        blockKey,
        String(safeTtl),
        String(safeLimit),
        String(safeBlockDuration),
      )) as [number | string, number | string, number | string, number | string];

      const totalHits = Number(raw?.[0] ?? 0);
      const timeToExpireMs = Math.max(0, Number(raw?.[1] ?? 0));
      const isBlocked = Number(raw?.[2] ?? 0) === 1;
      const timeToBlockExpireMs = Math.max(0, Number(raw?.[3] ?? 0));

      return {
        totalHits,
        timeToExpire: Math.ceil(timeToExpireMs / 1000),
        isBlocked,
        timeToBlockExpire: Math.ceil(timeToBlockExpireMs / 1000),
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis 限流存储异常，降级内存存储: ${reason}`);
      return await this.memoryFallback.increment(key, safeTtl, safeLimit, safeBlockDuration, throttlerName);
    }
  }
}
