import { RedisExpressRateLimitStore } from './redis-express-rate-limit.store';

describe('RedisExpressRateLimitStore', () => {
  const createStore = () => {
    const evalMock = jest.fn();
    const delMock = jest.fn();
    const scanAndDeleteByMatchMock = jest.fn();
    const redisService = {
      getClient: () => ({
        eval: evalMock,
        del: delMock,
      }),
      scanAndDeleteByMatch: scanAndDeleteByMatchMock,
    };

    const store = new RedisExpressRateLimitStore(redisService as any, 'test');
    store.init({ windowMs: 60_000 } as any);

    return { store, evalMock, delMock, scanAndDeleteByMatchMock };
  };

  it('Given redis eval returns count and ttl, When increment, Then should map result correctly', async () => {
    const { store, evalMock } = createStore();
    evalMock.mockResolvedValue([5, 30_000]);

    const result = await store.increment('client-1');

    expect(result.totalHits).toBe(5);
    expect(result.resetTime).toBeInstanceOf(Date);
    expect(result.resetTime!.getTime()).toBeGreaterThan(Date.now());

    store.shutdown();
  });

  it('Given redis unavailable, When increment, Then should fallback to memory store', async () => {
    const { store, evalMock } = createStore();
    evalMock.mockRejectedValue(new Error('redis down'));

    const first = await store.increment('client-2');
    const firstHits = first.totalHits;
    const second = await store.increment('client-2');

    expect(firstHits).toBe(1);
    expect(second.totalHits).toBe(2);

    store.shutdown();
  });
});
