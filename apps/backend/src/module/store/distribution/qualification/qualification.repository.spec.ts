import { DistShareBizType, DistShareEventType, DistShareTokenStatus } from '@prisma/client';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { DistributionQualificationRepository } from './qualification.repository';

describe('DistributionQualificationRepository', () => {
  const prisma = {
    sysDistShareToken: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    sysDistShareEvent: {
      createMany: jest.fn(),
    },
  };
  const tenantHelper = getTenantHelperTestProvider().useValue;
  let repository: DistributionQualificationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DistributionQualificationRepository(prisma as never, tenantHelper);
  });

  it('disableActiveShareTokensForDistributor disables active tokens and writes MANUAL_DISABLE audit events', async () => {
    prisma.sysDistShareToken.findMany.mockResolvedValue([
      {
        sid: 'DST_001',
        tenantId: 'tenant1',
        shareUserId: 'share1',
        bizType: DistShareBizType.PRODUCT,
        bizId: 'prod1',
      },
    ]);
    prisma.sysDistShareToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.sysDistShareEvent.createMany.mockResolvedValue({ count: 1 });

    const result = await repository.disableActiveShareTokensForDistributor({
      tenantId: 'tenant1',
      shareUserId: 'share1',
      operator: 'admin',
      reason: '冻结',
    });

    expect(result.count).toBe(1);
    expect(prisma.sysDistShareToken.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant1',
        shareUserId: 'share1',
        status: DistShareTokenStatus.ACTIVE,
      },
      data: {
        status: DistShareTokenStatus.DISABLED,
        updateBy: 'admin',
      },
    });
    expect(prisma.sysDistShareEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sid: 'DST_001',
          eventType: DistShareEventType.MANUAL_DISABLE,
          eventCode: 'DISTRIBUTOR_PROFILE_INACTIVE',
          eventMessage: '冻结',
        }),
      ],
    });
  });

  it('disableActiveShareTokensForDistributor skips updates when no active tokens exist', async () => {
    prisma.sysDistShareToken.findMany.mockResolvedValue([]);

    const result = await repository.disableActiveShareTokensForDistributor({
      tenantId: 'tenant1',
      shareUserId: 'share1',
      operator: 'admin',
      reason: '冻结',
    });

    expect(result.count).toBe(0);
    expect(prisma.sysDistShareToken.updateMany).not.toHaveBeenCalled();
    expect(prisma.sysDistShareEvent.createMany).not.toHaveBeenCalled();
  });
});
