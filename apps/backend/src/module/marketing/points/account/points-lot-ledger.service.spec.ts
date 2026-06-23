import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { PointsFreezeAllocationStatus, PointsRefundAllocationStrategy } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { PointsLotLedgerService } from './points-lot-ledger.service';
import { PointsRuleService } from '../rule/rule.service';

describe('PointsLotLedgerService', () => {
  let service: PointsLotLedgerService;
  const mockRuleService = {
    resolveExpireTime: jest.fn().mockResolvedValue(null),
  };

  const mockPrisma = {
    $transaction: jest.fn(),
    mktPointsLot: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    mktPointsFreezeAllocation: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    mktPointsConsumeAllocation: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    mktPointsRefundAllocation: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockCls = {
    get: jest.fn(),
    set: jest.fn(),
    run: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    isActive: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsLotLedgerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClsService, useValue: mockCls },
        { provide: PointsRuleService, useValue: mockRuleService },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    service = module.get(PointsLotLedgerService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({}));
  });

  it('Given 多个可用 lot, When freezeLots, Then 按 FIFO 冻结并记录冻结分摊', async () => {
    mockPrisma.mktPointsLot.findMany.mockResolvedValue([
      {
        id: 'lot-1',
        availableAmount: 60,
        frozenAmount: 0,
        consumedAmount: 0,
      },
      {
        id: 'lot-2',
        availableAmount: 50,
        frozenAmount: 0,
        consumedAmount: 0,
      },
    ]);

    await service.freezeLots({
      tenantId: 't1',
      accountId: 'acc1',
      memberId: 'm1',
      amount: 80,
      freezeTransactionId: 'freeze-tx',
      relatedId: 'order1',
    });

    expect(mockPrisma.mktPointsLot.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'lot-1' },
        data: expect.objectContaining({ availableAmount: 0, frozenAmount: 60 }),
      }),
    );
    expect(mockPrisma.mktPointsLot.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'lot-2' },
        data: expect.objectContaining({ availableAmount: 30, frozenAmount: 20 }),
      }),
    );
    expect(mockPrisma.mktPointsFreezeAllocation.create).toHaveBeenCalledTimes(2);
  });

  it('Given 已冻结分摊, When settleFrozenLots, Then 转为消费分摊并关闭冻结分摊', async () => {
    mockPrisma.mktPointsFreezeAllocation.findMany.mockResolvedValue([
      {
        id: 'fa-1',
        tenantId: 't1',
        accountId: 'acc1',
        memberId: 'm1',
        lotId: 'lot-1',
        amount: 30,
        lot: {
          availableAmount: 0,
          frozenAmount: 30,
          consumedAmount: 0,
        },
      },
    ]);

    await service.settleFrozenLots({
      tenantId: 't1',
      accountId: 'acc1',
      memberId: 'm1',
      amount: 30,
      spendTransactionId: 'spend-tx',
      relatedId: 'order1',
    });

    expect(mockPrisma.mktPointsConsumeAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          spendTransactionId: 'spend-tx',
          sourceFreezeAllocationId: 'fa-1',
          lotId: 'lot-1',
          amount: 30,
          refundableAmount: 30,
        }),
      }),
    );
    expect(mockPrisma.mktPointsFreezeAllocation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'fa-1' },
        data: { status: PointsFreezeAllocationStatus.CONSUMED },
      }),
    );
  });

  it('Given 已冻结分摊金额大于释放金额, When releaseFrozenLots, Then 保留剩余 ACTIVE 分摊', async () => {
    mockPrisma.mktPointsFreezeAllocation.findMany.mockResolvedValue([
      {
        id: 'fa-1',
        tenantId: 't1',
        accountId: 'acc1',
        memberId: 'm1',
        lotId: 'lot-1',
        amount: 30,
        lot: {
          availableAmount: 0,
          frozenAmount: 30,
          consumedAmount: 0,
        },
      },
    ]);

    await service.releaseFrozenLots({
      tenantId: 't1',
      accountId: 'acc1',
      memberId: 'm1',
      amount: 10,
      releaseTransactionId: 'release-tx',
      relatedId: 'order1',
    });

    expect(mockPrisma.mktPointsLot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lot-1' },
        data: expect.objectContaining({
          availableAmount: { increment: 10 },
          frozenAmount: { decrement: 10 },
        }),
      }),
    );
    expect(mockPrisma.mktPointsFreezeAllocation.update).toHaveBeenCalledWith({
      where: { id: 'fa-1' },
      data: { amount: 20 },
    });
  });

  it('Given 已冻结分摊金额大于结算金额, When settleFrozenLots, Then 消费部分并保留剩余 ACTIVE 分摊', async () => {
    mockPrisma.mktPointsFreezeAllocation.findMany.mockResolvedValue([
      {
        id: 'fa-1',
        tenantId: 't1',
        accountId: 'acc1',
        memberId: 'm1',
        lotId: 'lot-1',
        amount: 30,
        lot: {
          availableAmount: 0,
          frozenAmount: 30,
          consumedAmount: 0,
        },
      },
    ]);

    await service.settleFrozenLots({
      tenantId: 't1',
      accountId: 'acc1',
      memberId: 'm1',
      amount: 10,
      spendTransactionId: 'spend-tx',
      relatedId: 'order1',
    });

    expect(mockPrisma.mktPointsConsumeAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          spendTransactionId: 'spend-tx',
          sourceFreezeAllocationId: 'fa-1',
          lotId: 'lot-1',
          amount: 10,
          refundableAmount: 10,
        }),
      }),
    );
    expect(mockPrisma.mktPointsFreezeAllocation.update).toHaveBeenCalledWith({
      where: { id: 'fa-1' },
      data: { amount: 20 },
    });
  });

  it('Given 消费分摊 lot 未过期, When refundSpentLots, Then 原 lot 恢复并记录原路退款分摊', async () => {
    mockPrisma.mktPointsConsumeAllocation.findMany.mockResolvedValue([
      {
        id: 'ca-1',
        tenantId: 't1',
        accountId: 'acc1',
        memberId: 'm1',
        spendTransactionId: 'spend-tx',
        lotId: 'lot-1',
        refundableAmount: 20,
        lot: {
          id: 'lot-1',
          expireTime: null,
        },
      },
    ]);

    const result = await service.refundSpentLots({
      tenantId: 't1',
      accountId: 'acc1',
      memberId: 'm1',
      amount: 20,
      relatedId: 'order1',
      refundTransactionId: 'refund-tx',
    });

    expect(mockPrisma.mktPointsLot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lot-1' },
        data: expect.objectContaining({
          availableAmount: { increment: 20 },
          consumedAmount: { decrement: 20 },
        }),
      }),
    );
    expect(mockPrisma.mktPointsRefundAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          strategy: PointsRefundAllocationStrategy.ORIGINAL_LOT_RESTORE,
          sourceConsumeAllocationId: 'ca-1',
          sourceLotId: 'lot-1',
          targetLotId: 'lot-1',
        }),
      }),
    );
    expect(result.strategy).toBe(PointsRefundAllocationStrategy.ORIGINAL_LOT_RESTORE);
  });

  it('Given 消费分摊缺失, When refundSpentLots, Then 创建补偿 lot 并返回降级策略', async () => {
    mockPrisma.mktPointsConsumeAllocation.findMany.mockResolvedValue([]);
    mockPrisma.mktPointsLot.create.mockResolvedValue({ id: 'refund-lot' });

    const result = await service.refundSpentLots({
      tenantId: 't1',
      accountId: 'acc1',
      memberId: 'm1',
      amount: 15,
      relatedId: 'legacy-order',
      refundTransactionId: 'refund-tx',
    });

    expect(mockPrisma.mktPointsLot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceTransactionId: 'refund-tx',
          totalAmount: 15,
          availableAmount: 15,
        }),
      }),
    );
    expect(mockPrisma.mktPointsRefundAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          strategy: PointsRefundAllocationStrategy.NEW_REFUND_TRANSACTION,
          targetLotId: 'refund-lot',
          amount: 15,
        }),
      }),
    );
    expect(result.strategy).toBe(PointsRefundAllocationStrategy.NEW_REFUND_TRANSACTION);
  });

  // AC1-4: 已过期 lot 走补偿，补偿 lot 应用规则推导的新 expireTime（不能继承已过期时间）
  it('Given 原 lot 已过期, When refundSpentLots, Then 创建补偿 lot 使用规则推导的 expireTime', async () => {
    const expiredAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockPrisma.mktPointsConsumeAllocation.findMany.mockResolvedValue([
      {
        id: 'ca-exp',
        tenantId: 't1',
        accountId: 'acc1',
        memberId: 'm1',
        spendTransactionId: 'spend-tx',
        lotId: 'lot-exp',
        refundableAmount: 10,
        lot: { id: 'lot-exp', expireTime: expiredAt },
      },
    ]);
    mockPrisma.mktPointsLot.create.mockResolvedValue({ id: 'compensation-lot' });
    const compensationExpire = new Date('2026-12-01T00:00:00.000Z');
    mockRuleService.resolveExpireTime.mockResolvedValueOnce(compensationExpire);

    const result = await service.refundSpentLots({
      tenantId: 't1',
      accountId: 'acc1',
      memberId: 'm1',
      amount: 10,
      relatedId: 'order-exp',
      refundTransactionId: 'refund-tx-exp',
    });

    expect(mockRuleService.resolveExpireTime).toHaveBeenCalled();
    expect(mockPrisma.mktPointsLot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceTransactionId: 'refund-tx-exp',
          totalAmount: 10,
          expireTime: compensationExpire,
        }),
      }),
    );
    expect(result.strategy).toBe(PointsRefundAllocationStrategy.EXPIRED_LOT_COMPENSATION);
  });

  // AC1-5: NEW_REFUND_TRANSACTION fallback 也按规则计算
  it('Given 消费分摊缺失且规则未启用, When refundSpentLots, Then 兜底补偿 lot expireTime 为 null', async () => {
    mockPrisma.mktPointsConsumeAllocation.findMany.mockResolvedValue([]);
    mockPrisma.mktPointsLot.create.mockResolvedValue({ id: 'fallback-lot' });
    mockRuleService.resolveExpireTime.mockResolvedValueOnce(null);

    await service.refundSpentLots({
      tenantId: 't1',
      accountId: 'acc1',
      memberId: 'm1',
      amount: 5,
      relatedId: 'legacy-order',
      refundTransactionId: 'refund-tx-fb',
    });

    expect(mockPrisma.mktPointsLot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expireTime: null }),
      }),
    );
  });

  // AC1-6: 原 lot 未过期分支不新建 lot，规则不影响
  it('Given 原 lot 未过期, When refundSpentLots, Then 不创建补偿 lot 且不读取规则', async () => {
    mockPrisma.mktPointsConsumeAllocation.findMany.mockResolvedValue([
      {
        id: 'ca-ok',
        tenantId: 't1',
        accountId: 'acc1',
        memberId: 'm1',
        spendTransactionId: 'spend-tx',
        lotId: 'lot-ok',
        refundableAmount: 8,
        lot: { id: 'lot-ok', expireTime: null },
      },
    ]);
    mockRuleService.resolveExpireTime.mockClear();
    mockPrisma.mktPointsLot.create.mockClear();

    await service.refundSpentLots({
      tenantId: 't1',
      accountId: 'acc1',
      memberId: 'm1',
      amount: 8,
      relatedId: 'order-ok',
      refundTransactionId: 'refund-tx-ok',
    });

    expect(mockPrisma.mktPointsLot.create).not.toHaveBeenCalled();
  });
});
