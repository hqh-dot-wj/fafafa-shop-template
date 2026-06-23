import { Test, TestingModule } from '@nestjs/testing';
import {
  FinRefundStatus,
  ReconciliationBatchStatus,
  ReconciliationBizScope,
  ReconciliationBufferStatus,
  ReconciliationResultStatus,
  ReconciliationStatus,
  StatementBatchStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { SettlementReconciliationCenterService } from './settlement-reconciliation-center.service';

describe('SettlementReconciliationCenterService', () => {
  let service: SettlementReconciliationCenterService;

  const txMock = {
    finChannelStatementBatch: {
      create: jest.fn(),
      update: jest.fn(),
    },
    finChannelStatementLine: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    finReconciliationBatch: {
      create: jest.fn(),
      update: jest.fn(),
    },
    finReconciliationResult: {
      createMany: jest.fn(),
      updateMany: jest.fn(),
    },
    finReconciliationBuffer: {
      create: jest.fn(),
      update: jest.fn(),
    },
    finReconciliationIssue: {
      create: jest.fn(),
    },
  };

  const mockPrismaService = {
    payOrderRecord: {
      findMany: jest.fn(),
    },
    finSettlementExecution: {
      findMany: jest.fn(),
    },
    finWithdrawal: {
      findMany: jest.fn(),
    },
    finRefund: {
      findMany: jest.fn(),
    },
    finChannelStatementBatch: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    finChannelStatementLine: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    finReconciliationBatch: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    finReconciliationResult: {
      createMany: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    finReconciliationBuffer: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    finReconciliationIssue: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return await (input as (tx: typeof txMock) => Promise<unknown>)(txMock);
      }

      if (Array.isArray(input)) {
        return await Promise.all(input);
      }

      return input;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementReconciliationCenterService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    service = module.get<SettlementReconciliationCenterService>(SettlementReconciliationCenterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function mockRunnableRefundBatch(statementLines: Array<Record<string, unknown>>) {
    mockPrismaService.finChannelStatementBatch.findFirst.mockResolvedValue({
      id: 'stmt-batch-refund',
      statementDate: new Date('2026-04-23T00:00:00.000Z'),
      bizScope: ReconciliationBizScope.REFUND,
      channelType: 'WECHAT_PAY',
      status: StatementBatchStatus.NORMALIZED,
    });
    mockPrismaService.finChannelStatementLine.findMany.mockResolvedValue(statementLines);
    txMock.finReconciliationBatch.create.mockResolvedValue({
      id: 're-batch-refund',
      status: ReconciliationBatchStatus.RUNNING,
    });
    txMock.finReconciliationBatch.update.mockResolvedValue({
      id: 're-batch-refund',
      status: ReconciliationBatchStatus.COMPLETED,
    });
  }

  function refundStatementLine(overrides: Record<string, unknown> = {}) {
    return {
      id: 'line-refund-1',
      batchId: 'stmt-batch-refund',
      statementDate: new Date('2026-04-23T00:00:00.000Z'),
      bizScope: ReconciliationBizScope.REFUND,
      channelType: 'WECHAT_PAY',
      tenantId: 'tenant-1',
      outBizNo: 'RF20260423001',
      transactionId: '500000000001',
      externalNo: '500000000001',
      amount: 19.9,
      amountKind: 'REFUND',
      payerRefundAmount: 19.9,
      settlementRefundAmount: 19.88,
      refundFeeAmount: 0.02,
      discountRefundAmount: 0,
      netAmount: 19.88,
      status: FinRefundStatus.SUCCESS,
      tradeTime: new Date('2026-04-23T10:00:00.000Z'),
      rawPayload: null,
      ...overrides,
    };
  }

  function localRefundRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: 'fin-refund-1',
      tenantId: 'tenant-1',
      orderId: 'order-1',
      orderSn: 'SO20260423001',
      refundSn: 'RF20260423001',
      refundId: '500000000001',
      channelType: 'WECHAT',
      status: FinRefundStatus.SUCCESS,
      requestedAmount: 19.9,
      payerRefundAmount: 19.9,
      settlementRefundAmount: 19.88,
      refundFeeAmount: 0.02,
      discountRefundAmount: 0,
      successTime: new Date('2026-04-23T10:00:01.000Z'),
      updateTime: new Date('2026-04-23T10:00:02.000Z'),
      createTime: new Date('2026-04-23T09:59:00.000Z'),
      rawPayload: null,
      ...overrides,
    };
  }

  it('支付账单导入时应创建账单批次和标准化明细', async () => {
    mockPrismaService.payOrderRecord.findMany.mockResolvedValue([
      {
        id: 'pay-1',
        orderId: 'order-1',
        orderSn: 'SO20260423001',
        tenantId: 'tenant-1',
        channelType: 'WECHAT_PAY',
        transactionId: '420000000001',
        payAmount: 100,
        status: 'SUCCESS',
        payTime: new Date('2026-04-23T10:00:00.000Z'),
        createTime: new Date('2026-04-23T10:00:01.000Z'),
      },
    ]);
    txMock.finChannelStatementBatch.create.mockResolvedValue({
      id: 'stmt-batch-1',
      statementDate: new Date('2026-04-23T00:00:00.000Z'),
      bizScope: ReconciliationBizScope.PAYMENT,
      channelType: 'WECHAT_PAY',
      status: StatementBatchStatus.INIT,
    });
    txMock.finChannelStatementBatch.update.mockResolvedValue({
      id: 'stmt-batch-1',
      status: StatementBatchStatus.NORMALIZED,
      importedCount: 1,
      failedCount: 0,
    });

    const result = await service.importStatementBatch(
      {
        statementDate: '2026-04-23',
        bizScope: ReconciliationBizScope.PAYMENT,
        channelType: 'WECHAT_PAY',
      },
      'finance-admin',
    );

    expect(result.code).toBe(200);
    expect(txMock.finChannelStatementBatch.create).toHaveBeenCalled();
    expect(txMock.finChannelStatementLine.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            batchId: 'stmt-batch-1',
            bizScope: ReconciliationBizScope.PAYMENT,
            channelType: 'WECHAT_PAY',
            outBizNo: 'SO20260423001',
            transactionId: '420000000001',
            amount: new Decimal(100),
          }),
        ],
      }),
    );
    expect(txMock.finChannelStatementBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'stmt-batch-1' },
        data: expect.objectContaining({
          status: StatementBatchStatus.NORMALIZED,
          importedCount: 1,
        }),
      }),
    );
  });

  it('退款账单导入时应只从 FinRefund 生成拆口径标准化明细', async () => {
    mockPrismaService.finRefund.findMany.mockResolvedValue([localRefundRecord()]);
    txMock.finChannelStatementBatch.create.mockResolvedValue({
      id: 'stmt-batch-refund',
      statementDate: new Date('2026-04-23T00:00:00.000Z'),
      bizScope: ReconciliationBizScope.REFUND,
      channelType: 'WECHAT_PAY',
      status: StatementBatchStatus.INIT,
    });
    txMock.finChannelStatementBatch.update.mockResolvedValue({
      id: 'stmt-batch-refund',
      status: StatementBatchStatus.NORMALIZED,
      importedCount: 1,
      failedCount: 0,
    });

    const result = await service.importStatementBatch(
      {
        statementDate: '2026-04-23',
        bizScope: ReconciliationBizScope.REFUND,
        channelType: 'WECHAT_PAY',
      },
      'finance-admin',
    );

    expect(result.code).toBe(200);
    expect(mockPrismaService.payOrderRecord.findMany).not.toHaveBeenCalled();
    expect(mockPrismaService.finRefund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          channelType: { in: ['WECHAT_PAY', 'WECHAT'] },
        }),
      }),
    );
    expect(txMock.finChannelStatementLine.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            batchId: 'stmt-batch-refund',
            bizScope: ReconciliationBizScope.REFUND,
            channelType: 'WECHAT_PAY',
            outBizNo: 'RF20260423001',
            transactionId: '500000000001',
            amountKind: 'REFUND',
            payerRefundAmount: new Decimal('19.90'),
            settlementRefundAmount: new Decimal('19.88'),
            refundFeeAmount: new Decimal('0.02'),
            discountRefundAmount: new Decimal(0),
            netAmount: new Decimal('19.88'),
          }),
        ],
      }),
    );
  });

  it('日级对账命中边缘时间差异时应进入缓冲池而不是直接建异常', async () => {
    mockPrismaService.finChannelStatementBatch.findFirst.mockResolvedValue({
      id: 'stmt-batch-1',
      statementDate: new Date('2026-04-23T00:00:00.000Z'),
      bizScope: ReconciliationBizScope.PAYMENT,
      channelType: 'WECHAT_PAY',
      status: StatementBatchStatus.NORMALIZED,
    });
    mockPrismaService.finChannelStatementLine.findMany.mockResolvedValue([
      {
        id: 'line-1',
        batchId: 'stmt-batch-1',
        statementDate: new Date('2026-04-23T00:00:00.000Z'),
        bizScope: ReconciliationBizScope.PAYMENT,
        channelType: 'WECHAT_PAY',
        tenantId: 'tenant-1',
        outBizNo: 'SO20260423001',
        transactionId: '420000000001',
        amount: 100,
        status: 'SUCCESS',
        tradeTime: new Date('2026-04-23T23:58:30.000Z'),
      },
    ]);
    mockPrismaService.payOrderRecord.findMany.mockResolvedValue([]);
    txMock.finReconciliationBatch.create.mockResolvedValue({
      id: 're-batch-1',
      status: ReconciliationBatchStatus.RUNNING,
    });
    txMock.finReconciliationBatch.update.mockResolvedValue({
      id: 're-batch-1',
      status: ReconciliationBatchStatus.COMPLETED,
    });
    txMock.finReconciliationBuffer.create.mockResolvedValue({
      id: 'buffer-1',
      status: ReconciliationBufferStatus.WAITING,
    });

    const result = await service.runReconciliationBatch(
      {
        batchDate: '2026-04-23',
        bizScope: ReconciliationBizScope.PAYMENT,
        channelType: 'WECHAT_PAY',
      },
      'finance-admin',
    );

    expect(result.code).toBe(200);
    expect(txMock.finReconciliationBatch.create).toHaveBeenCalled();
    expect(txMock.finReconciliationBuffer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bizScope: ReconciliationBizScope.PAYMENT,
          channelType: 'WECHAT_PAY',
          reasonCode: 'TIME_WINDOW_BUFFERED',
          status: ReconciliationBufferStatus.WAITING,
        }),
      }),
    );
    expect(txMock.finReconciliationIssue.create).not.toHaveBeenCalled();
    expect(txMock.finReconciliationResult.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            status: ReconciliationResultStatus.BUFFERED,
            reasonCode: 'TIME_WINDOW_BUFFERED',
          }),
        ],
      }),
    );
  });

  it('对账金额差异使用 Decimal 计算，避免 0.30 - 0.29 浮点误差', async () => {
    mockPrismaService.finChannelStatementBatch.findFirst.mockResolvedValue({
      id: 'stmt-batch-1',
      statementDate: new Date('2026-04-23T00:00:00.000Z'),
      bizScope: ReconciliationBizScope.PAYMENT,
      channelType: 'WECHAT_PAY',
      status: StatementBatchStatus.NORMALIZED,
    });
    mockPrismaService.finChannelStatementLine.findMany.mockResolvedValue([
      {
        id: 'line-1',
        batchId: 'stmt-batch-1',
        statementDate: new Date('2026-04-23T00:00:00.000Z'),
        bizScope: ReconciliationBizScope.PAYMENT,
        channelType: 'WECHAT_PAY',
        tenantId: 'tenant-1',
        outBizNo: 'SO20260423001',
        transactionId: '420000000001',
        amount: 0.3,
        status: 'SUCCESS',
        tradeTime: new Date('2026-04-23T10:00:00.000Z'),
      },
    ]);
    mockPrismaService.payOrderRecord.findMany.mockResolvedValue([
      {
        id: 'pay-1',
        orderId: 'order-1',
        orderSn: 'SO20260423001',
        tenantId: 'tenant-1',
        channelType: 'WECHAT_PAY',
        transactionId: '420000000001',
        payAmount: 0.29,
        status: 'SUCCESS',
        payTime: new Date('2026-04-23T10:00:00.000Z'),
      },
    ]);
    txMock.finReconciliationBatch.create.mockResolvedValue({
      id: 're-batch-1',
      status: ReconciliationBatchStatus.RUNNING,
    });
    txMock.finReconciliationBatch.update.mockResolvedValue({
      id: 're-batch-1',
      status: ReconciliationBatchStatus.COMPLETED,
    });
    txMock.finReconciliationIssue.create.mockResolvedValue({
      id: 'issue-1',
      status: ReconciliationStatus.WAITING,
    });

    await service.runReconciliationBatch(
      {
        batchDate: '2026-04-23',
        bizScope: ReconciliationBizScope.PAYMENT,
        channelType: 'WECHAT_PAY',
      },
      'finance-admin',
    );

    expect(txMock.finReconciliationIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diffAmount: 0.01,
        }),
      }),
    );
    expect(txMock.finReconciliationResult.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ diffAmount: 0.01 })],
      }),
    );
  });

  it('退款对账金额拆口径一致时应生成 MATCHED 结果', async () => {
    mockRunnableRefundBatch([refundStatementLine()]);
    mockPrismaService.finRefund.findMany.mockResolvedValue([localRefundRecord()]);

    const result = await service.runReconciliationBatch(
      {
        batchDate: '2026-04-23',
        bizScope: ReconciliationBizScope.REFUND,
        channelType: 'WECHAT_PAY',
      },
      'finance-admin',
    );

    expect(result.code).toBe(200);
    expect(mockPrismaService.payOrderRecord.findMany).not.toHaveBeenCalled();
    expect(txMock.finReconciliationIssue.create).not.toHaveBeenCalled();
    expect(txMock.finReconciliationResult.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            status: ReconciliationResultStatus.MATCHED,
            reasonCode: 'MATCHED',
            localAmount: 19.9,
            channelAmount: 19.9,
            diffAmount: 0,
            localAmountBreakdown: expect.objectContaining({
              payerRefundAmount: '19.90',
              refundFeeAmount: '0.02',
              netAmount: '19.88',
            }),
            channelAmountBreakdown: expect.objectContaining({
              payerRefundAmount: '19.90',
              refundFeeAmount: '0.02',
              netAmount: '19.88',
            }),
          }),
        ],
      }),
    );
    expect(txMock.finReconciliationBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          matchedCount: 1,
          unmatchedCount: 0,
          bufferedCount: 0,
          ignoredCount: 0,
        }),
      }),
    );
  });

  it('退款对账金额拆口径不一致时应生成 UNMATCHED 并解释用户退款手续费净额', async () => {
    mockRunnableRefundBatch([
      refundStatementLine({
        refundFeeAmount: 0.03,
        netAmount: 19.87,
      }),
    ]);
    mockPrismaService.finRefund.findMany.mockResolvedValue([localRefundRecord()]);
    txMock.finReconciliationIssue.create.mockResolvedValue({
      id: 'issue-refund-1',
      status: ReconciliationStatus.WAITING,
    });

    const result = await service.runReconciliationBatch(
      {
        batchDate: '2026-04-23',
        bizScope: ReconciliationBizScope.REFUND,
        channelType: 'WECHAT_PAY',
      },
      'finance-admin',
    );

    expect(result.code).toBe(200);
    expect(txMock.finReconciliationIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issueType: 'REFUND_AMOUNT_BREAKDOWN_MISMATCH',
          issueReason: expect.stringContaining('用户退款 本地 19.90 / 渠道 19.90'),
        }),
      }),
    );
    expect(txMock.finReconciliationIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issueReason: expect.stringContaining('手续费 本地 0.02 / 渠道 0.03'),
        }),
      }),
    );
    expect(txMock.finReconciliationIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issueReason: expect.stringContaining('净额 本地 19.88 / 渠道 19.87'),
        }),
      }),
    );
    expect(txMock.finReconciliationResult.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            status: ReconciliationResultStatus.UNMATCHED,
            reasonCode: 'REFUND_AMOUNT_BREAKDOWN_MISMATCH',
            reasonText: expect.stringContaining('19.90'),
            issueId: 'issue-refund-1',
          }),
        ],
      }),
    );
  });

  it('退款对账渠道有账且边缘时间无本地记录时应进入 BUFFERED', async () => {
    mockRunnableRefundBatch([
      refundStatementLine({
        outBizNo: 'RF20260423002',
        transactionId: '500000000002',
        externalNo: '500000000002',
        tradeTime: new Date('2026-04-23T23:58:30.000Z'),
      }),
    ]);
    mockPrismaService.finRefund.findMany.mockResolvedValue([]);
    txMock.finReconciliationBuffer.create.mockResolvedValue({
      id: 'buffer-refund-1',
      status: ReconciliationBufferStatus.WAITING,
    });

    const result = await service.runReconciliationBatch(
      {
        batchDate: '2026-04-23',
        bizScope: ReconciliationBizScope.REFUND,
        channelType: 'WECHAT_PAY',
      },
      'finance-admin',
    );

    expect(result.code).toBe(200);
    expect(txMock.finReconciliationBuffer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bizScope: ReconciliationBizScope.REFUND,
          reasonCode: 'TIME_WINDOW_BUFFERED',
          status: ReconciliationBufferStatus.WAITING,
        }),
      }),
    );
    expect(txMock.finReconciliationIssue.create).not.toHaveBeenCalled();
    expect(txMock.finReconciliationResult.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            status: ReconciliationResultStatus.BUFFERED,
            reasonCode: 'TIME_WINDOW_BUFFERED',
            channelAmountBreakdown: expect.objectContaining({
              netAmount: '19.88',
            }),
          }),
        ],
      }),
    );
  });

  it('退款对账渠道状态非成功时应生成 IGNORED 结果', async () => {
    mockRunnableRefundBatch([
      refundStatementLine({
        status: FinRefundStatus.PROCESSING,
      }),
    ]);
    mockPrismaService.finRefund.findMany.mockResolvedValue([]);

    const result = await service.runReconciliationBatch(
      {
        batchDate: '2026-04-23',
        bizScope: ReconciliationBizScope.REFUND,
        channelType: 'WECHAT_PAY',
      },
      'finance-admin',
    );

    expect(result.code).toBe(200);
    expect(txMock.finReconciliationIssue.create).not.toHaveBeenCalled();
    expect(txMock.finReconciliationBuffer.create).not.toHaveBeenCalled();
    expect(txMock.finReconciliationResult.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            status: ReconciliationResultStatus.IGNORED,
            reasonCode: 'REFUND_NOT_SUCCESS_IGNORED',
            channelAmountBreakdown: expect.objectContaining({
              payerRefundAmount: '19.90',
              refundFeeAmount: '0.02',
              netAmount: '19.88',
            }),
          }),
        ],
      }),
    );
    expect(txMock.finReconciliationBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          matchedCount: 0,
          unmatchedCount: 0,
          bufferedCount: 0,
          ignoredCount: 1,
        }),
      }),
    );
  });

  it('缓冲记录升级异常时应创建正式异常并更新缓冲状态', async () => {
    mockPrismaService.finReconciliationBuffer.findUnique.mockResolvedValue({
      id: 'buffer-1',
      bizScope: ReconciliationBizScope.SETTLEMENT,
      channelType: 'WECHAT_PROFITSHARING',
      tenantId: 'tenant-1',
      localBizId: 'exec-1',
      localBizNo: 'STE-001',
      channelBizNo: 'PS-001',
      transactionId: '420000000001',
      reasonCode: 'CHANNEL_PROCESSING',
      reasonText: '微信分账处理中',
      status: ReconciliationBufferStatus.WAITING,
      retryCount: 1,
    });
    mockPrismaService.finReconciliationResult.findFirst.mockResolvedValue({
      id: 'result-1',
      status: ReconciliationResultStatus.BUFFERED,
    });
    txMock.finReconciliationIssue.create.mockResolvedValue({
      id: 'issue-1',
      status: ReconciliationStatus.WAITING,
    });
    txMock.finReconciliationBuffer.update.mockResolvedValue({
      id: 'buffer-1',
      status: ReconciliationBufferStatus.EXPIRED,
    });

    const result = await service.handleReconciliationBuffer(
      {
        bufferId: 'buffer-1',
        action: 'ESCALATE',
        remark: '超过缓冲时限，升级异常',
      },
      'finance-admin',
    );

    expect(result.code).toBe(200);
    expect(txMock.finReconciliationIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          issueType: 'CHANNEL_PROCESSING',
          status: ReconciliationStatus.WAITING,
          issueReason: '超过缓冲时限，升级异常',
        }),
      }),
    );
    expect(txMock.finReconciliationBuffer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'buffer-1' },
        data: expect.objectContaining({
          status: ReconciliationBufferStatus.EXPIRED,
          retryCount: 2,
        }),
      }),
    );
    expect(txMock.finReconciliationResult.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bufferId: 'buffer-1' },
        data: expect.objectContaining({
          status: ReconciliationResultStatus.UNMATCHED,
          issueId: 'issue-1',
        }),
      }),
    );
  });
});
