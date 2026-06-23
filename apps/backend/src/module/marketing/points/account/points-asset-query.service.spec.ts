import { Test, TestingModule } from '@nestjs/testing';
import {
  PointsConsumeAllocationStatus,
  PointsDebtReason,
  PointsDebtStatus,
  PointsFreezeAllocationStatus,
  PointsLotStatus,
  PointsRefundAllocationStrategy,
  PointsTransactionStatus,
  PointsTransactionType,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { PointsAssetQueryService } from './points-asset-query.service';

describe('PointsAssetQueryService', () => {
  let service: PointsAssetQueryService;

  const mockPrisma = {
    mktPointsLot: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    mktPointsFreezeAllocation: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    mktPointsConsumeAllocation: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    mktPointsRefundAllocation: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    mktPointsDebt: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const now = new Date('2026-04-28T10:00:00.000Z');
  const transaction = {
    id: 'tx-1',
    type: PointsTransactionType.EARN_ORDER,
    amount: 100,
    status: PointsTransactionStatus.COMPLETED,
    relatedId: 'order-1',
    relatedType: 'ORDER',
    remark: '订单发放',
    createTime: now,
  };
  const lot = {
    id: 'lot-1',
    tenantId: 't1',
    accountId: 'acc-1',
    memberId: 'm1',
    sourceTransactionId: 'tx-1',
    sourceType: PointsTransactionType.EARN_ORDER,
    totalAmount: 100,
    availableAmount: 60,
    frozenAmount: 20,
    consumedAmount: 10,
    expiredAmount: 10,
    expireTime: now,
    status: PointsLotStatus.ACTIVE,
    createTime: now,
    updateTime: now,
    sourceTransaction: transaction,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PointsAssetQueryService, { provide: PrismaService, useValue: mockPrisma }, getTenantHelperTestProvider()],
    }).compile();

    service = module.get(PointsAssetQueryService);
    jest.clearAllMocks();
  });

  it('Given 会员与状态筛选, When getLots, Then 返回资产批次和来源交易', async () => {
    mockPrisma.mktPointsLot.findMany.mockResolvedValue([lot]);
    mockPrisma.mktPointsLot.count.mockResolvedValue(1);

    const result = await service.getLots({
      memberId: 'm1',
      status: PointsLotStatus.ACTIVE,
      pageNum: 2,
      pageSize: 20,
    });

    expect(mockPrisma.mktPointsLot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ memberId: 'm1', status: PointsLotStatus.ACTIVE }),
        skip: 20,
        take: 20,
      }),
    );
    expect(result.data?.rows[0]).toMatchObject({
      id: 'lot-1',
      availableAmount: 60,
      sourceTransaction: { id: 'tx-1', relatedId: 'order-1' },
    });
    expect(result.data?.total).toBe(1);
  });

  it('Given 订单关联ID, When getFreezeAllocations, Then 返回冻结分摊与批次快照', async () => {
    mockPrisma.mktPointsFreezeAllocation.findMany.mockResolvedValue([
      {
        id: 'fa-1',
        tenantId: 't1',
        accountId: 'acc-1',
        memberId: 'm1',
        freezeTransactionId: 'freeze-tx',
        releaseTransactionId: null,
        lotId: 'lot-1',
        relatedId: 'order-1',
        amount: 20,
        status: PointsFreezeAllocationStatus.ACTIVE,
        createTime: now,
        updateTime: now,
        lot,
        freezeTransaction: transaction,
        releaseTransaction: null,
      },
    ]);
    mockPrisma.mktPointsFreezeAllocation.count.mockResolvedValue(1);

    const result = await service.getFreezeAllocations({ relatedId: 'order-1', pageNum: 1, pageSize: 10 });

    expect(mockPrisma.mktPointsFreezeAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ relatedId: 'order-1' }) }),
    );
    expect(result.data?.rows[0]).toMatchObject({
      id: 'fa-1',
      amount: 20,
      lot: { id: 'lot-1', availableAmount: 60 },
    });
  });

  it('Given 消费交易ID, When getConsumeAllocations, Then 返回可退款余额', async () => {
    mockPrisma.mktPointsConsumeAllocation.findMany.mockResolvedValue([
      {
        id: 'ca-1',
        tenantId: 't1',
        accountId: 'acc-1',
        memberId: 'm1',
        spendTransactionId: 'spend-tx',
        sourceFreezeAllocationId: 'fa-1',
        lotId: 'lot-1',
        relatedId: 'order-1',
        amount: 20,
        refundableAmount: 8,
        status: PointsConsumeAllocationStatus.ACTIVE,
        createTime: now,
        updateTime: now,
        lot,
        spendTransaction: transaction,
      },
    ]);
    mockPrisma.mktPointsConsumeAllocation.count.mockResolvedValue(1);

    const result = await service.getConsumeAllocations({ spendTransactionId: 'spend-tx' });

    expect(mockPrisma.mktPointsConsumeAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ spendTransactionId: 'spend-tx' }) }),
    );
    expect(result.data?.rows[0]).toMatchObject({
      id: 'ca-1',
      refundableAmount: 8,
      spendTransaction: { id: 'tx-1' },
    });
  });

  it('Given 退款策略筛选, When getRefundAllocations, Then 返回来源和目标批次', async () => {
    mockPrisma.mktPointsRefundAllocation.findMany.mockResolvedValue([
      {
        id: 'ra-1',
        tenantId: 't1',
        accountId: 'acc-1',
        memberId: 'm1',
        refundTransactionId: 'refund-tx',
        sourceSpendTransactionId: 'spend-tx',
        sourceConsumeAllocationId: 'ca-1',
        sourceLotId: 'lot-1',
        targetLotId: 'lot-1',
        relatedId: 'order-1',
        amount: 8,
        strategy: PointsRefundAllocationStrategy.ORIGINAL_LOT_RESTORE,
        createTime: now,
        refundTransaction: transaction,
        sourceSpendTransaction: transaction,
        sourceLot: lot,
        targetLot: lot,
      },
    ]);
    mockPrisma.mktPointsRefundAllocation.count.mockResolvedValue(1);

    const result = await service.getRefundAllocations({
      strategy: PointsRefundAllocationStrategy.ORIGINAL_LOT_RESTORE,
    });

    expect(mockPrisma.mktPointsRefundAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ strategy: PointsRefundAllocationStrategy.ORIGINAL_LOT_RESTORE }),
      }),
    );
    expect(result.data?.rows[0]).toMatchObject({
      id: 'ra-1',
      amount: 8,
      sourceLot: { id: 'lot-1' },
      targetLot: { id: 'lot-1' },
    });
  });

  it('Given 欠账状态筛选, When getDebts, Then 返回退款扣回风险记录', async () => {
    mockPrisma.mktPointsDebt.findMany.mockResolvedValue([
      {
        id: 'debt-1',
        tenantId: 't1',
        accountId: 'acc-1',
        memberId: 'm1',
        sourceTransactionId: 'tx-1',
        relatedId: 'order-1',
        relatedType: 'ORDER',
        reason: PointsDebtReason.ORDER_REFUND_CLAWBACK_INSUFFICIENT,
        status: PointsDebtStatus.OPEN,
        expectedAmount: 100,
        deductedAmount: 0,
        debtAmount: 100,
        availableAtCreate: 0,
        remark: '余额不足',
        createTime: now,
        updateTime: now,
        sourceTransaction: transaction,
      },
    ]);
    mockPrisma.mktPointsDebt.count.mockResolvedValue(1);

    const result = await service.getDebts({ status: PointsDebtStatus.OPEN, relatedId: 'order-1' });

    expect(mockPrisma.mktPointsDebt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: PointsDebtStatus.OPEN, relatedId: 'order-1' }),
      }),
    );
    expect(result.data?.rows[0]).toMatchObject({
      id: 'debt-1',
      debtAmount: 100,
      reason: PointsDebtReason.ORDER_REFUND_CLAWBACK_INSUFFICIENT,
      sourceTransaction: { id: 'tx-1' },
    });
  });
});
