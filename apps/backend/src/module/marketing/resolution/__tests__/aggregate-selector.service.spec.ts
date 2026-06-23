import { Test } from '@nestjs/testing';
import { StorePlayConfig } from '@prisma/client';
import { AggregateSelectorService } from '../services/aggregate-selector.service';
import { ResolutionRepository } from '../resolution.repository';

function mockStorePlayConfig(overrides: Partial<StorePlayConfig> = {}): StorePlayConfig {
  return {
    id: 'default-id',
    tenantId: '000000',
    serviceId: 'prod1',
    serviceType: 'REAL',
    templateCode: 'GROUP_BUY',
    rules: {},
    rulesHistory: [],
    stockMode: 'STRONG_LOCK',
    status: 'ON_SHELF',
    delFlag: 'NORMAL',
    scopeType: 'PRODUCT',
    aggregateEnabled: true,
    zoneEnabled: true,
    displayPriority: 0,
    commissionMode: 'INHERIT',
    commissionRate: null,
    createTime: new Date(),
    updateTime: new Date(),
    ...overrides,
  };
}

describe('AggregateSelectorService', () => {
  let service: AggregateSelectorService;
  let repository: { findPriorityRulesByTenant: jest.Mock };

  beforeEach(async () => {
    repository = { findPriorityRulesByTenant: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [AggregateSelectorService, { provide: ResolutionRepository, useValue: repository }],
    }).compile();
    service = module.get(AggregateSelectorService);
  });

  it('should select highest priority type first', async () => {
    repository.findPriorityRulesByTenant.mockResolvedValue([
      { activityType: 'FLASH_SALE', priority: 100, aggregateEnabled: true },
      { activityType: 'GROUP_BUY', priority: 80, aggregateEnabled: true },
    ]);
    const candidates = [
      mockStorePlayConfig({ id: 'c1', templateCode: 'GROUP_BUY', displayPriority: 0 }),
      mockStorePlayConfig({ id: 'c2', templateCode: 'FLASH_SALE', displayPriority: 0 }),
    ];
    const result = await service.selectMainActivity('tenant1', candidates);
    expect(result?.id).toBe('c2');
  });

  it('should use displayPriority within same type', async () => {
    repository.findPriorityRulesByTenant.mockResolvedValue([
      { activityType: 'GROUP_BUY', priority: 80, aggregateEnabled: true },
    ]);
    const candidates = [
      mockStorePlayConfig({ id: 'c1', templateCode: 'GROUP_BUY', displayPriority: 5 }),
      mockStorePlayConfig({ id: 'c2', templateCode: 'GROUP_BUY', displayPriority: 10 }),
    ];
    const result = await service.selectMainActivity('tenant1', candidates);
    expect(result?.id).toBe('c2');
  });

  it('should return null for empty candidates', async () => {
    repository.findPriorityRulesByTenant.mockResolvedValue([]);
    const result = await service.selectMainActivity('tenant1', []);
    expect(result).toBeNull();
  });
});
