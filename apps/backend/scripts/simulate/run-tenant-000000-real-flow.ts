import {
  CommissionBaseType,
  CommissionMode,
  CouponDistributionType,
  CouponStatus,
  CouponType,
  CouponValidityType,
  DelFlag,
  DistributionMode,
  MarketingStockMode,
  MemberStatus,
  ProductType,
  PublishStatus,
  Status,
  UserCouponStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bull';
import { NestFactory } from '@nestjs/core';
import type { Queue } from 'bull';
import { TenantContext } from '../../src/common/tenant/tenant.context';
import { AppModule } from '../../src/app.module';
import { PaymentService } from '../../src/module/client/payment/payment.service';
import { OrderService } from '../../src/module/client/order/order.service';
import { SettlementScheduler } from '../../src/module/finance/settlement/settlement.scheduler';
import { ResolutionService } from '../../src/module/marketing/resolution/resolution.service';
import { StoreOrderService } from '../../src/module/store/order/store-order.service';
import { StorePlayConfigService } from '../../src/module/marketing/config/config.service';
import { StoreProductService } from '../../src/module/store/product/product.service';
import { DistMode } from '../../src/module/store/product/dto/import-product.dto';
import { PrismaService, type TenantAwarePrismaClient } from '../../src/prisma/prisma.service';
import { getErrorMessage } from '../../src/common/utils/error';

/**
 * 租户 000000 真实业务闭环模拟（DB + 真 Service，非纯 Mock）
 *
 * PLAY_REGISTRY（5 种玩法）与本脚本覆盖关系：
 * - GROUP_BUY：group-buy-leader（开团首单）；满团/失败退款见 engineGaps
 * - COURSE_GROUP_BUY：course-group-buy、course-group-buy-with-coupon
 * - FLASH_SALE：flash-sale、flash-sale-with-coupon、flash-sale-with-points
 * - FULL_REDUCTION：full-reduction、full-reduction-with-coupon
 * - MEMBER_UPGRADE：member-upgrade-purchase（L0 会员购买升级商品，支付后申请/自动通过并 levelId 提升）
 *
 * 另有 E2E：`test/tenant-000000-marketing-distribution.e2e-spec.ts`（拼班/秒杀/满减/券/佣金等细矩阵）。
 * 非注册玩法（新人价/会员价等）见 coverage.engineGaps。
 */

const TENANT_ID = '000000';
/** 跨店分销夹具用副租户（无订单，仅上级会员归属） */
const TENANT_CROSS = '000001';

const GSKU_COURSE = 't000000_flow_gsku_course';
const GSKU_FLASH = 't000000_flow_gsku_flash';
const GSKU_REDUCE = 't000000_flow_gsku_reduce';
const GSKU_BULK = 't000000_flow_gsku_bulk';

const M_TOP = 't000000_flow_m_top';
const M_L1 = 't000000_flow_m_l1';
const M_BUYER = 't000000_flow_m_buyer';
const M_SOLO = 't000000_flow_m_solo';
const M_DIRECT_C2 = 't000000_flow_m_direct_c2';
const M_SELF_SHARE = 't000000_flow_m_self_share';
/** 上级在 TENANT_CROSS，用于跨店分销开关 */
const M_CROSS_L1 = 't000000_flow_m_cross_l1';
const M_CROSS_BUYER = 't000000_flow_m_cross_buyer';
/** 普通拼团专用商品（玩法已配，成团需多单，见 coverage.engineGaps） */
const PID_GROUP = 't000000_flow_group';
const GSKU_GROUP = 't000000_flow_gsku_group';
/** 会员升级玩法专用商品（MEMBER_UPGRADE） */
const PID_UPGRADE = 't000000_flow_upgrade';
const GSKU_UPGRADE = 't000000_flow_gsku_upgrade';
/** 每轮跑前强制 levelId=0，用于可重复执行升级闭环 */
const M_UPGRADE_BUYER = 't000000_flow_m_upgrade';

/** 与 `tenant-000000-marketing-distribution.e2e-spec` 同源，供本脚本在库内缺失时自动补齐 */
const E2E_COUPON_TPL_DISC = 'e2e11111-1111-4111-8111-111111111101';
const E2E_COUPON_TPL_PCT = 'e2e11111-1111-4111-8111-111111111102';
const E2E_COUPON_TPL_STACK = 'e2e11111-1111-4111-8111-111111111103';
const E2E_USER_COUPON_DISC = 'e2e22222-2222-4222-8222-222222222201';
const E2E_USER_COUPON_PCT = 'e2e22222-2222-4222-8222-222222222202';
const E2E_USER_COUPON_FLASH_STACK = 'e2e22222-2222-4222-8222-222222222203';
/** 与 E2E MD-008 一致：拼班/活动叠满减券 */
const E2E_USER_COUPON_COURSE_STACK = 'e2e22222-2222-4222-8222-222222222204';

const E2E_COUPON_FIXED_START = new Date('2020-01-01T00:00:00.000Z');
const E2E_COUPON_FIXED_END = new Date('2030-12-31T23:59:59.999Z');

type ScenarioSummary = {
  scenario: string;
  orderId?: string;
  payAmount?: number;
  orderStatus?: string;
  itemSnapshots?: Array<{
    skuId: string;
    price: number;
    quantity: number;
    totalAmount: number;
    activityType: string | null;
    activityContextKey: string | null;
    activityConfigId: string | null;
    activityNameSnapshot: string | null;
    activityPriceSnapshot: number | null;
  }>;
  commissions?: Array<{
    id: string;
    beneficiaryId: string;
    level: number;
    amount: number;
    status: string;
    commissionBase: number;
    commissionBaseType: string;
    isCapped: boolean;
    planSettleTime?: string | null;
  }>;
  walletAfter?: Record<string, { balance: number; totalIncome: number; pendingRecovery: number }>;
  refundResult?: unknown;
  note?: string;
};

type OrderRunResult = Awaited<ReturnType<typeof createPayAndLoad>>;

function toNum(value: Decimal | number | string | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

type FlowCoverageReport = {
  coveredScenarios: string[];
  engineGaps: Array<{ scenario: string; reason: string }>;
};

function jsonReplacer(_key: string, value: unknown) {
  return typeof value === 'bigint' ? value.toString() : value;
}

function writeFlowReportFile(
  coverage: FlowCoverageReport,
  results: ScenarioSummary[],
  startedAt: number,
): string {
  const outDir = join(__dirname, 'output');
  mkdirSync(outDir, { recursive: true });
  const fileName = `tenant-000000-real-flow-${Date.now()}.json`;
  const filePath = join(outDir, fileName);
  const payload = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    coverage,
    results,
  };
  writeFileSync(filePath, `${JSON.stringify(payload, jsonReplacer, 2)}\n`, 'utf8');
  return filePath;
}

function printCompactSummary(results: ScenarioSummary[], reportPath: string) {
  console.log('\n========== tenant-000000-real-flow 速览 ==========');
  console.log(
    `${'scenario'.padEnd(42)}${'status'.padEnd(12)}${'pay'.padStart(8)}${'comm#'.padStart(8)}  orderId`,
  );
  console.log('-'.repeat(100));
  for (const r of results) {
    const oid = (r.orderId ?? '-').slice(-12);
    const comm = r.commissions?.length ?? 0;
    const pay = r.payAmount != null ? String(r.payAmount) : '-';
    console.log(
      `${r.scenario.slice(0, 41).padEnd(42)}${String(r.orderStatus ?? '-').slice(0, 11).padEnd(12)}${pay.padStart(8)}${String(comm).padStart(8)}  ${oid}`,
    );
  }
  console.log('-'.repeat(100));
  console.log(`共 ${results.length} 条；完整 JSON: ${reportPath}`);
}

function mapItems(items: OrderRunResult['items']): ScenarioSummary['itemSnapshots'] {
  return items.map((item) => ({
    skuId: item.skuId,
    price: toNum(item.price)!,
    quantity: item.quantity,
    totalAmount: toNum(item.totalAmount)!,
    activityType: item.activityType,
    activityContextKey: item.activityContextKey,
    activityConfigId: item.activityConfigId,
    activityNameSnapshot: item.activityNameSnapshot,
    activityPriceSnapshot: toNum(item.activityPriceSnapshot),
  }));
}

function mapCommissions(commissions: OrderRunResult['commissions']): ScenarioSummary['commissions'] {
  return commissions.map((comm) => ({
    id: String(comm.id),
    beneficiaryId: comm.beneficiaryId,
    level: comm.level,
    amount: toNum(comm.amount)!,
    status: comm.status,
    commissionBase: toNum(comm.commissionBase)!,
    commissionBaseType: comm.commissionBaseType ?? '',
    isCapped: comm.isCapped,
    planSettleTime: comm.planSettleTime?.toISOString() ?? null,
  }));
}

function pushOrderScenario(
  results: ScenarioSummary[],
  scenario: string,
  orderRun: OrderRunResult,
  extra: Partial<ScenarioSummary> = {},
) {
  results.push({
    scenario,
    orderId: orderRun.orderId,
    payAmount: toNum(orderRun.order?.payAmount)!,
    orderStatus: orderRun.order?.status,
    itemSnapshots: mapItems(orderRun.items),
    commissions: mapCommissions(orderRun.commissions),
    ...extra,
  });
}

function pushUnpaidCancelScenario(
  results: ScenarioSummary[],
  scenario: string,
  run: {
    orderId: string;
    order: OrderRunResult['order'];
    items: OrderRunResult['items'];
    commissions: OrderRunResult['commissions'];
  },
  extra: Partial<ScenarioSummary> = {},
) {
  results.push({
    scenario,
    orderId: run.orderId,
    payAmount: toNum(run.order?.payAmount) ?? undefined,
    orderStatus: run.order?.status,
    itemSnapshots: mapItems(run.items),
    commissions: mapCommissions(run.commissions),
    ...extra,
  });
}

async function waitCalcCommissionIdle(
  app: { get: <T>(token: string) => T },
  previousFailedCount?: number,
): Promise<void> {
  const queue = app.get<Queue>(getQueueToken('CALC_COMMISSION'));
  for (let i = 0; i < 100; i++) {
    await queue.whenCurrentJobsFinished();
    const counts = await queue.getJobCounts();
    if ((counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0) === 0) {
      if (previousFailedCount != null && (counts.failed ?? 0) > previousFailedCount) {
        const failed = await queue.getFailed();
        const latest = failed[failed.length - 1];
        throw new Error(
          `commission queue failed: ${latest?.data?.orderId ?? 'unknown-order'} - ${latest?.failedReason ?? 'unknown'}`,
        );
      }
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function duplicateUserCoupon(
  prisma: TenantAwarePrismaClient,
  sourceCouponId: string,
  memberId: string,
  suffix: string,
) {
  const source = await prisma.mktUserCoupon.findUnique({ where: { id: sourceCouponId } });
  if (!source) {
    throw new Error(`source coupon missing: ${sourceCouponId}`);
  }

  const clonedId = `${sourceCouponId}_${suffix}`;
  await prisma.mktCouponUsage.deleteMany({ where: { userCouponId: clonedId } });
  await prisma.mktUserCoupon.deleteMany({ where: { id: clonedId } });

  const { id: _id, receiveTime: _receiveTime, usedTime: _usedTime, orderId: _orderId, ...rest } = source;
  await prisma.mktUserCoupon.create({
    data: {
      ...rest,
      id: clonedId,
      memberId,
      status: 'UNUSED',
      usedTime: null,
      orderId: null,
      receiveTime: new Date(),
    },
  });

  return clonedId;
}

async function getSkuMeta(prisma: TenantAwarePrismaClient, globalSkuId: string) {
  const sku = await prisma.pmsTenantSku.findFirst({
    where: { tenantId: TENANT_ID, globalSkuId },
    include: {
      tenantProd: {
        include: {
          product: true,
        },
      },
    },
  });
  if (!sku) {
    throw new Error(`tenant sku missing for ${globalSkuId}`);
  }
  return {
    skuId: sku.id,
    productId: sku.tenantProd.productId,
    productName: sku.tenantProd.product.name,
  };
}

async function resolveActivity(resolutionService: ResolutionService, productId: string, memberId: string) {
  const resolved = await resolutionService.resolveMainActivity({
    tenantId: TENANT_ID,
    productId,
    memberId,
    scene: 'CODEX_REAL_FLOW',
  });
  if (!resolved) {
    throw new Error(`no resolved activity for product ${productId}`);
  }
  return resolved;
}

async function ensureMember(
  prisma: TenantAwarePrismaClient,
  params: {
    memberId: string;
    nickname: string;
    levelId: number;
    parentId?: string | null;
    indirectParentId?: string | null;
  },
) {
  await prisma.umsMember.upsert({
    where: { memberId: params.memberId },
    create: {
      memberId: params.memberId,
      tenantId: TENANT_ID,
      nickname: params.nickname,
      status: MemberStatus.NORMAL,
      levelId: params.levelId,
      parentId: params.parentId ?? null,
      indirectParentId: params.indirectParentId ?? null,
    },
    update: {
      tenantId: TENANT_ID,
      nickname: params.nickname,
      status: MemberStatus.NORMAL,
      levelId: params.levelId,
      parentId: params.parentId ?? null,
      indirectParentId: params.indirectParentId ?? null,
    },
  });
}

async function ensureFlowMembers(prisma: TenantAwarePrismaClient) {
  await ensureMember(prisma, {
    memberId: M_TOP,
    nickname: 'Codex TOP',
    levelId: 2,
    parentId: null,
    indirectParentId: null,
  });
  await ensureMember(prisma, {
    memberId: M_L1,
    nickname: 'Codex L1',
    levelId: 1,
    parentId: M_TOP,
    indirectParentId: null,
  });
  await ensureMember(prisma, {
    memberId: M_BUYER,
    nickname: 'Codex Buyer',
    levelId: 0,
    parentId: M_L1,
    indirectParentId: M_TOP,
  });
  await ensureMember(prisma, {
    memberId: M_SOLO,
    nickname: 'Codex Solo',
    levelId: 0,
    parentId: null,
    indirectParentId: null,
  });
  await ensureMember(prisma, {
    memberId: M_DIRECT_C2,
    nickname: 'Codex Direct C2',
    levelId: 0,
    parentId: M_TOP,
    indirectParentId: null,
  });
  await ensureMember(prisma, {
    memberId: M_SELF_SHARE,
    nickname: 'Codex Self Share',
    levelId: 0,
    parentId: M_L1,
    indirectParentId: M_TOP,
  });
}

async function createPayAndLoad(params: {
  orderService: OrderService;
  paymentService: PaymentService;
  prisma: TenantAwarePrismaClient;
  app: { get: <T>(token: string) => T };
  memberId: string;
  items: Array<{
    skuId: string;
    quantity: number;
    activityContextKey?: string;
    activityType?: string;
    activityConfigId?: string;
  }>;
  phone: string;
  receiverName?: string;
  shareUserId?: string;
  userCouponId?: string;
  pointsUsed?: number;
  remark: string;
}) {
  const queue = params.app.get<Queue>(getQueueToken('CALC_COMMISSION'));
  const queueCountsBeforePay = await queue.getJobCounts();
  const preview = await TenantContext.run({ tenantId: TENANT_ID }, () =>
    params.orderService.getCheckoutPreview(params.memberId, TENANT_ID, params.items),
  );

  const createRes = await TenantContext.run({ tenantId: TENANT_ID }, () =>
    params.orderService.createOrder(params.memberId, {
      tenantId: TENANT_ID,
      items: params.items,
      receiverName: params.receiverName ?? 'Codex',
      receiverPhone: params.phone,
      receiverAddress: 'Shanghai JingAn Test Address',
      shareUserId: params.shareUserId,
      userCouponId: params.userCouponId,
      pointsUsed: params.pointsUsed,
      remark: params.remark,
    }),
  );

  const orderId = String(createRes.data!.orderId);
  await params.paymentService.mockSuccess(params.memberId, orderId);
  await waitCalcCommissionIdle(params.app, queueCountsBeforePay.failed ?? 0);

  const order = await params.prisma.omsOrder.findUnique({ where: { id: orderId } });
  const items = await params.prisma.omsOrderItem.findMany({ where: { orderId }, orderBy: { id: 'asc' } });
  const commissions = await params.prisma.finCommission.findMany({
    where: { orderId },
    orderBy: [{ level: 'asc' }, { id: 'asc' }],
  });

  return {
    preview,
    orderId,
    order,
    items,
    commissions,
  };
}

async function createUnpaidThenCancel(params: {
  orderService: OrderService;
  prisma: TenantAwarePrismaClient;
  memberId: string;
  items: Array<{
    skuId: string;
    quantity: number;
    activityContextKey?: string;
    activityType?: string;
    activityConfigId?: string;
  }>;
  phone: string;
  userCouponId?: string;
  pointsUsed?: number;
  remark: string;
}) {
  const preview = await TenantContext.run({ tenantId: TENANT_ID }, () =>
    params.orderService.getCheckoutPreview(params.memberId, TENANT_ID, params.items),
  );
  const createRes = await TenantContext.run({ tenantId: TENANT_ID }, () =>
    params.orderService.createOrder(params.memberId, {
      tenantId: TENANT_ID,
      items: params.items,
      receiverName: 'Codex',
      receiverPhone: params.phone,
      receiverAddress: 'Shanghai JingAn Test Address',
      userCouponId: params.userCouponId,
      pointsUsed: params.pointsUsed,
      remark: params.remark,
    }),
  );
  const orderId = String(createRes.data!.orderId);
  await TenantContext.run({ tenantId: TENANT_ID }, () =>
    params.orderService.cancelOrder(params.memberId, { orderId, reason: 'codex-unpaid-cancel' }),
  );
  const order = await params.prisma.omsOrder.findUnique({ where: { id: orderId } });
  const items = await params.prisma.omsOrderItem.findMany({ where: { orderId }, orderBy: { id: 'asc' } });
  const commissions = await params.prisma.finCommission.findMany({
    where: { orderId },
    orderBy: [{ level: 'asc' }, { id: 'asc' }],
  });
  return { preview, orderId, order, items, commissions };
}

async function loadWallets(prisma: TenantAwarePrismaClient, memberIds: string[]) {
  const wallets = await prisma.finWallet.findMany({ where: { memberId: { in: memberIds } } });
  return Object.fromEntries(
    memberIds.map((memberId) => {
      const wallet = wallets.find((row) => row.memberId === memberId);
      return [
        memberId,
        {
          balance: toNum(wallet?.balance ?? 0)!,
          totalIncome: toNum(wallet?.totalIncome ?? 0)!,
          pendingRecovery: toNum(wallet?.pendingRecovery ?? 0)!,
        },
      ];
    }),
  );
}

async function withCommissionBaseType<T>(
  prisma: TenantAwarePrismaClient,
  commissionBaseType: CommissionBaseType,
  fn: () => Promise<T>,
) {
  const previous = await prisma.sysDistConfig.findUniqueOrThrow({ where: { tenantId: TENANT_ID } });
  await prisma.sysDistConfig.update({
    where: { tenantId: TENANT_ID },
    data: { commissionBaseType, updateBy: 'codex-real-flow' },
  });
  try {
    return await fn();
  } finally {
    await prisma.sysDistConfig.update({
      where: { tenantId: TENANT_ID },
      data: { commissionBaseType: previous.commissionBaseType, updateBy: 'codex-real-flow-restore' },
    });
  }
}

async function withBlacklist<T>(prisma: TenantAwarePrismaClient, userId: string, fn: () => Promise<T>) {
  await prisma.sysDistBlacklist.upsert({
    where: { tenantId_userId: { tenantId: TENANT_ID, userId } },
    create: {
      tenantId: TENANT_ID,
      userId,
      reason: 'codex real flow',
      createBy: 'codex',
    },
    update: {
      reason: 'codex real flow',
    },
  });
  try {
    return await fn();
  } finally {
    await prisma.sysDistBlacklist.deleteMany({ where: { tenantId: TENANT_ID, userId } });
  }
}

async function withTenantSkuDistMode<T>(
  prisma: TenantAwarePrismaClient,
  tenantSkuId: string,
  distMode: DistributionMode,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = await prisma.pmsTenantSku.findUniqueOrThrow({
    where: { id: tenantSkuId },
    select: { distMode: true },
  });
  await prisma.pmsTenantSku.update({
    where: { id: tenantSkuId },
    data: { distMode },
  });
  try {
    return await fn();
  } finally {
    await prisma.pmsTenantSku.update({
      where: { id: tenantSkuId },
      data: { distMode: previous.distMode },
    });
  }
}

async function withTenantSkuSnapshotPatch<T>(
  prisma: TenantAwarePrismaClient,
  tenantSkuId: string,
  patch: Partial<{ distMode: DistributionMode; distRate: Decimal; isExchangeProduct: boolean }>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = await prisma.pmsTenantSku.findUniqueOrThrow({
    where: { id: tenantSkuId },
    select: { distMode: true, distRate: true, isExchangeProduct: true },
  });
  await prisma.pmsTenantSku.update({
    where: { id: tenantSkuId },
    data: {
      ...(patch.distMode != null ? { distMode: patch.distMode } : {}),
      ...(patch.distRate != null ? { distRate: patch.distRate } : {}),
      ...(patch.isExchangeProduct != null ? { isExchangeProduct: patch.isExchangeProduct } : {}),
    },
  });
  try {
    return await fn();
  } finally {
    await prisma.pmsTenantSku.update({
      where: { id: tenantSkuId },
      data: {
        distMode: previous.distMode,
        distRate: previous.distRate,
        isExchangeProduct: previous.isExchangeProduct,
      },
    });
  }
}

async function withSysDistCrossTenantFlags<T>(
  prisma: TenantAwarePrismaClient,
  enableCrossTenant: boolean,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = await prisma.sysDistConfig.findUniqueOrThrow({ where: { tenantId: TENANT_ID } });
  await prisma.sysDistConfig.update({
    where: { tenantId: TENANT_ID },
    data: { enableCrossTenant, updateBy: 'codex-real-flow-cross' },
  });
  try {
    return await fn();
  } finally {
    await prisma.sysDistConfig.update({
      where: { tenantId: TENANT_ID },
      data: { enableCrossTenant: previous.enableCrossTenant, updateBy: 'codex-real-flow-cross-restore' },
    });
  }
}

async function ensureGlobalProductAndSku(params: {
  prisma: TenantAwarePrismaClient;
  categoryId: number;
  productId: string;
  skuId: string;
  type: ProductType;
  name: string;
  guidePrice: number;
}) {
  const { prisma, categoryId, productId, skuId, type, name, guidePrice } = params;
  await prisma.pmsProduct.upsert({
    where: { productId },
    create: {
      productId,
      categoryId,
      name,
      mainImages: [],
      detailHtml: '<p>codex-flow</p>',
      type,
      specDef: {},
      publishStatus: PublishStatus.ON_SHELF,
      delFlag: DelFlag.NORMAL,
      serviceDuration: type === ProductType.SERVICE ? 60 : undefined,
      needBooking: type === ProductType.SERVICE ? true : undefined,
    },
    update: { publishStatus: PublishStatus.ON_SHELF, delFlag: DelFlag.NORMAL },
  });
  await prisma.pmsGlobalSku.upsert({
    where: { skuId },
    create: {
      skuId,
      productId,
      specValues: {},
      guidePrice: new Decimal(guidePrice),
      distMode: 'RATIO',
      guideRate: new Decimal(1),
    },
    update: { guidePrice: new Decimal(guidePrice) },
  });
}

async function ensureCrossTenantMembers(prisma: TenantAwarePrismaClient) {
  await prisma.sysTenant.upsert({
    where: { tenantId: TENANT_CROSS },
    create: {
      tenantId: TENANT_CROSS,
      companyName: 'Simulate-Cross-Tenant',
      status: Status.NORMAL,
      delFlag: DelFlag.NORMAL,
      createBy: 'codex-real-flow',
      updateBy: 'codex-real-flow',
    },
    update: { companyName: 'Simulate-Cross-Tenant' },
  });

  await prisma.umsMember.upsert({
    where: { memberId: M_CROSS_L1 },
    create: {
      memberId: M_CROSS_L1,
      tenantId: TENANT_CROSS,
      nickname: 'Codex Cross L1',
      status: MemberStatus.NORMAL,
      levelId: 1,
      parentId: null,
      indirectParentId: null,
    },
    update: {
      tenantId: TENANT_CROSS,
      nickname: 'Codex Cross L1',
      status: MemberStatus.NORMAL,
      levelId: 1,
    },
  });

  await prisma.umsMember.upsert({
    where: { memberId: M_CROSS_BUYER },
    create: {
      memberId: M_CROSS_BUYER,
      tenantId: TENANT_ID,
      nickname: 'Codex Cross Buyer',
      status: MemberStatus.NORMAL,
      levelId: 0,
      parentId: M_CROSS_L1,
      indirectParentId: null,
    },
    update: {
      tenantId: TENANT_ID,
      parentId: M_CROSS_L1,
      nickname: 'Codex Cross Buyer',
      status: MemberStatus.NORMAL,
      levelId: 0,
    },
  });
}

async function ensureGroupBuyCatalog(params: {
  prisma: TenantAwarePrismaClient;
  storeProductService: StoreProductService;
  storePlayConfigService: StorePlayConfigService;
}) {
  const { prisma, storeProductService, storePlayConfigService } = params;
  const category = await prisma.pmsCategory.findFirst();
  if (!category) {
    throw new Error('缺少 pms_category，请先 seed');
  }
  await ensureGlobalProductAndSku({
    prisma,
    categoryId: category.catId,
    productId: PID_GROUP,
    skuId: GSKU_GROUP,
    type: ProductType.REAL,
    name: 'Flow 拼团实物',
    guidePrice: 120,
  });

  const existingTp = await prisma.pmsTenantProduct.findFirst({
    where: { tenantId: TENANT_ID, productId: PID_GROUP },
  });
  if (!existingTp) {
    const imp = await storeProductService.importProduct(TENANT_ID, {
      productId: PID_GROUP,
      skus: [{ globalSkuId: GSKU_GROUP, price: 120, stock: 200, distMode: DistMode.RATIO, distRate: 1 }],
    });
    const tp = imp.data!;
    await storeProductService.updateProductBase(TENANT_ID, {
      id: tp.id,
      status: PublishStatus.ON_SHELF,
    });
    console.warn('[codex-real-flow] 已导入租户商品: GROUP ' + PID_GROUP);
  }

  const existingCfg = await prisma.storePlayConfig.findMany({
    where: { tenantId: TENANT_ID, serviceId: PID_GROUP },
    select: { id: true },
  });
  if (existingCfg.length > 0) {
    await prisma.playInstance.deleteMany({ where: { configId: { in: existingCfg.map((c) => c.id) } } });
    await prisma.storePlayConfig.deleteMany({ where: { id: { in: existingCfg.map((c) => c.id) } } });
  }

  const now = Date.now();
  await storePlayConfigService.create(
    {
      serviceId: PID_GROUP,
      serviceType: ProductType.REAL,
      templateCode: 'GROUP_BUY',
      stockMode: MarketingStockMode.STRONG_LOCK,
      commissionMode: CommissionMode.FIXED_RATE,
      commissionRate: 0.05,
      displayPriority: 20,
      rules: {
        name: 'Flow 普通拼团',
        price: 88,
        minCount: 2,
        maxCount: 10,
        validDays: 7,
        startTime: new Date(now - 3600_000).toISOString(),
        endTime: new Date(now + 30 * 86400_000).toISOString(),
      },
      status: PublishStatus.ON_SHELF,
    },
    TENANT_ID,
  );
  console.warn('[codex-real-flow] 已重建 storePlayConfig: GROUP_BUY @ ' + PID_GROUP);
}

async function ensureMemberUpgradeCatalog(params: {
  prisma: TenantAwarePrismaClient;
  storeProductService: StoreProductService;
  storePlayConfigService: StorePlayConfigService;
}) {
  const { prisma, storeProductService, storePlayConfigService } = params;
  const category = await prisma.pmsCategory.findFirst();
  if (!category) {
    throw new Error('缺少 pms_category，请先 seed');
  }
  await ensureGlobalProductAndSku({
    prisma,
    categoryId: category.catId,
    productId: PID_UPGRADE,
    skuId: GSKU_UPGRADE,
    type: ProductType.REAL,
    name: 'Flow 会员升级商品',
    guidePrice: 99,
  });

  const existingTp = await prisma.pmsTenantProduct.findFirst({
    where: { tenantId: TENANT_ID, productId: PID_UPGRADE },
  });
  if (!existingTp) {
    const imp = await storeProductService.importProduct(TENANT_ID, {
      productId: PID_UPGRADE,
      skus: [{ globalSkuId: GSKU_UPGRADE, price: 99, stock: 200, distMode: DistMode.RATIO, distRate: 1 }],
    });
    const tp = imp.data!;
    await storeProductService.updateProductBase(TENANT_ID, {
      id: tp.id,
      status: PublishStatus.ON_SHELF,
    });
    console.warn('[codex-real-flow] 已导入租户商品: MEMBER_UPGRADE ' + PID_UPGRADE);
  }

  const existingCfg = await prisma.storePlayConfig.findMany({
    where: { tenantId: TENANT_ID, serviceId: PID_UPGRADE },
    select: { id: true },
  });
  if (existingCfg.length > 0) {
    await prisma.playInstance.deleteMany({ where: { configId: { in: existingCfg.map((c) => c.id) } } });
    await prisma.storePlayConfig.deleteMany({ where: { id: { in: existingCfg.map((c) => c.id) } } });
  }

  await storePlayConfigService.create(
    {
      serviceId: PID_UPGRADE,
      serviceType: ProductType.REAL,
      templateCode: 'MEMBER_UPGRADE',
      stockMode: MarketingStockMode.LAZY_CHECK,
      commissionMode: CommissionMode.NONE,
      displayPriority: 18,
      rules: {
        targetLevel: 1,
        price: 59,
        autoApprove: true,
      },
      status: PublishStatus.ON_SHELF,
    },
    TENANT_ID,
  );
  console.warn('[codex-real-flow] 已重建 storePlayConfig: MEMBER_UPGRADE @ ' + PID_UPGRADE);
}

/** 每轮执行前将升级买家打回 L0，保证 MEMBER_UPGRADE 场景可重复跑 */
async function ensureUpgradeFlowMember(prisma: TenantAwarePrismaClient) {
  await ensureMember(prisma, {
    memberId: M_UPGRADE_BUYER,
    nickname: 'Codex Upgrade Buyer',
    levelId: 0,
    parentId: M_L1,
    indirectParentId: M_TOP,
  });
}

/**
 * 库内若无 E2E 固定 ID 的券模板/用户券，则按 e2e 规格创建；并保证买家积分账户可支撑多笔抵扣。
 */
async function ensureE2eFlowMarketingFixtures(prisma: TenantAwarePrismaClient) {
  const created: string[] = [];

  await prisma.mktPointsRule.upsert({
    where: { tenantId: TENANT_ID },
    create: {
      tenantId: TENANT_ID,
      orderPointsEnabled: true,
      orderPointsRatio: new Decimal(1),
      orderPointsBase: new Decimal(1),
      signinPointsEnabled: true,
      signinPointsAmount: 10,
      pointsValidityEnabled: false,
      pointsValidityDays: null,
      pointsRedemptionEnabled: true,
      pointsRedemptionRatio: new Decimal(100),
      pointsRedemptionBase: new Decimal(1),
      maxPointsPerOrder: null,
      maxDiscountPercentOrder: 50,
      systemEnabled: true,
      createBy: 'codex-real-flow',
    },
    update: {
      pointsRedemptionRatio: new Decimal(100),
      pointsRedemptionBase: new Decimal(1),
      maxDiscountPercentOrder: 50,
      pointsRedemptionEnabled: true,
      systemEnabled: true,
    },
  });

  const pointsAcct = await prisma.mktPointsAccount.findUnique({
    where: { tenantId_memberId: { tenantId: TENANT_ID, memberId: M_BUYER } },
  });
  if (!pointsAcct) {
    await prisma.mktPointsAccount.create({
      data: {
        tenantId: TENANT_ID,
        memberId: M_BUYER,
        totalPoints: 50_000,
        availablePoints: 50_000,
        frozenPoints: 0,
        usedPoints: 0,
        expiredPoints: 0,
      },
    });
    created.push('mkt_points_account(buyer)');
  } else if (pointsAcct.availablePoints < 5000) {
    await prisma.mktPointsAccount.update({
      where: { tenantId_memberId: { tenantId: TENANT_ID, memberId: M_BUYER } },
      data: {
        availablePoints: 50_000,
        totalPoints: pointsAcct.totalPoints < 50_000 ? 50_000 : pointsAcct.totalPoints,
      },
    });
    created.push('mkt_points_account(buyer topped up)');
  }

  const beforeTpl = await prisma.mktCouponTemplate.findMany({
    where: { id: { in: [E2E_COUPON_TPL_DISC, E2E_COUPON_TPL_PCT, E2E_COUPON_TPL_STACK] } },
    select: { id: true },
  });
  const hadTplCount = beforeTpl.length;

  await prisma.mktCouponTemplate.upsert({
    where: { id: E2E_COUPON_TPL_DISC },
    create: {
      id: E2E_COUPON_TPL_DISC,
      tenantId: TENANT_ID,
      name: 'E2E满减12',
      description: 'E2E',
      type: CouponType.DISCOUNT,
      discountAmount: new Decimal(12),
      discountPercent: null,
      maxDiscountAmount: null,
      minOrderAmount: new Decimal(0),
      minActualPayAmount: null,
      applicableProducts: [],
      applicableCategories: [],
      memberLevels: [],
      exchangeProductId: null,
      exchangeSkuId: null,
      validityType: CouponValidityType.FIXED,
      startTime: E2E_COUPON_FIXED_START,
      endTime: E2E_COUPON_FIXED_END,
      validDays: null,
      totalStock: 1000,
      remainingStock: 1000,
      limitPerUser: 10,
      status: CouponStatus.ACTIVE,
      createBy: 'codex-real-flow',
    },
    update: {},
  });

  await prisma.mktCouponTemplate.upsert({
    where: { id: E2E_COUPON_TPL_PCT },
    create: {
      id: E2E_COUPON_TPL_PCT,
      tenantId: TENANT_ID,
      name: 'E2E九折',
      description: 'E2E',
      type: CouponType.PERCENTAGE,
      discountAmount: null,
      discountPercent: 10,
      maxDiscountAmount: null,
      minOrderAmount: new Decimal(0),
      minActualPayAmount: null,
      applicableProducts: [],
      applicableCategories: [],
      memberLevels: [],
      exchangeProductId: null,
      exchangeSkuId: null,
      validityType: CouponValidityType.FIXED,
      startTime: E2E_COUPON_FIXED_START,
      endTime: E2E_COUPON_FIXED_END,
      validDays: null,
      totalStock: 1000,
      remainingStock: 1000,
      limitPerUser: 10,
      status: CouponStatus.ACTIVE,
      createBy: 'codex-real-flow',
    },
    update: {},
  });

  await prisma.mktCouponTemplate.upsert({
    where: { id: E2E_COUPON_TPL_STACK },
    create: {
      id: E2E_COUPON_TPL_STACK,
      tenantId: TENANT_ID,
      name: 'E2E叠券减5',
      description: 'E2E 玩法价+券',
      type: CouponType.DISCOUNT,
      discountAmount: new Decimal(5),
      discountPercent: null,
      maxDiscountAmount: null,
      minOrderAmount: new Decimal(0),
      minActualPayAmount: null,
      applicableProducts: [],
      applicableCategories: [],
      memberLevels: [],
      exchangeProductId: null,
      exchangeSkuId: null,
      validityType: CouponValidityType.FIXED,
      startTime: E2E_COUPON_FIXED_START,
      endTime: E2E_COUPON_FIXED_END,
      validDays: null,
      totalStock: 1000,
      remainingStock: 1000,
      limitPerUser: 10,
      status: CouponStatus.ACTIVE,
      createBy: 'codex-real-flow',
    },
    update: {},
  });

  const afterTpl = await prisma.mktCouponTemplate.findMany({
    where: { id: { in: [E2E_COUPON_TPL_DISC, E2E_COUPON_TPL_PCT, E2E_COUPON_TPL_STACK] } },
    select: { id: true },
  });
  if (afterTpl.length > hadTplCount) {
    created.push('mkt_coupon_template(e2e×3)');
  }

  const userCouponDefs: Array<{
    id: string;
    templateId: string;
    couponName: string;
    couponType: CouponType;
    discountAmount: Decimal | null;
    discountPercent: number | null;
  }> = [
    {
      id: E2E_USER_COUPON_DISC,
      templateId: E2E_COUPON_TPL_DISC,
      couponName: 'E2E满减12',
      couponType: CouponType.DISCOUNT,
      discountAmount: new Decimal(12),
      discountPercent: null,
    },
    {
      id: E2E_USER_COUPON_PCT,
      templateId: E2E_COUPON_TPL_PCT,
      couponName: 'E2E九折',
      couponType: CouponType.PERCENTAGE,
      discountAmount: null,
      discountPercent: 10,
    },
    {
      id: E2E_USER_COUPON_FLASH_STACK,
      templateId: E2E_COUPON_TPL_STACK,
      couponName: 'E2E叠券减5',
      couponType: CouponType.DISCOUNT,
      discountAmount: new Decimal(5),
      discountPercent: null,
    },
    {
      id: E2E_USER_COUPON_COURSE_STACK,
      templateId: E2E_COUPON_TPL_STACK,
      couponName: 'E2E叠券减5',
      couponType: CouponType.DISCOUNT,
      discountAmount: new Decimal(5),
      discountPercent: null,
    },
  ];

  const beforeUc = await prisma.mktUserCoupon.count({
    where: { id: { in: userCouponDefs.map((u) => u.id) } },
  });

  for (const u of userCouponDefs) {
    await prisma.mktUserCoupon.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        tenantId: TENANT_ID,
        memberId: M_BUYER,
        templateId: u.templateId,
        couponName: u.couponName,
        couponType: u.couponType,
        discountAmount: u.discountAmount,
        discountPercent: u.discountPercent,
        maxDiscountAmount: null,
        minOrderAmount: new Decimal(0),
        startTime: E2E_COUPON_FIXED_START,
        endTime: E2E_COUPON_FIXED_END,
        status: UserCouponStatus.UNUSED,
        distributionType: CouponDistributionType.MANUAL,
        distributionSource: 'codex-real-flow',
      },
      update: {},
    });
  }

  const afterUc = await prisma.mktUserCoupon.count({
    where: { id: { in: userCouponDefs.map((x) => x.id) } },
  });
  if (afterUc > beforeUc) {
    created.push(`mkt_user_coupon(e2e×${afterUc - beforeUc} new)`);
  }

  if (created.length > 0) {
    console.warn(`[codex-real-flow] 已补齐营销夹具: ${created.join(', ')}`);
  }
}

function nextPhone(flowTag: string, index: number) {
  return `1380000${flowTag.slice(-4)}${String(index).padStart(2, '0')}`;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const startedAt = Date.now();
    const prisma = app.get(PrismaService).prismaInner;
    const resolutionService = app.get(ResolutionService);
    const orderService = app.get(OrderService);
    const paymentService = app.get(PaymentService);
    const storeOrderService = app.get(StoreOrderService);
    const settlementScheduler = app.get(SettlementScheduler);
    const storeProductService = app.get(StoreProductService);
    const storePlayConfigService = app.get(StorePlayConfigService);

    await prisma.sysDistConfig.findUniqueOrThrow({ where: { tenantId: TENANT_ID } });
    await ensureFlowMembers(prisma);
    await ensureE2eFlowMarketingFixtures(prisma);
    await ensureCrossTenantMembers(prisma);
    await ensureGroupBuyCatalog({ prisma, storeProductService, storePlayConfigService });
    await ensureMemberUpgradeCatalog({ prisma, storeProductService, storePlayConfigService });
    await ensureUpgradeFlowMember(prisma);

    const bulk = await getSkuMeta(prisma, GSKU_BULK);
    const flash = await getSkuMeta(prisma, GSKU_FLASH);
    const course = await getSkuMeta(prisma, GSKU_COURSE);
    const reduce = await getSkuMeta(prisma, GSKU_REDUCE);

    const flowTag = `${Date.now()}`;
    const couponNormalOnly = await duplicateUserCoupon(
      prisma,
      E2E_USER_COUPON_DISC,
      M_BUYER,
      `codex_normal_coupon_only_${flowTag}`,
    );
    const couponNormalAndPoints = await duplicateUserCoupon(
      prisma,
      E2E_USER_COUPON_DISC,
      M_BUYER,
      `codex_normal_coupon_points_${flowTag}`,
    );
    const couponFlash = await duplicateUserCoupon(
      prisma,
      E2E_USER_COUPON_FLASH_STACK,
      M_BUYER,
      `codex_flash_${flowTag}`,
    );
    const couponCourseStack = await duplicateUserCoupon(
      prisma,
      E2E_USER_COUPON_COURSE_STACK,
      M_BUYER,
      `codex_course_stack_${flowTag}`,
    );
    const couponReduceWithCoupon = await duplicateUserCoupon(
      prisma,
      E2E_USER_COUPON_DISC,
      M_BUYER,
      `codex_reduce_w_coupon_${flowTag}`,
    );
    const couponUnpaidCancel = await duplicateUserCoupon(
      prisma,
      E2E_USER_COUPON_DISC,
      M_BUYER,
      `codex_unpaid_cancel_${flowTag}`,
    );
    const couponActualPaidCombo = await duplicateUserCoupon(
      prisma,
      E2E_USER_COUPON_DISC,
      M_BUYER,
      `codex_actual_paid_combo_${flowTag}`,
    );

    const flashActivity = await resolveActivity(resolutionService, flash.productId, M_BUYER);
    const courseActivity = await resolveActivity(resolutionService, course.productId, M_BUYER);
    const reduceActivity = await resolveActivity(resolutionService, reduce.productId, M_BUYER);
    const groupMeta = await getSkuMeta(prisma, GSKU_GROUP);
    const groupActivity = await resolveActivity(resolutionService, groupMeta.productId, M_BUYER);
    const upgradeMeta = await getSkuMeta(prisma, GSKU_UPGRADE);
    const upgradeActivity = await resolveActivity(resolutionService, upgradeMeta.productId, M_UPGRADE_BUYER);

    const coverage: FlowCoverageReport = {
      coveredScenarios: [
        'unpaid-cancel',
        'unpaid-cancel-with-coupon',
        'unpaid-cancel-with-points',
        'normal-no-coupon-no-points',
        'normal-coupon-only',
        'normal-points-only',
        'normal-coupon-and-points',
        'normal-sku-dist-none',
        'normal-sku-dist-fixed',
        'normal-exchange-sku',
        'flash-sale',
        'flash-sale-with-coupon',
        'flash-sale-with-points',
        'course-group-buy',
        'course-group-buy-with-coupon',
        'group-buy-leader',
        'member-upgrade-purchase',
        'full-reduction',
        'full-reduction-with-coupon',
        'actual-paid',
        'actual-paid-coupon-and-points',
        'no-upline',
        'self-purchase',
        'c2-direct-full-take',
        'l1-blacklist',
        'l2-blacklist',
        'cross-tenant-disabled',
        'cross-tenant-enabled',
        'service-settlement',
        'full-refund-unsettled',
        'partial-refund-coupon-points',
        'full-refund-settled',
      ],
      engineGaps: [
        {
          scenario: 'newcomer-price',
          reason:
            '门店玩法模板未注册 NEWCOMER 策略（PLAY_REGISTRY 无此项），无法通过 StorePlayConfigService 落库；需产品线接入后再跑',
        },
        {
          scenario: 'member-price',
          reason:
            '门店玩法模板未注册 MEMBER_PRICE 策略，无法自动创建玩法配置；需产品线接入后再跑',
        },
        {
          scenario: 'group-buy-full-chain',
          reason:
            '普通拼团满团通常需多单/实例；本脚本仅覆盖开团首单（group-buy-leader），满团与失败退款需另编排',
        },
        {
          scenario: 'partial-refund-after-settled',
          reason: '矩阵 R5 建议在业务验收中单测编排；本脚本未再造第二笔已结算单做部分退',
        },
      ],
    };

    const results: ScenarioSummary[] = [];
    let phoneIndex = 1;

    const unpaidPlain = await createUnpaidThenCancel({
      orderService,
      prisma,
      memberId: M_BUYER,
      items: [{ skuId: bulk.skuId, quantity: 1 }],
      phone: nextPhone(flowTag, phoneIndex++),
      remark: `codex-real-flow-unpaid-cancel-${flowTag}`,
    });
    pushUnpaidCancelScenario(results, 'unpaid-cancel', unpaidPlain, {
      note: 'R1: 待支付取消；预期无佣金、库存恢复、触发 handleOrderCancelled',
    });

    const unpaidWithCouponRun = await createUnpaidThenCancel({
      orderService,
      prisma,
      memberId: M_BUYER,
      items: [{ skuId: bulk.skuId, quantity: 1 }],
      phone: nextPhone(flowTag, phoneIndex++),
      userCouponId: couponUnpaidCancel,
      remark: `codex-real-flow-unpaid-cancel-coupon-${flowTag}`,
    });
    const couponAfterUnpaidCancel = await prisma.mktUserCoupon.findUnique({
      where: { id: couponUnpaidCancel },
      select: { status: true },
    });
    pushUnpaidCancelScenario(results, 'unpaid-cancel-with-coupon', unpaidWithCouponRun, {
      note: `R1+券: 取消后 userCoupon.status=${couponAfterUnpaidCancel?.status ?? 'MISSING'}（预期 UNUSED 或等价解锁态）`,
    });

    const pointsBeforeUnpaidCancel = await prisma.mktPointsAccount.findUnique({
      where: { tenantId_memberId: { tenantId: TENANT_ID, memberId: M_BUYER } },
      select: { availablePoints: true },
    });
    const unpaidWithPointsRun = await createUnpaidThenCancel({
      orderService,
      prisma,
      memberId: M_BUYER,
      items: [{ skuId: bulk.skuId, quantity: 1 }],
      phone: nextPhone(flowTag, phoneIndex++),
      pointsUsed: 100,
      remark: `codex-real-flow-unpaid-cancel-points-${flowTag}`,
    });
    const pointsAfterUnpaidCancel = await prisma.mktPointsAccount.findUnique({
      where: { tenantId_memberId: { tenantId: TENANT_ID, memberId: M_BUYER } },
      select: { availablePoints: true },
    });
    pushUnpaidCancelScenario(results, 'unpaid-cancel-with-points', unpaidWithPointsRun, {
      note: `R1+积分: 取消后 availablePoints=${pointsAfterUnpaidCancel?.availablePoints ?? 'MISSING'}（下单前约 ${pointsBeforeUnpaidCancel?.availablePoints ?? 'MISSING'}）`,
    });

    const normalBase = await createPayAndLoad({
      app,
      prisma,
      orderService,
      paymentService,
      memberId: M_BUYER,
      items: [{ skuId: bulk.skuId, quantity: 1 }],
      phone: nextPhone(flowTag, phoneIndex++),
      remark: `codex-real-flow-normal-base-${flowTag}`,
    });
    pushOrderScenario(results, 'normal-no-coupon-no-points', normalBase);

    const normalCouponOnly = await createPayAndLoad({
      app,
      prisma,
      orderService,
      paymentService,
      memberId: M_BUYER,
      items: [{ skuId: bulk.skuId, quantity: 1 }],
      phone: nextPhone(flowTag, phoneIndex++),
      userCouponId: couponNormalOnly,
      remark: `codex-real-flow-normal-coupon-only-${flowTag}`,
    });
    pushOrderScenario(results, 'normal-coupon-only', normalCouponOnly);

    const normalPointsOnly = await createPayAndLoad({
      app,
      prisma,
      orderService,
      paymentService,
      memberId: M_BUYER,
      items: [{ skuId: bulk.skuId, quantity: 1 }],
      phone: nextPhone(flowTag, phoneIndex++),
      pointsUsed: 100,
      remark: `codex-real-flow-normal-points-only-${flowTag}`,
    });
    pushOrderScenario(results, 'normal-points-only', normalPointsOnly);

    const normalCouponPoints = await createPayAndLoad({
      app,
      prisma,
      orderService,
      paymentService,
      memberId: M_BUYER,
      items: [{ skuId: bulk.skuId, quantity: 2 }],
      phone: nextPhone(flowTag, phoneIndex++),
      userCouponId: couponNormalAndPoints,
      pointsUsed: 100,
      remark: `codex-real-flow-normal-coupon-points-${flowTag}`,
    });
    pushOrderScenario(results, 'normal-coupon-and-points', normalCouponPoints);

    const normalDistNone = await withTenantSkuDistMode(prisma, bulk.skuId, DistributionMode.NONE, async () =>
      createPayAndLoad({
        app,
        prisma,
        orderService,
        paymentService,
        memberId: M_BUYER,
        items: [{ skuId: bulk.skuId, quantity: 1 }],
        phone: nextPhone(flowTag, phoneIndex++),
        remark: `codex-real-flow-normal-dist-none-${flowTag}`,
      }),
    );
    pushOrderScenario(results, 'normal-sku-dist-none', normalDistNone, {
      note: 'P5: 临时将租户 SKU distMode=NONE；预期无 fin_commission；已恢复为原 distMode',
    });

    const normalDistFixed = await withTenantSkuSnapshotPatch(
      prisma,
      bulk.skuId,
      { distMode: DistributionMode.FIXED, distRate: new Decimal(8) },
      async () =>
        createPayAndLoad({
          app,
          prisma,
          orderService,
          paymentService,
          memberId: M_BUYER,
          items: [{ skuId: bulk.skuId, quantity: 1 }],
          phone: nextPhone(flowTag, phoneIndex++),
          remark: `codex-real-flow-normal-dist-fixed-${flowTag}`,
        }),
    );
    pushOrderScenario(results, 'normal-sku-dist-fixed', normalDistFixed, {
      note: 'P5b: 临时 distMode=FIXED + distRate=8（固定额）；已恢复',
    });

    const normalExchange = await withTenantSkuSnapshotPatch(
      prisma,
      bulk.skuId,
      { isExchangeProduct: true },
      async () =>
        createPayAndLoad({
          app,
          prisma,
          orderService,
          paymentService,
          memberId: M_BUYER,
          items: [{ skuId: bulk.skuId, quantity: 1 }],
          phone: nextPhone(flowTag, phoneIndex++),
          remark: `codex-real-flow-normal-exchange-${flowTag}`,
        }),
    );
    pushOrderScenario(results, 'normal-exchange-sku', normalExchange, {
      note: 'P5c: 临时 isExchangeProduct=true；佣金基数多为 ZERO；已恢复',
    });

    const flashBase = await createPayAndLoad({
      app,
      prisma,
      orderService,
      paymentService,
      memberId: M_BUYER,
      items: [
        {
          skuId: flash.skuId,
          quantity: 1,
          activityContextKey: flashActivity.activityContextKey,
          activityType: flashActivity.activityType,
          activityConfigId: flashActivity.configId,
        },
      ],
      phone: nextPhone(flowTag, phoneIndex++),
      remark: `codex-real-flow-flash-${flowTag}`,
    });
    pushOrderScenario(results, 'flash-sale', flashBase);

    const flashCouponOrder = await createPayAndLoad({
      app,
      prisma,
      orderService,
      paymentService,
      memberId: M_BUYER,
      items: [
        {
          skuId: flash.skuId,
          quantity: 1,
          activityContextKey: flashActivity.activityContextKey,
          activityType: flashActivity.activityType,
          activityConfigId: flashActivity.configId,
        },
      ],
      phone: nextPhone(flowTag, phoneIndex++),
      userCouponId: couponFlash,
      remark: `codex-real-flow-flash-coupon-${flowTag}`,
    });
    pushOrderScenario(results, 'flash-sale-with-coupon', flashCouponOrder);

    const flashWithPoints = await createPayAndLoad({
      app,
      prisma,
      orderService,
      paymentService,
      memberId: M_BUYER,
      items: [
        {
          skuId: flash.skuId,
          quantity: 1,
          activityContextKey: flashActivity.activityContextKey,
          activityType: flashActivity.activityType,
          activityConfigId: flashActivity.configId,
        },
      ],
      phone: nextPhone(flowTag, phoneIndex++),
      pointsUsed: 100,
      remark: `codex-real-flow-flash-points-${flowTag}`,
    });
    pushOrderScenario(results, 'flash-sale-with-points', flashWithPoints, {
      note: 'M1: 活动价后再叠积分抵扣',
    });

    const courseBase = await createPayAndLoad({
      app,
      prisma,
      orderService,
      paymentService,
      memberId: M_BUYER,
      items: [
        {
          skuId: course.skuId,
          quantity: 1,
          activityContextKey: courseActivity.activityContextKey,
          activityType: courseActivity.activityType,
          activityConfigId: courseActivity.configId,
        },
      ],
      phone: nextPhone(flowTag, phoneIndex++),
      remark: `codex-real-flow-course-${flowTag}`,
    });
    pushOrderScenario(results, 'course-group-buy', courseBase);

    const courseWithCoupon = await createPayAndLoad({
      app,
      prisma,
      orderService,
      paymentService,
      memberId: M_BUYER,
      items: [
        {
          skuId: course.skuId,
          quantity: 1,
          activityContextKey: courseActivity.activityContextKey,
          activityType: courseActivity.activityType,
          activityConfigId: courseActivity.configId,
        },
      ],
      phone: nextPhone(flowTag, phoneIndex++),
      userCouponId: couponCourseStack,
      remark: `codex-real-flow-course-coupon-${flowTag}`,
    });
    pushOrderScenario(results, 'course-group-buy-with-coupon', courseWithCoupon, {
      note: 'M3: 拼班活动价 + E2E 叠券（与 tenant-000000 e2e MD-008 同源券实例）',
    });

    const reduceBase = await createPayAndLoad({
      app,
      prisma,
      orderService,
      paymentService,
      memberId: M_BUYER,
      items: [
        {
          skuId: reduce.skuId,
          quantity: 1,
          activityContextKey: reduceActivity.activityContextKey,
          activityType: reduceActivity.activityType,
          activityConfigId: reduceActivity.configId,
        },
      ],
      phone: nextPhone(flowTag, phoneIndex++),
      remark: `codex-real-flow-reduce-${flowTag}`,
    });
    pushOrderScenario(results, 'full-reduction', reduceBase);

    const reduceWithCoupon = await createPayAndLoad({
      app,
      prisma,
      orderService,
      paymentService,
      memberId: M_BUYER,
      items: [
        {
          skuId: reduce.skuId,
          quantity: 1,
          activityContextKey: reduceActivity.activityContextKey,
          activityType: reduceActivity.activityType,
          activityConfigId: reduceActivity.configId,
        },
      ],
      phone: nextPhone(flowTag, phoneIndex++),
      userCouponId: couponReduceWithCoupon,
      remark: `codex-real-flow-reduce-coupon-${flowTag}`,
    });
    pushOrderScenario(results, 'full-reduction-with-coupon', reduceWithCoupon, {
      note: 'M4: FULL_REDUCTION 命中后再叠满减券',
    });

    let groupLeaderRun: OrderRunResult | null = null;
    try {
      groupLeaderRun = await createPayAndLoad({
        app,
        prisma,
        orderService,
        paymentService,
        memberId: M_BUYER,
        items: [
          {
            skuId: groupMeta.skuId,
            quantity: 1,
            activityContextKey: groupActivity.activityContextKey,
            activityType: groupActivity.activityType,
            activityConfigId: groupActivity.configId,
          },
        ],
        phone: nextPhone(flowTag, phoneIndex++),
        remark: `codex-real-flow-group-leader-${flowTag}`,
      });
    } catch (error: unknown) {
      results.push({
        scenario: 'group-buy-leader',
        orderStatus: 'ERROR',
        note: `开团下单失败: ${getErrorMessage(error)}`,
      });
    }
    if (groupLeaderRun) {
      pushOrderScenario(results, 'group-buy-leader', groupLeaderRun, {
        note: '普通拼团开团首单；满团/失败退款见 engineGaps.group-buy-full-chain',
      });
    }

    let memberUpgradeRun: OrderRunResult | null = null;
    try {
      memberUpgradeRun = await createPayAndLoad({
        app,
        prisma,
        orderService,
        paymentService,
        memberId: M_UPGRADE_BUYER,
        items: [
          {
            skuId: upgradeMeta.skuId,
            quantity: 1,
            activityContextKey: upgradeActivity.activityContextKey,
            activityType: upgradeActivity.activityType,
            activityConfigId: upgradeActivity.configId,
          },
        ],
        phone: nextPhone(flowTag, phoneIndex++),
        remark: `codex-real-flow-member-upgrade-${flowTag}`,
      });
    } catch (error: unknown) {
      results.push({
        scenario: 'member-upgrade-purchase',
        orderStatus: 'ERROR',
        note: `MEMBER_UPGRADE 下单失败: ${getErrorMessage(error)}`,
      });
    }
    if (memberUpgradeRun) {
      const memberAfter = await prisma.umsMember.findUnique({
        where: { memberId: M_UPGRADE_BUYER },
        select: { levelId: true },
      });
      const apply = await prisma.umsUpgradeApply.findFirst({
        where: { tenantId: TENANT_ID, memberId: M_UPGRADE_BUYER },
        orderBy: { createTime: 'desc' },
        select: { status: true, toLevel: true, fromLevel: true, orderId: true },
      });
      pushOrderScenario(results, 'member-upgrade-purchase', memberUpgradeRun, {
        note: `MEMBER_UPGRADE: pay 后 levelId=${memberAfter?.levelId ?? 'MISSING'} apply=${apply?.status ?? 'MISSING'} toLevel=${apply?.toLevel ?? 'n/a'} from=${apply?.fromLevel ?? 'n/a'} orderId=${apply?.orderId ?? 'n/a'}`,
      });
    }

    const actualPaid = await withCommissionBaseType(prisma, CommissionBaseType.ACTUAL_PAID, async () =>
      createPayAndLoad({
        app,
        prisma,
        orderService,
        paymentService,
        memberId: M_BUYER,
        items: [{ skuId: bulk.skuId, quantity: 1 }],
        phone: nextPhone(flowTag, phoneIndex++),
        pointsUsed: 200,
        remark: `codex-real-flow-actual-paid-${flowTag}`,
      }),
    );
    pushOrderScenario(results, 'actual-paid', actualPaid, {
      note: 'temporarily switched sys_dist_config.commissionBaseType to ACTUAL_PAID for this scenario',
    });

    const actualPaidCouponPoints = await withCommissionBaseType(
      prisma,
      CommissionBaseType.ACTUAL_PAID,
      async () =>
        createPayAndLoad({
          app,
          prisma,
          orderService,
          paymentService,
          memberId: M_BUYER,
          items: [{ skuId: bulk.skuId, quantity: 2 }],
          phone: nextPhone(flowTag, phoneIndex++),
          userCouponId: couponActualPaidCombo,
          pointsUsed: 100,
          remark: `codex-real-flow-actual-paid-combo-${flowTag}`,
        }),
    );
    pushOrderScenario(results, 'actual-paid-coupon-and-points', actualPaidCouponPoints, {
      note: 'P4 under ACTUAL_PAID：券+积分叠加时 commissionBaseType=ACTUAL_PAID',
    });

    const noUpline = await createPayAndLoad({
      app,
      prisma,
      orderService,
      paymentService,
      memberId: M_SOLO,
      items: [{ skuId: bulk.skuId, quantity: 1 }],
      phone: nextPhone(flowTag, phoneIndex++),
      remark: `codex-real-flow-no-upline-${flowTag}`,
    });
    pushOrderScenario(results, 'no-upline', noUpline);

    const selfPurchase = await createPayAndLoad({
      app,
      prisma,
      orderService,
      paymentService,
      memberId: M_SELF_SHARE,
      items: [{ skuId: bulk.skuId, quantity: 1 }],
      phone: nextPhone(flowTag, phoneIndex++),
      shareUserId: M_SELF_SHARE,
      remark: `codex-real-flow-self-purchase-${flowTag}`,
    });
    pushOrderScenario(results, 'self-purchase', selfPurchase);

    const directC2 = await createPayAndLoad({
      app,
      prisma,
      orderService,
      paymentService,
      memberId: M_DIRECT_C2,
      items: [{ skuId: bulk.skuId, quantity: 1 }],
      phone: nextPhone(flowTag, phoneIndex++),
      remark: `codex-real-flow-direct-c2-${flowTag}`,
    });
    pushOrderScenario(results, 'c2-direct-full-take', directC2);

    const l1Blacklist = await withBlacklist(prisma, M_L1, async () =>
      createPayAndLoad({
        app,
        prisma,
        orderService,
        paymentService,
        memberId: M_BUYER,
        items: [{ skuId: bulk.skuId, quantity: 1 }],
        phone: nextPhone(flowTag, phoneIndex++),
        remark: `codex-real-flow-l1-blacklist-${flowTag}`,
      }),
    );
    pushOrderScenario(results, 'l1-blacklist', l1Blacklist);

    const l2Blacklist = await withBlacklist(prisma, M_TOP, async () =>
      createPayAndLoad({
        app,
        prisma,
        orderService,
        paymentService,
        memberId: M_BUYER,
        items: [{ skuId: bulk.skuId, quantity: 1 }],
        phone: nextPhone(flowTag, phoneIndex++),
        remark: `codex-real-flow-l2-blacklist-${flowTag}`,
      }),
    );
    pushOrderScenario(results, 'l2-blacklist', l2Blacklist);

    const crossDisabled = await withSysDistCrossTenantFlags(prisma, false, async () =>
      createPayAndLoad({
        app,
        prisma,
        orderService,
        paymentService,
        memberId: M_CROSS_BUYER,
        items: [{ skuId: bulk.skuId, quantity: 1 }],
        phone: nextPhone(flowTag, phoneIndex++),
        remark: `codex-real-flow-cross-off-${flowTag}`,
      }),
    );
    pushOrderScenario(results, 'cross-tenant-disabled', crossDisabled, {
      note: '买家上级在副租户 + enableCrossTenant=false；L1Calculator 应跳过跨店受益人',
    });

    const crossEnabled = await withSysDistCrossTenantFlags(prisma, true, async () =>
      createPayAndLoad({
        app,
        prisma,
        orderService,
        paymentService,
        memberId: M_CROSS_BUYER,
        items: [{ skuId: bulk.skuId, quantity: 1 }],
        phone: nextPhone(flowTag, phoneIndex++),
        remark: `codex-real-flow-cross-on-${flowTag}`,
      }),
    );
    pushOrderScenario(results, 'cross-tenant-enabled', crossEnabled, {
      note: '买家上级在副租户 + enableCrossTenant=true；可产生 isCrossTenant 佣金（受日限额等约束）',
    });

    const courseOrderBeforeVerify = await prisma.omsOrder.findUnique({ where: { id: courseBase.orderId } });
    if (courseOrderBeforeVerify?.status !== 'SHIPPED') {
      await prisma.omsOrder.update({
        where: { id: courseBase.orderId },
        data: {
          status: 'SHIPPED',
          remark: `codex settle prep from ${courseOrderBeforeVerify?.status ?? 'UNKNOWN'}`,
        },
      });
    }
    await TenantContext.run({ tenantId: TENANT_ID }, () =>
      storeOrderService.verifyService({ orderId: courseBase.orderId, remark: 'codex verify' } as never, 'codex'),
    );
    await prisma.finCommission.updateMany({
      where: { orderId: courseBase.orderId, status: 'FROZEN' },
      data: { planSettleTime: new Date(Date.now() - 60_000) },
    });
    await settlementScheduler.triggerSettlement();
    results.push({
      scenario: 'service-settlement',
      orderId: courseBase.orderId,
      payAmount: toNum(courseBase.order?.payAmount)!,
      orderStatus: (await prisma.omsOrder.findUnique({ where: { id: courseBase.orderId } }))?.status,
      commissions: mapCommissions(
        await prisma.finCommission.findMany({
          where: { orderId: courseBase.orderId },
          orderBy: [{ level: 'asc' }],
        }),
      ),
      walletAfter: await loadWallets(prisma, [M_L1, M_TOP]),
      note: 'forced service order to SHIPPED and backdated planSettleTime to verify settlement in one run',
    });

    const fullRefundResult = await TenantContext.run({ tenantId: TENANT_ID }, () =>
      storeOrderService.refundOrder(reduceBase.orderId, 'codex full refund', 'codex'),
    );
    results.push({
      scenario: 'full-refund-unsettled',
      orderId: reduceBase.orderId,
      refundResult: fullRefundResult,
      orderStatus: (await prisma.omsOrder.findUnique({ where: { id: reduceBase.orderId } }))?.status,
      commissions: mapCommissions(
        await prisma.finCommission.findMany({ where: { orderId: reduceBase.orderId }, orderBy: [{ level: 'asc' }] }),
      ),
    });

    const partialItem = await prisma.omsOrderItem.findFirst({
      where: { orderId: normalCouponPoints.orderId },
      orderBy: { id: 'asc' },
    });
    if (!partialItem) {
      throw new Error(`order item missing for partial refund order ${normalCouponPoints.orderId}`);
    }
    const partialRefundResult = await TenantContext.run({ tenantId: TENANT_ID }, () =>
      storeOrderService.partialRefundOrder(
        {
          orderId: normalCouponPoints.orderId,
          items: [{ itemId: partialItem.id, quantity: 1 }],
          remark: 'codex partial refund',
        } as never,
        'codex',
      ),
    );
    results.push({
      scenario: 'partial-refund-coupon-points',
      orderId: normalCouponPoints.orderId,
      refundResult: partialRefundResult,
      orderStatus: (await prisma.omsOrder.findUnique({ where: { id: normalCouponPoints.orderId } }))?.status,
      commissions: mapCommissions(
        await prisma.finCommission.findMany({
          where: { orderId: normalCouponPoints.orderId },
          orderBy: [{ level: 'asc' }],
        }),
      ),
    });

    const settledRefundWalletBefore = await loadWallets(prisma, [M_L1, M_TOP]);
    const settledRefundResult = await TenantContext.run({ tenantId: TENANT_ID }, () =>
      storeOrderService.refundOrder(courseBase.orderId, 'codex settled refund', 'codex'),
    );
    const settledRefundWalletAfter = await loadWallets(prisma, [M_L1, M_TOP]);
    results.push({
      scenario: 'full-refund-settled',
      orderId: courseBase.orderId,
      refundResult: settledRefundResult,
      orderStatus: (await prisma.omsOrder.findUnique({ where: { id: courseBase.orderId } }))?.status,
      commissions: mapCommissions(
        await prisma.finCommission.findMany({ where: { orderId: courseBase.orderId }, orderBy: [{ level: 'asc' }] }),
      ),
      walletAfter: {
        before: settledRefundWalletBefore,
        after: settledRefundWalletAfter,
      } as never,
    });

    const reportPath = writeFlowReportFile(coverage, results, startedAt);
    printCompactSummary(results, reportPath);
    if (coverage.engineGaps.length > 0) {
      console.log('\n引擎/编排边界（未在本脚本内穷举）:');
      for (const g of coverage.engineGaps) {
        console.log(`  • ${g.scenario}: ${g.reason}`);
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
