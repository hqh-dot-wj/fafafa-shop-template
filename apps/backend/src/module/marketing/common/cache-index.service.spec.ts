import { MarketingCacheIndexService } from './cache-index.service';

describe('MarketingCacheIndexService', () => {
  const mockClient = {
    sadd: jest.fn(),
    pexpire: jest.fn(),
    smembers: jest.fn(),
    del: jest.fn(),
  };
  const mockRedis = {
    getClient: jest.fn(() => mockClient),
    del: jest.fn(),
  };

  let service: MarketingCacheIndexService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketingCacheIndexService(mockRedis as never);
  });

  it('trackCacheKey 应写入索引集合并同步过期时间', async () => {
    mockClient.sadd.mockResolvedValue(1);
    mockClient.pexpire.mockResolvedValue(1);

    await service.trackCacheKey('marketing:test:t-1:', 'marketing:test:t-1:handler:hash', 300000);

    expect(mockClient.sadd).toHaveBeenCalledWith(
      'marketing:cache:index:marketing:test:t-1:',
      'marketing:test:t-1:handler:hash',
    );
    expect(mockClient.pexpire).toHaveBeenCalledWith('marketing:cache:index:marketing:test:t-1:', 300000);
  });

  it('evictByScopedPrefix 索引命中时应删除实际缓存并清理索引', async () => {
    mockClient.smembers.mockResolvedValue(['k1', 'k2']);
    mockRedis.del.mockResolvedValue(2);
    mockClient.del.mockResolvedValue(1);

    const deleted = await service.evictByScopedPrefix('marketing:test:t-1:');

    expect(deleted).toBe(2);
    expect(mockRedis.del).toHaveBeenCalledWith(['k1', 'k2']);
    expect(mockClient.del).toHaveBeenCalledWith('marketing:cache:index:marketing:test:t-1:');
  });

  it('evictByScopedPrefix 索引为空时仅删除索引 key', async () => {
    mockClient.smembers.mockResolvedValue([]);
    mockClient.del.mockResolvedValue(1);

    const deleted = await service.evictByScopedPrefix('marketing:test:t-1:');

    expect(deleted).toBe(0);
    expect(mockRedis.del).not.toHaveBeenCalled();
    expect(mockClient.del).toHaveBeenCalledWith('marketing:cache:index:marketing:test:t-1:');
  });
});

