import { Injectable, OnModuleInit } from '@nestjs/common';
import { RedisService } from 'src/module/common/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MarketingStockMode, Prisma } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { ResponseCode } from 'src/common/response/response.interface';

/**
 * 营销名额原子扣减 Lua 脚本
 * @description
 * 在 Redis 服务端执行原子操作，合并“读取库存、判断剩余、执行减法”三个动作。
 * 有效防止在秒杀、团购等高并发场景下出现的“超卖”现象。
 * 返回值说明：
 *   1  - 扣减成功：剩余库存足够并已执行减法
 *  -1  - 库存不足：当前剩余名额少于申请扣减的数量
 *  -2  - 缓存丢失：Redis 中不存在该 Key，需要触发懒加载同步
 */
const DECR_STOCK_LUA = `
    local key = KEYS[1]
    local amount = tonumber(ARGV[1])
    local current = redis.call('get', key)
    
    if not current then
        return -2
    end
    
    if tonumber(current) >= amount then
        redis.call('decrby', key, amount)
        return 1
    else
        return -1
    end
`;

/**
 * 营销名额引擎 (Marketing Quota Engine)
 *
 * @description
 * 统一管理所有营销活动的剩余名额。支持多种互斥策略以平衡性能与一致性：
 * 1. 强互斥 (STRONG_LOCK): 适用于限量实物，下单立即预扣，锁定名额，保障用户支付体验。
 * 2. 弱互斥 (LAZY_CHECK): 适用于服务资源，仅做参考校验，核心逻辑在支付回调流转中完成。
 */
@Injectable()
export class MarketingStockService implements OnModuleInit {
  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /** 模块启动时向 Redis 客户端注册 mktDecrStock Lua 指令，供后续原子扣减调用 */
  onModuleInit() {
    this.redisService.getClient().defineCommand('mktDecrStock', {
      numberOfKeys: 1,
      lua: DECR_STOCK_LUA,
    });
  }

  /**
   * 获取营销名额缓存 Key
   */
  private getQuotaKey(configId: string): string {
    return `mkt:stock:${configId}`;
  }

  /**
   * 初始化营销名额到缓存 (通常在活动上线或管理端修改配置后调用)
   * @param configId 配置ID
   * @param quota 指定名额数量
   */
  async initQuota(configId: string, quota: number) {
    const key = this.getQuotaKey(configId);
    await this.redisService.set(key, quota);
  }

  /**
   * @deprecated 营销域请使用 initQuota；保留旧方法名兼容既有调用。
   */
  async initStock(configId: string, stock: number) {
    await this.initQuota(configId, stock);
  }

  /**
   * 原子预占营销名额
   *
   * @param configId 营销配置ID (对应 StorePlayConfig)
   * @param amount 扣减数量
   * @param mode 名额模式 (STRONG_LOCK/LAZY_CHECK)
   */
  async reserveQuota(configId: string, amount: number, mode: MarketingStockMode): Promise<boolean> {
    // 弱校验模式，直接放行，依靠后续流程保障
    if (mode === MarketingStockMode.LAZY_CHECK) {
      return true;
    }

    const key = this.getQuotaKey(configId);

    // 调用预注册的 Lua 脚本执行原子扣减
    const result = await (this.redisService.getClient() as any).mktDecrStock(key, amount);

    if (result === 1) {
      return true;
    }

    if (result === -2) {
      // 缓存失效补偿：懒加载从数据库同步名额到 Redis，然后重试一次
      await this.syncFromDb(configId);
      const retryResult = await (this.redisService.getClient() as any).mktDecrStock(key, amount);
      return retryResult === 1;
    }

    if (result === -1) {
      // 库存不足，抛出业务异常，由全局异常过滤器返回给前端
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, '当前活动参与人数过多，名额已抢光！');
    }

    return false;
  }

  /**
   * @deprecated 营销域请使用 reserveQuota；保留旧方法名兼容既有调用。
   */
  async decrement(configId: string, amount: number, mode: MarketingStockMode): Promise<boolean> {
    return this.reserveQuota(configId, amount, mode);
  }

  /**
   * 归还营销名额 (适用于订单取消、超时、退款等场景)
   */
  async releaseQuota(configId: string, amount: number) {
    const key = this.getQuotaKey(configId);
    const exists = await this.redisService.get(key);
    // 仅当缓存存在时才归还，防止冷数据归还导致库存虚增
    if (exists !== null) {
      await this.redisService.getClient().incrby(key, amount);
    }
  }

  /**
   * @deprecated 营销域请使用 releaseQuota；保留旧方法名兼容既有调用。
   */
  async increment(configId: string, amount: number) {
    await this.releaseQuota(configId, amount);
  }

  /**
   * 从数据库同步名额状态 (灾备方案)
   * @description 用于在缓存丢失时恢复最新的名额数据
   */
  private async syncFromDb(configId: string) {
    const config = await this.prisma.storePlayConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('storePlayConfig', {
        id: configId,
      }) as Prisma.StorePlayConfigWhereInput,
    });

    if (!config) {
      throw new BusinessException(ResponseCode.DATA_NOT_FOUND, '未找到关联的营销配置信息');
    }

    // 解析配置中的规则 JSON，提取名额字段；历史规则字段仍叫 stock，不能在本批改 schema。
    const stock = (config.rules as any)?.stock ?? 0;
    await this.initQuota(configId, stock);
  }
}
