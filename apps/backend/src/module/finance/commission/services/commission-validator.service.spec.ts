import { Test, TestingModule } from '@nestjs/testing';
import { CommissionValidatorService } from './commission-validator.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { MemberQueryPort } from '../../ports/member-query.port';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';

describe('CommissionValidatorService', () => {
  let service: CommissionValidatorService;
  let prismaService: PrismaService;

  // $transaction 内部使用的 tx mock（含 CAS updateMany）
  const mockTx = {
    finUserDailyQuota: {
      upsert: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }), // 默认：CAS 通过
    },
  };

  const mockPrismaService = {
    sysDistBlacklist: {
      findFirst: jest.fn(),
    },
    umsMember: {
      findUnique: jest.fn(),
    },
    finUserDailyQuota: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: typeof mockTx) => Promise<unknown>, _options?: unknown) => callback(mockTx)),
  };

  // A-T2: MemberQueryPort mock
  const mockMemberQueryPort = {
    findMemberForCommission: jest.fn(),
    findMemberBrief: jest.fn(),
    findMembersBrief: jest.fn(),
    checkCircularReferral: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionValidatorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: MemberQueryPort,
          useValue: mockMemberQueryPort,
        },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    service = module.get<CommissionValidatorService>(CommissionValidatorService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkSelfPurchase', () => {
    it('应该检测到自购 - 订单会员等于分享人', () => {
      const result = service.checkSelfPurchase('member1', 'member1', null);
      expect(result).toBe(true);
    });

    it('应该检测到自购 - 订单会员等于上级', () => {
      const result = service.checkSelfPurchase('member1', null, 'member1');
      expect(result).toBe(true);
    });

    it('应该返回false - 非自购', () => {
      const result = service.checkSelfPurchase('member1', 'member2', 'member3');
      expect(result).toBe(false);
    });
  });

  describe('isUserBlacklisted', () => {
    it('应该返回true - 用户在黑名单', async () => {
      mockPrismaService.sysDistBlacklist.findFirst.mockResolvedValue({
        tenantId: 'tenant1',
        userId: 'user1',
      });

      const result = await service.isUserBlacklisted('tenant1', 'user1');
      expect(result).toBe(true);
    });

    it('应该返回false - 用户不在黑名单', async () => {
      mockPrismaService.sysDistBlacklist.findFirst.mockResolvedValue(null);

      const result = await service.isUserBlacklisted('tenant1', 'user1');
      expect(result).toBe(false);
    });
  });

  describe('checkDailyLimit', () => {
    it('应该通过 - 首次使用且在限额内', async () => {
      // mockTx.finUserDailyQuota.updateMany 默认返回 { count: 1 }（CAS 通过）
      const amount = new Decimal(100);
      const limit = new Decimal(500);

      const result = await service.checkDailyLimit('tenant1', 'user1', amount, limit);

      expect(result).toBe(true);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockTx.finUserDailyQuota.upsert).toHaveBeenCalled();
      expect(mockTx.finUserDailyQuota.updateMany).toHaveBeenCalled();
    });

    it('应该通过 - 累计使用在限额内', async () => {
      // mockTx.finUserDailyQuota.updateMany 默认返回 { count: 1 }（CAS 通过）
      const amount = new Decimal(100);
      const limit = new Decimal(500);

      const result = await service.checkDailyLimit('tenant1', 'user1', amount, limit);

      expect(result).toBe(true);
      expect(mockTx.finUserDailyQuota.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ usedAmount: { lte: limit.sub(amount) } }),
          data: { usedAmount: { increment: amount } },
        }),
      );
    });

    it('应该拒绝 - 超出限额（CAS 条件不满足）', async () => {
      // CAS 模式：updateMany WHERE usedAmount <= limit-amount 条件不满足时返回 count:0
      // 不需要单独 rollback，原子性由 updateMany 条件保证
      const amount = new Decimal(200);
      const limit = new Decimal(500);

      mockTx.finUserDailyQuota.updateMany.mockResolvedValueOnce({ count: 0 });

      const result = await service.checkDailyLimit('tenant1', 'user1', amount, limit);

      expect(result).toBe(false);
      expect(mockTx.finUserDailyQuota.updateMany).toHaveBeenCalled();
      expect(mockPrismaService.finUserDailyQuota.update).not.toHaveBeenCalled();
    });

    it('应该拒绝 - 发生错误时为安全起见拒绝', async () => {
      const amount = new Decimal(100);
      const limit = new Decimal(500);

      mockPrismaService.$transaction.mockRejectedValueOnce(new Error('Database error'));

      const result = await service.checkDailyLimit('tenant1', 'user1', amount, limit);

      expect(result).toBe(false);
    });
  });

  describe('checkCircularReferral', () => {
    beforeEach(() => {
      mockMemberQueryPort.checkCircularReferral.mockReset();
    });

    it('应该检测到循环推荐', async () => {
      // A-T2: 通过 MemberQueryPort 检测循环推荐
      mockMemberQueryPort.checkCircularReferral.mockResolvedValue(true);

      const result = await service.checkCircularReferral('member1', 'member2');

      expect(result).toBe(true);
      expect(mockMemberQueryPort.checkCircularReferral).toHaveBeenCalledWith('member1', 'member2');
    });

    it('应该返回false - 无循环推荐', async () => {
      mockMemberQueryPort.checkCircularReferral.mockResolvedValue(false);

      const result = await service.checkCircularReferral('member1', 'member2');

      expect(result).toBe(false);
      expect(mockMemberQueryPort.checkCircularReferral).toHaveBeenCalledWith('member1', 'member2');
    });
  });

  describe('budget context', () => {
    it('应该在预算不足时返回熔断与不足标记', () => {
      const result = service.validateBudgetContext(
        {
          budgetTotal: 100,
          budgetAlertThreshold: 70,
          budgetFuseThreshold: 90,
        },
        {
          activityVersionId: 'version_001',
          shareChannel: 'MINIAPP',
          currentLevelId: 1,
          targetLevelId: 2,
        },
        {
          consumedAmount: 60,
          frozenAmount: 50,
          releasedAmount: 0,
        },
      );

      expect(result.budgetEnforced).toBe(true);
      expect(result.insufficientBudget).toBe(true);
      expect(result.fuseTriggered).toBe(true);
      expect(result.alertTriggered).toBe(true);
      expect(result.budgetRemaining).toBe(0);
      expect(result.isValid).toBe(false);
    });

    it('应该在接近预警阈值时返回告警标记', () => {
      const result = service.validateBudgetContext(
        {
          budgetTotal: 100,
          budgetAlertThreshold: 70,
          budgetFuseThreshold: 90,
        },
        {
          activityVersionId: 'version_001',
          shareChannel: 'H5',
          currentLevelId: 1,
          targetLevelId: 2,
        },
        {
          frozenAmount: 75,
        },
      );

      expect(result.insufficientBudget).toBe(false);
      expect(result.alertTriggered).toBe(true);
      expect(result.fuseTriggered).toBe(false);
      expect(result.budgetUsageRate).toBe(75);
      expect(result.isValid).toBe(true);
    });

    it('应该在触发熔断阈值时返回熔断标记', () => {
      const result = service.validateBudgetContext(
        {
          budgetTotal: 100,
          budgetAlertThreshold: 70,
          budgetFuseThreshold: 90,
        },
        {
          activityVersionId: 'version_001',
          shareChannel: 'APP',
          currentLevelId: 2,
          targetLevelId: 3,
        },
        {
          frozenAmount: 92,
        },
      );

      expect(result.alertTriggered).toBe(true);
      expect(result.fuseTriggered).toBe(true);
      expect(result.insufficientBudget).toBe(false);
      expect(result.isValid).toBe(false);
    });

    it('应该在上下文缺失时容错并返回快照', () => {
      const snapshot = service.buildBudgetSnapshot(
        {
          budgetTotal: 1000,
          budgetAlertThreshold: 75,
          budgetFuseThreshold: 95,
        },
        {},
        {
          frozenAmount: 80,
        },
      );

      const validation = service.validateBudgetContext(
        {
          budgetTotal: 1000,
          budgetAlertThreshold: 75,
          budgetFuseThreshold: 95,
        },
        {},
        {
          frozenAmount: 80,
        },
      );

      expect(snapshot.budgetTotal).toBe(1000);
      expect(snapshot.budgetFrozen).toBe(80);
      expect(snapshot.budgetByLevel).toEqual({ LUNKNOWN: 80 });
      expect(snapshot.budgetByChannel).toEqual({ UNKNOWN: 80 });
      expect(snapshot.budgetByActivityVersion).toEqual({ UNKNOWN: 80 });
      expect(validation.missingContext).toBe(true);
      expect(validation.budgetEnforced).toBe(true);
      expect(validation.isValid).toBe(true);
    });
  });
});
