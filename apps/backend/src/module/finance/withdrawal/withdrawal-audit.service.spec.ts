import { Test, TestingModule } from '@nestjs/testing';
import { WithdrawalAuditService } from './withdrawal-audit.service';
import { WithdrawalRepository } from './withdrawal.repository';
import { WalletRepository } from '../wallet/wallet.repository';
import { TransactionRepository } from '../wallet/transaction.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { WithdrawalPaymentService } from './withdrawal-payment.service';
import { WalletService } from '../wallet/wallet.service';
import { WithdrawalStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { BusinessConstants } from 'src/common/constants/business.constants';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';

describe('WithdrawalAuditService', () => {
  let service: WithdrawalAuditService;

  const mockWithdrawalRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    updateStatusIfCurrent: jest.fn(),
    claimPendingForApproval: jest.fn(),
    claimFailedForRetry: jest.fn(),
  };

  const mockWalletRepo = {
    findByMemberId: jest.fn(),
  };

  const mockTransactionRepo = {
    create: jest.fn(),
  };

  const mockPrismaService = {
    finWithdrawal: {
      findMany: jest.fn(),
    },
  };

  const mockPaymentService = {
    buildPaymentNo: jest.fn(),
    transfer: jest.fn(),
  };

  const mockWalletService = {
    unfreezeBalance: jest.fn(),
    deductFrozen: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalAuditService,
        {
          provide: WithdrawalRepository,
          useValue: mockWithdrawalRepo,
        },
        {
          provide: WalletRepository,
          useValue: mockWalletRepo,
        },
        {
          provide: TransactionRepository,
          useValue: mockTransactionRepo,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: WithdrawalPaymentService,
          useValue: mockPaymentService,
        },
        {
          provide: WalletService,
          useValue: mockWalletService,
        },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    service = module.get<WithdrawalAuditService>(WithdrawalAuditService);
    jest.clearAllMocks();
    mockWithdrawalRepo.claimPendingForApproval.mockResolvedValue(1);
    mockWithdrawalRepo.claimFailedForRetry.mockResolvedValue(1);
    mockWithdrawalRepo.updateStatusIfCurrent.mockResolvedValue(1);
    mockPaymentService.buildPaymentNo.mockImplementation(
      (withdrawal: { id: string; method?: string; paymentNo?: string | null }) =>
        withdrawal.paymentNo ??
        (withdrawal.method === 'BANK_CARD'
          ? `BANK_MANUAL_${withdrawal.id}`
          : `WD_BAT_${withdrawal.id}:WD_DTL_${withdrawal.id}`),
    );
  });

  // ========== WD-T6: 打款重试 ==========
  describe('approve - WD-T6 打款流程', () => {
    const mockWithdrawal = {
      id: 'withdrawal1',
      memberId: 'member1',
      tenantId: 'tenant1',
      amount: new Decimal(100),
      fee: new Decimal(0),
      actualAmount: new Decimal(100),
      status: WithdrawalStatus.PENDING,
      retryCount: 0,
    };

    it('Given 打款成功, When approve, Then 完成审核并返回成功', async () => {
      const paymentNo = 'WD_BAT_withdrawal1:WD_DTL_withdrawal1';
      mockPaymentService.transfer.mockResolvedValue({ paymentNo, channelStatus: 'SUCCESS' });
      mockWalletService.deductFrozen.mockResolvedValue({});
      mockWalletRepo.findByMemberId.mockResolvedValue({
        id: 'wallet1',
        balance: new Decimal(0),
      });
      mockTransactionRepo.create.mockResolvedValue({});

      const result = await service.approve(mockWithdrawal, 'admin1');

      expect(result.code).toBe(200);
      expect(result.data.paymentNo).toBe(paymentNo);
      expect(mockWithdrawalRepo.claimPendingForApproval).toHaveBeenCalledWith('withdrawal1', 'admin1', paymentNo);
      expect(mockPaymentService.transfer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'withdrawal1', paymentNo }),
      );
      expect(mockWithdrawalRepo.claimPendingForApproval.mock.invocationCallOrder[0]).toBeLessThan(
        mockPaymentService.transfer.mock.invocationCallOrder[0],
      );
      expect(mockWithdrawalRepo.updateStatusIfCurrent).toHaveBeenCalledWith(
        'withdrawal1',
        WithdrawalStatus.PROCESSING,
        {
          status: WithdrawalStatus.APPROVED,
          paymentNo,
          failReason: null,
          auditTime: expect.any(Date),
          auditBy: 'admin1',
        },
      );
      expect(mockWalletService.deductFrozen).toHaveBeenCalledWith('member1', new Decimal(100));
      expect(mockTransactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          relatedId: 'withdrawal1',
          type: 'WITHDRAW_OUT',
        }),
      );
    });

    it('Given 打款已受理, When approve, Then 标记为处理中并保留冻结余额', async () => {
      const paymentNo = 'WD_BAT_withdrawal1:WD_DTL_withdrawal1';
      mockPaymentService.transfer.mockResolvedValue({ paymentNo, channelStatus: 'PROCESSING' });

      const result = await service.approve(mockWithdrawal, 'admin1');

      expect(result.code).toBe(200);
      expect(result.msg).toContain('处理中');
      expect(mockWithdrawalRepo.claimPendingForApproval).toHaveBeenCalledWith('withdrawal1', 'admin1', paymentNo);
      expect(mockPaymentService.transfer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'withdrawal1', paymentNo }),
      );
      expect(mockWithdrawalRepo.claimPendingForApproval.mock.invocationCallOrder[0]).toBeLessThan(
        mockPaymentService.transfer.mock.invocationCallOrder[0],
      );
      expect(mockWithdrawalRepo.updateStatusIfCurrent).toHaveBeenCalledWith(
        'withdrawal1',
        WithdrawalStatus.PROCESSING,
        {
          status: WithdrawalStatus.PROCESSING,
          auditTime: expect.any(Date),
          auditBy: 'admin1',
          paymentNo,
          failReason: null,
        },
      );
      expect(mockWalletService.deductFrozen).not.toHaveBeenCalled();
    });

    it('Given 打款失败, When approve, Then 标记为FAILED并抛出异常', async () => {
      const paymentNo = 'WD_BAT_withdrawal1:WD_DTL_withdrawal1';
      mockPaymentService.transfer.mockRejectedValue(new Error('支付网关超时'));

      await expect(service.approve(mockWithdrawal, 'admin1')).rejects.toThrow(BusinessException);

      expect(mockWithdrawalRepo.claimPendingForApproval).toHaveBeenCalledWith('withdrawal1', 'admin1', paymentNo);
      expect(mockPaymentService.transfer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'withdrawal1', paymentNo }),
      );
      expect(mockWithdrawalRepo.claimPendingForApproval.mock.invocationCallOrder[0]).toBeLessThan(
        mockPaymentService.transfer.mock.invocationCallOrder[0],
      );
      expect(mockWithdrawalRepo.updateStatusIfCurrent).toHaveBeenCalledWith(
        'withdrawal1',
        WithdrawalStatus.PROCESSING,
        {
          status: WithdrawalStatus.FAILED,
          failReason: '支付网关超时',
        },
      );
    });

    it('Given 提现申请已处理, When approve, Then 拒绝且不发起外部打款', async () => {
      await expect(
        service.approve({ ...mockWithdrawal, status: WithdrawalStatus.APPROVED } as any, 'admin1'),
      ).rejects.toThrow(BusinessException);

      expect(mockWithdrawalRepo.claimPendingForApproval).not.toHaveBeenCalled();
      expect(mockPaymentService.transfer).not.toHaveBeenCalled();
    });

    it('Given 并发审核已被其他请求抢占, When approve, Then 幂等返回已处理且不发起外部打款', async () => {
      mockWithdrawalRepo.claimPendingForApproval.mockResolvedValue(0);

      const result = await service.approve(mockWithdrawal, 'admin1');

      expect(result.msg).toBe('提现申请已处理');
      expect(mockPaymentService.transfer).not.toHaveBeenCalled();
      expect(mockWalletService.deductFrozen).not.toHaveBeenCalled();
      expect(mockTransactionRepo.create).not.toHaveBeenCalled();
    });

    it('Given 打款成功但完成入账 CAS 失败, When approve, Then 不扣冻结余额不写流水', async () => {
      const paymentNo = 'WD_BAT_withdrawal1:WD_DTL_withdrawal1';
      mockPaymentService.transfer.mockResolvedValue({ paymentNo, channelStatus: 'SUCCESS' });
      mockWithdrawalRepo.updateStatusIfCurrent.mockResolvedValue(0);

      const result = await service.approve(mockWithdrawal, 'admin1');

      expect(result.msg).toBe('提现申请已处理');
      expect(mockWithdrawalRepo.claimPendingForApproval).toHaveBeenCalledWith('withdrawal1', 'admin1', paymentNo);
      expect(mockPaymentService.transfer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'withdrawal1', paymentNo }),
      );
      expect(mockWalletService.deductFrozen).not.toHaveBeenCalled();
      expect(mockTransactionRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('retryPayment - WD-T6 打款重试', () => {
    it('Given 提现记录不存在, When retryPayment, Then 返回false', async () => {
      mockWithdrawalRepo.findOne.mockResolvedValue(null);

      const result = await service.retryPayment('withdrawal1');

      expect(result).toBe(false);
    });

    it('Given 状态非FAILED, When retryPayment, Then 跳过重试返回false', async () => {
      mockWithdrawalRepo.findOne.mockResolvedValue({
        id: 'withdrawal1',
        status: WithdrawalStatus.APPROVED,
        retryCount: 0,
      });

      const result = await service.retryPayment('withdrawal1');

      expect(result).toBe(false);
    });

    it('Given 重试次数已达上限, When retryPayment, Then 跳过重试返回false', async () => {
      mockWithdrawalRepo.findOne.mockResolvedValue({
        id: 'withdrawal1',
        status: WithdrawalStatus.FAILED,
        retryCount: BusinessConstants.FINANCE.MAX_PAYMENT_RETRY_COUNT,
      });

      const result = await service.retryPayment('withdrawal1');

      expect(result).toBe(false);
    });

    it('Given 重试成功, When retryPayment, Then 完成审核返回true', async () => {
      const mockWithdrawal = {
        id: 'withdrawal1',
        memberId: 'member1',
        tenantId: 'tenant1',
        amount: new Decimal(100),
        actualAmount: new Decimal(100),
        status: WithdrawalStatus.FAILED,
        retryCount: 1,
      };

      mockWithdrawalRepo.findOne.mockResolvedValue(mockWithdrawal);
      const paymentNo = 'WD_BAT_withdrawal1:WD_DTL_withdrawal1';
      mockPaymentService.transfer.mockResolvedValue({ paymentNo, channelStatus: 'SUCCESS' });
      mockWalletService.deductFrozen.mockResolvedValue({});
      mockWalletRepo.findByMemberId.mockResolvedValue({
        id: 'wallet1',
        balance: new Decimal(0),
      });
      mockTransactionRepo.create.mockResolvedValue({});

      const result = await service.retryPayment('withdrawal1');

      expect(result).toBe(true);
      expect(mockWithdrawalRepo.claimFailedForRetry).toHaveBeenCalledWith(
        'withdrawal1',
        BusinessConstants.FINANCE.MAX_PAYMENT_RETRY_COUNT,
        paymentNo,
      );
      expect(mockPaymentService.transfer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'withdrawal1', paymentNo }),
      );
      expect(mockWithdrawalRepo.claimFailedForRetry.mock.invocationCallOrder[0]).toBeLessThan(
        mockPaymentService.transfer.mock.invocationCallOrder[0],
      );
      expect(mockWithdrawalRepo.updateStatusIfCurrent).toHaveBeenCalledWith(
        'withdrawal1',
        WithdrawalStatus.PROCESSING,
        {
          status: WithdrawalStatus.APPROVED,
          paymentNo,
          failReason: null,
        },
      );
      expect(mockWalletService.deductFrozen).toHaveBeenCalledWith('member1', new Decimal(100));
    });

    it('Given 重试失败, When retryPayment, Then 更新失败原因返回false', async () => {
      const mockWithdrawal = {
        id: 'withdrawal1',
        memberId: 'member1',
        tenantId: 'tenant1',
        amount: new Decimal(100),
        status: WithdrawalStatus.FAILED,
        retryCount: 1,
      };

      mockWithdrawalRepo.findOne.mockResolvedValue(mockWithdrawal);
      const paymentNo = 'WD_BAT_withdrawal1:WD_DTL_withdrawal1';
      mockPaymentService.transfer.mockRejectedValue(new Error('余额不足'));

      const result = await service.retryPayment('withdrawal1');

      expect(result).toBe(false);
      expect(mockWithdrawalRepo.claimFailedForRetry).toHaveBeenCalledWith(
        'withdrawal1',
        BusinessConstants.FINANCE.MAX_PAYMENT_RETRY_COUNT,
        paymentNo,
      );
      expect(mockPaymentService.transfer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'withdrawal1', paymentNo }),
      );
      expect(mockWithdrawalRepo.claimFailedForRetry.mock.invocationCallOrder[0]).toBeLessThan(
        mockPaymentService.transfer.mock.invocationCallOrder[0],
      );
      expect(mockWithdrawalRepo.updateStatusIfCurrent).toHaveBeenLastCalledWith(
        'withdrawal1',
        WithdrawalStatus.PROCESSING,
        {
          status: WithdrawalStatus.FAILED,
          failReason: '余额不足',
        },
      );
    });

    it('Given 重试被通道受理, When retryPayment, Then 更新为处理中返回true', async () => {
      const mockWithdrawal = {
        id: 'withdrawal1',
        memberId: 'member1',
        tenantId: 'tenant1',
        amount: new Decimal(100),
        status: WithdrawalStatus.FAILED,
        retryCount: 1,
      };

      mockWithdrawalRepo.findOne.mockResolvedValue(mockWithdrawal);
      const paymentNo = 'WD_BAT_withdrawal1:WD_DTL_withdrawal1';
      mockPaymentService.transfer.mockResolvedValue({ paymentNo, channelStatus: 'PROCESSING' });

      const result = await service.retryPayment('withdrawal1');

      expect(result).toBe(true);
      expect(mockWithdrawalRepo.updateStatusIfCurrent).toHaveBeenLastCalledWith(
        'withdrawal1',
        WithdrawalStatus.PROCESSING,
        {
          status: WithdrawalStatus.PROCESSING,
          paymentNo,
          failReason: null,
        },
      );
      expect(mockWalletService.deductFrozen).not.toHaveBeenCalled();
    });

    it('Given 重试记录已被其他任务抢占, When retryPayment, Then 不发起外部打款', async () => {
      mockWithdrawalRepo.findOne.mockResolvedValue({
        id: 'withdrawal1',
        status: WithdrawalStatus.FAILED,
        retryCount: 1,
      });
      mockWithdrawalRepo.claimFailedForRetry.mockResolvedValue(0);

      const result = await service.retryPayment('withdrawal1');

      expect(result).toBe(false);
      expect(mockWithdrawalRepo.claimFailedForRetry).toHaveBeenCalledWith(
        'withdrawal1',
        BusinessConstants.FINANCE.MAX_PAYMENT_RETRY_COUNT,
        'WD_BAT_withdrawal1:WD_DTL_withdrawal1',
      );
      expect(mockPaymentService.transfer).not.toHaveBeenCalled();
      expect(mockWalletService.deductFrozen).not.toHaveBeenCalled();
      expect(mockTransactionRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('Given 提现申请, When reject, Then 驳回并解冻余额', async () => {
      const mockWithdrawal = {
        id: 'withdrawal1',
        memberId: 'member1',
        amount: new Decimal(100),
        status: WithdrawalStatus.PENDING,
      };

      mockWalletService.unfreezeBalance.mockResolvedValue({});

      const result = await service.reject(mockWithdrawal as any, 'admin1', '余额异常');

      expect(result.code).toBe(200);
      expect(mockWithdrawalRepo.updateStatusIfCurrent).toHaveBeenCalledWith('withdrawal1', WithdrawalStatus.PENDING, {
        status: WithdrawalStatus.REJECTED,
        auditTime: expect.any(Date),
        auditBy: 'admin1',
        auditRemark: '余额异常',
      });
      expect(mockWalletService.unfreezeBalance).toHaveBeenCalledWith('member1', new Decimal(100));
    });

    it('Given 提现申请已处理, When reject, Then 拒绝且不解冻余额', async () => {
      const withdrawal = {
        id: 'withdrawal1',
        memberId: 'member1',
        amount: new Decimal(100),
        status: WithdrawalStatus.APPROVED,
      };

      await expect(service.reject(withdrawal as any, 'admin1')).rejects.toThrow(BusinessException);

      expect(mockWithdrawalRepo.updateStatusIfCurrent).not.toHaveBeenCalled();
      expect(mockWalletService.unfreezeBalance).not.toHaveBeenCalled();
    });

    it('Given 并发驳回已被其他请求抢占, When reject, Then 幂等返回已处理且不解冻余额', async () => {
      const withdrawal = {
        id: 'withdrawal1',
        memberId: 'member1',
        amount: new Decimal(100),
        status: WithdrawalStatus.PENDING,
      };
      mockWithdrawalRepo.updateStatusIfCurrent.mockResolvedValue(0);

      const result = await service.reject(withdrawal as any, 'admin1');

      expect(result.msg).toBe('提现申请已处理');
      expect(mockWalletService.unfreezeBalance).not.toHaveBeenCalled();
    });
  });

  describe('getRetryableWithdrawals', () => {
    it('Given 有待重试记录, When getRetryableWithdrawals, Then 返回记录列表', async () => {
      const mockWithdrawals = [
        { id: 'w1', status: WithdrawalStatus.FAILED, retryCount: 1 },
        { id: 'w2', status: WithdrawalStatus.FAILED, retryCount: 2 },
      ];

      mockPrismaService.finWithdrawal.findMany.mockResolvedValue(mockWithdrawals);

      const result = await service.getRetryableWithdrawals();

      expect(result).toHaveLength(2);
      expect(mockPrismaService.finWithdrawal.findMany).toHaveBeenCalledWith({
        where: {
          status: WithdrawalStatus.FAILED,
          retryCount: { lt: BusinessConstants.FINANCE.MAX_PAYMENT_RETRY_COUNT },
        },
        orderBy: { createTime: 'asc' },
        take: 10,
      });
    });
  });
});
