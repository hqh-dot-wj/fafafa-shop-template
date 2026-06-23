import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { PointsTransactionType } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { BusinessException } from '../../src/common/exceptions/business.exception';
import { MemberRepository } from '../../src/module/admin/member/member.repository';
import { MessageTouchpointDispatcher } from '../../src/module/marketing/events/message-touchpoint.dispatcher';
import { PointsAccountRepository } from '../../src/module/marketing/points/account/account.repository';
import { PointsAccountService } from '../../src/module/marketing/points/account/account.service';
import { PointsLotLedgerService } from '../../src/module/marketing/points/account/points-lot-ledger.service';
import { PointsTransactionRepository } from '../../src/module/marketing/points/account/transaction.repository';
import { PointsRuleService } from '../../src/module/marketing/points/rule/rule.service';

describe('PointsAccountService', () => {
  let service: PointsAccountService;

  const mockAccountRepo = {
    findByMemberId: jest.fn(),
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
  };

  const mockTransactionRepo = {
    create: jest.fn(),
    findUserTransactions: jest.fn(),
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

  const mockMessageTouchpointDispatcher = {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };

  const mockPrisma = {
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(mockPrisma)),
  };

  const mockClsService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    mockPrisma.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(mockPrisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsAccountService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ClsService,
          useValue: mockClsService,
        },
        {
          provide: PointsAccountRepository,
          useValue: mockAccountRepo,
        },
        {
          provide: PointsTransactionRepository,
          useValue: mockTransactionRepo,
        },
        {
          provide: PointsRuleService,
          // addPoints 内部会调用 resolveExpireTime 推导有效期，未启用规则时返回 null
          useValue: { resolveExpireTime: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: MemberRepository,
          useValue: {},
        },
        {
          provide: MessageTouchpointDispatcher,
          useValue: mockMessageTouchpointDispatcher,
        },
        {
          provide: PointsLotLedgerService,
          useValue: mockLotLedgerService,
        },
      ],
    }).compile();

    service = module.get<PointsAccountService>(PointsAccountService);
    mockClsService.get.mockReturnValue('test-tenant-001');
    mockLotLedgerService.createLotForEarn.mockResolvedValue(undefined);
    mockLotLedgerService.consumeAvailableLots.mockResolvedValue(undefined);
    mockLotLedgerService.freezeLots.mockResolvedValue(undefined);
    mockLotLedgerService.releaseFrozenLots.mockResolvedValue(undefined);
    mockLotLedgerService.getExpiringPoints.mockResolvedValue(0);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getOrCreateAccount', () => {
    it('应该返回已存在的账户', async () => {
      const memberId = 'member-001';
      const account = {
        id: 'account-001',
        memberId,
        availablePoints: 100,
        frozenPoints: 0,
      };

      mockAccountRepo.findByMemberId.mockResolvedValue(account);

      const result = await service.getOrCreateAccount(memberId);

      expect(result.code).toBe(200);
      expect(result.data.id).toBe('account-001');
      expect(mockAccountRepo.create).not.toHaveBeenCalled();
    });

    it('应该创建新账户', async () => {
      const memberId = 'member-002';

      mockAccountRepo.findByMemberId.mockResolvedValue(null);
      mockAccountRepo.create.mockResolvedValue({
        id: 'account-002',
        memberId,
        availablePoints: 0,
        frozenPoints: 0,
      });

      const result = await service.getOrCreateAccount(memberId);

      expect(result.code).toBe(200);
      expect(mockAccountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId,
          totalPoints: 0,
          availablePoints: 0,
          version: 0,
        }),
      );
    });
  });

  describe('addPoints', () => {
    it('应该成功增加积分并创建积分批次', async () => {
      const dto = {
        memberId: 'member-001',
        amount: 100,
        type: PointsTransactionType.EARN_ORDER,
        remark: '消费获得积分',
      };

      const account = {
        id: 'account-001',
        memberId: dto.memberId,
        availablePoints: 200,
      };

      mockAccountRepo.findByMemberId.mockResolvedValue(account);
      mockAccountRepo.atomicAdd.mockResolvedValue({ id: 'account-001', balanceBefore: 200, balanceAfter: 300 });
      mockTransactionRepo.create.mockResolvedValue({
        id: 'transaction-001',
        amount: dto.amount,
        balanceBefore: 200,
        balanceAfter: 300,
      });

      const result = await service.addPoints(dto);

      expect(result.code).toBe(200);
      expect(result.data.amount).toBe(100);
      expect(mockAccountRepo.atomicAdd).toHaveBeenCalledWith('account-001', 100, expect.any(String));
      expect(mockAccountRepo.update).not.toHaveBeenCalled();
      expect(mockLotLedgerService.createLotForEarn).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: dto.memberId,
          amount: dto.amount,
          sourceTransactionId: 'transaction-001',
        }),
      );
      expect(mockMessageTouchpointDispatcher.dispatch).toHaveBeenCalled();
    });
  });

  describe('deductPoints', () => {
    it('应该成功扣减积分并消费可用批次', async () => {
      const dto = {
        memberId: 'member-001',
        amount: 50,
        type: PointsTransactionType.USE_ORDER,
        remark: '积分抵扣',
      };

      mockAccountRepo.atomicDeduct.mockResolvedValue({
        id: 'account-001',
        balanceBefore: 200,
        balanceAfter: 150,
      });
      mockTransactionRepo.create.mockResolvedValue({
        id: 'transaction-001',
        amount: -50,
        balanceBefore: 200,
        balanceAfter: 150,
      });

      const result = await service.deductPoints(dto);

      expect(result.code).toBe(200);
      expect(result.data.amount).toBe(-50);
      expect(mockAccountRepo.atomicDeduct).toHaveBeenCalledWith('member-001', 50, expect.any(String));
      expect(mockAccountRepo.updateWithOptimisticLock).not.toHaveBeenCalled();
      expect(mockLotLedgerService.consumeAvailableLots).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: dto.memberId,
          amount: dto.amount,
          spendTransactionId: 'transaction-001',
        }),
      );
    });

    it('应该在余额不足时抛出异常', async () => {
      mockAccountRepo.atomicDeduct.mockResolvedValue(null);
      mockAccountRepo.findByMemberId.mockResolvedValue({
        id: 'account-001',
        memberId: 'member-001',
        availablePoints: 200,
        version: 1,
      });

      await expect(
        service.deductPoints({
          memberId: 'member-001',
          amount: 300,
          type: PointsTransactionType.USE_ORDER,
          remark: '积分抵扣',
        }),
      ).rejects.toThrow(BusinessException);
    });

    it('应该在原子扣减失败时不重试且不写流水', async () => {
      const optimisticCallsBefore = mockAccountRepo.updateWithOptimisticLock.mock.calls.length;
      const transactionCallsBefore = mockTransactionRepo.create.mock.calls.length;
      mockAccountRepo.atomicDeduct.mockResolvedValue(null);
      mockAccountRepo.findByMemberId.mockResolvedValue({
        id: 'account-001',
        memberId: 'member-001',
        availablePoints: 200,
        usedPoints: 100,
        version: 1,
      });
      await expect(
        service.deductPoints({
          memberId: 'member-001',
          amount: 50,
          type: PointsTransactionType.USE_ORDER,
          remark: '积分抵扣',
        }),
      ).rejects.toThrow(BusinessException);

      expect(mockAccountRepo.updateWithOptimisticLock.mock.calls.length - optimisticCallsBefore).toBe(0);
      expect(mockTransactionRepo.create.mock.calls.length - transactionCallsBefore).toBe(0);
    });

    it('应该在 amount 为 0 时直接抛出异常', async () => {
      mockAccountRepo.findByMemberId.mockResolvedValue({
        id: 'account-001',
        memberId: 'member-001',
        availablePoints: 200,
        usedPoints: 0,
        version: 1,
      });
      await expect(
        service.deductPoints({
          memberId: 'member-001',
          amount: 0,
          type: PointsTransactionType.USE_ORDER,
          remark: '积分抵扣',
        }),
      ).rejects.toThrow(BusinessException);

      expect(mockAccountRepo.atomicDeduct).not.toHaveBeenCalled();
      expect(mockAccountRepo.updateWithOptimisticLock).not.toHaveBeenCalled();
      expect(mockTransactionRepo.create).not.toHaveBeenCalled();
      expect(mockLotLedgerService.consumeAvailableLots).not.toHaveBeenCalled();
    });
  });

  describe('freezePoints', () => {
    it('应该成功冻结积分并冻结批次', async () => {
      const memberId = 'member-001';
      const amount = 100;
      const relatedId = 'order-001';

      mockAccountRepo.atomicFreeze.mockResolvedValue({ id: 'account-001', balanceBefore: 200, balanceAfter: 100 });
      mockTransactionRepo.create.mockResolvedValue({
        id: 'transaction-001',
        amount: -100,
      });

      const result = await service.freezePoints(memberId, amount, relatedId);

      expect(result.code).toBe(200);
      expect(mockAccountRepo.atomicFreeze).toHaveBeenCalledWith(memberId, amount, expect.any(String));
      expect(mockAccountRepo.updateWithOptimisticLock).not.toHaveBeenCalled();
      expect(mockLotLedgerService.freezeLots).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId,
          amount,
          freezeTransactionId: 'transaction-001',
          relatedId,
        }),
      );
    });

    it('应该在余额不足时抛出异常', async () => {
      mockAccountRepo.atomicFreeze.mockResolvedValue(null);
      mockAccountRepo.findByMemberId.mockResolvedValue({
        id: 'account-001',
        memberId: 'member-001',
        availablePoints: 200,
        frozenPoints: 0,
        version: 1,
      });

      await expect(service.freezePoints('member-001', 300, 'order-001')).rejects.toThrow(BusinessException);
    });
  });

  describe('unfreezePoints', () => {
    it('应该成功解冻积分并释放冻结批次', async () => {
      const memberId = 'member-001';
      const amount = 100;
      const relatedId = 'order-001';

      mockAccountRepo.atomicUnfreeze.mockResolvedValue({ id: 'account-001', balanceBefore: 100, balanceAfter: 200 });
      mockTransactionRepo.create.mockResolvedValue({
        id: 'transaction-001',
        amount: 100,
      });

      const result = await service.unfreezePoints(memberId, amount, relatedId);

      expect(result.code).toBe(200);
      expect(mockAccountRepo.atomicUnfreeze).toHaveBeenCalledWith(memberId, amount, expect.any(String));
      expect(mockAccountRepo.updateWithOptimisticLock).not.toHaveBeenCalled();
      expect(mockLotLedgerService.releaseFrozenLots).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId,
          amount,
          releaseTransactionId: 'transaction-001',
          relatedId,
        }),
      );
    });

    it('应该在冻结积分不足时抛出异常', async () => {
      mockAccountRepo.atomicUnfreeze.mockResolvedValue(null);
      mockAccountRepo.findByMemberId.mockResolvedValue({
        id: 'account-001',
        memberId: 'member-001',
        availablePoints: 100,
        frozenPoints: 100,
        version: 1,
      });

      await expect(service.unfreezePoints('member-001', 200, 'order-001')).rejects.toThrow(BusinessException);
    });
  });

  describe('getTransactions', () => {
    it('应该返回积分明细', async () => {
      mockTransactionRepo.findUserTransactions.mockResolvedValue({
        rows: [
          { id: 'trans-001', amount: 100, type: PointsTransactionType.EARN_ORDER },
          { id: 'trans-002', amount: -50, type: PointsTransactionType.USE_ORDER },
        ],
        total: 2,
      });

      const result = await service.getTransactions('member-001', {
        pageNum: 1,
        pageSize: 10,
      });

      expect(result.code).toBe(200);
      expect(result.data.rows).toHaveLength(2);
      expect(result.data.total).toBe(2);
    });
  });

  describe('getExpiringPoints', () => {
    it('应该返回即将过期的积分', async () => {
      mockLotLedgerService.getExpiringPoints.mockResolvedValue(500);

      const result = await service.getExpiringPoints('member-001', 30);

      expect(result.code).toBe(200);
      expect(result.data.expiringPoints).toBe(500);
      expect(result.data.days).toBe(30);
    });
  });
});
