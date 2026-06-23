import { BusinessConstants } from 'src/common/constants/business.constants';
import { AttributionConfigService } from './attribution-config.service';

describe('AttributionConfigService', () => {
  const mockPrisma = {
    mktCampaign: {
      findFirst: jest.fn(),
    },
  };
  const mockTenantHelper = {
    readWhereForDelegate: jest.fn((_model: string, where: unknown) => where),
  };
  const mockSharePolicyService = {
    getPolicy: jest.fn(),
  };

  let service: AttributionConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AttributionConfigService(
      mockPrisma as never,
      mockTenantHelper as never,
      mockSharePolicyService as never,
    );
  });

  it('uses activity attribution window before tenant policy', async () => {
    mockPrisma.mktCampaign.findFirst.mockResolvedValue({
      stagesJson: {
        distributionGrowth: {
          activityVersionId: 'activity-v1',
          attributionWindowMinutes: 43200,
        },
      },
    });

    const result = await service.getAttributionWindowMinutes({
      tenantId: 'tenant_001',
      activityVersionId: 'activity-v1',
    });

    expect(result).toBe(43200);
    expect(mockPrisma.mktCampaign.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant_001',
          stagesJson: {
            path: ['distributionGrowth', 'activityVersionId'],
            equals: 'activity-v1',
          },
        }),
      }),
    );
    expect(mockSharePolicyService.getPolicy).not.toHaveBeenCalled();
  });

  it('falls back to tenant policy when activity window is missing or invalid', async () => {
    mockPrisma.mktCampaign.findFirst.mockResolvedValue({
      stagesJson: {
        distributionGrowth: {
          activityVersionId: 'activity-v1',
          attributionWindowMinutes: 0,
        },
      },
    });
    mockSharePolicyService.getPolicy.mockResolvedValue({
      data: {
        attributionWindowMinutes: 2880,
      },
    });

    const result = await service.getAttributionWindowMinutes({
      tenantId: 'tenant_001',
      activityVersionId: 'activity-v1',
    });

    expect(result).toBe(2880);
    expect(mockSharePolicyService.getPolicy).toHaveBeenCalledWith('tenant_001');
  });

  it('falls back to global default when neither activity nor tenant policy has a window', async () => {
    mockPrisma.mktCampaign.findFirst.mockResolvedValue(null);
    mockSharePolicyService.getPolicy.mockResolvedValue({ data: null });

    const result = await service.getAttributionWindowMinutes({
      tenantId: 'tenant_001',
      activityVersionId: 'activity-v1',
    });

    expect(result).toBe(BusinessConstants.DISTRIBUTION.DEFAULT_ATTRIBUTION_WINDOW_MINUTES);
  });

  it('uses link expire override before tenant policy', async () => {
    const result = await service.getLinkExpireMinutes({
      tenantId: 'tenant_001',
      override: 720,
    });

    expect(result).toBe(720);
    expect(mockSharePolicyService.getPolicy).not.toHaveBeenCalled();
  });

  it('falls back to tenant link expire policy', async () => {
    mockSharePolicyService.getPolicy.mockResolvedValue({
      data: {
        linkExpireMinutes: 1440,
      },
    });

    const result = await service.getLinkExpireMinutes({
      tenantId: 'tenant_001',
    });

    expect(result).toBe(1440);
  });
});
