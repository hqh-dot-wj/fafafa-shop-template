import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdempotentGuard } from './idempotent.guard';
import { RedisService } from 'src/module/common/redis/redis.service';
import { BusinessException } from '../exceptions/business.exception';

describe('IdempotentGuard', () => {
  let guard: IdempotentGuard;

  const mockReflector = {
    get: jest.fn(),
  };

  const mockRedisService = {
    tryLock: jest.fn(),
  };

  beforeEach(() => {
    guard = new IdempotentGuard(mockReflector as unknown as Reflector, mockRedisService as unknown as RedisService);
    jest.clearAllMocks();
  });

  function createMockContext(headers: Record<string, string> = {}, user?: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          user,
          path: '/api/test',
        }),
      }),
      getHandler: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  describe('canActivate', () => {
    it('Given 无 @Idempotent 装饰器, When canActivate, Then 直接放行', async () => {
      mockReflector.get.mockReturnValue(undefined);

      const result = await guard.canActivate(createMockContext());

      expect(result).toBe(true);
      expect(mockRedisService.tryLock).not.toHaveBeenCalled();
    });

    it('Given 有 @Idempotent 但无 X-Idempotent-ID, When canActivate, Then 抛出参数异常', async () => {
      mockReflector.get.mockReturnValue({ ttl: 60000 });

      await expect(guard.canActivate(createMockContext({}))).rejects.toThrow(BusinessException);
    });

    it('Given 有效幂等 ID 且首次请求, When canActivate, Then 放行', async () => {
      mockReflector.get.mockReturnValue({ ttl: 60000 });
      mockRedisService.tryLock.mockResolvedValue(true);

      const result = await guard.canActivate(createMockContext({ 'x-idempotent-id': 'req-123' }, { userId: 'user1' }));

      expect(result).toBe(true);
      expect(mockRedisService.tryLock).toHaveBeenCalledWith('idempotent:user1:/api/test:req-123', 60000);
    });

    it('Given 重复请求(锁已存在), When canActivate, Then 抛出重复提交异常', async () => {
      mockReflector.get.mockReturnValue({ ttl: 60000 });
      mockRedisService.tryLock.mockResolvedValue(false);

      await expect(
        guard.canActivate(createMockContext({ 'x-idempotent-id': 'req-123' }, { userId: 'user1' })),
      ).rejects.toThrow(BusinessException);
    });

    it('Given 无用户信息, When canActivate, Then 使用 anonymous 作为用户标识', async () => {
      mockReflector.get.mockReturnValue({ ttl: 5000 });
      mockRedisService.tryLock.mockResolvedValue(true);

      await guard.canActivate(createMockContext({ 'x-idempotent-id': 'req-456' }));

      expect(mockRedisService.tryLock).toHaveBeenCalledWith('idempotent:anonymous:/api/test:req-456', 5000);
    });

    it('Given 未指定 ttl, When canActivate, Then 使用默认 60000ms', async () => {
      mockReflector.get.mockReturnValue({});
      mockRedisService.tryLock.mockResolvedValue(true);

      await guard.canActivate(createMockContext({ 'x-idempotent-id': 'req-789' }, { userId: 'u1' }));

      expect(mockRedisService.tryLock).toHaveBeenCalledWith(expect.any(String), 60000);
    });
  });
});
