import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { MemberUpgradeService } from './member-upgrade.service';

describe('MemberUpgradeService', () => {
  const memberRepo = {
    findById: jest.fn(),
    update: jest.fn(),
  };
  const upgradeApplyRepo = {
    create: jest.fn(),
  };
  const referralRepo = {
    create: jest.fn(),
  };
  const configRepo = {
    findById: jest.fn(),
  };
  const orderService = {
    findBySnForMarketing: jest.fn(),
  };
  let service: MemberUpgradeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MemberUpgradeService(
      memberRepo as never,
      upgradeApplyRepo as never,
      referralRepo as never,
      configRepo as never,
      orderService as never,
    );
  });

  describe('invariants', () => {
    it('rejects members already at or above the target level', async () => {
      memberRepo.findById.mockResolvedValue({ memberId: 'm1', levelId: 2 });

      await expect(service.validateJoin({ rules: { targetLevel: 2 } } as any, 'm1')).rejects.toThrow(BusinessException);
    });

    it('creates an approved application and upgrades member when autoApprove is enabled', async () => {
      configRepo.findById.mockResolvedValue({ id: 'cfg1', tenantId: 'tenant-abc', rules: { targetLevel: 1 } });
      orderService.findBySnForMarketing.mockResolvedValue({ id: 'order-1', tenantId: 'tenant-order' });
      memberRepo.findById.mockResolvedValue({ memberId: 'm1', levelId: 0 });

      await service.onPaymentSuccess({ id: 'inst1', configId: 'cfg1', memberId: 'm1', orderSn: 'SN1' } as any);

      expect(upgradeApplyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-order',
          memberId: 'm1',
          fromLevel: 0,
          toLevel: 1,
          orderId: 'order-1',
          status: 'APPROVED',
        }),
      );
      expect(memberRepo.update).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({ levelId: 1, tenantId: 'tenant-order', upgradeOrderId: 'order-1' }),
      );
    });
  });

  describe('boundary conditions', () => {
    it('returns zero price when rules omit price', async () => {
      const price = await service.calculatePrice({ rules: {} } as any);

      expect(price).toEqual(new Decimal(0));
    });

    it('does not upgrade immediately when autoApprove is false', async () => {
      configRepo.findById.mockResolvedValue({
        id: 'cfg1',
        tenantId: 'tenant-abc',
        rules: { targetLevel: 2, autoApprove: false },
      });
      orderService.findBySnForMarketing.mockResolvedValue(null);
      memberRepo.findById.mockResolvedValue({ memberId: 'm1', levelId: 1 });

      await service.onPaymentSuccess({ id: 'inst1', configId: 'cfg1', memberId: 'm1' } as any);

      expect(upgradeApplyRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' }));
      expect(memberRepo.update).not.toHaveBeenCalled();
      expect(referralRepo.create).not.toHaveBeenCalled();
    });
  });
});
