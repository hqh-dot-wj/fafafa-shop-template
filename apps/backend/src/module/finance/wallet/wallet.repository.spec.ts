import { PrismaService } from 'src/prisma/prisma.service';
import { ClsService } from 'nestjs-cls';
import { Decimal } from '@prisma/client/runtime/library';
import { WalletRepository } from './wallet.repository';

function createRepository() {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const prisma = {
    finWallet: {
      updateMany,
    },
  } as unknown as PrismaService;
  const cls = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ClsService;

  return {
    repository: new WalletRepository(prisma, cls),
    updateMany,
  };
}

describe('WalletRepository atomic balance contracts', () => {
  describe('invariants', () => {
    it('Given freeze request, When freezeBalanceAtomic, Then update predicate requires enough available balance', async () => {
      const { repository, updateMany } = createRepository();
      const amount = new Decimal(50);

      const result = await repository.freezeBalanceAtomic('member-1', amount);

      expect(result).toBe(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          memberId: 'member-1',
          balance: { gte: amount },
        },
        data: {
          balance: { decrement: amount },
          frozen: { increment: amount },
          version: { increment: 1 },
        },
      });
    });

    it('Given unfreeze request, When unfreezeBalanceAtomic, Then update predicate requires enough frozen balance', async () => {
      const { repository, updateMany } = createRepository();
      const amount = new Decimal(30);

      const result = await repository.unfreezeBalanceAtomic('member-1', amount);

      expect(result).toBe(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          memberId: 'member-1',
          frozen: { gte: amount },
        },
        data: {
          balance: { increment: amount },
          frozen: { decrement: amount },
          version: { increment: 1 },
        },
      });
    });

    it('Given frozen deduction request, When deductFrozenAtomic, Then update predicate requires enough frozen balance', async () => {
      const { repository, updateMany } = createRepository();
      const amount = new Decimal(20);

      const result = await repository.deductFrozenAtomic('member-1', amount);

      expect(result).toBe(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          memberId: 'member-1',
          frozen: { gte: amount },
        },
        data: {
          frozen: { decrement: amount },
          version: { increment: 1 },
        },
      });
    });
  });

  describe('adversarial inputs', () => {
    it('Given insufficient available balance, When freezeBalanceAtomic affects zero rows, Then caller receives zero', async () => {
      const { repository, updateMany } = createRepository();
      updateMany.mockResolvedValue({ count: 0 });

      await expect(repository.freezeBalanceAtomic('member-1', new Decimal(100))).resolves.toBe(0);
    });

    it('Given insufficient frozen balance, When unfreeze or deduct affects zero rows, Then caller receives zero', async () => {
      const { repository, updateMany } = createRepository();
      updateMany.mockResolvedValue({ count: 0 });

      await expect(repository.unfreezeBalanceAtomic('member-1', new Decimal(100))).resolves.toBe(0);
      await expect(repository.deductFrozenAtomic('member-1', new Decimal(100))).resolves.toBe(0);
    });
  });
});
