import { Test, TestingModule } from '@nestjs/testing';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { MemberRepository } from 'src/module/admin/member/member.repository';
import { MessageTouchpointDispatcher } from '../../events/message-touchpoint.dispatcher';
import { MarketingEventType } from '../../events/marketing-event.types';
import { PointsRuleService } from '../rule/rule.service';
import { PointsAccountRepository } from './account.repository';
import { PointsTransactionRepository } from './transaction.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClsService } from 'nestjs-cls';
import { PointsAccountService } from './account.service';
import { PointsLotLedgerService } from './points-lot-ledger.service';

describe('PointsAccountService', () => {
  let service: PointsAccountService;

  const mockAccountRepo = {
    findByMemberId: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    atomicAdd: jest.fn(),
    atomicDeduct: jest.fn(),
    atomicFreeze: jest.fn(),
    atomicUnfreeze: jest.fn(),
    atomicSettle: jest.fn(),
    atomicRefundSpent: jest.fn(),
    atomicExpireLotPoints: jest.fn(),
    updateWithOptimisticLock: jest.fn(),
    findPage: jest.fn(),
  };

  const mockTransactionRepo = {
    create: jest.fn(),
    findUserTransactions: jest.fn(),
    getExpiringPoints: jest.fn(),
    findTransactionsAdmin: jest.fn(),
  };

  const mockRuleService = {
    resolveExpireTime: jest.fn().mockResolvedValue(null),
  };
  const mockMemberRepo = {
    findMany: jest.fn(),
  };
  const mockEventEmitter = {
    dispatch: jest.fn(),
  };
  const mockPrisma = {
    $transaction: jest.fn(),
  };
  const mockCls = {
    get: jest.fn(),
    set: jest.fn(),
    run: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    isActive: jest.fn(() => true),
  };
  const mockLotLedgerService = {
    createLotForEarn: jest.fn(),
    consumeAvailableLots: jest.fn(),
    freezeLots: jest.fn(),
    releaseFrozenLots: jest.fn(),
    settleFrozenLots: jest.fn(),
    refundSpentLots: jest.fn(),
    expireLot: jest.fn(),
    getExpiringPoints: jest.fn(),
  };

  beforeEach(async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('00000');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsAccountService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClsService, useValue: mockCls },
        { provide: MemberRepository, useValue: mockMemberRepo },
        { provide: PointsAccountRepository, useValue: mockAccountRepo },
        { provide: PointsTransactionRepository, useValue: mockTransactionRepo },
        { provide: PointsRuleService, useValue: mockRuleService },
        { provide: MessageTouchpointDispatcher, useValue: mockEventEmitter },
        { provide: PointsLotLedgerService, useValue: mockLotLedgerService },
      ],
    }).compile();

    service = module.get<PointsAccountService>(PointsAccountService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({}));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreateAccount', () => {
    it('应返回已存在的账户', async () => {
      const account = { id: 'acc1', memberId: 'm1', availablePoints: 100 };
      mockAccountRepo.findByMemberId.mockResolvedValue(account);

      const result = await service.getOrCreateAccount('m1');

      expect(result.data).toBeDefined();
      expect(result.data.availablePoints).toBe(100);
      expect(mockAccountRepo.create).not.toHaveBeenCalled();
    });

    it('应创建新账户并返回', async () => {
      mockAccountRepo.findByMemberId.mockResolvedValue(null);
      const newAccount = { id: 'acc2', memberId: 'm2', availablePoints: 0 };
      mockAccountRepo.create.mockResolvedValue(newAccount);

      const result = await service.getOrCreateAccount('m2');

      expect(mockAccountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ memberId: 'm2', availablePoints: 0 }),
      );
      expect(result.data).toBeDefined();
    });
  });

  describe('getBalance', () => {
    it('无账户时应返回零余额', async () => {
      mockAccountRepo.findByMemberId.mockResolvedValue(null);

      const result = await service.getBalance('m1');

      expect(result.data).toEqual({
        availablePoints: 0,
        frozenPoints: 0,
        expiringPoints: expect.any(Number),
      });
    });

    it('有账户时应返回余额与即将过期积分', async () => {
      mockAccountRepo.findByMemberId.mockResolvedValue({
        availablePoints: 50,
        frozenPoints: 10,
      });
      mockLotLedgerService.getExpiringPoints.mockResolvedValue(5);

      const result = await service.getBalance('m1');

      expect(result.data.availablePoints).toBe(50);
      expect(result.data.frozenPoints).toBe(10);
      expect(result.data.expiringPoints).toBe(5);
    });
  });

  describe('addPoints', () => {
    beforeEach(() => {
      mockRuleService.resolveExpireTime.mockResolvedValue(null);
    });

    it('应增加积分并创建交易记录', async () => {
      const account = { id: 'acc1', memberId: 'm1', availablePoints: 100 };
      mockAccountRepo.findByMemberId.mockResolvedValue(account);
      mockAccountRepo.atomicAdd.mockResolvedValue({ id: 'acc1', balanceBefore: 100, balanceAfter: 120 });
      const tx = { id: 'tx1', amount: 20, balanceAfter: 120 };
      mockTransactionRepo.create.mockResolvedValue(tx);

      const result = await service.addPoints({
        memberId: 'm1',
        amount: 20,
        type: 'EARN_TASK',
        remark: '任务奖励',
      });

      expect(mockAccountRepo.atomicAdd).toHaveBeenCalledWith('acc1', 20, '00000');
      expect(mockAccountRepo.update).not.toHaveBeenCalled();
      expect(mockTransactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'm1',
          amount: 20,
          balanceBefore: 100,
          balanceAfter: 120,
        }),
      );
      expect(mockLotLedgerService.createLotForEarn).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'm1',
          amount: 20,
          sourceTransactionId: 'tx1',
        }),
      );
      expect(mockEventEmitter.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MarketingEventType.POINTS_EARNED,
          memberId: 'm1',
          configId: 'acc1',
        }),
      );
      expect(result.data).toBeDefined();
    });

    // AC1-1
    it('Given 调用方未传 expireTime 且规则启用有效期, When addPoints, Then lot 与交易记录使用规则推导的 expireTime', async () => {
      const account = { id: 'acc1', memberId: 'm1', availablePoints: 0 };
      mockAccountRepo.findByMemberId.mockResolvedValue(account);
      mockAccountRepo.atomicAdd.mockResolvedValue({ id: 'acc1', balanceBefore: 0, balanceAfter: 10 });
      mockTransactionRepo.create.mockResolvedValue({ id: 'tx-rule', amount: 10, balanceAfter: 10 });
      const ruleExpire = new Date('2026-06-01T00:00:00.000Z');
      mockRuleService.resolveExpireTime.mockResolvedValue(ruleExpire);

      await service.addPoints({ memberId: 'm1', amount: 10, type: 'EARN_TASK', remark: '任务' });

      expect(mockRuleService.resolveExpireTime).toHaveBeenCalled();
      expect(mockTransactionRepo.create).toHaveBeenCalledWith(expect.objectContaining({ expireTime: ruleExpire }));
      expect(mockLotLedgerService.createLotForEarn).toHaveBeenCalledWith(
        expect.objectContaining({ expireTime: ruleExpire }),
      );
    });

    // AC1-2
    it('Given 规则未启用有效期, When addPoints 未传 expireTime, Then lot 与交易记录 expireTime 为 null', async () => {
      const account = { id: 'acc1', memberId: 'm1', availablePoints: 0 };
      mockAccountRepo.findByMemberId.mockResolvedValue(account);
      mockAccountRepo.atomicAdd.mockResolvedValue({ id: 'acc1', balanceBefore: 0, balanceAfter: 10 });
      mockTransactionRepo.create.mockResolvedValue({ id: 'tx-none', amount: 10, balanceAfter: 10 });
      mockRuleService.resolveExpireTime.mockResolvedValue(null);

      await service.addPoints({ memberId: 'm1', amount: 10, type: 'EARN_TASK', remark: '任务' });

      expect(mockTransactionRepo.create).toHaveBeenCalledWith(expect.objectContaining({ expireTime: null }));
      expect(mockLotLedgerService.createLotForEarn).toHaveBeenCalledWith(expect.objectContaining({ expireTime: null }));
    });

    // AC1-3a: 调用方显式传 Date 覆盖规则
    it('Given 调用方显式传 expireTime Date, When addPoints, Then 不调用规则推导且使用传入值', async () => {
      const account = { id: 'acc1', memberId: 'm1', availablePoints: 0 };
      mockAccountRepo.findByMemberId.mockResolvedValue(account);
      mockAccountRepo.atomicAdd.mockResolvedValue({ id: 'acc1', balanceBefore: 0, balanceAfter: 5 });
      mockTransactionRepo.create.mockResolvedValue({ id: 'tx-explicit', amount: 5, balanceAfter: 5 });
      const explicit = new Date('2027-01-01T00:00:00.000Z');
      mockRuleService.resolveExpireTime.mockResolvedValue(new Date('2026-06-01T00:00:00.000Z'));

      await service.addPoints({
        memberId: 'm1',
        amount: 5,
        type: 'EARN_ADMIN',
        remark: '指定有效期',
        expireTime: explicit,
      });

      expect(mockRuleService.resolveExpireTime).not.toHaveBeenCalled();
      expect(mockLotLedgerService.createLotForEarn).toHaveBeenCalledWith(
        expect.objectContaining({ expireTime: explicit }),
      );
    });

    // AC1-3b: 调用方显式传 null = 永久（覆盖规则）
    it('Given 调用方显式传 expireTime null, When addPoints, Then 不调用规则推导且按永久处理', async () => {
      const account = { id: 'acc1', memberId: 'm1', availablePoints: 0 };
      mockAccountRepo.findByMemberId.mockResolvedValue(account);
      mockAccountRepo.atomicAdd.mockResolvedValue({ id: 'acc1', balanceBefore: 0, balanceAfter: 5 });
      mockTransactionRepo.create.mockResolvedValue({ id: 'tx-null', amount: 5, balanceAfter: 5 });
      mockRuleService.resolveExpireTime.mockResolvedValue(new Date('2026-06-01T00:00:00.000Z'));

      await service.addPoints({
        memberId: 'm1',
        amount: 5,
        type: 'EARN_ADMIN',
        remark: '永久补偿',
        expireTime: null,
      });

      expect(mockRuleService.resolveExpireTime).not.toHaveBeenCalled();
      expect(mockLotLedgerService.createLotForEarn).toHaveBeenCalledWith(expect.objectContaining({ expireTime: null }));
    });
  });

  describe('deductPoints', () => {
    // R-PRE-POINTS-01
    it('Given 积分账户不存在, When freezePoints, Then 抛出业务异常', async () => {
      mockAccountRepo.atomicDeduct.mockResolvedValue(null);
      mockAccountRepo.findByMemberId.mockResolvedValue(null);

      await expect(
        service.deductPoints({
          memberId: 'm1',
          amount: 10,
          type: 'USE_ORDER',
          remark: '订单抵扣',
        }),
      ).rejects.toThrow(BusinessException);
    });

    // R-PRE-POINTS-02
    it('Given 可用积分不足, When freezePoints, Then 抛出业务异常', async () => {
      mockAccountRepo.atomicDeduct.mockResolvedValue(null);
      mockAccountRepo.findByMemberId.mockResolvedValue({
        id: 'acc1',
        memberId: 'm1',
        availablePoints: 5,
        usedPoints: 0,
        version: 0,
      });

      await expect(
        service.deductPoints({
          memberId: 'm1',
          amount: 10,
          type: 'USE_ORDER',
          remark: '订单抵扣',
        }),
      ).rejects.toThrow(BusinessException);
    });

    it('应成功扣减积分', async () => {
      const account = {
        id: 'acc1',
        memberId: 'm1',
        availablePoints: 100,
        usedPoints: 0,
        version: 0,
      };
      void account;
      mockAccountRepo.atomicDeduct.mockResolvedValue({ id: 'acc1', balanceBefore: 100, balanceAfter: 90 });
      mockTransactionRepo.create.mockResolvedValue({
        id: 'tx1',
        amount: -10,
        balanceAfter: 90,
      });

      const result = await service.deductPoints({
        memberId: 'm1',
        amount: 10,
        type: 'USE_ORDER',
        relatedId: 'order1',
        remark: '订单抵扣',
      });

      expect(mockAccountRepo.atomicDeduct).toHaveBeenCalledWith('m1', 10, '00000');
      expect(mockAccountRepo.updateWithOptimisticLock).not.toHaveBeenCalled();
      expect(mockEventEmitter.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MarketingEventType.POINTS_USED,
          memberId: 'm1',
          configId: 'acc1',
        }),
      );
      expect(mockLotLedgerService.consumeAvailableLots).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'm1',
          amount: 10,
          spendTransactionId: 'tx1',
          relatedId: 'order1',
        }),
      );
      expect(result.data).toBeDefined();
    });

    it('Given amount 为 0, When deductPoints, Then 直接拒绝且不写流水', async () => {
      await expect(
        service.deductPoints({
          memberId: 'm1',
          amount: 0,
          type: 'USE_ORDER',
          remark: '订单抵扣',
        }),
      ).rejects.toThrow(BusinessException);

      expect(mockAccountRepo.atomicDeduct).not.toHaveBeenCalled();
      expect(mockTransactionRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('freezePoints', () => {
    it('账户不存在应抛异常', async () => {
      mockAccountRepo.atomicFreeze.mockResolvedValue(null);
      mockAccountRepo.findByMemberId.mockResolvedValue(null);

      await expect(service.freezePoints('m1', 10, 'order1')).rejects.toThrow(BusinessException);
    });

    it('余额不足应抛异常', async () => {
      mockAccountRepo.atomicFreeze.mockResolvedValue(null);
      mockAccountRepo.findByMemberId.mockResolvedValue({
        id: 'acc1',
        availablePoints: 5,
        frozenPoints: 0,
        version: 0,
      });

      await expect(service.freezePoints('m1', 10, 'order1')).rejects.toThrow(BusinessException);
    });

    // R-FLOW-POINTS-01
    it('Given 账户可用积分充足, When freezePoints, Then 原子冻结并生成交易记录', async () => {
      const account = {
        id: 'acc1',
        memberId: 'm1',
        availablePoints: 100,
        frozenPoints: 0,
        version: 0,
      };
      void account;
      mockAccountRepo.atomicFreeze.mockResolvedValue({ id: 'acc1', balanceBefore: 100, balanceAfter: 80 });
      mockTransactionRepo.create.mockResolvedValue({ id: 'tx1' });

      const result = await service.freezePoints('m1', 20, 'order1');

      expect(mockAccountRepo.atomicFreeze).toHaveBeenCalledWith('m1', 20, '00000');
      expect(mockAccountRepo.updateWithOptimisticLock).not.toHaveBeenCalled();
      expect(mockLotLedgerService.freezeLots).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'm1',
          amount: 20,
          freezeTransactionId: 'tx1',
          relatedId: 'order1',
        }),
      );
      expect(result.data).toBeDefined();
    });

    it('Given 订单事务内调用, When freezePointsInTx, Then 使用同一原子路径生成冻结流水', async () => {
      mockAccountRepo.atomicFreeze.mockResolvedValue({ id: 'acc1', balanceBefore: 50, balanceAfter: 30 });
      mockTransactionRepo.create.mockResolvedValue({ id: 'tx-freeze-in-tx' });

      const result = await service.freezePointsInTx('m1', 20, 'order1');

      expect(mockAccountRepo.atomicFreeze).toHaveBeenCalledWith('m1', 20, '00000');
      expect(mockLotLedgerService.freezeLots).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acc1',
          freezeTransactionId: 'tx-freeze-in-tx',
          relatedId: 'order1',
        }),
      );
      expect(result.data).toBeDefined();
    });
  });

  describe('unfreezePoints', () => {
    // R-PRE-POINTS-03
    it('Given 冻结积分不足, When unfreezePoints, Then 抛出业务异常', async () => {
      mockAccountRepo.atomicUnfreeze.mockResolvedValue(null);
      mockAccountRepo.findByMemberId.mockResolvedValue({
        id: 'acc1',
        availablePoints: 10,
        frozenPoints: 5,
        version: 0,
      });

      await expect(service.unfreezePoints('m1', 10, 'order1')).rejects.toThrow(BusinessException);
    });

    // R-FLOW-POINTS-02
    it('Given 冻结积分充足, When unfreezePoints, Then 原子解冻并生成交易记录', async () => {
      const account = {
        id: 'acc1',
        memberId: 'm1',
        availablePoints: 80,
        frozenPoints: 20,
        version: 0,
      };
      void account;
      mockAccountRepo.atomicUnfreeze.mockResolvedValue({ id: 'acc1', balanceBefore: 80, balanceAfter: 100 });
      mockTransactionRepo.create.mockResolvedValue({ id: 'tx1' });

      const result = await service.unfreezePoints('m1', 20, 'order1');

      expect(mockAccountRepo.atomicUnfreeze).toHaveBeenCalledWith('m1', 20, '00000');
      expect(mockAccountRepo.updateWithOptimisticLock).not.toHaveBeenCalled();
      expect(mockLotLedgerService.releaseFrozenLots).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'm1',
          amount: 20,
          releaseTransactionId: 'tx1',
          relatedId: 'order1',
        }),
      );
      expect(result.data).toBeDefined();
    });
  });

  describe('settleFrozenPoints', () => {
    it('Given 冻结积分充足, When settleFrozenPoints, Then 生成消费流水并结算冻结分摊', async () => {
      const account = {
        id: 'acc1',
        memberId: 'm1',
        availablePoints: 80,
        frozenPoints: 20,
        usedPoints: 0,
        version: 0,
      };
      void account;
      mockAccountRepo.atomicSettle.mockResolvedValue({ id: 'acc1', balanceBefore: 80, balanceAfter: 80 });
      mockTransactionRepo.create.mockResolvedValue({ id: 'tx1', amount: -20, balanceAfter: 80 });

      const result = await service.settleFrozenPoints({
        memberId: 'm1',
        amount: 20,
        type: 'USE_ORDER',
        relatedId: 'order1',
        remark: '订单抵扣',
      });

      expect(mockAccountRepo.atomicSettle).toHaveBeenCalledWith('m1', 20, '00000');
      expect(mockAccountRepo.updateWithOptimisticLock).not.toHaveBeenCalled();
      expect(mockLotLedgerService.settleFrozenLots).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'm1',
          amount: 20,
          spendTransactionId: 'tx1',
          relatedId: 'order1',
        }),
      );
      expect(result.data).toBeDefined();
    });
  });

  describe('refundSpentPoints', () => {
    it('Given 已消费积分, When refundSpentPoints, Then 恢复账户余额并按消费分摊退款', async () => {
      const account = {
        id: 'acc1',
        memberId: 'm1',
        availablePoints: 50,
        usedPoints: 30,
        version: 0,
      };
      void account;
      mockAccountRepo.atomicRefundSpent.mockResolvedValue({ id: 'acc1', balanceBefore: 50, balanceAfter: 80 });
      mockTransactionRepo.create.mockResolvedValue({ id: 'tx1', amount: 30, balanceAfter: 80 });
      mockLotLedgerService.refundSpentLots.mockResolvedValue({
        strategy: 'ORIGINAL_LOT_RESTORE',
        restoredAmount: 30,
        compensatedAmount: 0,
        fallbackAmount: 0,
      });

      const result = await service.refundSpentPoints({
        memberId: 'm1',
        amount: 30,
        relatedId: 'order1',
        remark: '订单退款原路返还',
      });

      expect(mockAccountRepo.atomicRefundSpent).toHaveBeenCalledWith('m1', 30, '00000');
      expect(mockAccountRepo.updateWithOptimisticLock).not.toHaveBeenCalled();
      expect(mockLotLedgerService.refundSpentLots).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'm1',
          amount: 30,
          refundTransactionId: 'tx1',
          relatedId: 'order1',
        }),
      );
      expect(result.data?.ledger.strategy).toBe('ORIGINAL_LOT_RESTORE');
    });
  });

  describe('expirePointsForLot', () => {
    const buildLot = (
      overrides: Partial<{
        id: string;
        accountId: string;
        memberId: string;
        tenantId: string;
        availableAmount: number;
      }> = {},
    ) => ({
      id: 'lot-exp',
      accountId: 'acc1',
      memberId: 'm1',
      tenantId: 't1',
      availableAmount: 30,
      ...overrides,
    });

    it('Given lot 有可过期余额, When expirePointsForLot, Then 账户字段回写 + 写 EXPIRE 流水 + 调用 lot 过期', async () => {
      const lot = buildLot({ availableAmount: 30 });
      mockAccountRepo.atomicExpireLotPoints.mockResolvedValue({ id: 'acc1', balanceBefore: 100, balanceAfter: 70 });
      mockTransactionRepo.create.mockResolvedValue({ id: 'tx-expire' });

      const result = await service.expirePointsForLot(lot as never);

      expect(mockAccountRepo.atomicExpireLotPoints).toHaveBeenCalledWith('acc1', 30, 't1');
      expect(mockAccountRepo.updateWithOptimisticLock).not.toHaveBeenCalled();
      expect(mockTransactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'EXPIRE',
          amount: -30,
          balanceBefore: 100,
          balanceAfter: 70,
          relatedId: 'lot-exp',
          relatedType: 'POINTS_LOT',
        }),
      );
      expect(mockLotLedgerService.expireLot).toHaveBeenCalledWith(lot, 'tx-expire');
      expect(result).toEqual({ transactionId: 'tx-expire', amount: 30 });
    });

    it('Given lot 可用余额为 0, When expirePointsForLot, Then 直接返回 null 不写入', async () => {
      const lot = buildLot({ availableAmount: 0 });

      const result = await service.expirePointsForLot(lot as never);

      expect(result).toBeNull();
      expect(mockAccountRepo.findById).not.toHaveBeenCalled();
      expect(mockTransactionRepo.create).not.toHaveBeenCalled();
    });

    it('Given 账户 availablePoints 已不够扣 (lot 与账户偏差), When expirePointsForLot, Then balanceAfter 截至 0 不会变成负数', async () => {
      const lot = buildLot({ availableAmount: 50 });
      mockAccountRepo.atomicExpireLotPoints.mockResolvedValue({ id: 'acc1', balanceBefore: 10, balanceAfter: 0 });
      mockTransactionRepo.create.mockResolvedValue({ id: 'tx-clip' });

      await service.expirePointsForLot(lot as never);

      expect(mockTransactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ balanceBefore: 10, balanceAfter: 0 }),
      );
    });

    it('Given 流水写入失败, When expirePointsForLot, Then 直接抛错不在同一事务内重试部分写入', async () => {
      const lot = buildLot({ availableAmount: 30 });
      const error = new Error('transaction write failed');
      mockAccountRepo.atomicExpireLotPoints.mockResolvedValue({ id: 'acc1', balanceBefore: 100, balanceAfter: 70 });
      mockTransactionRepo.create.mockRejectedValue(error);

      await expect(service.expirePointsForLot(lot as never)).rejects.toThrow('transaction write failed');

      expect(mockAccountRepo.atomicExpireLotPoints).toHaveBeenCalledTimes(1);
      expect(mockTransactionRepo.create).toHaveBeenCalledTimes(1);
      expect(mockLotLedgerService.expireLot).not.toHaveBeenCalled();
    });
  });

  describe('getTransactions', () => {
    it('应返回分页交易记录', async () => {
      mockTransactionRepo.findUserTransactions.mockResolvedValue({
        rows: [{ id: 'tx1', amount: 10 }],
        total: 1,
      });

      const result = await service.getTransactions('m1', {
        pageNum: 1,
        pageSize: 10,
      });

      expect(result.data).toBeDefined();
      expect(result.data?.total).toBe(1);
    });
  });

  describe('getAccountsForAdmin', () => {
    it('应返回账户列表并关联会员信息', async () => {
      mockAccountRepo.findPage.mockResolvedValue({
        rows: [{ id: 'acc1', memberId: 'm1' }],
        total: 1,
      });
      mockMemberRepo.findMany.mockResolvedValue([{ memberId: 'm1', nickname: '用户1' }]);

      const result = await service.getAccountsForAdmin({
        pageNum: 1,
        pageSize: 10,
      });

      expect(result.data).toBeDefined();
      expect(result.data?.total).toBe(1);
    });
  });
});
