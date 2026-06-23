import { FinRefundEventType, FinRefundStatus, FinRefundType, Prisma, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { HUNAN_FULL_ORDER_SCENARIOS } from '../hunan-full/catalog-orders';
import type { HunanOrderScenario } from '../hunan-full/types';
import { assertHunanFullSeedScope, HUNAN_FULL_TENANT_ID, hunanFullAt } from '../hunan-full/shared';

const HF_REFUND_SN_PREFIX = 'HF-RFD-';

function resolveRefundType(scenario: HunanOrderScenario): FinRefundType {
  if (scenario.scenarioType === 'refund-full') {
    return FinRefundType.FULL;
  }
  if (scenario.scenarioType === 'refund-partial') {
    return FinRefundType.PARTIAL;
  }
  return FinRefundType.FULL;
}

/** 部分退款：按佣金 CANCELLED 行关联的 itemIndex 汇总实付退款额。 */
function resolveRequestedRefundAmount(scenario: HunanOrderScenario): number {
  if (scenario.scenarioType === 'refund-full' || scenario.payStatus !== 'REFUNDED') {
    return scenario.payAmount;
  }

  if (scenario.scenarioType === 'refund-partial') {
    const revokedItemIndices = new Set(
      scenario.commissions
        .filter((commission) => commission.status === 'CANCELLED')
        .map((commission) => commission.itemIndex ?? 0),
    );

    if (revokedItemIndices.size > 0) {
      return scenario.items.reduce((sum, item, index) => {
        if (!revokedItemIndices.has(index)) {
          return sum;
        }
        const paid = item.orderItemFinalPaid ?? item.price * item.quantity;
        return sum + paid;
      }, 0);
    }
  }

  return scenario.payAmount;
}

function gatewayPayload(refundSn: string, status: string, amountYuan: Decimal): Prisma.InputJsonObject {
  const amountFen = amountYuan.mul(100).round().toNumber();
  return {
    seedTag: 'HF-REFUND-DEMO',
    refundSn,
    status,
    amountFen,
    payerRefundAmountFen: amountFen,
    settlementRefundAmountFen: amountFen,
    channel: 'WECHAT',
  };
}

export async function seedHunanRefunds(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanRefunds');
  console.log('[07-Orders] 湖南完整演示退款单...');

  const refundScenarios = HUNAN_FULL_ORDER_SCENARIOS.filter(
    (scenario) => scenario.payStatus === 'REFUNDED' || scenario.status === 'REFUNDED',
  );
  const orderIds = refundScenarios.map((scenario) => scenario.orderId);

  const existingRefunds = await prisma.finRefund.findMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      orderId: { in: orderIds },
    },
    select: { id: true },
  });
  const refundIds = existingRefunds.map((refund) => refund.id);

  if (refundIds.length > 0) {
    await prisma.finSettlementAdjustment.deleteMany({
      where: { refundRecordId: { in: refundIds } },
    });
    await prisma.finRefundEvent.deleteMany({
      where: { refundRecordId: { in: refundIds } },
    });
    await prisma.finRefund.deleteMany({
      where: { id: { in: refundIds } },
    });
  }

  let created = 0;
  let adjustments = 0;

  for (const scenario of refundScenarios) {
    const order = await prisma.omsOrder.findUnique({
      where: { id: scenario.orderId },
      select: {
        id: true,
        orderSn: true,
        payTime: true,
        createTime: true,
      },
    });
    if (!order) {
      continue;
    }

    const refundSn = `${HF_REFUND_SN_PREFIX}${scenario.orderSn}`;
    const requestedAmount = new Decimal(resolveRequestedRefundAmount(scenario));
    const refundType = resolveRefundType(scenario);
    const successTime =
      scenario.payOffsetDays == null ? (order.payTime ?? order.createTime) : hunanFullAt(scenario.payOffsetDays, 15, 0);

    const refund = await prisma.finRefund.create({
      data: {
        tenantId: HUNAN_FULL_TENANT_ID,
        orderId: order.id,
        orderSn: order.orderSn,
        refundSn,
        refundId: `wx-rfd-${scenario.orderId}`,
        channelType: scenario.payType ?? 'WECHAT',
        status: FinRefundStatus.SUCCESS,
        refundType,
        requestedAmount,
        payerRefundAmount: requestedAmount,
        settlementRefundAmount: requestedAmount,
        refundFeeAmount: new Decimal(0),
        discountRefundAmount: new Decimal(scenario.couponDiscount),
        payerTotalAmount: new Decimal(scenario.payAmount),
        settlementTotalAmount: new Decimal(scenario.payAmount),
        fundsAccount: 'AVAILABLE',
        reason: scenario.remark ?? `湖南演示种子：${scenario.scenarioType}`,
        successTime,
        finalizedAt: successTime,
        rawPayload: gatewayPayload(refundSn, 'SUCCESS', requestedAmount),
        events: {
          create: [
            {
              eventType: FinRefundEventType.REQUEST,
              fromStatus: null,
              toStatus: FinRefundStatus.CREATED,
              operator: 'seed',
              payload: {
                seedTag: 'HF-REFUND-DEMO',
                step: 'REQUEST',
                scenarioType: scenario.scenarioType,
              },
            },
            {
              eventType: FinRefundEventType.NOTIFY,
              fromStatus: FinRefundStatus.CREATED,
              toStatus: FinRefundStatus.SUCCESS,
              operator: 'seed',
              payload: gatewayPayload(refundSn, 'SUCCESS', requestedAmount),
            },
          ],
        },
      },
    });

    created += 1;

    const bill = await prisma.finSettlementBill.findFirst({
      where: {
        tenantId: HUNAN_FULL_TENANT_ID,
        orderId: order.id,
      },
      orderBy: { createTime: 'desc' },
      select: {
        id: true,
        storeAmount: true,
        commissionAmount: true,
      },
    });

    if (!bill) {
      continue;
    }

    const cancelledCommission = scenario.commissions
      .filter((commission) => commission.status === 'CANCELLED')
      .reduce((sum, commission) => sum + commission.amount, 0);

    await prisma.finSettlementAdjustment.create({
      data: {
        adjustmentNo: `${refundSn}-ADJ`,
        tenantId: HUNAN_FULL_TENANT_ID,
        orderId: order.id,
        refundRecordId: refund.id,
        settlementBillId: bill.id,
        storeAmountDelta: requestedAmount.negated(),
        commissionAmountDelta: new Decimal(-cancelledCommission),
        platformAmountDelta: new Decimal(0),
        feeAmountDelta: new Decimal(0),
        reason: `退款演示：${scenario.scenarioType}`,
        rawPayload: {
          seedTag: 'HF-REFUND-DEMO',
          orderSn: order.orderSn,
          refundSn,
        },
      },
    });
    adjustments += 1;
  }

  console.log(`  ✓ ${created} 笔 fin_refund（含事件流），${adjustments} 笔结算调整单`);
}
