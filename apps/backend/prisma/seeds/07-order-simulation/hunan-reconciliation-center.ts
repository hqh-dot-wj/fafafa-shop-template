import {
  PaymentRecordStatus,
  PrismaClient,
  ReconciliationBatchStatus,
  ReconciliationBizScope,
  ReconciliationBufferStatus,
  ReconciliationResultStatus,
  ReconciliationStatus,
  SettlementExecutionStatus,
  StatementBatchStatus,
  WithdrawalStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { assertHunanFullSeedScope, HUNAN_FULL_TENANT_ID, hunanFullAt } from '../hunan-full/shared';

function dayAt(offsetDays: number) {
  const date = hunanFullAt(offsetDays, 0, 0);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function seedHunanReconciliationCenter(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanReconciliationCenter');
  console.log('[07-Orders] 湖南完整演示对账中心...');

  await prisma.finReconciliationResult.deleteMany();
  await prisma.finReconciliationBuffer.deleteMany();
  await prisma.finReconciliationBatch.deleteMany();
  await prisma.finChannelStatementLine.deleteMany();
  await prisma.finChannelStatementBatch.deleteMany();
  await prisma.finReconciliationIssue.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
    },
  });

  const [paymentRecords, settlementExecutions, withdrawals] = await Promise.all([
    prisma.payOrderRecord.findMany({
      where: {
        tenantId: HUNAN_FULL_TENANT_ID,
        status: PaymentRecordStatus.SUCCESS,
      },
      orderBy: { createTime: 'asc' },
      take: 2,
    }),
    prisma.finSettlementExecution.findMany({
      where: {
        tenantId: HUNAN_FULL_TENANT_ID,
      },
      include: {
        bill: {
          select: {
            id: true,
            billNo: true,
            orderId: true,
            storeAmount: true,
          },
        },
      },
      orderBy: { createTime: 'asc' },
    }),
    prisma.finWithdrawal.findMany({
      where: {
        tenantId: HUNAN_FULL_TENANT_ID,
      },
      orderBy: { createTime: 'asc' },
      take: 2,
    }),
  ]);

  const matchedPayment = paymentRecords[0];
  const extraPayment = paymentRecords[1];
  const bufferedExecution =
    settlementExecutions.find(item => item.status === SettlementExecutionStatus.PENDING) ?? settlementExecutions[0];
  const unmatchedExecution =
    settlementExecutions.find(item => item.status === SettlementExecutionStatus.FAILED) ?? settlementExecutions[1];
  const matchedWithdrawal =
    withdrawals.find(item => item.status === WithdrawalStatus.APPROVED || item.status === WithdrawalStatus.PROCESSING) ??
    withdrawals[0];

  if (!matchedPayment || !extraPayment || !bufferedExecution || !unmatchedExecution || !matchedWithdrawal) {
    throw new Error('[Seed-Hunan-ReconciliationCenter] 缺少基础支付/结算/提现样本，无法生成对账中心演示数据。');
  }

  const paymentStatementBatch = await prisma.finChannelStatementBatch.create({
    data: {
      id: 'hf-stmt-pay-001',
      statementDate: dayAt(0),
      bizScope: ReconciliationBizScope.PAYMENT,
      channelType: 'WECHAT_PAY',
      status: StatementBatchStatus.NORMALIZED,
      sourceType: 'GENERATED',
      fileName: 'hf-payment-2026-04-23.csv',
      importedCount: 2,
      failedCount: 0,
      remark: '湖南演示支付账单批次',
    },
  });

  const settlementStatementBatch = await prisma.finChannelStatementBatch.create({
    data: {
      id: 'hf-stmt-settle-001',
      statementDate: dayAt(0),
      bizScope: ReconciliationBizScope.SETTLEMENT,
      channelType: bufferedExecution.channelType,
      status: StatementBatchStatus.NORMALIZED,
      sourceType: 'GENERATED',
      fileName: 'hf-settlement-2026-04-23.csv',
      importedCount: 2,
      failedCount: 0,
      remark: '湖南演示结算账单批次',
    },
  });

  const withdrawalStatementBatch = await prisma.finChannelStatementBatch.create({
    data: {
      id: 'hf-stmt-withdraw-001',
      statementDate: dayAt(0),
      bizScope: ReconciliationBizScope.WITHDRAWAL,
      channelType: matchedWithdrawal.method,
      status: StatementBatchStatus.NORMALIZED,
      sourceType: 'GENERATED',
      fileName: 'hf-withdraw-2026-04-23.csv',
      importedCount: 1,
      failedCount: 0,
      remark: '湖南演示提现账单批次',
    },
  });

  await prisma.finChannelStatementLine.createMany({
    data: [
      {
        id: 'hf-stmt-line-pay-001',
        batchId: paymentStatementBatch.id,
        statementDate: paymentStatementBatch.statementDate,
        tenantId: HUNAN_FULL_TENANT_ID,
        bizScope: ReconciliationBizScope.PAYMENT,
        channelType: 'WECHAT_PAY',
        transactionId: matchedPayment.transactionId,
        outBizNo: matchedPayment.orderSn,
        amount: new Decimal(matchedPayment.payAmount),
        status: matchedPayment.status,
        tradeTime: matchedPayment.payTime ?? matchedPayment.createTime,
      },
      {
        id: 'hf-stmt-line-pay-002',
        batchId: paymentStatementBatch.id,
        statementDate: paymentStatementBatch.statementDate,
        tenantId: HUNAN_FULL_TENANT_ID,
        bizScope: ReconciliationBizScope.PAYMENT,
        channelType: 'WECHAT_PAY',
        transactionId: `WX-MISSING-${extraPayment.orderSn}`,
        externalNo: `CH-PAY-${extraPayment.orderSn}`,
        outBizNo: `CH-${extraPayment.orderSn}`,
        amount: new Decimal(extraPayment.payAmount),
        status: 'SUCCESS',
        tradeTime: extraPayment.payTime ?? extraPayment.createTime,
      },
      {
        id: 'hf-stmt-line-settle-001',
        batchId: settlementStatementBatch.id,
        statementDate: settlementStatementBatch.statementDate,
        tenantId: HUNAN_FULL_TENANT_ID,
        bizScope: ReconciliationBizScope.SETTLEMENT,
        channelType: bufferedExecution.channelType,
        transactionId: bufferedExecution.externalNo ?? bufferedExecution.executeNo,
        externalNo: bufferedExecution.externalNo,
        outBizNo: bufferedExecution.executeNo,
        amount: new Decimal(bufferedExecution.bill.storeAmount),
        status: bufferedExecution.status,
        tradeTime: hunanFullAt(0, 23, 58),
      },
      {
        id: 'hf-stmt-line-settle-002',
        batchId: settlementStatementBatch.id,
        statementDate: settlementStatementBatch.statementDate,
        tenantId: HUNAN_FULL_TENANT_ID,
        bizScope: ReconciliationBizScope.SETTLEMENT,
        channelType: unmatchedExecution.channelType,
        transactionId: unmatchedExecution.externalNo ?? unmatchedExecution.executeNo,
        externalNo: unmatchedExecution.externalNo,
        outBizNo: unmatchedExecution.executeNo,
        amount: new Decimal(Number(unmatchedExecution.bill.storeAmount) - 12.5),
        status: unmatchedExecution.status,
        tradeTime: unmatchedExecution.updateTime,
      },
      {
        id: 'hf-stmt-line-withdraw-001',
        batchId: withdrawalStatementBatch.id,
        statementDate: withdrawalStatementBatch.statementDate,
        tenantId: HUNAN_FULL_TENANT_ID,
        bizScope: ReconciliationBizScope.WITHDRAWAL,
        channelType: matchedWithdrawal.method,
        transactionId: matchedWithdrawal.paymentNo,
        externalNo: matchedWithdrawal.paymentNo,
        outBizNo: matchedWithdrawal.id,
        amount: new Decimal(matchedWithdrawal.actualAmount ?? matchedWithdrawal.amount),
        status: matchedWithdrawal.status,
        tradeTime: matchedWithdrawal.auditTime ?? matchedWithdrawal.createTime,
      },
    ],
  });

  const paymentBatch = await prisma.finReconciliationBatch.create({
    data: {
      id: 'hf-re-batch-pay-001',
      statementBatchId: paymentStatementBatch.id,
      batchDate: paymentStatementBatch.statementDate,
      bizScope: ReconciliationBizScope.PAYMENT,
      channelType: 'WECHAT_PAY',
      status: ReconciliationBatchStatus.COMPLETED,
      totalCount: 2,
      matchedCount: 1,
      unmatchedCount: 1,
      bufferedCount: 0,
      ignoredCount: 0,
      remark: '湖南演示支付对账批次',
      startedAt: hunanFullAt(0, 9, 0),
      finishedAt: hunanFullAt(0, 9, 3),
    },
  });

  const settlementBatch = await prisma.finReconciliationBatch.create({
    data: {
      id: 'hf-re-batch-settle-001',
      statementBatchId: settlementStatementBatch.id,
      batchDate: settlementStatementBatch.statementDate,
      bizScope: ReconciliationBizScope.SETTLEMENT,
      channelType: bufferedExecution.channelType,
      status: ReconciliationBatchStatus.COMPLETED,
      totalCount: 2,
      matchedCount: 0,
      unmatchedCount: 1,
      bufferedCount: 1,
      ignoredCount: 0,
      remark: '湖南演示结算对账批次',
      startedAt: hunanFullAt(0, 10, 0),
      finishedAt: hunanFullAt(0, 10, 5),
    },
  });

  const withdrawalBatch = await prisma.finReconciliationBatch.create({
    data: {
      id: 'hf-re-batch-withdraw-001',
      statementBatchId: withdrawalStatementBatch.id,
      batchDate: withdrawalStatementBatch.statementDate,
      bizScope: ReconciliationBizScope.WITHDRAWAL,
      channelType: matchedWithdrawal.method,
      status: ReconciliationBatchStatus.COMPLETED,
      totalCount: 1,
      matchedCount: 1,
      unmatchedCount: 0,
      bufferedCount: 0,
      ignoredCount: 0,
      remark: '湖南演示提现对账批次',
      startedAt: hunanFullAt(0, 11, 0),
      finishedAt: hunanFullAt(0, 11, 2),
    },
  });

  const paymentIssue = await prisma.finReconciliationIssue.create({
    data: {
      id: 'hf-re-issue-pay-001',
      tenantId: HUNAN_FULL_TENANT_ID,
      batchId: paymentBatch.id,
      bizScope: ReconciliationBizScope.PAYMENT,
      channelType: 'WECHAT_PAY',
      channelBizNo: `CH-PAY-${extraPayment.orderSn}`,
      transactionId: `WX-MISSING-${extraPayment.orderSn}`,
      issueType: 'LOCAL_MISSING',
      status: ReconciliationStatus.WAITING,
      diffAmount: new Decimal(extraPayment.payAmount),
      issueReason: '渠道有支付成功记录，我方缺少对应本地支付映射',
    },
  });

  const settlementIssue = await prisma.finReconciliationIssue.create({
    data: {
      id: 'hf-re-issue-settle-001',
      tenantId: HUNAN_FULL_TENANT_ID,
      batchId: settlementBatch.id,
      bizScope: ReconciliationBizScope.SETTLEMENT,
      channelType: unmatchedExecution.channelType,
      localBizId: unmatchedExecution.id,
      localBizNo: unmatchedExecution.executeNo,
      channelBizNo: unmatchedExecution.externalNo ?? unmatchedExecution.executeNo,
      transactionId: unmatchedExecution.externalNo ?? unmatchedExecution.executeNo,
      orderId: unmatchedExecution.bill.orderId,
      billId: unmatchedExecution.billId,
      executionId: unmatchedExecution.id,
      issueType: 'AMOUNT_MISMATCH',
      status: ReconciliationStatus.UNMATCHED,
      diffAmount: new Decimal(-12.5),
      issueReason: '渠道回单金额少于我方应结金额，需要人工复核',
    },
  });

  const buffer = await prisma.finReconciliationBuffer.create({
    data: {
      id: 'hf-re-buffer-001',
      bizScope: ReconciliationBizScope.SETTLEMENT,
      channelType: bufferedExecution.channelType,
      tenantId: HUNAN_FULL_TENANT_ID,
      localBizId: bufferedExecution.id,
      localBizNo: bufferedExecution.executeNo,
      channelBizNo: bufferedExecution.externalNo ?? bufferedExecution.executeNo,
      transactionId: bufferedExecution.externalNo ?? bufferedExecution.executeNo,
      reasonCode: 'TIME_WINDOW_BUFFERED',
      reasonText: '接近日切时间，先进入缓冲池等待次日复核',
      firstSeenAt: hunanFullAt(0, 23, 59),
      nextCheckAt: hunanFullAt(1, 0, 30),
      expireAt: hunanFullAt(1, 12, 0),
      retryCount: 1,
      status: ReconciliationBufferStatus.WAITING,
    },
  });

  await prisma.finReconciliationResult.createMany({
    data: [
      {
        id: 'hf-re-result-pay-001',
        batchId: paymentBatch.id,
        bizScope: ReconciliationBizScope.PAYMENT,
        tenantId: HUNAN_FULL_TENANT_ID,
        channelType: 'WECHAT_PAY',
        localBizId: matchedPayment.id,
        localBizNo: matchedPayment.orderSn,
        channelBizNo: matchedPayment.orderSn,
        transactionId: matchedPayment.transactionId,
        localAmount: new Decimal(matchedPayment.payAmount),
        channelAmount: new Decimal(matchedPayment.payAmount),
        diffAmount: new Decimal(0),
        status: ReconciliationResultStatus.MATCHED,
        reasonCode: 'MATCHED',
        reasonText: '支付金额一致',
        matchedAt: hunanFullAt(0, 9, 2),
      },
      {
        id: 'hf-re-result-pay-002',
        batchId: paymentBatch.id,
        bizScope: ReconciliationBizScope.PAYMENT,
        tenantId: HUNAN_FULL_TENANT_ID,
        channelType: 'WECHAT_PAY',
        channelBizNo: `CH-PAY-${extraPayment.orderSn}`,
        transactionId: `WX-MISSING-${extraPayment.orderSn}`,
        localAmount: null,
        channelAmount: new Decimal(extraPayment.payAmount),
        diffAmount: new Decimal(extraPayment.payAmount),
        status: ReconciliationResultStatus.UNMATCHED,
        reasonCode: 'LOCAL_MISSING',
        reasonText: '渠道有账，我方无本地支付单',
        issueId: paymentIssue.id,
      },
      {
        id: 'hf-re-result-settle-001',
        batchId: settlementBatch.id,
        bizScope: ReconciliationBizScope.SETTLEMENT,
        tenantId: HUNAN_FULL_TENANT_ID,
        channelType: bufferedExecution.channelType,
        localBizId: bufferedExecution.id,
        localBizNo: bufferedExecution.executeNo,
        channelBizNo: bufferedExecution.externalNo ?? bufferedExecution.executeNo,
        transactionId: bufferedExecution.externalNo ?? bufferedExecution.executeNo,
        localAmount: new Decimal(bufferedExecution.bill.storeAmount),
        channelAmount: new Decimal(bufferedExecution.bill.storeAmount),
        diffAmount: new Decimal(0),
        status: ReconciliationResultStatus.BUFFERED,
        reasonCode: 'TIME_WINDOW_BUFFERED',
        reasonText: '接近日切时间，等待次日复核',
        bufferId: buffer.id,
      },
      {
        id: 'hf-re-result-settle-002',
        batchId: settlementBatch.id,
        bizScope: ReconciliationBizScope.SETTLEMENT,
        tenantId: HUNAN_FULL_TENANT_ID,
        channelType: unmatchedExecution.channelType,
        localBizId: unmatchedExecution.id,
        localBizNo: unmatchedExecution.executeNo,
        channelBizNo: unmatchedExecution.externalNo ?? unmatchedExecution.executeNo,
        transactionId: unmatchedExecution.externalNo ?? unmatchedExecution.executeNo,
        localAmount: new Decimal(unmatchedExecution.bill.storeAmount),
        channelAmount: new Decimal(Number(unmatchedExecution.bill.storeAmount) - 12.5),
        diffAmount: new Decimal(-12.5),
        status: ReconciliationResultStatus.UNMATCHED,
        reasonCode: 'AMOUNT_MISMATCH',
        reasonText: '渠道金额与我方金额不一致',
        issueId: settlementIssue.id,
      },
      {
        id: 'hf-re-result-withdraw-001',
        batchId: withdrawalBatch.id,
        bizScope: ReconciliationBizScope.WITHDRAWAL,
        tenantId: HUNAN_FULL_TENANT_ID,
        channelType: matchedWithdrawal.method,
        localBizId: matchedWithdrawal.id,
        localBizNo: matchedWithdrawal.id,
        channelBizNo: matchedWithdrawal.paymentNo,
        transactionId: matchedWithdrawal.paymentNo,
        localAmount: new Decimal(matchedWithdrawal.actualAmount ?? matchedWithdrawal.amount),
        channelAmount: new Decimal(matchedWithdrawal.actualAmount ?? matchedWithdrawal.amount),
        diffAmount: new Decimal(0),
        status: ReconciliationResultStatus.MATCHED,
        reasonCode: 'MATCHED',
        reasonText: '提现打款金额一致',
        matchedAt: hunanFullAt(0, 11, 1),
      },
    ],
  });

  await prisma.finReconciliationIssue.update({
    where: { id: paymentIssue.id },
    data: { resultId: 'hf-re-result-pay-002' },
  });

  await prisma.finReconciliationIssue.update({
    where: { id: settlementIssue.id },
    data: { resultId: 'hf-re-result-settle-002' },
  });

  console.log('  ✓ 3 个渠道账单批次，3 个对账批次，5 条结果，1 条缓冲，2 条正式异常');
}
