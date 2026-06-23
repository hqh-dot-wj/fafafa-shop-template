import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  const createStorage = () => {
    const evalMock = jest.fn();
    const redisService = {
      getClient: () => ({
        eval: evalMock,
      }),
    };
    const storage = new RedisThrottlerStorage(redisService as any);
    return { storage, evalMock };
  };

  it('Given redis eval response, When increment, Then should map to throttler record', async () => {
    const { storage, evalMock } = createStorage();
    evalMock.mockResolvedValue([3, 55_000, 0, 0]);

    const result = await storage.increment('k1', 60_000, 100, 60_000, 'default');

    expect(result).toEqual({
      totalHits: 3,
      timeToExpire: 55,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    expect(evalMock).toHaveBeenCalled();
  });

  it('Given redis unavailable, When increment, Then should fallback to memory storage', async () => {
    const { storage, evalMock } = createStorage();
    evalMock.mockRejectedValue(new Error('redis down'));

    const first = await storage.increment('k2', 60_000, 1, 60_000, 'default');
    const second = await storage.increment('k2', 60_000, 1, 60_000, 'default');

    expect(first.totalHits).toBe(1);
    expect(first.isBlocked).toBe(false);
    expect(second.totalHits).toBeGreaterThanOrEqual(2);
    expect(second.isBlocked).toBe(true);
    (storage as any).memoryFallback.onApplicationShutdown();
  });
});
