import { WithdrawalStatus } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'src/prisma/prisma.service';
import { WithdrawalRepository } from './withdrawal.repository';

function createRepository() {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const prisma = {
    finWithdrawal: {
      updateMany,
    },
  } as unknown as PrismaService;
  const cls = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ClsService;

  return {
    repository: new WithdrawalRepository(prisma, cls),
    updateMany,
  };
}

describe('WithdrawalRepository status CAS contracts', () => {
  describe('invariants', () => {
    it('Given a current status, When updateStatusIfCurrent, Then update predicate includes id and current status', async () => {
      const { repository, updateMany } = createRepository();

      const result = await repository.updateStatusIfCurrent('withdrawal-1', WithdrawalStatus.PROCESSING, {
        status: WithdrawalStatus.APPROVED,
        paymentNo: 'PAY-1',
      });

      expect(result).toBe(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: 'withdrawal-1',
          status: WithdrawalStatus.PROCESSING,
        },
        data: {
          status: WithdrawalStatus.APPROVED,
          paymentNo: 'PAY-1',
        },
      });
    });

    it('Given pending approval, When claimPendingForApproval, Then only PENDING can become PROCESSING', async () => {
      const { repository, updateMany } = createRepository();

      const result = await repository.claimPendingForApproval('withdrawal-1', 'auditor-1');

      expect(result).toBe(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: 'withdrawal-1',
          status: WithdrawalStatus.PENDING,
        },
        data: {
          status: WithdrawalStatus.PROCESSING,
          auditTime: expect.any(Date),
          auditBy: 'auditor-1',
          failReason: null,
        },
      });
    });

    it('Given reserved paymentNo, When claimPendingForApproval, Then paymentNo is persisted with the claim', async () => {
      const { repository, updateMany } = createRepository();

      const result = await repository.claimPendingForApproval('withdrawal-1', 'auditor-1', 'WD_BAT_1:WD_DTL_1');

      expect(result).toBe(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: 'withdrawal-1',
          status: WithdrawalStatus.PENDING,
        },
        data: {
          status: WithdrawalStatus.PROCESSING,
          auditTime: expect.any(Date),
          auditBy: 'auditor-1',
          failReason: null,
          paymentNo: 'WD_BAT_1:WD_DTL_1',
        },
      });
    });

    it('Given failed retry, When claimFailedForRetry, Then only retryable FAILED records can become PROCESSING', async () => {
      const { repository, updateMany } = createRepository();

      const result = await repository.claimFailedForRetry('withdrawal-1', 3);

      expect(result).toBe(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: 'withdrawal-1',
          status: WithdrawalStatus.FAILED,
          retryCount: { lt: 3 },
        },
        data: {
          status: WithdrawalStatus.PROCESSING,
          retryCount: { increment: 1 },
          failReason: null,
        },
      });
    });

    it('Given retry paymentNo, When claimFailedForRetry, Then paymentNo is persisted before retry transfer', async () => {
      const { repository, updateMany } = createRepository();

      const result = await repository.claimFailedForRetry('withdrawal-1', 3, 'WD_BAT_1:WD_DTL_1');

      expect(result).toBe(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: 'withdrawal-1',
          status: WithdrawalStatus.FAILED,
          retryCount: { lt: 3 },
        },
        data: {
          status: WithdrawalStatus.PROCESSING,
          retryCount: { increment: 1 },
          failReason: null,
          paymentNo: 'WD_BAT_1:WD_DTL_1',
        },
      });
    });
  });

  describe('adversarial inputs', () => {
    it('Given status already changed, When updateStatusIfCurrent affects zero rows, Then caller receives zero', async () => {
      const { repository, updateMany } = createRepository();
      updateMany.mockResolvedValue({ count: 0 });

      await expect(
        repository.updateStatusIfCurrent('withdrawal-1', WithdrawalStatus.PROCESSING, {
          status: WithdrawalStatus.APPROVED,
        }),
      ).resolves.toBe(0);
    });

    it('Given retry count already reached limit, When claimFailedForRetry affects zero rows, Then caller receives zero', async () => {
      const { repository, updateMany } = createRepository();
      updateMany.mockResolvedValue({ count: 0 });

      await expect(repository.claimFailedForRetry('withdrawal-1', 3)).resolves.toBe(0);
    });
  });
});
