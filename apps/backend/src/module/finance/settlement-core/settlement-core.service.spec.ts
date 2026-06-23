import { Test, TestingModule } from '@nestjs/testing';
import {
  FinRefundStatus,
  FinRefundType,
  ReconciliationStatus,
  SettlementBillStatus,
  SettlementChannelType,
  SettlementExecutionStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { SettlementCoreService } from './settlement-core.service';
import { SettlementExecutionService } from './settlement-execution.service';

describe('SettlementCoreService', () => {
  let service: SettlementCoreService;
  let tenantHelper: TenantHelper;

  const txMock = {
    finReconciliationIssue: {
      update: jest.fn(),
    },
    finSettlementBill: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    finSettlementExecution: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    finSettlementExecutionLog: {
      create: jest.fn(),
    },
  };

  const mockPrismaService = {
    finTenantSettlementProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    finSettlementBill: {
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    finSettlementBillItem: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    finSettlementAdjustment: {
      upsert: jest.fn(),
    },
    finCommission: {
      aggregate: jest.fn(),
    },
    finRefund: {
      aggregate: jest.fn(),
    },
    finSettlementExecution: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    finSettlementExecutionLog: {
      create: jest.fn(),
    },
    finReconciliationIssue: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    omsOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    payOrderRecord: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return await (input as (tx: typeof txMock) => Promise<unknown>)(txMock);
      }

      if (Array.isArray(input)) {
        return Promise.all(input);
      }

      return input;
    }),
  };

  const mockSettlementExecutionService = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementCoreService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        getTenantHelperTestProvider(),
        {
          provide: SettlementExecutionService,
          useValue: mockSettlementExecutionService,
        },
      ],
    }).compile();

    service = module.get<SettlementCoreService>(SettlementCoreService);
    tenantHelper = module.get<TenantHelper>(TenantHelper);
    txMock.finSettlementBill.updateMany.mockResolvedValue({ count: 1 });
    txMock.finSettlementExecution.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaService.finTenantSettlementProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      tenantId: 'tenant-1',
      enabled: true,
      defaultChannel: SettlementChannelType.WECHAT_PROFITSHARING,
      receiverType: 'MERCHANT',
      receiverAccount: 'merchant-1',
      receiverName: '测试门店',
      bankName: null,
      bankAccountNo: null,
      needManualReview: true,
      status: 'ACTIVE',
      remark: null,
      createTime: new Date('2026-05-01T00:00:00.000Z'),
      updateTime: new Date('2026-05-01T00:00:00.000Z'),
    });
    mockPrismaService.omsOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      orderSn: 'ORDER001',
      tenantId: 'tenant-1',
      payAmount: new Decimal('100.00'),
    });
    mockPrismaService.payOrderRecord.findFirst.mockResolvedValue({
      id: 'pay-1',
      orderId: 'order-1',
      tenantId: 'tenant-1',
    });
    mockPrismaService.payOrderRecord.upsert.mockResolvedValue({
      id: 'pay-1',
      orderId: 'order-1',
      tenantId: 'tenant-1',
    });
    let commissionAggregateCall = 0;
    mockPrismaService.finCommission.aggregate.mockImplementation(() => {
      const amount = commissionAggregateCall % 2 === 0 ? '10.00' : '0.00';
      commissionAggregateCall += 1;
      return Promise.resolve({ _sum: { amount: new Decimal(amount) } });
    });
    mockPrismaService.finRefund.aggregate.mockResolvedValue({
      _sum: {
        requestedAmount: new Decimal('100.00'),
        refundFeeAmount: new Decimal('0.20'),
      },
    });
    mockPrismaService.finSettlementBillItem.deleteMany.mockResolvedValue({ count: 1 });
    mockPrismaService.finSettlementBillItem.create.mockResolvedValue({ id: 'item-1' });
    mockPrismaService.finSettlementAdjustment.upsert.mockResolvedValue({
      id: 'adjustment-1',
      adjustmentNo: 'STA-REFUND_ORDER001_FULL',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const buildListQuery = (overrides: Record<string, unknown> = {}) =>
    ({
      pageNum: 1,
      pageSize: 10,
      skip: 0,
      take: 10,
      getOrderBy: jest.fn(() => undefined),
      getDateRange: jest.fn(() => undefined),
      ...overrides,
    }) as any;

  const buildSuccessfulRefund = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'refund-1',
      tenantId: 'tenant-1',
      orderId: 'order-1',
      orderSn: 'ORDER001',
      refundSn: 'REFUND_ORDER001_FULL',
      refundId: 'wx-refund-1',
      channelType: 'WECHAT',
      status: FinRefundStatus.SUCCESS,
      refundType: FinRefundType.FULL,
      requestedAmount: new Decimal('100.00'),
      payerRefundAmount: new Decimal('100.00'),
      settlementRefundAmount: new Decimal('100.00'),
      refundFeeAmount: new Decimal('0.20'),
      discountRefundAmount: new Decimal('0.00'),
      payerTotalAmount: new Decimal('100.00'),
      settlementTotalAmount: new Decimal('100.00'),
      fundsAccount: null,
      reason: '用户申请退款',
      failReason: null,
      successTime: new Date('2026-05-19T10:00:00.000Z'),
      lastQueryTime: null,
      retryCount: 0,
      rawPayload: null,
      finalizePayload: null,
      finalizedAt: null,
      createTime: new Date('2026-05-19T09:00:00.000Z'),
      updateTime: new Date('2026-05-19T10:00:00.000Z'),
      ...overrides,
    }) as any;

  it('非手工通道执行时应创建待对账异常', async () => {
    mockPrismaService.finSettlementBill.findFirst.mockResolvedValue({
      id: 'bill-1',
      billNo: 'STL-001',
      orderId: 'order-1',
      tenantId: 'tenant-1',
      status: SettlementBillStatus.APPROVED,
      channelType: SettlementChannelType.WECHAT_PROFITSHARING,
      remark: null,
      payRecord: {
        id: 'pay-1',
        transactionId: '420000000001',
        channelType: 'WECHAT_PAY',
      },
      items: [
        {
          id: 'item-1',
          receiverType: 'MERCHANT',
          receiverId: '1900000109',
          receiverName: '测试门店',
          amount: 80,
          reason: '门店应收',
        },
      ],
      executions: [],
    });
    mockSettlementExecutionService.execute.mockResolvedValue({
      executionStatus: SettlementExecutionStatus.PROCESSING,
      billStatus: SettlementBillStatus.EXECUTING,
      issueStatus: ReconciliationStatus.WAITING,
      externalNo: 'ps-order-001',
      stage: 'CHANNEL_PROCESSING',
      message: '微信分账已受理，等待异步处理',
      requestPayload: { outOrderNo: 'STE-001' },
      responsePayload: { state: 'PROCESSING' },
      failureReason: null,
    });
    mockPrismaService.finSettlementExecution.create.mockResolvedValue({
      id: 'exec-1',
      executeNo: 'STE-001',
      status: SettlementExecutionStatus.PROCESSING,
      externalNo: 'ps-order-001',
      createTime: new Date('2026-04-22T10:00:00.000Z'),
    });
    mockPrismaService.finSettlementBill.update.mockResolvedValue({
      id: 'bill-1',
      billNo: 'STL-001',
    });

    const result = await service.executeSettlementBill(
      {
        billId: 'bill-1',
        channelType: SettlementChannelType.WECHAT_PROFITSHARING,
      },
      'finance-admin',
    );

    expect(result.code).toBe(200);
    expect(mockSettlementExecutionService.execute).toHaveBeenCalled();
    expect(mockPrismaService.finSettlementExecution.create).toHaveBeenCalled();
    expect(mockPrismaService.finReconciliationIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          billId: 'bill-1',
          executionId: 'exec-1',
          status: ReconciliationStatus.WAITING,
          issueType: 'EXECUTION_PENDING',
        }),
      }),
    );
  });

  it('人工确认对账成功时应同步关闭异常并更新结算状态', async () => {
    mockPrismaService.finReconciliationIssue.findFirst.mockResolvedValue({
      id: 'issue-1',
      tenantId: 'tenant-1',
      billId: 'bill-1',
      executionId: 'exec-1',
      status: ReconciliationStatus.WAITING,
    });

    const result = await service.handleReconciliationIssue(
      {
        issueId: 'issue-1',
        action: 'MARK_SUCCESS',
        externalNo: 'WX-20260422-001',
        remark: '微信回单已核对',
      },
      'finance-admin',
    );

    expect(result.code).toBe(200);
    expect(txMock.finReconciliationIssue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'issue-1' },
        data: expect.objectContaining({
          status: ReconciliationStatus.MATCHED,
          handledBy: 'finance-admin',
        }),
      }),
    );
    expect(txMock.finSettlementBill.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bill-1' },
        data: expect.objectContaining({
          status: SettlementBillStatus.SUCCESS,
        }),
      }),
    );
    expect(txMock.finSettlementExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exec-1' },
        data: expect.objectContaining({
          status: SettlementExecutionStatus.SUCCESS,
          externalNo: 'WX-20260422-001',
        }),
      }),
    );
    expect(txMock.finSettlementExecutionLog.create).toHaveBeenCalled();
  });

  it('对账异常列表关联读回应限制在异常所属租户', async () => {
    mockPrismaService.finReconciliationIssue.findMany.mockResolvedValue([
      {
        id: 'issue-1',
        tenantId: 'tenant-1',
        billId: 'bill-1',
        executionId: 'exec-1',
        orderId: 'order-1',
        issueType: 'EXECUTION_PENDING',
        status: ReconciliationStatus.WAITING,
        diffAmount: null,
        issueReason: '待对账',
        handledBy: null,
        handledRemark: null,
        handledTime: null,
        createTime: new Date('2026-04-22T10:00:00.000Z'),
        updateTime: null,
      },
    ]);
    mockPrismaService.finReconciliationIssue.count.mockResolvedValue(1);
    mockPrismaService.finSettlementBill.findMany.mockResolvedValue([
      {
        id: 'bill-1',
        tenantId: 'tenant-1',
        billNo: 'STL-001',
        status: SettlementBillStatus.APPROVED,
        orderId: 'order-1',
      },
    ]);
    mockPrismaService.finSettlementExecution.findMany.mockResolvedValue([
      {
        id: 'exec-1',
        tenantId: 'tenant-1',
        executeNo: 'STE-001',
        status: SettlementExecutionStatus.PROCESSING,
        channelType: SettlementChannelType.WECHAT_PROFITSHARING,
        externalNo: null,
      },
    ]);
    mockPrismaService.omsOrder.findMany.mockResolvedValue([
      { id: 'order-1', tenantId: 'tenant-1', orderSn: 'NO202604220001' },
    ]);

    await service.listReconciliationIssues(buildListQuery());

    expect(mockPrismaService.finSettlementBill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['bill-1'] }, tenantId: { in: ['tenant-1'] } },
      }),
    );
    expect(mockPrismaService.finSettlementExecution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['exec-1'] }, tenantId: { in: ['tenant-1'] } },
      }),
    );
    expect(mockPrismaService.omsOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['order-1'] }, tenantId: { in: ['tenant-1'] } },
      }),
    );
  });

  it('对账异常详情关联读回应使用异常租户', async () => {
    mockPrismaService.finReconciliationIssue.findFirst.mockResolvedValue({
      id: 'issue-1',
      tenantId: 'tenant-1',
      billId: 'bill-1',
      executionId: 'exec-1',
      orderId: 'order-1',
      issueType: 'EXECUTION_PENDING',
      status: ReconciliationStatus.WAITING,
      diffAmount: null,
      issueReason: '待对账',
      handledBy: null,
      handledRemark: null,
      handledTime: null,
      createTime: new Date('2026-04-22T10:00:00.000Z'),
      updateTime: null,
    });
    mockPrismaService.finSettlementBill.findFirst.mockResolvedValue({
      id: 'bill-1',
      tenantId: 'tenant-1',
      billNo: 'STL-001',
      status: SettlementBillStatus.APPROVED,
      orderId: 'order-1',
    });
    mockPrismaService.finSettlementExecution.findFirst.mockResolvedValue({
      id: 'exec-1',
      tenantId: 'tenant-1',
      executeNo: 'STE-001',
      status: SettlementExecutionStatus.PROCESSING,
      channelType: SettlementChannelType.WECHAT_PROFITSHARING,
      externalNo: null,
    });
    mockPrismaService.omsOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      tenantId: 'tenant-1',
      orderSn: 'NO202604220001',
    });

    await service.getReconciliationIssueDetail('issue-1');

    expect(mockPrismaService.finSettlementBill.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bill-1', tenantId: 'tenant-1' },
      }),
    );
    expect(mockPrismaService.finSettlementExecution.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exec-1', tenantId: 'tenant-1' },
      }),
    );
    expect(mockPrismaService.omsOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1', tenantId: 'tenant-1' },
      }),
    );
  });

  it('渠道回查更新执行单时应按执行单租户更新结算状态', async () => {
    jest.spyOn(tenantHelper, 'readWhereForDelegate').mockReturnValue({ id: 'exec-1', tenantId: 'tenant-1' });
    mockPrismaService.finSettlementExecution.findFirst.mockResolvedValue({
      id: 'exec-1',
      tenantId: 'tenant-1',
      billId: 'bill-1',
      externalNo: null,
    });

    await service.updateExecutionFromChannel({
      executionId: 'exec-1',
      operator: 'scheduler',
      executionStatus: SettlementExecutionStatus.SUCCESS,
      billStatus: SettlementBillStatus.SUCCESS,
      issueStatus: ReconciliationStatus.MATCHED,
      externalNo: 'WX-20260422-001',
      stage: 'CHANNEL_SUCCESS',
      message: '微信分账成功',
    });

    expect(mockPrismaService.finSettlementExecution.findFirst).toHaveBeenCalledWith({
      where: { id: 'exec-1', tenantId: 'tenant-1' },
    });
    expect(txMock.finSettlementExecution.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exec-1', tenantId: 'tenant-1' },
      }),
    );
    expect(txMock.finSettlementBill.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bill-1', tenantId: 'tenant-1' },
      }),
    );
    expect(mockPrismaService.finReconciliationIssue.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { executionId: 'exec-1', tenantId: 'tenant-1' },
      }),
    );
  });

  it('Given 未锁定结算单, When 退款成功收口, Then 刷新原结算单净额且不生成调整单', async () => {
    mockPrismaService.finCommission.aggregate.mockResolvedValue({ _sum: { amount: new Decimal('0.00') } });
    mockPrismaService.finSettlementBill.findFirst.mockResolvedValue({
      id: 'bill-1',
      billNo: 'STL-ORDER001',
      orderId: 'order-1',
      tenantId: 'tenant-1',
      payRecordId: 'pay-1',
      totalAmount: new Decimal('100.00'),
      platformAmount: new Decimal('0.00'),
      storeAmount: new Decimal('90.00'),
      commissionAmount: new Decimal('10.00'),
      crossTenantAmount: new Decimal('0.00'),
      channelType: SettlementChannelType.WECHAT_PROFITSHARING,
      status: SettlementBillStatus.PENDING_REVIEW,
      remark: null,
      items: [],
    });
    mockPrismaService.finSettlementBill.upsert.mockResolvedValue({
      id: 'bill-1',
      orderId: 'order-1',
      tenantId: 'tenant-1',
    });

    const result = await service.handleSuccessfulRefundSettlement(buildSuccessfulRefund());

    expect(result).toEqual({ action: 'REFRESHED', billId: 'bill-1' });
    expect(mockPrismaService.finSettlementBill.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          totalAmount: new Decimal('0.00'),
          storeAmount: new Decimal('0.00'),
          commissionAmount: new Decimal('0.00'),
        }),
      }),
    );
    expect(mockPrismaService.finSettlementBillItem.deleteMany).toHaveBeenCalledWith({ where: { billId: 'bill-1' } });
    expect(mockPrismaService.finSettlementBillItem.create).not.toHaveBeenCalled();
    expect(mockPrismaService.finSettlementAdjustment.upsert).not.toHaveBeenCalled();
  });

  it('Given 已锁定结算单, When 退款成功收口, Then 不改原单并生成可反查退款和原结算单的调整单', async () => {
    mockPrismaService.finCommission.aggregate.mockResolvedValue({ _sum: { amount: new Decimal('0.00') } });
    mockPrismaService.finSettlementBill.findFirst.mockResolvedValue({
      id: 'bill-1',
      billNo: 'STL-ORDER001',
      orderId: 'order-1',
      tenantId: 'tenant-1',
      payRecordId: 'pay-1',
      totalAmount: new Decimal('100.00'),
      platformAmount: new Decimal('0.00'),
      storeAmount: new Decimal('90.00'),
      commissionAmount: new Decimal('10.00'),
      crossTenantAmount: new Decimal('0.00'),
      channelType: SettlementChannelType.WECHAT_PROFITSHARING,
      status: SettlementBillStatus.APPROVED,
      remark: null,
    });

    const result = await service.handleSuccessfulRefundSettlement(buildSuccessfulRefund());

    expect(result).toEqual({ action: 'ADJUSTED', billId: 'bill-1', adjustmentId: 'adjustment-1' });
    expect(mockPrismaService.finSettlementBill.upsert).not.toHaveBeenCalled();
    expect(mockPrismaService.finSettlementAdjustment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { refundRecordId: 'refund-1' },
        create: expect.objectContaining({
          tenantId: 'tenant-1',
          orderId: 'order-1',
          refundRecordId: 'refund-1',
          settlementBillId: 'bill-1',
          storeAmountDelta: new Decimal('-90.00'),
          commissionAmountDelta: new Decimal('-10.00'),
          platformAmountDelta: new Decimal('0.00'),
          feeAmountDelta: new Decimal('0.20'),
        }),
      }),
    );
  });

  it('Given 同一退款重复收口, When 已锁定结算单再次处理, Then 通过 refundRecordId 幂等 upsert 调整单', async () => {
    mockPrismaService.finCommission.aggregate.mockResolvedValue({ _sum: { amount: new Decimal('0.00') } });
    mockPrismaService.finSettlementBill.findFirst.mockResolvedValue({
      id: 'bill-1',
      billNo: 'STL-ORDER001',
      orderId: 'order-1',
      tenantId: 'tenant-1',
      payRecordId: 'pay-1',
      totalAmount: new Decimal('100.00'),
      platformAmount: new Decimal('0.00'),
      storeAmount: new Decimal('90.00'),
      commissionAmount: new Decimal('10.00'),
      crossTenantAmount: new Decimal('0.00'),
      channelType: SettlementChannelType.WECHAT_PROFITSHARING,
      status: SettlementBillStatus.SUCCESS,
      remark: null,
    });

    await service.handleSuccessfulRefundSettlement(buildSuccessfulRefund());
    await service.handleSuccessfulRefundSettlement(buildSuccessfulRefund());

    expect(mockPrismaService.finSettlementAdjustment.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrismaService.finSettlementAdjustment.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { refundRecordId: 'refund-1' },
        create: expect.objectContaining({ adjustmentNo: 'STA-REFUND_ORDER001_FULL' }),
        update: expect.objectContaining({
          settlementBillId: 'bill-1',
          storeAmountDelta: new Decimal('-90.00'),
        }),
      }),
    );
  });

  // ====================================================================================
  // 规格（#1 退款聚合 + #2 storeAmount 公式）
  //   I1: snapshot.refundAmount 取 settlementRefundAmount → payerRefundAmount → requestedAmount fallback chain
  //   I2: snapshot.storeAmount = max(totalAmount - platformAmount - commissionAmount - refundFeeAmount, 0)
  //   I3: 网关只退一部分（settlement < requested）时不能让商家多被扣
  // ====================================================================================

  it('Given 退款 settlementRefundAmount=80, requestedAmount=100, When 触发结算同步, Then totalAmount 按 80 计', async () => {
    // 复现 #1：网关只退 80（手续费 0 等业务原因），requested=100；旧实现会按 requested 多扣 20。
    mockPrismaService.finCommission.aggregate.mockResolvedValue({ _sum: { amount: new Decimal('0.00') } });
    mockPrismaService.finRefund.aggregate.mockResolvedValue({
      _sum: {
        settlementRefundAmount: new Decimal('80.00'),
        payerRefundAmount: new Decimal('100.00'),
        requestedAmount: new Decimal('100.00'),
        refundFeeAmount: new Decimal('0.00'),
      },
    });
    mockPrismaService.finSettlementBill.findFirst.mockResolvedValue(null);
    mockPrismaService.finSettlementBill.upsert.mockImplementation(async (args: any) => ({
      id: 'bill-new',
      ...args.create,
    }));

    await service.recordPaidOrder({
      orderId: 'order-1',
      tenantId: 'tenant-1',
      orderSn: 'ORDER001',
      transactionId: '420000000001',
      payAmount: 100,
      channelType: 'WECHAT_PAY',
      payTime: new Date('2026-05-19T10:00:00.000Z'),
    });

    // payAmount(100) - settlementRefund(80) = 20 → totalAmount = 20
    // storeAmount = max(20 - 0 - 0 - 0, 0) = 20
    expect(mockPrismaService.finSettlementBill.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          totalAmount: new Decimal('20.00'),
          storeAmount: new Decimal('20.00'),
        }),
      }),
    );
  });

  it('Given 退款手续费 refundFeeAmount=2, When 触发结算同步, Then storeAmount 扣减手续费(商家承担)', async () => {
    // 复现 #2：refundFeeAmount 必须从 storeAmount 扣除，避免 admin-web 展示金额 ≠ 实际打款金额。
    mockPrismaService.finCommission.aggregate.mockResolvedValue({ _sum: { amount: new Decimal('0.00') } });
    mockPrismaService.finRefund.aggregate.mockResolvedValue({
      _sum: {
        settlementRefundAmount: new Decimal('0.00'),
        payerRefundAmount: new Decimal('0.00'),
        requestedAmount: new Decimal('0.00'),
        refundFeeAmount: new Decimal('2.00'),
      },
    });
    mockPrismaService.finSettlementBill.findFirst.mockResolvedValue(null);
    mockPrismaService.finSettlementBill.upsert.mockImplementation(async (args: any) => ({
      id: 'bill-new',
      ...args.create,
    }));

    await service.recordPaidOrder({
      orderId: 'order-1',
      tenantId: 'tenant-1',
      orderSn: 'ORDER001',
      transactionId: '420000000001',
      payAmount: 100,
      channelType: 'WECHAT_PAY',
      payTime: new Date('2026-05-19T10:00:00.000Z'),
    });

    // totalAmount = 100 - 0 = 100；storeAmount = max(100 - 0 - 0 - 2, 0) = 98
    expect(mockPrismaService.finSettlementBill.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          totalAmount: new Decimal('100.00'),
          storeAmount: new Decimal('98.00'),
        }),
      }),
    );
  });

  it('Given 退款聚合 settlement=null, payer=90, When fallback chain, Then 取 payerRefundAmount', async () => {
    mockPrismaService.finCommission.aggregate.mockResolvedValue({ _sum: { amount: new Decimal('0.00') } });
    mockPrismaService.finRefund.aggregate.mockResolvedValue({
      _sum: {
        settlementRefundAmount: null,
        payerRefundAmount: new Decimal('90.00'),
        requestedAmount: new Decimal('100.00'),
        refundFeeAmount: new Decimal('0.00'),
      },
    });
    mockPrismaService.finSettlementBill.findFirst.mockResolvedValue(null);
    mockPrismaService.finSettlementBill.upsert.mockImplementation(async (args: any) => ({
      id: 'bill-new',
      ...args.create,
    }));

    await service.recordPaidOrder({
      orderId: 'order-1',
      tenantId: 'tenant-1',
      orderSn: 'ORDER001',
      transactionId: '420000000001',
      payAmount: 100,
      channelType: 'WECHAT_PAY',
      payTime: new Date('2026-05-19T10:00:00.000Z'),
    });

    // settlement=null → fallback payer=90 → totalAmount = 100 - 90 = 10
    expect(mockPrismaService.finSettlementBill.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          totalAmount: new Decimal('10.00'),
        }),
      }),
    );
  });
});
