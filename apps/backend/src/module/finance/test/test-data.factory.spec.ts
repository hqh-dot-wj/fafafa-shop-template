import { TestDataFactory } from './test-data.factory';
import { Decimal } from '@prisma/client/runtime/library';
import { CommissionStatus, WithdrawalStatus } from '@prisma/client';

describe('TestDataFactory', () => {
  describe('createOrder', () => {
    it('Given 无覆盖, When createOrder, Then 返回默认订单', () => {
      const order = TestDataFactory.createOrder();
      expect(order.tenantId).toBe('tenant1');
      expect(order.totalAmount).toBeInstanceOf(Decimal);
      expect(order.items).toHaveLength(1);
    });

    it('Given 覆盖 memberId, When createOrder, Then 使用覆盖值', () => {
      const order = TestDataFactory.createOrder({ memberId: 'custom-member' });
      expect(order.memberId).toBe('custom-member');
    });
  });

  describe('createMember', () => {
    it('Given 无覆盖, When createMember, Then 返回默认会员', () => {
      const member = TestDataFactory.createMember();
      expect(member.tenantId).toBe('tenant1');
      expect(member.levelId).toBe(0);
    });
  });

  describe('createReferralChain', () => {
    it('Given 调用, When createReferralChain, Then 返回三级推荐链', () => {
      const { c0, c1, c2 } = TestDataFactory.createReferralChain();

      expect(c0.parentId).toBe('member-c1');
      expect(c0.indirectParentId).toBe('member-c2');
      expect(c1.parentId).toBe('member-c2');
      expect(c2.parentId).toBeNull();
    });
  });

  describe('createCommission', () => {
    it('Given 无覆盖, When createCommission, Then 返回冻结状态佣金', () => {
      const commission = TestDataFactory.createCommission();
      expect(commission.status).toBe(CommissionStatus.FROZEN);
      expect(commission.amount).toBeInstanceOf(Decimal);
    });

    it('Given createSettledCommission, When 调用, Then 返回已结算佣金', () => {
      const commission = TestDataFactory.createSettledCommission();
      expect(commission.status).toBe(CommissionStatus.SETTLED);
      expect(commission.settleTime).toBeInstanceOf(Date);
    });
  });

  describe('createWallet', () => {
    it('Given createEmptyWallet, When 调用, Then 余额全为0', () => {
      const wallet = TestDataFactory.createEmptyWallet();
      expect(wallet.balance.toString()).toBe('0');
      expect(wallet.frozen.toString()).toBe('0');
      expect(wallet.totalIncome.toString()).toBe('0');
    });

    it('Given createWalletWithPendingRecovery, When 调用, Then 有待回收余额', () => {
      const wallet = TestDataFactory.createWalletWithPendingRecovery();
      expect(wallet.pendingRecovery.toString()).toBe('50');
      expect(wallet.balance.toString()).toBe('0');
    });
  });

  describe('createWithdrawal', () => {
    it('Given createPendingWithdrawal, When 调用, Then 状态为 PENDING', () => {
      const w = TestDataFactory.createPendingWithdrawal();
      expect(w.status).toBe(WithdrawalStatus.PENDING);
    });

    it('Given createApprovedWithdrawal, When 调用, Then 状态为 APPROVED 且有 paymentNo', () => {
      const w = TestDataFactory.createApprovedWithdrawal();
      expect(w.status).toBe(WithdrawalStatus.APPROVED);
      expect(w.paymentNo).toBeDefined();
    });

    it('Given createProcessingWithdrawal, When 调用, Then 状态为 PROCESSING 且有 paymentNo', () => {
      const w = TestDataFactory.createProcessingWithdrawal();
      expect(w.status).toBe(WithdrawalStatus.PROCESSING);
      expect(w.paymentNo).toBeDefined();
    });

    it('Given createRejectedWithdrawal, When 调用, Then 状态为 REJECTED 且有审核备注', () => {
      const w = TestDataFactory.createRejectedWithdrawal();
      expect(w.status).toBe(WithdrawalStatus.REJECTED);
      expect(w.auditRemark).toBeDefined();
    });

    it('Given createFailedWithdrawal, When 调用, Then 状态为 FAILED 且 retryCount>0', () => {
      const w = TestDataFactory.createFailedWithdrawal();
      expect(w.status).toBe(WithdrawalStatus.FAILED);
      expect(w.retryCount).toBeGreaterThan(0);
    });
  });

  describe('createBatchCommissions', () => {
    it('Given count=5, When createBatchCommissions, Then 返回5条佣金记录', () => {
      const commissions = TestDataFactory.createBatchCommissions(5);
      expect(commissions).toHaveLength(5);
      commissions.forEach((c, i) => {
        expect(c.orderId).toBe(`order-${i + 1}`);
      });
    });
  });

  describe('createCrossTenantScenario', () => {
    it('Given 调用, When createCrossTenantScenario, Then 返回跨店场景数据', () => {
      const { order, beneficiary, config } = TestDataFactory.createCrossTenantScenario();
      expect(order.tenantId).toBe('tenant1');
      expect(beneficiary.tenantId).toBe('tenant2');
      expect(config.enableCrossTenant).toBe(true);
    });
  });

  describe('createSelfPurchaseScenario', () => {
    it('Given 调用, When createSelfPurchaseScenario, Then 自购场景 memberId=shareUserId', () => {
      const { member, order } = TestDataFactory.createSelfPurchaseScenario();
      expect(order.memberId).toBe(member.memberId);
      expect(order.shareUserId).toBe(member.memberId);
    });
  });
});
