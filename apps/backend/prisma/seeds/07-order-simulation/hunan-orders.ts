import {
  DelFlag,
  OrderStatus,
  OrderType,
  PayStatus,
  PlayInstanceStatus,
  Prisma,
  PrismaClient,
  UserCouponStatus,
} from '@prisma/client';

import { Decimal } from '@prisma/client/runtime/library';

import { HUNAN_FULL_ORDER_SCENARIOS } from '../hunan-full/catalog-orders';
import { assertHunanFullSeedScope, hunanFullAt, HUNAN_FULL_TENANT_ID } from '../hunan-full/shared';

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function mapOrderType(type: (typeof HUNAN_FULL_ORDER_SCENARIOS)[number]['orderType']): OrderType {
  if (type === 'SERVICE') {
    return OrderType.SERVICE;
  }
  if (type === 'MIXED') {
    return OrderType.MIXED;
  }
  return OrderType.PRODUCT;
}

function mapOrderStatus(status: (typeof HUNAN_FULL_ORDER_SCENARIOS)[number]['status']): OrderStatus {
  if (status === 'PAID') {
    return OrderStatus.PAID;
  }
  if (status === 'SHIPPED') {
    return OrderStatus.SHIPPED;
  }
  if (status === 'COMPLETED') {
    return OrderStatus.COMPLETED;
  }
  if (status === 'CANCELLED') {
    return OrderStatus.CANCELLED;
  }
  if (status === 'REFUNDED') {
    return OrderStatus.REFUNDED;
  }
  return OrderStatus.PENDING_PAY;
}

function mapPayStatus(status: (typeof HUNAN_FULL_ORDER_SCENARIOS)[number]['payStatus']): PayStatus {
  if (status === 'PAID') {
    return PayStatus.PAID;
  }
  if (status === 'REFUNDED') {
    return PayStatus.REFUNDED;
  }
  return PayStatus.UNPAID;
}

function mapPlayInstanceStatus(
  status: NonNullable<(typeof HUNAN_FULL_ORDER_SCENARIOS)[number]['playInstances']>[number]['status'],
) {
  switch (status) {
    case 'PAID':
      return PlayInstanceStatus.PAID;
    case 'ACTIVE':
      return PlayInstanceStatus.ACTIVE;
    case 'SUCCESS':
      return PlayInstanceStatus.SUCCESS;
    case 'TIMEOUT':
      return PlayInstanceStatus.TIMEOUT;
    case 'FAILED':
      return PlayInstanceStatus.FAILED;
    case 'REFUNDED':
      return PlayInstanceStatus.REFUNDED;
    default:
      return PlayInstanceStatus.PENDING_PAY;
  }
}

function isTerminalPlayStatus(status: PlayInstanceStatus): boolean {
  switch (status) {
    case PlayInstanceStatus.SUCCESS:
    case PlayInstanceStatus.TIMEOUT:
    case PlayInstanceStatus.FAILED:
    case PlayInstanceStatus.REFUNDED:
      return true;
    default:
      return false;
  }
}

function normalizeActivityType(activityType: string | null | undefined): string | null {
  if (!activityType) {
    return null;
  }
  if (activityType === 'COURSE_GROUP_BUY') {
    return 'COURSE_GROUP';
  }
  return activityType;
}

function deriveOfferType(
  scenario: (typeof HUNAN_FULL_ORDER_SCENARIOS)[number],
  item: (typeof HUNAN_FULL_ORDER_SCENARIOS)[number]['items'][number],
): string {
  const normalizedActivityType = normalizeActivityType(item.activityType);
  if (normalizedActivityType) {
    return normalizedActivityType;
  }
  if (scenario.couponDiscount > 0) {
    return 'COUPON';
  }
  if (scenario.pointsUsed > 0 || scenario.pointsDiscount > 0) {
    return 'POINTS';
  }
  return 'BASELINE';
}

function deriveAttributionDefaults(
  scenario: (typeof HUNAN_FULL_ORDER_SCENARIOS)[number],
  item: (typeof HUNAN_FULL_ORDER_SCENARIOS)[number]['items'][number],
  index: number,
) {
  const normalizedActivityType = normalizeActivityType(item.activityType);

  let sourceSceneCodeSnapshot = 'HF_SCENE_HOME';
  let sourceModuleCodeSnapshot = 'HF_HOME_GOODS';
  let sourcePagePathSnapshot = '/pages/index/index';
  let sourceChannelSnapshot = 'miniapp';

  switch (normalizedActivityType) {
    case 'FLASH_SALE':
      sourceSceneCodeSnapshot = 'HF_SCENE_FLASH';
      sourceModuleCodeSnapshot = 'HF_FLASH_TODAY';
      sourcePagePathSnapshot = '/pages/marketing/flash';
      break;
    case 'NEWCOMER_EXCLUSIVE':
    case 'FIRST_ORDER':
      sourceSceneCodeSnapshot = 'HF_SCENE_NEWCOMER';
      sourceModuleCodeSnapshot = 'HF_NEWCOMER_PRICE';
      sourcePagePathSnapshot = '/pages/marketing/newcomer';
      break;
    case 'COURSE_GROUP':
      sourceSceneCodeSnapshot = 'HF_SCENE_COURSE';
      sourceModuleCodeSnapshot = 'HF_COURSE_GROUP';
      sourcePagePathSnapshot = '/pages/marketing/course-group';
      sourceChannelSnapshot = 'h5';
      break;
    case 'MEMBER_UPGRADE':
      sourceSceneCodeSnapshot = 'HF_SCENE_HOME';
      sourceModuleCodeSnapshot = 'HF_HOME_INSTANT';
      sourcePagePathSnapshot = '/pages/member/upgrade';
      break;
    default:
      break;
  }

  return {
    sourceSceneCodeSnapshot,
    sourceModuleCodeSnapshot,
    sourceChannelSnapshot,
    sourcePagePathSnapshot,
    shareUserIdSnapshot: scenario.shareUserId ?? null,
    referrerIdSnapshot: scenario.referrerId ?? null,
    cardTemplateCodeSnapshot: normalizedActivityType === 'FLASH_SALE' ? 'HF_CARD_SIMPLE' : 'HF_CARD_HERO',
    resolverPolicyCodeSnapshot: 'HF_RESOLVER_DEFAULT',
    resolverReleaseNoSnapshot: 1,
    audienceSnapshot: { mode: normalizedActivityType === 'NEWCOMER_EXCLUSIVE' ? 'NEWCOMER' : 'ALL' },
    secondaryBenefitsSnapshot: {
      activityType: normalizedActivityType,
      couponDiscount: scenario.couponDiscount,
      pointsUsed: scenario.pointsUsed,
      pointsDiscount: scenario.pointsDiscount,
      orderItemIndex: index,
    },
    denyStackReasonsSnapshot: [] as string[],
    entryContextSnapshot: {
      scenarioType: scenario.scenarioType,
      orderSn: scenario.orderSn,
      orderItemIndex: index,
      seedTag: 'HF-ORDER-CHAIN',
    },
  };
}

export async function seedHunanOrders(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanOrders');
  console.log('[07-Orders] 湖南完整演示订单...');

  const orderIds = HUNAN_FULL_ORDER_SCENARIOS.map((order) => order.orderId);
  const playInstanceIds = HUNAN_FULL_ORDER_SCENARIOS.flatMap(
    (order) => order.playInstances?.map((instance) => instance.playInstanceId) ?? [],
  );

  for (const order of HUNAN_FULL_ORDER_SCENARIOS) {
    if (!order.userCouponCode) {
      continue;
    }

    await prisma.mktUserCoupon.updateMany({
      where: {
        tenantId: HUNAN_FULL_TENANT_ID,
        memberId: order.memberId,
        distributionSource: `HF-SEED::${order.userCouponCode}`,
      },
      data: {
        status: UserCouponStatus.UNUSED,
        usedTime: null,
        orderId: null,
      },
    });
  }

  await prisma.mktCouponUsage.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      orderId: { in: orderIds },
    },
  });

  const existingItems = await prisma.omsOrderItem.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const existingItemIds = existingItems.map((item) => item.id);
  const existingFulfillmentOrders = await prisma.fulfillmentOrder.findMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      OR: [
        { orderId: { in: orderIds } },
        ...(existingItemIds.length > 0 ? [{ orderItemId: { in: existingItemIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const fulfillmentOrderIds = existingFulfillmentOrders.map((order) => order.id);

  if (existingItems.length > 0) {
    await prisma.omsOrderItemAttribution.deleteMany({
      where: {
        orderItemId: { in: existingItemIds },
      },
    });
    await prisma.rptOrderItemMarketingFact.deleteMany({
      where: {
        orderItemId: { in: existingItemIds },
      },
    });
  }

  if (fulfillmentOrderIds.length > 0) {
    // Seed reruns must clear fulfillment children before deleting demo order items.
    await prisma.fulfillmentShipmentItem.deleteMany({
      where: {
        fulfillmentOrderId: { in: fulfillmentOrderIds },
      },
    });
    await prisma.fulfillmentProof.deleteMany({
      where: {
        fulfillmentOrderId: { in: fulfillmentOrderIds },
      },
    });
    await prisma.fulfillmentAssignment.deleteMany({
      where: {
        tenantId: HUNAN_FULL_TENANT_ID,
        fulfillmentOrderId: { in: fulfillmentOrderIds },
      },
    });
    await prisma.fulfillmentEvent.deleteMany({
      where: {
        tenantId: HUNAN_FULL_TENANT_ID,
        fulfillmentOrderId: { in: fulfillmentOrderIds },
      },
    });
    await prisma.fulfillmentShipment.deleteMany({
      where: {
        tenantId: HUNAN_FULL_TENANT_ID,
        fulfillmentOrderId: { in: fulfillmentOrderIds },
      },
    });
    await prisma.fulfillmentOrder.deleteMany({
      where: {
        tenantId: HUNAN_FULL_TENANT_ID,
        id: { in: fulfillmentOrderIds },
      },
    });
  }

  const existingSettlementBills = await prisma.finSettlementBill.findMany({
    where: {
      orderId: { in: orderIds },
    },
    select: {
      id: true,
      payRecordId: true,
    },
  });
  const settlementBillIds = existingSettlementBills.map((bill) => bill.id);

  const existingExecutions =
    settlementBillIds.length === 0
      ? []
      : await prisma.finSettlementExecution.findMany({
          where: {
            billId: { in: settlementBillIds },
          },
          select: {
            id: true,
          },
        });
  const executionIds = existingExecutions.map((execution) => execution.id);

  const payRecordIds = existingSettlementBills
    .map((bill) => bill.payRecordId)
    .filter((value): value is string => Boolean(value));

  await prisma.finReconciliationIssue.deleteMany({
    where: {
      OR: [
        { orderId: { in: orderIds } },
        ...(settlementBillIds.length > 0 ? [{ billId: { in: settlementBillIds } }] : []),
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

  if (settlementBillIds.length > 0) {
    await prisma.finSettlementExecution.deleteMany({
      where: {
        billId: { in: settlementBillIds },
      },
    });
    await prisma.finSettlementAuditLog.deleteMany({
      where: {
        billId: { in: settlementBillIds },
      },
    });
    await prisma.finSettlementBillItem.deleteMany({
      where: {
        billId: { in: settlementBillIds },
      },
    });
    await prisma.finSettlementBill.deleteMany({
      where: {
        id: { in: settlementBillIds },
      },
    });
  }

  if (payRecordIds.length > 0) {
    await prisma.payOrderRecord.deleteMany({
      where: {
        id: { in: payRecordIds },
      },
    });
  } else {
    await prisma.payOrderRecord.deleteMany({
      where: {
        orderId: { in: orderIds },
      },
    });
  }

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

  await prisma.finCommission.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      orderId: { in: orderIds },
    },
  });
  await prisma.omsOrderItem.deleteMany({
    where: { orderId: { in: orderIds } },
  });
  await prisma.playInstance.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      OR: [{ orderId: { in: orderIds } }, { id: { in: playInstanceIds } }],
    },
  });
  await prisma.omsOrder.deleteMany({
    where: {
      id: { in: orderIds },
    },
  });

  for (const scenario of HUNAN_FULL_ORDER_SCENARIOS) {
    const createTime = hunanFullAt(scenario.createOffsetDays, 10, 0);
    const payTime = scenario.payOffsetDays == null ? null : hunanFullAt(scenario.payOffsetDays, 11, 15);
    const bookingTime = scenario.bookingOffsetDays == null ? null : hunanFullAt(scenario.bookingOffsetDays, 14, 0);
    const userCoupon =
      scenario.userCouponCode == null
        ? null
        : await prisma.mktUserCoupon.findFirst({
            where: {
              tenantId: HUNAN_FULL_TENANT_ID,
              memberId: scenario.memberId,
              distributionSource: `HF-SEED::${scenario.userCouponCode}`,
            },
            orderBy: { receiveTime: 'desc' },
          });

    await prisma.omsOrder.create({
      data: {
        id: scenario.orderId,
        orderSn: scenario.orderSn,
        memberId: scenario.memberId,
        tenantId: HUNAN_FULL_TENANT_ID,
        orderType: mapOrderType(scenario.orderType),
        totalAmount: new Decimal(scenario.totalAmount),
        freightAmount: new Decimal(scenario.freightAmount),
        discountAmount: new Decimal(scenario.discountAmount),
        payAmount: new Decimal(scenario.payAmount),
        userCouponId: userCoupon?.id ?? null,
        couponDiscount: new Decimal(scenario.couponDiscount),
        pointsUsed: scenario.pointsUsed,
        pointsDiscount: new Decimal(scenario.pointsDiscount),
        pointsEarned: scenario.pointsEarned,
        receiverName: scenario.receiverName ?? null,
        receiverPhone: scenario.receiverPhone ?? null,
        receiverAddress: scenario.receiverAddress ?? null,
        bookingTime,
        workerId: null,
        serviceRemark: scenario.serviceRemark ?? null,
        shareUserId: scenario.shareUserId ?? null,
        referrerId: scenario.referrerId ?? null,
        status: mapOrderStatus(scenario.status),
        payStatus: mapPayStatus(scenario.payStatus),
        payType: scenario.payType ?? null,
        transactionId: scenario.transactionId ?? null,
        payTime,
        createTime,
        deleteTime: null,
        delFlag: DelFlag.NORMAL,
        remark: scenario.remark ?? null,
      },
    });

    const playInstances = new Map<string, string>();
    for (const play of scenario.playInstances ?? []) {
      const playPayTime = play.payOffsetDays == null ? payTime : hunanFullAt(play.payOffsetDays, 11, 45);
      const status = mapPlayInstanceStatus(play.status);

      await prisma.playInstance.create({
        data: {
          id: play.playInstanceId,
          tenantId: HUNAN_FULL_TENANT_ID,
          memberId: scenario.memberId,
          configId: play.configId,
          templateCode: play.templateCode,
          orderSn: scenario.orderSn,
          orderId: scenario.orderId,
          orderItemId: null,
          instanceData: asJson(play.instanceData),
          status,
          createTime,
          payTime: playPayTime,
          endTime:
            play.endOffsetDays == null
              ? isTerminalPlayStatus(status)
                ? playPayTime
                : null
              : hunanFullAt(play.endOffsetDays, 18, 0),
          sysDistConfigId: null,
        },
      });

      playInstances.set(play.playInstanceId, play.playInstanceId);
    }

    for (const [index, item] of scenario.items.entries()) {
      const attributionDefaults = deriveAttributionDefaults(scenario, item, index);
      const mergedAttribution = {
        ...attributionDefaults,
        ...(item.attribution ?? {}),
      };

      const createdItem = await prisma.omsOrderItem.create({
        data: {
          orderId: scenario.orderId,
          tenantId: HUNAN_FULL_TENANT_ID,
          productId: item.productId,
          productName: item.productName,
          productImg: item.productImg,
          skuId: item.skuId,
          specData: asJson(item.specData),
          price: new Decimal(item.price),
          quantity: item.quantity,
          totalAmount: new Decimal(item.price * item.quantity),
          pointsRatio: item.pointsRatio,
          earnedPoints: item.earnedPoints,
          activityContextKey: item.activityType ? `${scenario.orderSn}:${index}` : null,
          entrySource: mergedAttribution.sourcePagePathSnapshot ?? scenario.scenarioType,
          activityType: item.activityType ?? null,
          activityConfigId: item.activityConfigId ?? null,
          playInstanceId: item.playInstanceId ? (playInstances.get(item.playInstanceId) ?? item.playInstanceId) : null,
          activityNameSnapshot: item.activityNameSnapshot ?? null,
          activityPriceSnapshot: item.activityPriceSnapshot == null ? null : new Decimal(item.activityPriceSnapshot),
          activityStatusSnapshot: item.activityStatusSnapshot ?? null,
          activityCommissionModeSnapshot: item.activityCommissionModeSnapshot ?? null,
          activityCommissionRateSnapshot:
            item.activityCommissionRateSnapshot == null ? null : new Decimal(item.activityCommissionRateSnapshot),
          commissionRuleSource: item.commissionRuleSource ?? null,
          commissionPoolSnapshot: item.commissionPoolSnapshot == null ? null : new Decimal(item.commissionPoolSnapshot),
          l1WeightSnapshot: item.l1WeightSnapshot == null ? null : new Decimal(item.l1WeightSnapshot),
          l2WeightSnapshot: item.l2WeightSnapshot == null ? null : new Decimal(item.l2WeightSnapshot),
          orderItemOriginalAmount:
            item.orderItemOriginalAmount == null ? null : new Decimal(item.orderItemOriginalAmount),
          orderItemDiscountAllocated:
            item.orderItemDiscountAllocated == null ? null : new Decimal(item.orderItemDiscountAllocated),
          orderItemFinalPaid: item.orderItemFinalPaid == null ? null : new Decimal(item.orderItemFinalPaid),
          resolutionSnapshot: asJson({
            ...item.resolutionSnapshot,
            seedItemIndex: index,
            sourceSceneCodeSnapshot: mergedAttribution.sourceSceneCodeSnapshot ?? null,
            sourceModuleCodeSnapshot: mergedAttribution.sourceModuleCodeSnapshot ?? null,
            offerType: deriveOfferType(scenario, item),
          }),
        },
      });

      await prisma.omsOrderItemAttribution.create({
        data: {
          orderItemId: createdItem.id,
          tenantId: HUNAN_FULL_TENANT_ID,
          sourceSceneCodeSnapshot: mergedAttribution.sourceSceneCodeSnapshot ?? null,
          sourceModuleCodeSnapshot: mergedAttribution.sourceModuleCodeSnapshot ?? null,
          sourceChannelSnapshot: mergedAttribution.sourceChannelSnapshot ?? null,
          sourcePagePathSnapshot: mergedAttribution.sourcePagePathSnapshot ?? null,
          shareUserIdSnapshot: mergedAttribution.shareUserIdSnapshot ?? null,
          referrerIdSnapshot: mergedAttribution.referrerIdSnapshot ?? null,
          cardTemplateCodeSnapshot: mergedAttribution.cardTemplateCodeSnapshot ?? null,
          resolverPolicyCodeSnapshot: mergedAttribution.resolverPolicyCodeSnapshot ?? null,
          resolverReleaseNoSnapshot: mergedAttribution.resolverReleaseNoSnapshot ?? null,
          audienceSnapshot:
            mergedAttribution.audienceSnapshot == null ? null : asJson(mergedAttribution.audienceSnapshot),
          secondaryBenefitsSnapshot:
            mergedAttribution.secondaryBenefitsSnapshot == null
              ? null
              : asJson(mergedAttribution.secondaryBenefitsSnapshot),
          denyStackReasonsSnapshot:
            mergedAttribution.denyStackReasonsSnapshot == null
              ? null
              : asJson(mergedAttribution.denyStackReasonsSnapshot),
          entryContextSnapshot:
            mergedAttribution.entryContextSnapshot == null ? null : asJson(mergedAttribution.entryContextSnapshot),
        },
      });

      await prisma.rptOrderItemMarketingFact.create({
        data: {
          tenantId: HUNAN_FULL_TENANT_ID,
          orderItemId: createdItem.id,
          sourceSceneCode: mergedAttribution.sourceSceneCodeSnapshot ?? null,
          sourceModuleCode: mergedAttribution.sourceModuleCodeSnapshot ?? null,
          primaryOfferType: deriveOfferType(scenario, item),
          finalPaidAmount: new Decimal(item.orderItemFinalPaid ?? item.price * item.quantity),
        },
      });
    }

    if (userCoupon && scenario.payStatus !== 'UNPAID') {
      await prisma.mktUserCoupon.update({
        where: { id: userCoupon.id },
        data: {
          status: UserCouponStatus.USED,
          usedTime: payTime ?? createTime,
          orderId: scenario.orderId,
        },
      });

      await prisma.mktCouponUsage.create({
        data: {
          tenantId: HUNAN_FULL_TENANT_ID,
          userCouponId: userCoupon.id,
          memberId: scenario.memberId,
          orderId: scenario.orderId,
          discountAmount: new Decimal(scenario.couponDiscount),
          orderAmount: new Decimal(scenario.totalAmount),
          usedTime: payTime ?? createTime,
        },
      });
    }
  }

  console.log(`  ✓ ${HUNAN_FULL_ORDER_SCENARIOS.length} 笔模拟订单与活动快照`);
}
