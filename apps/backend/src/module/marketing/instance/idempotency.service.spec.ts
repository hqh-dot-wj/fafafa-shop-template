import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyService } from './idempotency.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { BusinessException } from 'src/common/exceptions/business.exception';

/**
 * 幂等性保障服务单元测试
 *
 * @description
 * 测试幂等性服务的核心功能：
 * - 参与活动幂等性（缓存和读取）
 * - 支付回调幂等性（标记和检查）
 * - 状态变更分布式锁（获取和释放）
 * - 并发场景处理
 *
 * @验证需求 FR-5.1, FR-5.2, FR-5.3, US-3
 */
describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let mockRedisSvc: { get: jest.Mock; set: jest.Mock; getClient: jest.Mock };
  let mockRedisClient: { set: jest.Mock; eval: jest.Mock; keys: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    mockRedisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
      del: jest.fn().mockResolvedValue(1),
    };
    mockRedisSvc = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: RedisService,
          useValue: mockRedisSvc,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkJoinIdempotency - 检查参与幂等性', () => {
    it('应该在缓存不存在时返回 null', async () => {
      mockRedisSvc.get.mockResolvedValue(null);

      const result = await service.checkJoinIdempotency('config-123', 'member-456');

      expect(result).toBeNull();
      expect(mockRedisSvc.get).toHaveBeenCalledWith('idempotency:join:config-123:member-456');
    });

    it('应该在缓存存在时返回缓存结果', async () => {
      const cachedResult = {
        instanceId: 'instance-789',
        status: 'PENDING_PAY',
      };
      mockRedisSvc.get.mockResolvedValue(cachedResult);

      const result = await service.checkJoinIdempotency('config-123', 'member-456');

      expect(result).toEqual(cachedResult);
      expect(mockRedisSvc.get).toHaveBeenCalledWith('idempotency:join:config-123:member-456');
    });

    it('应该支持带 groupId 的幂等键', async () => {
      mockRedisSvc.get.mockResolvedValue(null);

      await service.checkJoinIdempotency('config-123', 'member-456', {
        groupId: 'group-999',
      });

      expect(mockRedisSvc.get).toHaveBeenCalledWith('idempotency:join:config-123:member-456:group-999');
    });

    it('应该处理 JSON 解析错误', async () => {
      mockRedisSvc.get.mockResolvedValue('invalid-json');

      const result = await service.checkJoinIdempotency('config-123', 'member-456');

      expect(result).toBeNull();
    });

    it('应该处理 Redis 错误', async () => {
      mockRedisSvc.get.mockRejectedValue(new Error('Redis connection failed'));

      await expect(service.checkJoinIdempotency('config-123', 'member-456')).rejects.toThrow('Redis connection failed');
    });
  });

  describe('cacheJoinResult - 缓存参与结果', () => {
    it('应该成功缓存参与结果（5分钟）', async () => {
      const result = {
        instanceId: 'instance-789',
        status: 'PENDING_PAY',
      };

      await service.cacheJoinResult('config-123', 'member-456', {}, result);

      expect(mockRedisSvc.set).toHaveBeenCalledWith(
        'idempotency:join:config-123:member-456',
        JSON.stringify(result),
        300_000,
      );
    });

    it('应该支持带 groupId 的缓存键', async () => {
      const result = { instanceId: 'instance-789' };

      await service.cacheJoinResult('config-123', 'member-456', { groupId: 'group-999' }, result);

      expect(mockRedisSvc.set).toHaveBeenCalledWith(
        'idempotency:join:config-123:member-456:group-999',
        JSON.stringify(result),
        300_000,
      );
    });

    it('应该处理 Redis 错误', async () => {
      mockRedisSvc.set.mockRejectedValue(new Error('Redis write failed'));

      await expect(service.cacheJoinResult('config-123', 'member-456', {}, {})).rejects.toThrow('Redis write failed');
    });
  });

  describe('checkPaymentIdempotency - 检查支付幂等性', () => {
    it('应该在未处理时返回 false', async () => {
      mockRedisSvc.get.mockResolvedValue(null);

      const result = await service.checkPaymentIdempotency('order-123');

      expect(result).toBe(false);
      expect(mockRedisSvc.get).toHaveBeenCalledWith('idempotency:payment:order-123');
    });

    it('应该在已处理时返回 true', async () => {
      mockRedisSvc.get.mockResolvedValue('1');

      const result = await service.checkPaymentIdempotency('order-123');

      expect(result).toBe(true);
      expect(mockRedisSvc.get).toHaveBeenCalledWith('idempotency:payment:order-123');
    });

    it('应该处理 Redis 错误', async () => {
      mockRedisSvc.get.mockRejectedValue(new Error('Redis connection failed'));

      await expect(service.checkPaymentIdempotency('order-123')).rejects.toThrow('Redis connection failed');
    });
  });

  describe('markPaymentProcessed - 标记支付已处理', () => {
    it('应该成功标记支付已处理（10分钟）', async () => {
      await service.markPaymentProcessed('order-123');

      expect(mockRedisSvc.set).toHaveBeenCalledWith('idempotency:payment:order-123', '1', 600_000);
    });

    it('应该处理 Redis 错误', async () => {
      mockRedisSvc.set.mockRejectedValue(new Error('Redis write failed'));

      await expect(service.markPaymentProcessed('order-123')).rejects.toThrow('Redis write failed');
    });
  });

  describe('withStateLock - 状态变更分布式锁', () => {
    it('应该成功获取锁并执行回调', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.eval.mockResolvedValue(1);

      const callback = jest.fn().mockResolvedValue('success');

      const result = await service.withStateLock('instance-123', callback);

      expect(result).toBe('success');
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'idempotency:state:instance-123',
        expect.any(String),
        'PX',
        5000,
        'NX',
      );
      expect(callback).toHaveBeenCalled();
      expect(mockRedisClient.eval).toHaveBeenCalled();
    });

    it('应该在获取锁失败时抛出异常', async () => {
      mockRedisClient.set.mockResolvedValue(null);

      const callback = jest.fn();

      await expect(service.withStateLock('instance-123', callback)).rejects.toBeInstanceOf(BusinessException);

      expect(callback).not.toHaveBeenCalled();
    });

    it('应该支持自定义超时时间', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.eval.mockResolvedValue(1);

      const callback = jest.fn().mockResolvedValue('success');

      await service.withStateLock('instance-123', callback, 10000);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'idempotency:state:instance-123',
        expect.any(String),
        'PX',
        10000, // 自定义超时
        'NX',
      );
    });

    it('应该在回调执行后释放锁', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.eval.mockResolvedValue(1);

      const callback = jest.fn().mockResolvedValue('success');

      await service.withStateLock('instance-123', callback);

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("get", KEYS[1])'),
        1,
        'idempotency:state:instance-123',
        expect.any(String),
      );
    });

    it('应该在回调抛出异常时仍然释放锁', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.eval.mockResolvedValue(1);

      const callback = jest.fn().mockRejectedValue(new Error('Callback error'));

      await expect(service.withStateLock('instance-123', callback)).rejects.toThrow('Callback error');

      expect(mockRedisClient.eval).toHaveBeenCalled();
    });

    it('应该处理 Redis 错误', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis connection failed'));

      const callback = jest.fn();

      await expect(service.withStateLock('instance-123', callback)).rejects.toThrow('Redis connection failed');
    });
  });

  describe('withTeamLock - 团队级分布式锁', () => {
    it('应该成功获取团队锁并执行回调', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.eval.mockResolvedValue(1);

      const callback = jest.fn().mockResolvedValue('team-success');

      const result = await service.withTeamLock('team-123', callback);

      expect(result).toBe('team-success');
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'idempotency:team:team-123',
        expect.any(String),
        'PX',
        10000,
        'NX',
      );
      expect(callback).toHaveBeenCalled();
      expect(mockRedisClient.eval).toHaveBeenCalled();
    });

    it('应该在团队锁已被占用时抛出业务异常', async () => {
      mockRedisClient.set.mockResolvedValue(null);

      const callback = jest.fn();

      await expect(service.withTeamLock('team-123', callback)).rejects.toBeInstanceOf(BusinessException);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('并发场景测试', () => {
    it('应该防止并发参与同一活动', async () => {
      const result = { instanceId: 'instance-789' };

      mockRedisSvc.get.mockResolvedValueOnce(null);
      mockRedisSvc.get.mockResolvedValueOnce(result);

      const result1 = await service.checkJoinIdempotency('config-123', 'member-456');
      expect(result1).toBeNull();

      await service.cacheJoinResult('config-123', 'member-456', {}, result);

      const result2 = await service.checkJoinIdempotency('config-123', 'member-456');
      expect(result2).toEqual(result);
    });

    it('应该防止并发支付回调', async () => {
      mockRedisSvc.get.mockResolvedValueOnce(null);
      mockRedisSvc.get.mockResolvedValueOnce('1');

      const processed1 = await service.checkPaymentIdempotency('order-123');
      expect(processed1).toBe(false);

      await service.markPaymentProcessed('order-123');

      const processed2 = await service.checkPaymentIdempotency('order-123');
      expect(processed2).toBe(true);
    });

    it('应该防止并发状态变更', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      mockRedisClient.eval.mockResolvedValue(1);
      mockRedisClient.set.mockResolvedValueOnce(null);

      const callback1 = jest.fn().mockResolvedValue('success1');
      const callback2 = jest.fn().mockResolvedValue('success2');

      const promise1 = service.withStateLock('instance-123', callback1);
      const promise2 = service.withStateLock('instance-123', callback2);

      await expect(promise1).resolves.toBe('success1');
      await expect(promise2).rejects.toBeInstanceOf(BusinessException);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('边界情况测试', () => {
    it('应该处理空字符串参数', async () => {
      mockRedisSvc.get.mockResolvedValue(null);

      await expect(service.checkJoinIdempotency('', '')).resolves.toBeNull();
    });

    it('应该处理特殊字符参数', async () => {
      mockRedisSvc.get.mockResolvedValue(null);

      await expect(service.checkJoinIdempotency('config:123', 'member@456')).resolves.toBeNull();

      expect(mockRedisSvc.get).toHaveBeenCalledWith('idempotency:join:config:123:member@456');
    });

    it('应该处理超长参数', async () => {
      const longId = 'a'.repeat(1000);
      mockRedisSvc.get.mockResolvedValue(null);

      await expect(service.checkJoinIdempotency(longId, longId)).resolves.toBeNull();
    });

    it('应该处理 null 回调', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.eval.mockResolvedValue(1);

      await expect(service.withStateLock('instance-123', null as any)).rejects.toThrow();
    });

    it('应该处理 undefined 回调', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.eval.mockResolvedValue(1);

      await expect(service.withStateLock('instance-123', undefined as any)).rejects.toThrow();
    });
  });

  describe('性能测试', () => {
    it('幂等性检查应该在 50ms 内完成', async () => {
      mockRedisSvc.get.mockResolvedValue(null);

      const startTime = Date.now();
      await service.checkJoinIdempotency('config-123', 'member-456');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50);
    });

    it('缓存结果应该在 50ms 内完成', async () => {
      const startTime = Date.now();
      await service.cacheJoinResult('config-123', 'member-456', {}, {});
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50);
    });
  });
});
