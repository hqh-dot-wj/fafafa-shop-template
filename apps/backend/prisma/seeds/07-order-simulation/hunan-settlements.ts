import {
  PaymentRecordStatus,
  PrismaClient,
  ReconciliationStatus,
  SettlementBillStatus,
  SettlementChannelType,
  SettlementExecutionStatus,
  SettlementProfileStatus,
  SettlementReceiverType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { HUNAN_FULL_ORDER_SCENARIOS } from '../hunan-full/catalog-orders';
import { assertHunanFullSeedScope, HUNAN_FULL_TENANT_ID } from '../hunan-full/shared';

type SeedBillMode = 'PENDING_REVIEW' | 'REJECTED' | 'APPROVED' | 'SUCCESS' | 'EXECUTING' | 'FAILED' | 'CLOSED';

const BILL_MODES: SeedBillMode[] = ['PENDING_REVIEW', 'REJECTED', 'APPROVED', 'SUCCESS', 'EXECUTING', 'FAILED'];

function resolvePaymentStatus(payStatus: string) {
  if (payStatus === 'REFUNDED') {
    return PaymentRecordStatus.REFUNDED;
  }

  return PaymentRecordStatus.SUCCESS;
}

function resolveBillMode(index: number, payStatus: string): SeedBillMode {
  if (payStatus === 'REFUNDED') {
    return 'CLOSED';
  }

  return BILL_MODES[index % BILL_MODES.length];
}

export async function seedHunanSettlements(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanSettlements');
  console.log('[07-Orders] 湖南完整演示清结算...');

  const orderIds = HUNAN_FULL_ORDER_SCENARIOS
    .filter((scenario) => scenario.payStatus === 'PAID' || scenario.payStatus === 'REFUNDED')
    .map((scenario) => scenario.orderId);

  const existingBills = await prisma.finSettlementBill.findMany({
    where: {
      orderId: { in: orderIds },
    },
    select: {
      id: true,
    },
  });
  const billIds = existingBills.map((bill) => bill.id);

  const existingExecutions =
    billIds.length === 0
      ? []
      : await prisma.finSettlementExecution.findMany({
          where: {
            billId: { in: billIds },
          },
          select: {
            id: true,
          },
        });
  const executionIds = existingExecutions.map((execution) => execution.id);

  await prisma.finReconciliationIssue.deleteMany({
    where: {
      OR: [
        { orderId: { in: orderIds } },
        ...(billIds.length > 0 ? [{ billId: { in: billIds } }] : []),
        ...(executionIds.length > 0 ? [{ executionId: { in: executionIds } }] : []),
      ],
    },
  });

  if (executionIds.length > 0) {
    await prisma.finSettlementExecutionLog.deleteMany({
      where: {
        executionId: { in: executionIds },
      },
    });
  }

  if (billIds.length > 0) {
    await prisma.finSettlementExecution.deleteMany({
      where: {
        billId: { in: billIds },
      },
    });
    await prisma.finSettlementAuditLog.deleteMany({
      where: {
        billId: { in: billIds },
      },
    });
    await prisma.finSettlementBillItem.deleteMany({
      where: {
        billId: { in: billIds },
      },
    });
  }

  await prisma.finSettlementBill.deleteMany({
    where: {
      orderId: { in: orderIds },
    },
  });
  await prisma.payOrderRecord.deleteMany({
    where: {
      orderId: { in: orderIds },
    },
  });

  const tenant = await prisma.sysTenant.findUnique({
    where: { tenantId: HUNAN_FULL_TENANT_ID },
    select: { companyName: true },
  });

  await prisma.finTenantSettlementProfile.upsert({
    where: { tenantId: HUNAN_FULL_TENANT_ID },
    create: {
      tenantId: HUNAN_FULL_TENANT_ID,
      enabled: true,
      defaultChannel: SettlementChannelType.WECHAT_PROFITSHARING,
      receiverType: SettlementReceiverType.MERCHANT,
      receiverAccount: '1900000109',
      receiverName: tenant?.companyName ?? '湖南演示租户',
      needManualReview: true,
      status: SettlementProfileStatus.ACTIVE,
      remark: '湖南完整演示租户默认走平台统一收款后人工审核分账',
    },
    update: {
      enabled: true,
      defaultChannel: SettlementChannelType.WECHAT_PROFITSHARING,
      receiverType: SettlementReceiverType.MERCHANT,
      receiverAccount: '1900000109',
      receiverName: tenant?.companyName ?? '湖南演示租户',
      needManualReview: true,
      status: SettlementProfileStatus.ACTIVE,
      remark: '湖南完整演示租户默认走平台统一收款后人工审核分账',
    },
  });

  const orders = await prisma.omsOrder.findMany({
    where: {
      id: { in: orderIds },
    },
    orderBy: {
      createTime: 'asc',
    },
  });

  const commissionAgg = await prisma.finCommission.groupBy({
    by: ['orderId'],
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      orderId: { in: orderIds },
      status: { not: 'CANCELLED' },
    },
    _sum: {
      amount: true,
    },
  });

  const crossTenantAgg = await prisma.finCommission.groupBy({
    by: ['orderId'],
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      orderId: { in: orderIds },
      isCrossTenant: true,
      status: { not: 'CANCELLED' },
    },
    _sum: {
      amount: true,
    },
  });

  const commissionMap = new Map(commissionAgg.map((item) => [item.orderId, Number(item._sum.amount ?? 0)]));
  const crossTenantMap = new Map(crossTenantAgg.map((item) => [item.orderId, Number(item._sum.amount ?? 0)]));

  let billCount = 0;
  let issueCount = 0;

  for (const [index, order] of orders.entries()) {
    const scenario = HUNAN_FULL_ORDER_SCENARIOS.find((item) => item.orderId === order.id);
    if (!scenario) continue;

    const payRecord = await prisma.payOrderRecord.create({
      data: {
        orderId: order.id,
        orderSn: order.orderSn,
        tenantId: order.tenantId,
        channelType: order.payType ?? 'WECHAT_JSAPI',
        transactionId: order.transactionId,
        payAmount: order.payAmount,
        status: resolvePaymentStatus(scenario.payStatus),
        payTime: order.payTime,
        rawPayload: {
          seedTag: 'HF-SETTLEMENT-DEMO',
          scenarioType: scenario.scenarioType,
          payStatus: scenario.payStatus,
        },
      },
    });

    const totalAmount = Number(order.payAmount);
    const commissionAmount = commissionMap.get(order.id) ?? 0;
    const crossTenantAmount = crossTenantMap.get(order.id) ?? 0;
    const storeAmount = Math.max(totalAmount - commissionAmount, 0);
    const mode = resolveBillMode(index, scenario.payStatus);
    const channelType =
      mode === 'SUCCESS' || mode === 'EXECUTING'
        ? SettlementChannelType.WECHAT_PROFITSHARING
        : mode === 'FAILED'
          ? SettlementChannelType.BANK_TRANSFER
          : SettlementChannelType.OFFLINE_TRANSFER;

    const bill = await prisma.finSettlementBill.create({
      data: {
        billNo: `STL-${order.orderSn}`,
        orderId: order.id,
        tenantId: order.tenantId,
        payRecordId: payRecord.id,
        totalAmount: new Decimal(totalAmount),
        platformAmount: new Decimal(0),
        storeAmount: new Decimal(storeAmount),
        commissionAmount: new Decimal(commissionAmount),
        crossTenantAmount: new Decimal(crossTenantAmount),
        channelType,
        status:
          mode === 'PENDING_REVIEW'
            ? SettlementBillStatus.PENDING_REVIEW
            : mode === 'REJECTED'
              ? SettlementBillStatus.REJECTED
              : mode === 'APPROVED'
                ? SettlementBillStatus.APPROVED
                : mode === 'SUCCESS'
                  ? SettlementBillStatus.SUCCESS
                  : mode === 'EXECUTING'
                    ? SettlementBillStatus.EXECUTING
                    : mode === 'FAILED'
                      ? SettlementBillStatus.FAILED
                      : SettlementBillStatus.CLOSED,
        remark:
          mode === 'PENDING_REVIEW'
            ? '演示数据：待财务审核'
            : mode === 'REJECTED'
              ? '演示数据：审核驳回'
              : mode === 'APPROVED'
                ? '演示数据：审核通过待执行'
                : mode === 'SUCCESS'
                  ? '演示数据：已执行成功'
                  : mode === 'EXECUTING'
                    ? '演示数据：通道处理中'
                    : mode === 'FAILED'
                      ? '演示数据：执行失败待对账'
                      : '演示数据：退款关闭',
      },
    });

    if (storeAmount > 0) {
      await prisma.finSettlementBillItem.create({
        data: {
          billId: bill.id,
          tenantId: order.tenantId,
          receiverType: SettlementReceiverType.MERCHANT,
          receiverId: '1900000109',
          receiverName: tenant?.companyName ?? '湖南演示租户',
          channelType,
          amount: new Decimal(storeAmount),
          reason: '门店应收',
        },
      });
    }

    if (mode !== 'PENDING_REVIEW') {
      await prisma.finSettlementAuditLog.create({
        data: {
          billId: bill.id,
          tenantId: order.tenantId,
          action: mode === 'REJECTED' ? 'REJECT' : 'APPROVE',
          auditBy: mode === 'REJECTED' ? 'risk.auditor' : 'finance.auditor',
          remark: mode === 'REJECTED' ? '演示：金额复核未通过' : '演示：金额已确认',
        },
      });
    }

    if (mode === 'SUCCESS' || mode === 'EXECUTING' || mode === 'FAILED') {
      const executionStatus =
        mode === 'SUCCESS'
          ? SettlementExecutionStatus.SUCCESS
          : mode === 'EXECUTING'
            ? SettlementExecutionStatus.PENDING
            : SettlementExecutionStatus.FAILED;

      const execution = await prisma.finSettlementExecution.create({
        data: {
          billId: bill.id,
          tenantId: order.tenantId,
          executeNo: `STE-${order.orderSn}`,
          channelType,
          status: executionStatus,
          externalNo: mode === 'SUCCESS' ? `WX-${order.orderSn}` : mode === 'FAILED' ? `BANK-${order.orderSn}` : null,
          requestPayload: {
            seedTag: 'HF-SETTLEMENT-DEMO',
            operator: 'seed.finance',
          },
          responsePayload:
            mode === 'SUCCESS'
              ? { acceptedAt: order.payTime?.toISOString() ?? order.createTime.toISOString(), result: 'success' }
              : mode === 'EXECUTING'
                ? { acceptedAt: new Date().toISOString(), result: 'pending' }
                : { acceptedAt: new Date().toISOString(), result: 'failed' },
          failureReason: mode === 'FAILED' ? '演示：银行回单未通过复核' : null,
        },
      });

      await prisma.finSettlementExecutionLog.createMany({
        data: [
          {
            executionId: execution.id,
            tenantId: order.tenantId,
            stage: 'REQUEST_ACCEPTED',
            message: '演示数据：执行请求已提交',
            payload: {
              channelType,
              seedMode: mode,
            },
          },
          ...(mode === 'SUCCESS'
            ? [
                {
                  executionId: execution.id,
                  tenantId: order.tenantId,
                  stage: 'CHANNEL_SUCCESS',
                  message: '演示数据：结算执行成功',
                  payload: {
                    externalNo: `WX-${order.orderSn}`,
                  },
                },
              ]
            : mode === 'FAILED'
              ? [
                  {
                    executionId: execution.id,
                    tenantId: order.tenantId,
                    stage: 'CHANNEL_FAILED',
                    message: '演示数据：结算执行失败',
                    payload: {
                      externalNo: `BANK-${order.orderSn}`,
                    },
                  },
                ]
              : []),
        ],
      });

      if (mode === 'EXECUTING' || mode === 'FAILED') {
        await prisma.finReconciliationIssue.create({
          data: {
            tenantId: order.tenantId,
            orderId: order.id,
            billId: bill.id,
            executionId: execution.id,
            issueType: mode === 'EXECUTING' ? 'EXECUTION_PENDING' : 'CHANNEL_FAILED',
            status: mode === 'EXECUTING' ? ReconciliationStatus.WAITING : ReconciliationStatus.UNMATCHED,
            diffAmount: mode === 'FAILED' ? new Decimal(12.5) : null,
            issueReason:
              mode === 'EXECUTING' ? '演示数据：微信分账结果未回写，等待人工核对' : '演示数据：银行打款失败，需要人工复核',
          },
        });
        issueCount += 1;
      }
    }

    billCount += 1;
  }

  console.log(`  ✓ ${billCount} 张应结算单，${issueCount} 条对账异常`);
}
