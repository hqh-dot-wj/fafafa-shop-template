import { Test } from '@nestjs/testing';
import { ResolutionExplainService } from '../services/resolution-explain.service';
import { RedisService } from 'src/module/common/redis/redis.service';

const mockRedisClient = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
};

const mockRedisService = {
  getClient: jest.fn().mockReturnValue(mockRedisClient),
};

describe('ResolutionExplainService', () => {
  let service: ResolutionExplainService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [ResolutionExplainService, { provide: RedisService, useValue: mockRedisService }],
    }).compile();
    service = module.get(ResolutionExplainService);
  });

  it('should write explain snapshot to Redis with 7-day TTL', async () => {
    await service.record({
      traceId: 'trace-001',
      tenantId: 'tenant-001',
      productId: 'prod-001',
      memberId: 'mem-001',
      winner: { configId: 'cfg-1', templateCode: 'FLASH_SALE', priority: 10 },
      filtered: [
        {
          config: {
            id: 'cfg-2',
            templateCode: 'NEWCOMER',
            tenantId: 'tenant-001',
            serviceId: 'prod-001',
            serviceType: 'REAL',
            rules: {},
            rulesHistory: [],
            stockMode: 'STRONG_LOCK',
            status: 'ON_SHELF',
            delFlag: 'NORMAL',
            scopeType: 'PRODUCT',
            aggregateEnabled: true,
            zoneEnabled: true,
            displayPriority: 5,
            commissionMode: 'INHERIT',
            commissionRate: null,
            createTime: new Date(),
            updateTime: new Date(),
          },
          reason: 'not_newcomer',
        },
      ],
    });

    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'marketing:resolution:explain:tenant-001:trace-001:prod-001',
      expect.stringContaining('"explainVersion":"1"'),
      'EX',
      604800,
    );

    const payload = JSON.parse(mockRedisClient.set.mock.calls[0][1]);
    expect(payload.filtered[0].reason).toBe('not_newcomer');
    expect(payload.filtered[0].reasonText).toBe('仅限新用户');
    expect(payload.winner.configId).toBe('cfg-1');
  });

  it('should return null when no explain data exists', async () => {
    mockRedisClient.get.mockResolvedValue(null);
    const result = await service.query({ tenantId: 'tenant-001', traceId: 'trace-999', productId: 'prod-001' });
    expect(result).toBeNull();
  });

  it('should return parsed snapshot when data exists', async () => {
    const snapshot = {
      traceId: 'trace-001',
      tenantId: 'tenant-001',
      productId: 'prod-001',
      resolvedAt: new Date().toISOString(),
      winner: null,
      filtered: [{ configId: 'cfg-2', templateCode: 'NEWCOMER', reason: 'not_newcomer', reasonText: '仅限新用户' }],
      explainVersion: '1',
    };
    mockRedisClient.get.mockResolvedValue(JSON.stringify(snapshot));
    const result = await service.query({ tenantId: 'tenant-001', traceId: 'trace-001', productId: 'prod-001' });
    expect(result).not.toBeNull();
    expect(result!.filtered[0].reason).toBe('not_newcomer');
  });
});
