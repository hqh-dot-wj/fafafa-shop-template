import { StorePlayConfig } from '@prisma/client';
import { EligibilityFilterService, EligibilityContext } from '../services/eligibility-filter.service';

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

describe('EligibilityFilterService', () => {
  let service: EligibilityFilterService;
  beforeEach(() => {
    service = new EligibilityFilterService();
  });

  it('should pass config with no time restriction', () => {
    const config = mockStorePlayConfig({ id: 'c1', rules: {} });
    const ctx: EligibilityContext = { memberId: 'm1', now: new Date() };
    const result = service.filterCandidates([config], ctx);
    expect(result.eligible).toHaveLength(1);
    expect(result.filtered).toHaveLength(0);
  });

  it('should filter out expired config', () => {
    const pastEnd = new Date(Date.now() - 86400000);
    const config = mockStorePlayConfig({
      id: 'c2',
      templateCode: 'FLASH_SALE',
      rules: { endTime: pastEnd.toISOString() },
    });
    const ctx: EligibilityContext = { memberId: 'm1', now: new Date() };
    const result = service.filterCandidates([config], ctx);
    expect(result.eligible).toHaveLength(0);
    expect(result.filtered[0].reason).toContain('expired');
  });

  it('should filter out config not yet started', () => {
    const futureStart = new Date(Date.now() + 86400000);
    const config = mockStorePlayConfig({
      id: 'c3',
      templateCode: 'FLASH_SALE',
      rules: { startTime: futureStart.toISOString() },
    });
    const ctx: EligibilityContext = { memberId: 'm1', now: new Date() };
    const result = service.filterCandidates([config], ctx);
    expect(result.eligible).toHaveLength(0);
    expect(result.filtered[0].reason).toContain('not_started');
  });
});
