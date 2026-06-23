import { Test, TestingModule } from '@nestjs/testing';
import { RedisLockService } from './redis-lock.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { BusinessException } from 'src/common/exceptions';

describe('RedisLockService', () => {
  let service: RedisLockService;

  const mockRedisService = {
    tryLock: jest.fn(),
    unlock: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisLockService, { provide: RedisService, useValue: mockRedisService }],
    }).compile();

    service = module.get<RedisLockService>(RedisLockService);
    jest.clearAllMocks();
  });

  describe('executeWithLock', () => {
    it('Given 获取锁成功, When executeWithLock, Then 执行回调并释放锁', async () => {
      mockRedisService.tryLock.mockResolvedValue('token-123');
      const callback = jest.fn().mockResolvedValue('result');

      const result = await service.executeWithLock('lock:test', callback);

      expect(result).toBe('result');
      expect(callback).toHaveBeenCalled();
      expect(mockRedisService.unlock).toHaveBeenCalledWith('lock:test', 'token-123');
    });

    it('Given 获取锁失败(重试耗尽), When executeWithLock, Then 抛出异常', async () => {
      mockRedisService.tryLock.mockResolvedValue(null);

      await expect(service.executeWithLock('lock:test', jest.fn(), 10000, 2, 10)).rejects.toThrow(BusinessException);

      expect(mockRedisService.tryLock).toHaveBeenCalledTimes(2);
    });

    it('Given 第二次重试获取锁成功, When executeWithLock, Then 执行回调', async () => {
      mockRedisService.tryLock.mockResolvedValueOnce(null).mockResolvedValueOnce('token-456');
      const callback = jest.fn().mockResolvedValue('ok');

      const result = await service.executeWithLock('lock:test', callback, 10000, 3, 10);

      expect(result).toBe('ok');
      expect(mockRedisService.tryLock).toHaveBeenCalledTimes(2);
    });

    it('Given 回调抛异常, When executeWithLock, Then 仍然释放锁', async () => {
      mockRedisService.tryLock.mockResolvedValue('token-789');
      const callback = jest.fn().mockRejectedValue(new Error('callback error'));

      await expect(service.executeWithLock('lock:test', callback)).rejects.toThrow('callback error');

      expect(mockRedisService.unlock).toHaveBeenCalledWith('lock:test', 'token-789');
    });
  });

  describe('getCouponStockLockKey', () => {
    it('Given templateId, When getCouponStockLockKey, Then 返回正确的锁键', () => {
      expect(service.getCouponStockLockKey('t1')).toBe('lock:coupon:stock:t1');
    });
  });

  describe('getUserClaimLockKey', () => {
    it('Given memberId 和 templateId, When getUserClaimLockKey, Then 返回正确的锁键', () => {
      expect(service.getUserClaimLockKey('m1', 't1')).toBe('lock:coupon:claim:m1:t1');
    });
  });

  describe('tryLock', () => {
    it('Given 锁可用, When tryLock, Then 返回 token', async () => {
      mockRedisService.tryLock.mockResolvedValue('token-abc');

      const result = await service.tryLock('lock:test', 5000);

      expect(result).toBe('token-abc');
      expect(mockRedisService.tryLock).toHaveBeenCalledWith('lock:test', 5000);
    });

    it('Given 锁已被占用, When tryLock, Then 返回 null', async () => {
      mockRedisService.tryLock.mockResolvedValue(null);

      const result = await service.tryLock('lock:test');

      expect(result).toBeNull();
    });
  });

  describe('unlock', () => {
    it('Given 有效 token, When unlock, Then 调用 redis unlock', async () => {
      await service.unlock('lock:test', 'token-abc');

      expect(mockRedisService.unlock).toHaveBeenCalledWith('lock:test', 'token-abc');
    });
  });
});
