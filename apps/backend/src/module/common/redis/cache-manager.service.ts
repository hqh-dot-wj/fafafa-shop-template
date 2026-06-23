import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from 'src/module/common/redis/redis.service';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheEnum, DelFlagEnum, StatusEnum } from 'src/common/enum/index';
import { TenantHelper } from 'src/common/tenant/tenant.helper';

/** 空值占位符，用于缓存穿透保护 */
const NULL_PLACEHOLDER = '__NULL__';

/** 空值缓存 TTL（秒），较短以便快速恢复 */
const NULL_CACHE_TTL = 60;
/** 未抢到锁时的轮询次数，避免热点 key 过期瞬间全部回源 */
const LOCK_WAIT_RETRY_TIMES = 20;
/** 未抢到锁时的轮询间隔（毫秒） */
const LOCK_WAIT_INTERVAL_MS = 50;

/**
 * 缓存预热配置
 */
interface CacheWarmupConfig {
  /** 缓存键前缀 */
  keyPrefix: string;
  /** 过期时间（秒） */
  ttl: number;
  /** 是否在启动时预热 */
  warmOnStart?: boolean;
  /** 预热数据获取函数 */
  fetcher: () => Promise<Map<string, unknown>>;
}

/**
 * 缓存获取选项
 */
interface CacheGetOptions<T> {
  /** 缓存未命中时的数据获取函数 */
  fetcher: () => Promise<T | null>;
  /** 缓存 TTL（秒） */
  ttl: number;
  /** 是否启用空值缓存（防穿透），默认 true */
  cacheNull?: boolean;
}

/**
 * 缓存管理服务
 *
 * @description 统一管理缓存策略，包括：
 * - 缓存预热
 * - 缓存失效
 * - 防雪崩（随机过期偏移）
 * - 防穿透（空值缓存）
 * - 防击穿（互斥锁）
 * - 批量操作
 */
@Injectable()
export class CacheManagerService implements OnModuleInit {
  private readonly logger = new Logger(CacheManagerService.name);

  /** 随机过期时间偏移范围（毫秒） */
  private readonly JITTER_RANGE_MS = 5 * 60 * 1000; // 5分钟

  /** 缓存预热配置 */
  private warmupConfigs: Map<string, CacheWarmupConfig> = new Map();

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {
    this.registerWarmupConfigs();
  }

  /**
   * 模块初始化时执行缓存预热
   */
  async onModuleInit() {
    this.logger.log('Starting cache warmup...');
    await this.warmupAll();
    this.logger.log('Cache warmup completed');
  }

  /**
   * 注册缓存预热配置
   */
  private registerWarmupConfigs() {
    // 字典缓存预热
    this.warmupConfigs.set('dict', {
      keyPrefix: CacheEnum.SYS_DICT_KEY,
      ttl: 86400, // 24小时
      warmOnStart: true,
      fetcher: async () => {
        const dictTypes = await this.prisma.sysDictType.findMany({
          where: this.tenantHelper.readWhereForDelegate('sysDictType', {
            status: StatusEnum.NORMAL,
            delFlag: DelFlagEnum.NORMAL,
          }) as Prisma.SysDictTypeWhereInput,
          select: { dictType: true },
        });

        const result = new Map<string, unknown>();
        for (const type of dictTypes) {
          const data = await this.prisma.sysDictData.findMany({
            where: this.tenantHelper.readWhereForDelegate('sysDictData', {
              dictType: type.dictType,
              status: StatusEnum.NORMAL,
            }) as Prisma.SysDictDataWhereInput,
            orderBy: { dictSort: 'asc' },
          });
          result.set(type.dictType, data);
        }
        return result;
      },
    });

    // 系统配置缓存预热
    this.warmupConfigs.set('config', {
      keyPrefix: CacheEnum.SYS_CONFIG_KEY,
      ttl: 3600, // 1小时
      warmOnStart: true,
      fetcher: async () => {
        const configs = await this.prisma.sysConfig.findMany({
          where: this.tenantHelper.readWhereForDelegate('sysConfig', {
            status: StatusEnum.NORMAL,
            delFlag: DelFlagEnum.NORMAL,
          }) as Prisma.SysConfigWhereInput,
        });

        const result = new Map<string, unknown>();
        for (const config of configs) {
          result.set(config.configKey, config.configValue);
        }
        return result;
      },
    });
  }

  /**
   * 预热所有配置的缓存
   */
  async warmupAll() {
    for (const [name, config] of this.warmupConfigs) {
      if (config.warmOnStart) {
        try {
          await this.warmup(name);
        } catch (error) {
          this.logger.error(`Failed to warmup cache: ${name}`, error);
        }
      }
    }
  }

  /**
   * 预热指定缓存
   */
  async warmup(name: string) {
    const config = this.warmupConfigs.get(name);
    if (!config) {
      this.logger.warn(`Cache config not found: ${name}`);
      return;
    }

    this.logger.log(`Warming up cache: ${name}`);
    const data = await config.fetcher();

    for (const [key, value] of data) {
      const ttlMs = this.addJitter(config.ttl * 1000);
      await this.redis.set(`${config.keyPrefix}${key}`, value, ttlMs);
    }

    this.logger.log(`Warmed up ${data.size} entries for: ${name}`);
  }

  /**
   * 添加随机过期偏移（防雪崩）
   */
  private addJitter(baseTtlMs: number): number {
    const jitterMs = Math.floor(Math.random() * this.JITTER_RANGE_MS);
    return baseTtlMs + jitterMs;
  }

  /**
   * 设置缓存（带随机偏移）
   */
  async set(key: string, value: unknown, ttlMs: number) {
    const finalTtlMs = this.addJitter(ttlMs);
    await this.redis.set(key, value, finalTtlMs);
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    return this.redis.get(key);
  }

  /**
   * 删除缓存
   */
  async del(key: string) {
    await this.redis.del(key);
  }

  /**
   * 批量删除缓存（按前缀）
   */
  async delByPrefix(prefix: string) {
    const deletedCount = await this.redis.scanAndDeleteByMatch(`${prefix}*`);
    if (deletedCount > 0) {
      this.logger.log(`Deleted ${deletedCount} cache entries with prefix: ${prefix}`);
    }
  }

  /**
   * 刷新指定缓存分类
   */
  async refresh(name: string) {
    const config = this.warmupConfigs.get(name);
    if (!config) {
      this.logger.warn(`Cache config not found: ${name}`);
      return;
    }

    // 先删除旧缓存
    await this.delByPrefix(config.keyPrefix);
    // 重新预热
    await this.warmup(name);
  }

  /**
   * 获取缓存统计信息
   */
  async getStats() {
    const stats: Record<string, { count: number }> = {};

    for (const [name, config] of this.warmupConfigs) {
      stats[name] = { count: await this.countByPattern(`${config.keyPrefix}*`) };
    }

    return stats;
  }

  /**
   * 带穿透保护的缓存获取（推荐使用）
   * @param key 缓存键
   * @param options 缓存选项
   * @returns 缓存值或 null
   * @description
   * - 缓存命中：直接返回
   * - 缓存未命中：调用 fetcher 获取数据
   * - fetcher 返回 null：缓存空值占位符，防止穿透
   * - 空值占位符 TTL 较短（60秒），便于数据恢复后快速生效
   */
  async getOrSet<T>(key: string, options: CacheGetOptions<T>): Promise<T | null> {
    const { fetcher, ttl, cacheNull = true } = options;

    // 尝试从缓存获取
    const cached = await this.redis.get(key);

    // 命中空值占位符，返回 null（防穿透）
    if (cached === NULL_PLACEHOLDER) {
      return null;
    }

    // 命中有效缓存
    if (cached !== null) {
      return cached as T;
    }

    // 缓存未命中，调用 fetcher
    const data = await fetcher();

    if (data !== null) {
      // 有数据，缓存并返回
      await this.set(key, data, ttl * 1000);
      return data;
    }

    // 数据为空，缓存空值占位符（防穿透）
    if (cacheNull) {
      await this.redis.set(key, NULL_PLACEHOLDER, NULL_CACHE_TTL * 1000);
    }

    return null;
  }

  /**
   * 带击穿保护的缓存获取（热点数据推荐）
   * @param key 缓存键
   * @param options 缓存选项
   * @returns 缓存值或 null
   * @description
   * - 使用互斥锁防止缓存击穿
   * - 热点 Key 过期时，只有一个请求去查询数据库
   * - 其他请求等待或返回旧数据
   */
  async getOrSetWithLock<T>(key: string, options: CacheGetOptions<T>): Promise<T | null> {
    const { fetcher, ttl, cacheNull = true } = options;

    // 尝试从缓存获取
    const cached = await this.redis.get(key);

    if (cached === NULL_PLACEHOLDER) {
      return null;
    }

    if (cached !== null) {
      return cached as T;
    }

    // 缓存未命中，尝试获取互斥锁
    const lockKey = `lock:cache:${key}`;
    let token = await this.redis.tryLock(lockKey, 10000); // 10秒锁超时

    if (!token) {
      // 未获取到锁：短暂轮询等待持锁请求回填，避免并发回源
      for (let i = 0; i < LOCK_WAIT_RETRY_TIMES; i++) {
        await this.sleep(LOCK_WAIT_INTERVAL_MS);
        const retryCache = await this.redis.get(key);
        if (retryCache === NULL_PLACEHOLDER) {
          return null;
        }
        if (retryCache !== null) {
          return retryCache as T;
        }

        token = await this.redis.tryLock(lockKey, 10000);
        if (token) {
          break;
        }
      }

      // 长时间未拿到锁且缓存仍未回填，兜底回源一次并回填，避免直接返回 null 触发上层再回源
      if (!token) {
        return await this.loadAndCacheDirectly(key, fetcher, ttl, cacheNull);
      }
    }

    try {
      // 双重检查：获取锁后再次检查缓存
      const doubleCheck = await this.redis.get(key);
      if (doubleCheck !== null && doubleCheck !== NULL_PLACEHOLDER) {
        return doubleCheck as T;
      }

      // 查询数据
      const data = await fetcher();

      if (data !== null) {
        await this.set(key, data, ttl * 1000);
        return data;
      }

      if (cacheNull) {
        await this.redis.set(key, NULL_PLACEHOLDER, NULL_CACHE_TTL * 1000);
      }

      return null;
    } finally {
      if (token) {
        await this.redis.unlock(lockKey, token);
      }
    }
  }

  /**
   * 兜底直查并回填缓存（用于长时间抢不到锁的场景）
   */
  private async loadAndCacheDirectly<T>(
    key: string,
    fetcher: () => Promise<T | null>,
    ttl: number,
    cacheNull: boolean,
  ): Promise<T | null> {
    const data = await fetcher();

    if (data !== null) {
      await this.set(key, data, ttl * 1000);
      return data;
    }

    if (cacheNull) {
      await this.redis.set(key, NULL_PLACEHOLDER, NULL_CACHE_TTL * 1000);
    }

    return null;
  }

  /**
   * 休眠指定毫秒
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 按模式统计 Key 数量（使用 SCAN 避免 KEYS 阻塞）
   */
  private async countByPattern(pattern: string): Promise<number> {
    const client = this.redis.getClient();
    let cursor = '0';
    let count = 0;

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = nextCursor;
      count += keys.length;
    } while (cursor !== '0');

    return count;
  }
}
