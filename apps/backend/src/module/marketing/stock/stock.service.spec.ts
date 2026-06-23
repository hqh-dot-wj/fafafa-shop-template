import { Test, TestingModule } from '@nestjs/testing';
import { MarketingStockService } from './stock.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { MarketingStockMode } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions/business.exception';

describe('MarketingStockService', () => {
  let service: MarketingStockService;

  const mockRedisClient = {
    defineCommand: jest.fn(),
    mktDecrStock: jest.fn(),
    incrby: jest.fn(),
    get: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn(() => mockRedisClient),
    set: jest.fn(),
    get: jest.fn(),
  };

  const mockPrisma = {
    storePlayConfig: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingStockService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: PrismaService, useValue: mockPrisma },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    service = module.get<MarketingStockService>(MarketingStockService);
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('Given 模块初始化, When onModuleInit, Then 注册 Lua 脚本', () => {
      service.onModuleInit();

      expect(mockRedisClient.defineCommand).toHaveBeenCalledWith('mktDecrStock', {
        numberOfKeys: 1,
        lua: expect.stringContaining('local key = KEYS[1]'),
      });
    });
  });

  describe('initQuota', () => {
    it('Given configId 和 quota, When initQuota, Then 设置 Redis 缓存', async () => {
      await service.initQuota('config1', 100);

      expect(mockRedisService.set).toHaveBeenCalledWith('mkt:stock:config1', 100);
    });
  });

  describe('reserveQuota - LAZY_CHECK 模式', () => {
    it('Given LAZY_CHECK 模式, When reserveQuota, Then 直接返回 true 不扣减', async () => {
      const result = await service.reserveQuota('config1', 1, MarketingStockMode.LAZY_CHECK);

      expect(result).toBe(true);
      expect(mockRedisClient.mktDecrStock).not.toHaveBeenCalled();
    });
  });

  describe('reserveQuota - STRONG_LOCK 模式', () => {
    it('Given 名额充足(result=1), When reserveQuota, Then 返回 true', async () => {
      mockRedisClient.mktDecrStock.mockResolvedValue(1);

      const result = await service.reserveQuota('config1', 1, MarketingStockMode.STRONG_LOCK);

      expect(result).toBe(true);
      expect(mockRedisClient.mktDecrStock).toHaveBeenCalledWith('mkt:stock:config1', 1);
    });

    it('Given 名额不足(result=-1), When reserveQuota, Then 抛出名额不足异常', async () => {
      mockRedisClient.mktDecrStock.mockResolvedValue(-1);

      await expect(service.reserveQuota('config1', 1, MarketingStockMode.STRONG_LOCK)).rejects.toThrow(BusinessException);
    });

    it('Given 缓存丢失且重试成功(result=-2 then 1), When reserveQuota, Then 从 DB 同步后返回 true', async () => {
      mockRedisClient.mktDecrStock.mockResolvedValueOnce(-2).mockResolvedValueOnce(1);

      mockPrisma.storePlayConfig.findFirst.mockResolvedValue({
        id: 'config1',
        rules: { stock: 50 },
      });

      const result = await service.reserveQuota('config1', 1, MarketingStockMode.STRONG_LOCK);

      expect(result).toBe(true);
      expect(mockRedisService.set).toHaveBeenCalledWith('mkt:stock:config1', 50);
      expect(mockRedisClient.mktDecrStock).toHaveBeenCalledTimes(2);
    });

    it('Given 缓存丢失且重试仍失败(result=-2 then -1), When reserveQuota, Then 返回 false', async () => {
      mockRedisClient.mktDecrStock.mockResolvedValueOnce(-2).mockResolvedValueOnce(-1);

      mockPrisma.storePlayConfig.findFirst.mockResolvedValue({
        id: 'config1',
        rules: { stock: 0 },
      });

      const result = await service.reserveQuota('config1', 1, MarketingStockMode.STRONG_LOCK);
      expect(result).toBe(false);
    });

    it('Given 缓存丢失且 DB 无配置, When reserveQuota, Then 抛出配置不存在异常', async () => {
      mockRedisClient.mktDecrStock.mockResolvedValue(-2);
      mockPrisma.storePlayConfig.findFirst.mockResolvedValue(null);

      await expect(service.reserveQuota('config1', 1, MarketingStockMode.STRONG_LOCK)).rejects.toThrow(BusinessException);
    });

    it('Given 缓存丢失且 DB 配置无 stock 字段, When reserveQuota, Then 使用默认值 0 并返回 false', async () => {
      mockRedisClient.mktDecrStock.mockResolvedValueOnce(-2).mockResolvedValueOnce(-1);

      mockPrisma.storePlayConfig.findFirst.mockResolvedValue({
        id: 'config1',
        rules: {},
      });

      const result = await service.reserveQuota('config1', 1, MarketingStockMode.STRONG_LOCK);
      expect(result).toBe(false);

      expect(mockRedisService.set).toHaveBeenCalledWith('mkt:stock:config1', 0);
    });
  });

  describe('releaseQuota', () => {
    it('Given 缓存存在, When releaseQuota, Then 归还名额', async () => {
      mockRedisService.get.mockResolvedValue('50');

      await service.releaseQuota('config1', 1);

      expect(mockRedisClient.incrby).toHaveBeenCalledWith('mkt:stock:config1', 1);
    });

    it('Given 缓存不存在, When releaseQuota, Then 不执行归还（防止虚增）', async () => {
      mockRedisService.get.mockResolvedValue(null);

      await service.releaseQuota('config1', 1);

      expect(mockRedisClient.incrby).not.toHaveBeenCalled();
    });

    it('Given 归还多个名额, When releaseQuota, Then 正确增加数量', async () => {
      mockRedisService.get.mockResolvedValue('10');

      await service.releaseQuota('config1', 5);

      expect(mockRedisClient.incrby).toHaveBeenCalledWith('mkt:stock:config1', 5);
    });
  });
});
