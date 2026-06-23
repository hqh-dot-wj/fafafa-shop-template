import { Logger } from '@nestjs/common';
import { OrderOutboxMetricsService } from './order-outbox-metrics.service';

describe('OrderOutboxMetricsService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  };
  const redis = {
    tryLock: jest.fn(),
    unlock: jest.fn(),
  };
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let service: OrderOutboxMetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    // 默认 lock 拿到，让既有行为用例不受 leader-only 改造影响
    redis.tryLock.mockResolvedValue('mock-token');
    redis.unlock.mockResolvedValue(1);
    service = new OrderOutboxMetricsService(prisma as never, redis as never);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('invariants', () => {
    it('returns zero metrics when query returns no rows', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.collect();

      expect(result).toEqual({ pendingCount: 0n, failedCount: 0n, maxPendingAgeSeconds: null });
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('logs error when failed outbox rows exist (requires manual replay)', async () => {
      prisma.$queryRaw.mockResolvedValue([{ pendingCount: 1n, failedCount: 2n, maxPendingAgeSeconds: 10 }]);

      await service.collect();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Order outbox has FAILED rows; manual replay required',
          pendingCount: '1',
          failedCount: '2',
          maxPendingAgeSeconds: 10,
        }),
      );
    });
  });

  describe('boundary conditions', () => {
    it('logs backlog warning when max pending age exceeds threshold without failed rows', async () => {
      prisma.$queryRaw.mockResolvedValue([{ pendingCount: 1n, failedCount: 0n, maxPendingAgeSeconds: 61 }]);

      await service.collect();

      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Order outbox backlog detected' }));
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  // C1: 多实例场景下只有抢到锁的 leader 才查全表，避免每实例 30 秒一次的 N 倍开销
  describe('distributed lock (leader-only collection)', () => {
    it('skips Prisma query when lock is held by another instance', async () => {
      redis.tryLock.mockResolvedValueOnce(null);

      const result = await service.collect();

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(redis.unlock).not.toHaveBeenCalled();
      // 跳过本轮时返回零值，避免 caller 误以为无数据
      expect(result).toEqual({ pendingCount: 0n, failedCount: 0n, maxPendingAgeSeconds: null });
    });

    it('acquires lock with expected key and ttl, releases with same token', async () => {
      redis.tryLock.mockResolvedValueOnce('uuid-a');
      prisma.$queryRaw.mockResolvedValue([]);

      await service.collect();

      const [keyArg, ttlArg] = redis.tryLock.mock.calls[0];
      expect(typeof keyArg).toBe('string');
      expect(keyArg.length).toBeGreaterThan(0);
      expect(typeof ttlArg).toBe('number');
      // TTL 必须 < cron 间隔（30s），避免上一轮卡住时连环阻塞；至少 10s 保证慢查询能跑完
      expect(ttlArg).toBeGreaterThanOrEqual(10_000);
      expect(ttlArg).toBeLessThan(30_000);

      expect(redis.unlock).toHaveBeenCalledTimes(1);
      expect(redis.unlock.mock.calls[0][0]).toBe(keyArg);
      expect(redis.unlock.mock.calls[0][1]).toBe('uuid-a');
    });

    it('still releases lock when Prisma query throws', async () => {
      redis.tryLock.mockResolvedValueOnce('uuid-b');
      prisma.$queryRaw.mockRejectedValue(new Error('db down'));

      await expect(service.collect()).rejects.toThrow('db down');

      expect(redis.unlock).toHaveBeenCalledTimes(1);
      expect(redis.unlock.mock.calls[0][1]).toBe('uuid-b');
    });
  });
});
