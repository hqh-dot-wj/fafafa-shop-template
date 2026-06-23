import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { CommissionStatus } from '@prisma/client';
import { CommissionSettlerService } from './commission-settler.service';
import { CommissionRepository } from '../commission.repository';
import { WalletService } from '../../wallet/wallet.service';

describe('CommissionSettlerService', () => {
  let service: CommissionSettlerService;

  const mockCommissionRepo = {
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };

  const mockWalletService = {
    deductBalanceOrPendingRecovery: jest.fn().mockResolvedValue({
      deducted: new Decimal(0),
      pendingRecovery: new Decimal(0),
    }),
    reverseSettledCommissionForOrderRefund: jest.fn().mockResolvedValue({
      deducted: new Decimal(0),
      pendingRecovery: new Decimal(0),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionSettlerService,
        { provide: CommissionRepository, useValue: mockCommissionRepo },
        { provide: WalletService, useValue: mockWalletService },
      ],
    }).compile();

    service = module.get<CommissionSettlerService>(CommissionSettlerService);
    jest.clearAllMocks();
  });

  describe('cancelByOrderItemId', () => {
    it('Given 冻结中的活动佣金, When cancelByOrderItemId, Then 取消该订单项的佣金', async () => {
      const commission = {
        id: BigInt(1),
        orderId: 'order-1',
        orderItemId: 101,
        beneficiaryId: 'member-2',
        amount: new Decimal(12),
        status: CommissionStatus.FROZEN,
        commissionRuleSource: 'ACTIVITY_FIXED_RATE',
      };

      mockCommissionRepo.findMany.mockResolvedValue([commission]);

      await service.cancelByOrderItemId('order-1', 101);

      expect(mockCommissionRepo.findMany).toHaveBeenCalledWith({
        where: {
          orderId: 'order-1',
          orderItemId: { in: [101] },
        },
      });
      expect(mockCommissionRepo.update).toHaveBeenCalledWith(BigInt(1), { status: CommissionStatus.CANCELLED });
    });

    it('Given 已结算的活动佣金, When cancelByOrderItemId, Then 倒扣余额', async () => {
      const commission = {
        id: BigInt(2),
        orderId: 'order-1',
        orderItemId: 102,
        beneficiaryId: 'member-3',
        amount: new Decimal(20),
        status: CommissionStatus.SETTLED,
        commissionRuleSource: 'ACTIVITY_FIXED_RATE',
      };

      mockCommissionRepo.findMany.mockResolvedValue([commission]);
      mockWalletService.deductBalanceOrPendingRecovery.mockResolvedValue({
        deducted: new Decimal(20),
        pendingRecovery: new Decimal(0),
      });

      await service.cancelByOrderItemId('order-1', 102);

      expect(mockWalletService.deductBalanceOrPendingRecovery).toHaveBeenCalledWith(
        'member-3',
        new Decimal(20),
        'order-1',
        '订单退款，佣金回收',
        expect.anything(),
      );
      expect(mockCommissionRepo.update).toHaveBeenCalledWith(BigInt(2), { status: CommissionStatus.CANCELLED });
    });

    it('Given 该订单项无佣金记录, When cancelByOrderItemId, Then 静默返回', async () => {
      mockCommissionRepo.findMany.mockResolvedValue([]);

      await service.cancelByOrderItemId('order-1', 999);

      expect(mockCommissionRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('cancelCommissions - 全额退款', () => {
    it('Given 多条冻结佣金, When cancelCommissions 不传 itemIds, Then 全部取消', async () => {
      const commissions = [
        {
          id: BigInt(1),
          orderId: 'order-1',
          beneficiaryId: 'member-2',
          amount: new Decimal(10),
          status: CommissionStatus.FROZEN,
        },
        {
          id: BigInt(2),
          orderId: 'order-1',
          beneficiaryId: 'member-3',
          amount: new Decimal(5),
          status: CommissionStatus.FROZEN,
        },
      ];

      mockCommissionRepo.findMany.mockResolvedValue(commissions);

      await service.cancelCommissions('order-1');

      expect(mockCommissionRepo.findMany).toHaveBeenCalledWith({ where: { orderId: 'order-1' } });
      expect(mockCommissionRepo.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancelCommissionsForPartialRefund', () => {
    it.each([
      ['0', new Decimal(0)],
      ['负数', new Decimal(-0.1)],
      ['超过 1', new Decimal(1.01)],
    ])('Given 退款比例为%s, When 部分退款, Then 拒绝且不修改佣金', async (_label, refundRatio) => {
      await expect(service.cancelCommissionsForPartialRefund('order-1', refundRatio, 'refund-1')).rejects.toMatchObject(
        {
          response: expect.objectContaining({
            msg: '退款比例必须大于0且不超过1',
          }),
        },
      );

      expect(mockCommissionRepo.findMany).not.toHaveBeenCalled();
      expect(mockCommissionRepo.update).not.toHaveBeenCalled();
      expect(mockWalletService.reverseSettledCommissionForOrderRefund).not.toHaveBeenCalled();
    });

    it('Given 冻结和已结算佣金, When 部分退款(50%), Then 只减少金额不取消记录，按比例回退已结算钱包', async () => {
      mockCommissionRepo.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          orderId: 'order-1',
          beneficiaryId: 'member-2',
          amount: new Decimal(20),
          status: CommissionStatus.FROZEN,
        },
        {
          id: BigInt(2),
          orderId: 'order-1',
          beneficiaryId: 'member-3',
          amount: new Decimal(30),
          status: CommissionStatus.SETTLED,
        },
      ]);

      await service.cancelCommissionsForPartialRefund('order-1', new Decimal(0.5), 'refund-1');

      expect(mockCommissionRepo.findMany).toHaveBeenCalledWith({
        where: {
          orderId: 'order-1',
          status: { not: CommissionStatus.CANCELLED },
        },
      });
      // 50% 退款后剩余 10 / 15，不足以取消整条记录 → 只更新 amount
      expect(mockCommissionRepo.update).toHaveBeenCalledWith(BigInt(1), { amount: new Decimal(10) });
      expect(mockCommissionRepo.update).toHaveBeenCalledWith(BigInt(2), { amount: new Decimal(15) });
      // 已结算佣金按退款金额倒扣余额
      expect(mockWalletService.reverseSettledCommissionForOrderRefund).toHaveBeenCalledWith(
        'member-3',
        new Decimal(15),
        'refund-1',
        '订单order-1部分退款回退已结算佣金(佣金#2)',
      );
    });

    it('Given 冻结佣金, When 全额退款(100%), Then 取消整条记录', async () => {
      mockCommissionRepo.findMany.mockResolvedValue([
        {
          id: BigInt(3),
          orderId: 'order-2',
          beneficiaryId: 'member-4',
          amount: new Decimal(50),
          status: CommissionStatus.FROZEN,
        },
      ]);

      await service.cancelCommissionsForPartialRefund('order-2', new Decimal(1), 'refund-2');

      // remainingAmount = 50 - 50 = 0 < 0.01 → CANCELLED
      expect(mockCommissionRepo.update).toHaveBeenCalledWith(BigInt(3), { status: CommissionStatus.CANCELLED });
      expect(mockWalletService.reverseSettledCommissionForOrderRefund).not.toHaveBeenCalled();
    });

    it('Given 佣金金额不能按比例整除到分, When 部分退款, Then 退款额与剩余额守恒到分', async () => {
      mockCommissionRepo.findMany.mockResolvedValue([
        {
          id: BigInt(5),
          orderId: 'order-4',
          beneficiaryId: 'member-6',
          amount: new Decimal('10.01'),
          status: CommissionStatus.SETTLED,
        },
      ]);

      await service.cancelCommissionsForPartialRefund('order-4', new Decimal('0.333'), 'refund-4');

      expect(mockCommissionRepo.update).toHaveBeenCalledWith(BigInt(5), { amount: new Decimal('6.68') });
      expect(mockWalletService.reverseSettledCommissionForOrderRefund).toHaveBeenCalledWith(
        'member-6',
        new Decimal('3.33'),
        'refund-4',
        '订单order-4部分退款回退已结算佣金(佣金#5)',
      );
    });

    // ====================================================================================
    // 规格（部分退款多次累计扣减）
    //   I1: ∀ 单次退款, refundCommissionAmount ≤ min(originalAmount × refundRatio, 剩余 amount)
    //   I2: ∀ 多次部分退款, sum(refundCommissionAmount) ≤ originalAmount  （防御性 cap）
    //   I3: 累计退款比例达到或超过 100% 时，commission 必须落到 CANCELLED 终态
    //   I4: originalAmount = null 时 fallback 到 amount，保持历史数据语义不变
    //
    // 关键回归（漏洞 #20）：
    //   旧实现 splitByRatio(amount, ratio) 用「当前剩余 amount」做基数，
    //   多次部分退款累计扣减偏小。新实现用 originalAmount × ratio 做基数。
    // ====================================================================================

    it('Given originalAmount=100 已扣 30, When 第二次部分退 50%(基于原 payAmount), Then 应扣 50 而非 35', async () => {
      // 复现场景：订单 ¥1000，佣金 originalAmount=¥100
      // 第一次部分退 30% 后 commission.amount = 70（已由前次写回）
      // 第二次部分退 50% 应基于 originalAmount × 0.5 = ¥50 扣减，而非 70 × 0.5 = ¥35
      mockCommissionRepo.findMany.mockResolvedValue([
        {
          id: BigInt(10),
          orderId: 'order-multi-refund',
          beneficiaryId: 'member-10',
          amount: new Decimal(70),
          originalAmount: new Decimal(100),
          status: CommissionStatus.FROZEN,
        },
      ]);

      await service.cancelCommissionsForPartialRefund('order-multi-refund', new Decimal(0.5), 'refund-second');

      expect(mockCommissionRepo.update).toHaveBeenCalledWith(BigInt(10), { amount: new Decimal(20) });
    });

    it('Given originalAmount=null(历史数据), When 部分退款, Then fallback 用 amount 做基数', async () => {
      mockCommissionRepo.findMany.mockResolvedValue([
        {
          id: BigInt(11),
          orderId: 'order-legacy',
          beneficiaryId: 'member-11',
          amount: new Decimal(20),
          originalAmount: null,
          status: CommissionStatus.FROZEN,
        },
      ]);

      await service.cancelCommissionsForPartialRefund('order-legacy', new Decimal(0.5), 'refund-legacy');

      // baseAmount = amount = 20, idealDeduct = 10, remaining = 10
      expect(mockCommissionRepo.update).toHaveBeenCalledWith(BigInt(11), { amount: new Decimal(10) });
    });

    it('Given originalAmount=100 已扣 80, When 第三次部分退 50%(超额防御), Then 应扣 20 触发 CANCELLED', async () => {
      // 累计 ratio 已逼近 100%，单次 ratio × originalAmount > 剩余 amount，应按剩余 cap 并 CANCELLED。
      mockCommissionRepo.findMany.mockResolvedValue([
        {
          id: BigInt(12),
          orderId: 'order-cap',
          beneficiaryId: 'member-12',
          amount: new Decimal(20),
          originalAmount: new Decimal(100),
          status: CommissionStatus.SETTLED,
        },
      ]);

      await service.cancelCommissionsForPartialRefund('order-cap', new Decimal(0.5), 'refund-cap');

      // idealDeduct = 50, cap 到剩余 20, remaining = 0 < 0.01 → CANCELLED
      expect(mockCommissionRepo.update).toHaveBeenCalledWith(BigInt(12), { status: CommissionStatus.CANCELLED });
      // SETTLED 状态下钱包按 cap 后的 20 倒扣
      expect(mockWalletService.reverseSettledCommissionForOrderRefund).toHaveBeenCalledWith(
        'member-12',
        new Decimal(20),
        'refund-cap',
        '订单order-cap部分退款回退已结算佣金(佣金#12)',
      );
    });

    it('Given 极小剩余金额(<0.01), When 部分退款, Then 取消整条记录', async () => {
      mockCommissionRepo.findMany.mockResolvedValue([
        {
          id: BigInt(4),
          orderId: 'order-3',
          beneficiaryId: 'member-5',
          amount: new Decimal('0.01'),
          status: CommissionStatus.FROZEN,
        },
      ]);

      await service.cancelCommissionsForPartialRefund('order-3', new Decimal(0.99), 'refund-3');

      // remainingAmount = 0.01 - 0.01 * 0.99 = 0.0001 → rounds to 0.00 < 0.01 → CANCELLED
      expect(mockCommissionRepo.update).toHaveBeenCalledWith(BigInt(4), { status: CommissionStatus.CANCELLED });
    });
  });
});
