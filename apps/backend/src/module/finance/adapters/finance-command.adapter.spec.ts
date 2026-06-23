import { Decimal } from '@prisma/client/runtime/library';
import { FinanceCommandAdapter } from './finance-command.adapter';

describe('FinanceCommandAdapter', () => {
  const walletService = {
    getOrCreateWallet: jest.fn(),
    addBalance: jest.fn(),
    reverseSettledCommissionForOrderRefund: jest.fn(),
  };
  const withdrawalService = {
    apply: jest.fn(),
    audit: jest.fn(),
  };
  const commissionService = {
    triggerCalculation: jest.fn(),
    cancelCommissions: jest.fn(),
    cancelCommissionsForPartialRefund: jest.fn(),
    updatePlanSettleTime: jest.fn(),
  };
  const settlementCoreService = {
    recordPaidOrder: jest.fn(),
    ensureTenantProfile: jest.fn(),
    handleSuccessfulRefundSettlement: jest.fn(),
  };
  let service: FinanceCommandAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FinanceCommandAdapter(
      walletService as never,
      withdrawalService as never,
      commissionService as never,
      settlementCoreService as never,
    );
  });

  describe('invariants', () => {
    it('ensures wallet before crediting income', async () => {
      walletService.addBalance.mockResolvedValue({ balance: '10.00' });
      const amount = new Decimal('10.00');

      await service.creditWalletIncome({
        memberId: 'm1',
        tenantId: 't1',
        amount,
        relatedId: 'order-1',
        remark: 'commission',
      });

      expect(walletService.getOrCreateWallet).toHaveBeenCalledWith('m1', 't1');
      expect(walletService.addBalance).toHaveBeenCalledWith('m1', amount, 'order-1', 'commission');
    });

    it('forwards partial refund commission cancellation arguments unchanged', async () => {
      await service.cancelCommissionsForOrderPartialRefund({
        orderId: 'o1',
        refundRatio: new Decimal('0.25'),
        relatedId: 'refund-1',
      });

      expect(commissionService.cancelCommissionsForPartialRefund).toHaveBeenCalledWith(
        'o1',
        new Decimal('0.25'),
        'refund-1',
      );
    });

    it('forwards successful refund settlement handling unchanged', async () => {
      const refund = { id: 'refund-1', refundSn: 'REFUND_ORDER001_FULL' };

      await service.handleSuccessfulRefundSettlement(refund as never);

      expect(settlementCoreService.handleSuccessfulRefundSettlement).toHaveBeenCalledWith(refund);
    });
  });

  describe('boundary conditions', () => {
    it('passes optional itemIds through when cancelling order commissions', async () => {
      await service.cancelOrderCommissions('o1', [1, 2]);

      expect(commissionService.cancelCommissions).toHaveBeenCalledWith('o1', [1, 2]);
    });

    it('passes withdrawal audit remark as undefined when omitted', async () => {
      await service.auditWithdrawal({
        withdrawalId: 'w1',
        action: 'APPROVE',
        auditBy: 'admin',
        tenantId: 't1',
      });

      expect(withdrawalService.audit).toHaveBeenCalledWith('w1', 'APPROVE', 'admin', 't1', undefined);
    });
  });
});
