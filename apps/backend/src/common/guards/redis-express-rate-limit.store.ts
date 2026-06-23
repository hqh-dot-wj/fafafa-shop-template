import { Injectable, Logger } from '@nestjs/common';
import { MemoryStore, type ClientRateLimitInfo, type Options, type Store } from 'express-rate-limit';
import { RedisService } from 'src/module/common/redis/redis.service';

/**
 * express-rate-limit 的 Redis Store，实现多实例限流一致性。
 * Redis 异常时自动降级内存存储，保障可用性。
 */
@Injectable()
export class RedisExpressRateLimitStore implements Store {
  public localKeys = false;
  public prefix: string;

  private readonly logger = new Logger(RedisExpressRateLimitStore.name);
  private readonly memoryFallback = new MemoryStore();
  private windowMs = 60_000;
  private lastFallbackWarnAt = 0;

  constructor(
    private readonly redisService: RedisService,
    namespace = 'global',
  ) {
    this.prefix = `rl:${namespace}:`;
  }

  init(options: Options): void {
    this.windowMs = Number.isFinite(options.windowMs) ? Math.max(1000, Math.trunc(options.windowMs)) : 60_000;
    this.memoryFallback.init(options);
  }

  private toKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private warnFallback(reason: unknown): void {
    const now = Date.now();
    if (now - this.lastFallbackWarnAt < 30_000) return;
    this.lastFallbackWarnAt = now;
    const message = reason instanceof Error ? reason.message : String(reason);
    this.logger.warn(`Redis 限流存储异常，降级内存存储: ${message}`);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const redisKey = this.toKey(key);
    try {
      const client = this.redisService.getClient();
      const [rawCount, rawTtl] = (await client.eval(
        `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current <= 0 then
  return {0, -2}
end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`,
        1,
        redisKey,
      )) as [number | string, number | string];

      const totalHits = Number(rawCount);
      const ttlMs = Number(rawTtl);

      if (!Number.isFinite(totalHits) || totalHits <= 0 || !Number.isFinite(ttlMs) || ttlMs <= 0) {
        return undefined;
      }

      return {
        totalHits,
        resetTime: new Date(Date.now() + ttlMs),
      };
    } catch (error) {
      this.warnFallback(error);
      return await this.memoryFallback.get(key);
    }
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const redisKey = this.toKey(key);
    try {
      const client = this.redisService.getClient();
      const [rawCount, rawTtl] = (await client.eval(
        `
local counterKey = KEYS[1]
local windowMs = tonumber(ARGV[1])

local total = redis.call('INCR', counterKey)
if total == 1 then
  redis.call('PEXPIRE', counterKey, windowMs)
end

local ttl = redis.call('PTTL', counterKey)
if ttl < 0 then
  redis.call('PEXPIRE', counterKey, windowMs)
  ttl = windowMs
end

return {total, ttl}
`,
        1,
        redisKey,
        String(this.windowMs),
      )) as [number | string, number | string];

      const totalHits = Number(rawCount);
      const ttlMs = Math.max(0, Number(rawTtl));

      return {
        totalHits: Number.isFinite(totalHits) ? totalHits : 1,
        resetTime: new Date(Date.now() + ttlMs),
      };
    } catch (error) {
      this.warnFallback(error);
      return await this.memoryFallback.increment(key);
    }
  }

  async decrement(key: string): Promise<void> {
    const redisKey = this.toKey(key);
    try {
      await this.redisService.getClient().eval(
        `
local v = redis.call('DECR', KEYS[1])
if v <= 0 then
  redis.call('DEL', KEYS[1])
end
return v
`,
        1,
        redisKey,
      );
    } catch (error) {
      this.warnFallback(error);
      await this.memoryFallback.decrement(key);
    }
  }

  async resetKey(key: string): Promise<void> {
    const redisKey = this.toKey(key);
    try {
      await this.redisService.getClient().del(redisKey);
    } catch (error) {
      this.warnFallback(error);
      await this.memoryFallback.resetKey(key);
    }
  }

  async resetAll(): Promise<void> {
    try {
      await this.redisService.scanAndDeleteByMatch(`${this.prefix}*`);
    } catch (error) {
      this.warnFallback(error);
      await this.memoryFallback.resetAll();
    }
  }

  shutdown(): void {
    this.memoryFallback.shutdown();
  }
}
