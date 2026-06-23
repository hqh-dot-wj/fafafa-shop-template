import { CommissionBaseType, CommissionStatus, PrismaClient } from '@prisma/client';

import { Decimal } from '@prisma/client/runtime/library';

import { HUNAN_FULL_ORDER_SCENARIOS } from '../hunan-full/catalog-orders';
import { assertHunanFullSeedScope, HUNAN_FULL_TENANT_ID } from '../hunan-full/shared';

function mapCommissionBaseType(
  type: NonNullable<(typeof HUNAN_FULL_ORDER_SCENARIOS)[number]['commissions'][number]['commissionBaseType']>,
) {
  if (type === 'ACTUAL_PAID') {
    return CommissionBaseType.ACTUAL_PAID;
  }
  if (type === 'ZERO') {
    return CommissionBaseType.ZERO;
  }
  return CommissionBaseType.ORIGINAL_PRICE;
}

function mapCommissionStatus(status: (typeof HUNAN_FULL_ORDER_SCENARIOS)[number]['commissions'][number]['status']) {
  if (status === 'SETTLED') {
    return CommissionStatus.SETTLED;
  }
  if (status === 'CANCELLED') {
    return CommissionStatus.CANCELLED;
  }
  return CommissionStatus.FROZEN;
}

function shiftDate(base: Date, offsetDays: number, hour = 18, minute = 0): Date {
  const target = new Date(base);
  target.setDate(target.getDate() + offsetDays);
  target.setHours(hour, minute, 0, 0);
  return target;
}

export async function seedHunanCommissions(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanCommissions');
  console.log('[07-Orders] 湖南完整演示佣金...');

  const orderIds = HUNAN_FULL_ORDER_SCENARIOS.map((order) => order.orderId);

  await prisma.finCommission.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      orderId: { in: orderIds },
    },
  });

  const orders = await prisma.omsOrder.findMany({
    where: {
      id: { in: orderIds },
    },
    include: {
      items: {
        orderBy: { id: 'asc' },
      },
    },
  });
  const orderById = new Map(orders.map((order) => [order.id, order]));

  let commissionCount = 0;

  for (const scenario of HUNAN_FULL_ORDER_SCENARIOS) {
    const order = orderById.get(scenario.orderId);
    if (!order) {
      continue;
    }

    const commissionCreateTime = order.payTime ?? order.createTime;

    for (const commission of scenario.commissions) {
      const item =
        commission.itemIndex == null
          ? order.items.length === 1
            ? order.items[0]
            : null
          : (order.items[commission.itemIndex] ?? null);

      await prisma.finCommission.create({
        data: {
          orderId: order.id,
          tenantId: HUNAN_FULL_TENANT_ID,
          orderItemId: item?.id ?? null,
          activityType: commission.activityType ?? item?.activityType ?? null,
          activityConfigId: commission.activityConfigId ?? item?.activityConfigId ?? null,
          playInstanceId: commission.playInstanceId ?? item?.playInstanceId ?? null,
          commissionRuleSource: commission.commissionRuleSource,
          activityCommissionRateSnapshot:
            commission.activityCommissionRateSnapshot == null
              ? null
              : new Decimal(commission.activityCommissionRateSnapshot),
          commissionPoolSnapshot:
            commission.commissionPoolSnapshot == null ? null : new Decimal(commission.commissionPoolSnapshot),
          beneficiaryId: commission.beneficiaryId,
          level: commission.level,
          amount: new Decimal(commission.amount),
          originalAmount: new Decimal(commission.amount),
          rateSnapshot: new Decimal(commission.rateSnapshot),
          commissionBase: new Decimal(commission.commissionBase),
          commissionBaseType: mapCommissionBaseType(commission.commissionBaseType),
          orderOriginalPrice: commission.orderOriginalPrice == null ? null : new Decimal(commission.orderOriginalPrice),
          orderActualPaid: commission.orderActualPaid == null ? null : new Decimal(commission.orderActualPaid),
          couponDiscount: commission.couponDiscount == null ? null : new Decimal(commission.couponDiscount),
          pointsDiscount: commission.pointsDiscount == null ? null : new Decimal(commission.pointsDiscount),
          isCapped: commission.isCapped,
          status: mapCommissionStatus(commission.status),
          createTime: commissionCreateTime,
          planSettleTime: shiftDate(commissionCreateTime, commission.planSettleOffsetDays ?? 7),
          settleTime:
            commission.settleOffsetDays == null ? null : shiftDate(commissionCreateTime, commission.settleOffsetDays),
          isCrossTenant: commission.isCrossTenant ?? false,
        },
      });

      commissionCount += 1;
    }
  }

  console.log(`  ✓ ${commissionCount} 条佣金记录`);
}
