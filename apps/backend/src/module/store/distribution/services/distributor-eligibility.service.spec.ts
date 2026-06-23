import { DistDistributorProfileStatus } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { DistributorEligibilityService } from './distributor-eligibility.service';

describe('DistributorEligibilityService', () => {
  const prisma = {
    sysDistDistributorProfile: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const tenantHelper = getTenantHelperTestProvider().useValue;
  let service: DistributorEligibilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DistributorEligibilityService(prisma as never, tenantHelper);
  });

  it('isActive only accepts ACTIVE profile in tenant scope', async () => {
    prisma.sysDistDistributorProfile.findFirst.mockResolvedValue({ id: 'profile-1' });

    const active = await service.isActive('tenant-1', 'member-1');

    expect(active).toBe(true);
    expect(prisma.sysDistDistributorProfile.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        memberId: 'member-1',
        status: DistDistributorProfileStatus.ACTIVE,
      },
      select: { id: true },
    });
  });

  it('assertActive rejects missing or inactive distributor profile', async () => {
    prisma.sysDistDistributorProfile.findFirst.mockResolvedValue(null);

    await expect(service.assertActive('tenant-1', 'member-1')).rejects.toBeInstanceOf(BusinessException);
  });

  it('filterActive returns only active member ids and de-duplicates input', async () => {
    prisma.sysDistDistributorProfile.findMany.mockResolvedValue([{ memberId: 'member-1' }, { memberId: 'member-3' }]);

    const active = await service.filterActive('tenant-1', ['member-1', 'member-1', 'member-2', 'member-3']);

    expect([...active]).toEqual(['member-1', 'member-3']);
    expect(prisma.sysDistDistributorProfile.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        memberId: { in: ['member-1', 'member-2', 'member-3'] },
        status: DistDistributorProfileStatus.ACTIVE,
      },
      select: { memberId: true },
    });
  });
});
