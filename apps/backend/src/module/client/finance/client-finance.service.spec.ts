import { Test, TestingModule } from '@nestjs/testing';
import { ClientFinanceService } from './client-finance.service';
import { BusinessException } from 'src/common/exceptions';
import { FinanceCommandPort } from 'src/module/finance/ports/finance-command.port';
import { CommissionQueryPort } from 'src/module/finance/ports/commission-query.port';
import { WalletQueryPort } from 'src/module/finance/ports/wallet-query.port';
import { WithdrawalQueryPort } from 'src/module/finance/ports/withdrawal-query.port';

describe('ClientFinanceService', () => {
  let service: ClientFinanceService;

  const mockFinanceCommandPort = {
    ensureWallet: jest.fn(),
    requestWithdrawal: jest.fn(),
  };

  const mockWalletQueryPort = {
    findTransactionsPage: jest.fn(),
  };

  const mockWithdrawalQueryPort = {
    findPage: jest.fn(),
  };

  const mockCommissionQueryPort = {
    findPage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientFinanceService,
        { provide: FinanceCommandPort, useValue: mockFinanceCommandPort },
        { provide: WalletQueryPort, useValue: mockWalletQueryPort },
        { provide: WithdrawalQueryPort, useValue: mockWithdrawalQueryPort },
        { provide: CommissionQueryPort, useValue: mockCommissionQueryPort },
      ],
    }).compile();

    service = module.get(ClientFinanceService);
    jest.clearAllMocks();
  });

  describe('getWallet', () => {
    it('通过财务命令端口确保钱包后返回', async () => {
      mockFinanceCommandPort.ensureWallet.mockResolvedValue({
        id: 'w1',
        memberId: 'm1',
        tenantId: 't1',
        balance: 0,
        frozen: 0,
        totalIncome: 0,
        pendingRecovery: 0,
      });

      const res = await service.getWallet('t1', 'm1');

      expect(res.data?.balance).toBe(0);
      expect(mockFinanceCommandPort.ensureWallet).toHaveBeenCalledWith('m1', 't1');
    });
  });

  describe('list boundaries', () => {
    it('Given withdrawal list query, When status and page are valid strings, Then normalize before querying current member scope', async () => {
      mockWithdrawalQueryPort.findPage.mockResolvedValue({ rows: [], total: 0, pageNum: 2, pageSize: 20 });

      const result = await service.getWithdrawalList('tenant-1', 'member-1', {
        status: 'FAILED',
        pageNum: '2' as never,
        pageSize: '20' as never,
      });

      expect(mockWithdrawalQueryPort.findPage).toHaveBeenCalledWith(
        expect.objectContaining({
          pageNum: 2,
          pageSize: 20,
          where: expect.objectContaining({ tenantId: 'tenant-1', memberId: 'member-1', status: 'FAILED' }),
        }),
      );
      expect(result.data?.total).toBe(0);
    });

    it('Given invalid withdrawal status, When getWithdrawalList, Then reject before query port access', async () => {
      await expect(
        service.getWithdrawalList('tenant-1', 'member-1', { status: 'INVALID', pageNum: 1, pageSize: 10 }),
      ).rejects.toThrow(BusinessException);

      expect(mockWithdrawalQueryPort.findPage).not.toHaveBeenCalled();
    });

    it('Given invalid commission page, When getCommissionList, Then reject before query port access', async () => {
      await expect(
        service.getCommissionList('tenant-1', 'member-1', { status: 'SETTLED', pageNum: 0, pageSize: 10 }),
      ).rejects.toThrow(BusinessException);

      expect(mockCommissionQueryPort.findPage).not.toHaveBeenCalled();
    });

    it('Given invalid transaction type, When getTransactionList, Then reject before query port access', async () => {
      await expect(
        service.getTransactionList('tenant-1', 'member-1', { type: 'UNKNOWN', pageNum: 1, pageSize: 10 }),
      ).rejects.toThrow(BusinessException);

      expect(mockWalletQueryPort.findTransactionsPage).not.toHaveBeenCalled();
    });

    it('Given valid transaction query, When getTransactionList, Then force member and tenant scope', async () => {
      mockWalletQueryPort.findTransactionsPage.mockResolvedValue({ rows: [], total: 0, pageNum: 1, pageSize: 10 });

      await service.getTransactionList('tenant-1', 'member-1', { type: 'WITHDRAW_OUT', pageNum: 1, pageSize: 10 });

      expect(mockWalletQueryPort.findTransactionsPage).toHaveBeenCalledWith('member-1', {
        tenantId: 'tenant-1',
        type: 'WITHDRAW_OUT',
        pageNum: 1,
        pageSize: 10,
      });
    });
  });
});
