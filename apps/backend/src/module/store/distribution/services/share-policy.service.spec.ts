import { DistShareAttributionMode, DistShareBindingMode } from '@prisma/client';
import { BusinessConstants } from 'src/common/constants/business.constants';
import { SharePolicyService } from './share-policy.service';

describe('SharePolicyService', () => {
  const prisma = {
    sysDistSharePolicy: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const tenantHelper = {
    readWhereForDelegate: jest.fn((_delegate: string, where: object) => where),
  };
  let service: SharePolicyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SharePolicyService(prisma as never, tenantHelper as never);
  });

  describe('invariants', () => {
    it('returns default active policy when tenant has no persisted policy', async () => {
      prisma.sysDistSharePolicy.findFirst.mockResolvedValue(null);

      const result = await service.getPolicy('tenant-1');

      expect(result.data).toMatchObject({
        tenantId: 'tenant-1',
        linkExpireMinutes: BusinessConstants.DISTRIBUTION.DEFAULT_SHARE_LINK_EXPIRE_MINUTES,
        bindingMode: DistShareBindingMode.BOTH,
        attributionMode: DistShareAttributionMode.LAST_TOUCH,
        isActive: true,
      });
    });

    it('uses tenant-scoped helper when reading policy', async () => {
      prisma.sysDistSharePolicy.findFirst.mockResolvedValue(null);

      await service.getPolicy('tenant-1');

      expect(tenantHelper.readWhereForDelegate).toHaveBeenCalledWith('sysDistSharePolicy', { tenantId: 'tenant-1' });
    });
  });

  describe('boundary conditions', () => {
    it('upserts nullable quota fields without dropping explicit false flags', async () => {
      const now = new Date('2026-05-01T00:00:00.000Z');
      prisma.sysDistSharePolicy.upsert.mockResolvedValue({
        id: 1,
        tenantId: 'tenant-1',
        linkExpireMinutes: 60,
        maxClickCount: null,
        maxBindCount: null,
        maxOrderCount: null,
        bindingMode: DistShareBindingMode.LINK_ONLY,
        attributionMode: DistShareAttributionMode.FIRST_TOUCH,
        attributionWindowMinutes: 30,
        enableCrossTenantBind: false,
        isActive: false,
        createTime: now,
        updateTime: now,
      });

      const result = await service.updatePolicy(
        'tenant-1',
        {
          linkExpireMinutes: 60,
          maxClickCount: null,
          maxBindCount: null,
          maxOrderCount: null,
          bindingMode: DistShareBindingMode.LINK_ONLY,
          attributionMode: DistShareAttributionMode.FIRST_TOUCH,
          attributionWindowMinutes: 30,
          enableCrossTenantBind: false,
          isActive: false,
        } as any,
        'admin',
      );

      expect(prisma.sysDistSharePolicy.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
          update: expect.objectContaining({ enableCrossTenantBind: false, isActive: false, updateBy: 'admin' }),
        }),
      );
      expect(result.data).toMatchObject({ enableCrossTenantBind: false, isActive: false });
    });
  });
});
