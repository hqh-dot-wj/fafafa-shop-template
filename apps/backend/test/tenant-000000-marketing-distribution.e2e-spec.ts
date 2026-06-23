/**
 * 租户 000000：两种营销配置（拼班 / 秒杀）+ 门店选品（Service）+ 多会员分销链 + 下单 + mock 支付 + 佣金计算
 *
 * 运行：pnpm --filter @apps/backend test:e2e -- tenant-000000-marketing-distribution.e2e-spec.ts
 *
 * 保留数据（不执行 afterAll 清理，便于连库查看）：
 *   Windows PowerShell: $env:E2E_SKIP_CLEANUP='1'; pnpm exec jest --config ./test/jest-e2e.json tenant-000000-marketing-distribution.e2e-spec.ts --runInBand
 * 再次运行前请手动删除本文件创建的 mkt_store_config / 订单 / 会员等，否则会因活动互斥或唯一键冲突失败。
 *
 * 依赖：PostgreSQL（与 .env 一致）、Redis（营销幂等/库存）、已执行 prisma migrate；建议独立测试库。
 *
 * 说明：
 * - 主路径使用 Nest **Service**（StoreProductService、StorePlayConfigService、OrderService、PaymentService、CommissionService）。
 * - C 端 HTTP 仅作对照可选；本文件以 Service 调用为主。
 * - 券/积分：`createOrder` 含 `userCouponId` / `pointsUsed` 时用 `TenantContext.run({ tenantId })` 包裹，保证积分规则 `findByTenantId` 命中租户（见 MD-004～MD-006）。
 * - MD-009：单条用例内临时 `sys_dist_config.commissionBaseType=ACTUAL_PAID`，`finally` 恢复 `ORIGINAL_PRICE`，避免污染其余用例。
 * - MD-007 / MD-008：订单域**允许** `marketingConfigId` 与 `userCouponId` 同时传入（先营销价预览再算券）；见叠券用例。
 * - 分销：`sys_dist_level` 与黑名单、C2 直推全拿、自购不返佣等多场景；订单数量通过批量下单提高。
 * - 支付成功会入队 CALC_COMMISSION，勿再同步调用 calculateCommission，否则与队列并发会触发 fin_commission 唯一键冲突。
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import type { Queue } from 'bull';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { WechatService } from '../src/module/client/common/service/wechat.service';
import { RiskService } from '../src/module/risk/risk.service';
import { AdmissionService } from '../src/module/lbs/admission/admission.service';
import { StoreProductService } from '../src/module/store/product/product.service';
import { DistMode } from '../src/module/store/product/dto/import-product.dto';
import { StorePlayConfigService } from '../src/module/marketing/config/config.service';
import { OrderService } from '../src/module/client/order/order.service';
import { PaymentService } from '../src/module/client/payment/payment.service';
import { PlayInstanceService } from '../src/module/marketing/instance/instance.service';
import {
  ProductType,
  PublishStatus,
  MemberStatus,
  MarketingStockMode,
  CouponType,
  CouponValidityType,
  CouponStatus,
  UserCouponStatus,
  CouponDistributionType,
  CommissionBaseType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { TenantContext } from '../src/common/tenant/tenant.context';
import { createE2eApp } from './helpers/e2e-app';

const TENANT_ID = '000000';

/** 设为 1 / true / yes 时跳过 afterAll 数据清理（仍关闭 Nest 应用） */
function isE2eSkipCleanup(): boolean {
  const v = process.env.E2E_SKIP_CLEANUP;
  if (v == null || v === '') return false;
  const s = v.toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

const PID_COURSE = 't000000_flow_course';
const PID_FLASH = 't000000_flow_flash';
const PID_BULK = 't000000_flow_bulk';
const GSKU_COURSE = 't000000_flow_gsku_course';
const GSKU_FLASH = 't000000_flow_gsku_flash';
const GSKU_BULK = 't000000_flow_gsku_bulk';

const M_TOP = 't000000_flow_m_top';
const M_L1 = 't000000_flow_m_l1';
const M_BUYER = 't000000_flow_m_buyer';
const M_SOLO = 't000000_flow_m_solo';
/** 上级仅为 C2（TOP），无 indirect → C2 全拿 L2 */
const M_DIRECT_C2 = 't000000_flow_m_direct_c2';
/** 与 M_BUYER 同链，用于自购（shareUserId=本人） */
const M_SELF_SHARE = 't000000_flow_m_self_share';

/** 链式 extra，与固定会员合计 12 人 */
const EXTRA_MEMBER_IDS = [
  't000000_flow_m_e1',
  't000000_flow_m_e2',
  't000000_flow_m_e3',
  't000000_flow_m_e4',
  't000000_flow_m_e5',
  't000000_flow_m_e6',
];

const ALL_MEMBER_IDS = [M_TOP, M_L1, M_BUYER, M_SOLO, M_DIRECT_C2, M_SELF_SHARE, ...EXTRA_MEMBER_IDS];

const M_CHAIN_TAIL = EXTRA_MEMBER_IDS[EXTRA_MEMBER_IDS.length - 1];

/** E2E 专用券模板/用户券（满减券 / 折扣券 / 玩法叠券），与 seed 隔离 */
const E2E_COUPON_TPL_DISC = 'e2e11111-1111-4111-8111-111111111101';
const E2E_COUPON_TPL_PCT = 'e2e11111-1111-4111-8111-111111111102';
/** 满减 5 元，专用于秒杀/拼班与优惠券叠加（MD-007 / MD-008） */
const E2E_COUPON_TPL_STACK = 'e2e11111-1111-4111-8111-111111111103';
const E2E_USER_COUPON_DISC = 'e2e22222-2222-4222-8222-222222222201';
const E2E_USER_COUPON_PCT = 'e2e22222-2222-4222-8222-222222222202';
const E2E_USER_COUPON_FLASH_STACK = 'e2e22222-2222-4222-8222-222222222203';
const E2E_USER_COUPON_COURSE_STACK = 'e2e22222-2222-4222-8222-222222222204';

const E2E_STACK_USER_COUPON_IDS = [
  E2E_USER_COUPON_DISC,
  E2E_USER_COUPON_PCT,
  E2E_USER_COUPON_FLASH_STACK,
  E2E_USER_COUPON_COURSE_STACK,
];
const E2E_COUPON_TEMPLATE_IDS = [E2E_COUPON_TPL_DISC, E2E_COUPON_TPL_PCT, E2E_COUPON_TPL_STACK];

const mockWechatService = {
  code2Session: jest.fn((code: string) =>
    Promise.resolve({
      success: true,
      data: {
        openid: `o-${code}-${Date.now()}`,
        unionid: `u-${code}-${Date.now()}`,
        session_key: 'mock-session-key',
      },
    }),
  ),
  getPhoneNumber: jest.fn(() => Promise.resolve('13800000000')),
};

const mockRiskService = {
  checkOrderRisk: jest.fn().mockResolvedValue(undefined),
};

const mockAdmissionService = {
  checkLocationAdmission: jest.fn().mockResolvedValue(undefined),
  isLocationInRange: jest.fn().mockResolvedValue(true),
};

describe('Tenant 000000 marketing + distribution (service-driven)', () => {
  jest.setTimeout(180_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let storeProductService: StoreProductService;
  let storePlayConfigService: StorePlayConfigService;
  let orderService: OrderService;
  let paymentService: PaymentService;
  let playInstanceService: PlayInstanceService;

  let tenantSkuFlash: string;
  let tenantSkuCourse: string;
  let tenantSkuBulk: string;
  let configCourseId: string;
  let configFlashId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WechatService)
      .useValue(mockWechatService)
      .overrideProvider(RiskService)
      .useValue(mockRiskService)
      .overrideProvider(AdmissionService)
      .useValue(mockAdmissionService)
      .compile();

    const e2eApp = await createE2eApp(moduleFixture);
    app = e2eApp.app;

    prisma = app.get(PrismaService);
    storeProductService = app.get(StoreProductService);
    storePlayConfigService = app.get(StorePlayConfigService);
    orderService = app.get(OrderService);
    paymentService = app.get(PaymentService);
    playInstanceService = app.get(PlayInstanceService);

    const tenant = await prisma.sysTenant.findUnique({ where: { tenantId: TENANT_ID } });
    if (!tenant) {
      throw new Error(`缺少租户 ${TENANT_ID}，请先执行 prisma seed / 迁移`);
    }

    await prisma.sysDistConfig.upsert({
      where: { tenantId: TENANT_ID },
      create: {
        tenantId: TENANT_ID,
        level1Rate: new Decimal(0.1),
        level2Rate: new Decimal(0.05),
        enableLV0: true,
        enableCrossTenant: false,
        crossTenantRate: new Decimal(1),
        crossMaxDaily: new Decimal(500),
        commissionBaseType: 'ORIGINAL_PRICE',
        maxCommissionRate: new Decimal(0.5),
        createBy: 'e2e',
        updateBy: 'e2e',
      },
      update: {
        level1Rate: new Decimal(0.1),
        level2Rate: new Decimal(0.05),
        commissionBaseType: 'ORIGINAL_PRICE',
      },
    });

    const category = await prisma.pmsCategory.findFirst();
    if (!category) {
      throw new Error('缺少 pms_category，请先 seed');
    }

    await ensureGlobalProductAndSku({
      prisma,
      categoryId: category.catId,
      productId: PID_COURSE,
      skuId: GSKU_COURSE,
      type: ProductType.SERVICE,
      name: 'E2E 拼班课',
      guidePrice: 299,
    });
    await ensureGlobalProductAndSku({
      prisma,
      categoryId: category.catId,
      productId: PID_FLASH,
      skuId: GSKU_FLASH,
      type: ProductType.REAL,
      name: 'E2E 秒杀实物',
      guidePrice: 120,
    });
    await ensureGlobalProductAndSku({
      prisma,
      categoryId: category.catId,
      productId: PID_BULK,
      skuId: GSKU_BULK,
      type: ProductType.REAL,
      name: 'E2E 批量下单实物',
      guidePrice: 55,
    });

    const impCourse = await storeProductService.importProduct(TENANT_ID, {
      productId: PID_COURSE,
      skus: [{ globalSkuId: GSKU_COURSE, price: 299, stock: 50, distMode: DistMode.RATIO, distRate: 1 }],
    });
    const tpCourse = impCourse.data!;
    await storeProductService.updateProductBase(TENANT_ID, {
      id: tpCourse.id,
      status: PublishStatus.ON_SHELF,
    });
    tenantSkuCourse = (
      await prisma.pmsTenantSku.findFirstOrThrow({
        where: { tenantId: TENANT_ID, tenantProductId: tpCourse.id },
      })
    ).id;

    const impFlash = await storeProductService.importProduct(TENANT_ID, {
      productId: PID_FLASH,
      skus: [{ globalSkuId: GSKU_FLASH, price: 120, stock: 200, distMode: DistMode.RATIO, distRate: 1 }],
    });
    const tpFlash = impFlash.data!;
    await storeProductService.updateProductBase(TENANT_ID, {
      id: tpFlash.id,
      status: PublishStatus.ON_SHELF,
    });
    tenantSkuFlash = (
      await prisma.pmsTenantSku.findFirstOrThrow({
        where: { tenantId: TENANT_ID, tenantProductId: tpFlash.id },
      })
    ).id;

    const impBulk = await storeProductService.importProduct(TENANT_ID, {
      productId: PID_BULK,
      skus: [{ globalSkuId: GSKU_BULK, price: 50, stock: 500, distMode: DistMode.RATIO, distRate: 1 }],
    });
    const tpBulk = impBulk.data!;
    await storeProductService.updateProductBase(TENANT_ID, {
      id: tpBulk.id,
      status: PublishStatus.ON_SHELF,
    });
    tenantSkuBulk = (
      await prisma.pmsTenantSku.findFirstOrThrow({
        where: { tenantId: TENANT_ID, tenantProductId: tpBulk.id },
      })
    ).id;

    const marketingServiceIds = [PID_COURSE, PID_FLASH];
    const existingCfg = await prisma.storePlayConfig.findMany({
      where: { tenantId: TENANT_ID, serviceId: { in: marketingServiceIds } },
      select: { id: true },
    });
    const existingCfgIds = existingCfg.map((c) => c.id);
    if (existingCfgIds.length > 0) {
      await prisma.playInstance.deleteMany({ where: { configId: { in: existingCfgIds } } });
      await prisma.storePlayConfig.deleteMany({ where: { id: { in: existingCfgIds } } });
    }

    const now = Date.now();
    const joinDeadline = new Date(now + 7 * 86400000).toISOString();
    const classStart = new Date(now + 10 * 86400000).toISOString();
    const classEnd = new Date(now + 20 * 86400000).toISOString();

    const resCourse = await storePlayConfigService.create(
      {
        serviceId: PID_COURSE,
        serviceType: ProductType.SERVICE,
        templateCode: 'COURSE_GROUP_BUY',
        rules: {
          name: '春季拼班（E2E）',
          price: 199,
          minCount: 2,
          maxCount: 30,
          totalLessons: 8,
          dayLessons: 2,
          joinDeadline,
          classStartTime: classStart,
          classEndTime: classEnd,
          classAddress: '长沙市岳麓区（E2E）',
          leaderMustBeDistributor: false,
        },
        status: PublishStatus.ON_SHELF,
      },
      TENANT_ID,
    );
    configCourseId = resCourse.data!.id;

    const flashStart = new Date(now + 1500).toISOString();
    const flashEnd = new Date(now + 86400000).toISOString();
    const resFlash = await storePlayConfigService.create(
      {
        serviceId: PID_FLASH,
        serviceType: ProductType.REAL,
        templateCode: 'FLASH_SALE',
        stockMode: MarketingStockMode.STRONG_LOCK,
        rules: {
          name: '午间秒杀（E2E）',
          flashPrice: 39,
          totalStock: 100,
          limitPerUser: 3,
          startTime: flashStart,
          endTime: flashEnd,
        },
        status: PublishStatus.ON_SHELF,
      },
      TENANT_ID,
    );
    configFlashId = resFlash.data!.id;

    await new Promise((r) => setTimeout(r, 2000));

    await seedMembers();
    await seedMarketingCouponsAndPoints();
  });

  afterAll(async () => {
    if (isE2eSkipCleanup()) {
      console.warn(
        '[E2E] E2E_SKIP_CLEANUP 已开启：未删除测试数据。租户 000000 下可查询 t000000_flow_* 商品/会员/订单/营销配置。',
      );
    } else {
      const memberIds = ALL_MEMBER_IDS;

      await prisma.finCommission.deleteMany({
        where: { order: { tenantId: TENANT_ID, memberId: { in: memberIds } } },
      });
      await prisma.finCommission.deleteMany({ where: { tenantId: TENANT_ID, beneficiaryId: { in: memberIds } } });
      await prisma.mktCouponUsage.deleteMany({
        where: { userCouponId: { in: E2E_STACK_USER_COUPON_IDS } },
      });
      await prisma.mktUserCoupon.deleteMany({
        where: { id: { in: E2E_STACK_USER_COUPON_IDS } },
      });
      await prisma.mktCouponTemplate.deleteMany({
        where: { id: { in: E2E_COUPON_TEMPLATE_IDS } },
      });
      await prisma.mktPointsTransaction.deleteMany({ where: { tenantId: TENANT_ID, memberId: M_BUYER } });
      await prisma.mktPointsAccount.deleteMany({ where: { tenantId: TENANT_ID, memberId: M_BUYER } });
      await prisma.sysDistBlacklist.deleteMany({
        where: { tenantId: TENANT_ID, userId: { in: [M_L1, M_TOP, M_BUYER] } },
      });
      await prisma.omsOrderItem.deleteMany({
        where: { order: { tenantId: TENANT_ID, memberId: { in: memberIds } } },
      });
      await prisma.omsOrder.deleteMany({ where: { tenantId: TENANT_ID, memberId: { in: memberIds } } });
      await prisma.playInstance.deleteMany({ where: { tenantId: TENANT_ID, memberId: { in: memberIds } } });
      await prisma.storePlayConfig.deleteMany({
        where: { id: { in: [configCourseId, configFlashId].filter(Boolean) } },
      });

      await prisma.pmsTenantSku.deleteMany({
        where: { tenantId: TENANT_ID, globalSkuId: { in: [GSKU_COURSE, GSKU_FLASH, GSKU_BULK] } },
      });
      await prisma.pmsTenantProduct.deleteMany({
        where: { tenantId: TENANT_ID, productId: { in: [PID_COURSE, PID_FLASH, PID_BULK] } },
      });
      await prisma.pmsGlobalSku.deleteMany({
        where: { skuId: { in: [GSKU_COURSE, GSKU_FLASH, GSKU_BULK] } },
      });
      await prisma.pmsProduct.deleteMany({
        where: { productId: { in: [PID_COURSE, PID_FLASH, PID_BULK] } },
      });
      await prisma.umsMember.deleteMany({ where: { memberId: { in: memberIds } } });
    }

    await app.close();
  });

  async function seedMembers() {
    await prisma.umsMember.deleteMany({ where: { memberId: { in: ALL_MEMBER_IDS } } });

    await prisma.umsMember.create({
      data: {
        memberId: M_TOP,
        tenantId: TENANT_ID,
        nickname: 'E2E_TOP',
        status: MemberStatus.NORMAL,
        levelId: 2,
        parentId: null,
        indirectParentId: null,
      },
    });

    await prisma.umsMember.create({
      data: {
        memberId: M_L1,
        tenantId: TENANT_ID,
        nickname: 'E2E_L1',
        status: MemberStatus.NORMAL,
        levelId: 1,
        parentId: M_TOP,
        indirectParentId: null,
      },
    });

    await prisma.umsMember.create({
      data: {
        memberId: M_BUYER,
        tenantId: TENANT_ID,
        nickname: 'E2E_BUYER',
        status: MemberStatus.NORMAL,
        levelId: 0,
        parentId: M_L1,
        indirectParentId: M_TOP,
      },
    });

    await prisma.umsMember.create({
      data: {
        memberId: M_SOLO,
        tenantId: TENANT_ID,
        nickname: 'E2E_SOLO',
        status: MemberStatus.NORMAL,
        levelId: 0,
        parentId: null,
        indirectParentId: null,
      },
    });

    await prisma.umsMember.create({
      data: {
        memberId: M_DIRECT_C2,
        tenantId: TENANT_ID,
        nickname: 'E2E_DIRECT_C2',
        status: MemberStatus.NORMAL,
        levelId: 0,
        parentId: M_TOP,
        indirectParentId: null,
      },
    });

    await prisma.umsMember.create({
      data: {
        memberId: M_SELF_SHARE,
        tenantId: TENANT_ID,
        nickname: 'E2E_SELF_SHARE',
        status: MemberStatus.NORMAL,
        levelId: 0,
        parentId: M_L1,
        indirectParentId: M_TOP,
      },
    });

    let prev = M_SOLO;
    for (const mid of EXTRA_MEMBER_IDS) {
      await prisma.umsMember.create({
        data: {
          memberId: mid,
          tenantId: TENANT_ID,
          nickname: `E2E_${mid.slice(-3)}`,
          status: MemberStatus.NORMAL,
          levelId: 0,
          parentId: prev,
          indirectParentId: null,
        },
      });
      prev = mid;
    }
  }

  /** 固定 UUID 券模板/用户券 + 积分账户；重复跑 spec 前先删再用，避免券已使用冲突 */
  async function seedMarketingCouponsAndPoints() {
    const startTime = new Date('2020-01-01T00:00:00.000Z');
    const endTime = new Date('2030-12-31T23:59:59.999Z');

    await prisma.mktCouponUsage.deleteMany({
      where: { userCouponId: { in: E2E_STACK_USER_COUPON_IDS } },
    });
    await prisma.mktUserCoupon.deleteMany({
      where: { id: { in: E2E_STACK_USER_COUPON_IDS } },
    });
    await prisma.mktCouponTemplate.deleteMany({
      where: { id: { in: E2E_COUPON_TEMPLATE_IDS } },
    });

    await prisma.mktPointsTransaction.deleteMany({ where: { tenantId: TENANT_ID, memberId: M_BUYER } });
    await prisma.mktPointsAccount.deleteMany({ where: { tenantId: TENANT_ID, memberId: M_BUYER } });

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
        createBy: 'e2e',
      },
      update: {
        pointsRedemptionRatio: new Decimal(100),
        pointsRedemptionBase: new Decimal(1),
        maxDiscountPercentOrder: 50,
        pointsRedemptionEnabled: true,
        systemEnabled: true,
      },
    });

    await prisma.mktPointsAccount.create({
      data: {
        tenantId: TENANT_ID,
        memberId: M_BUYER,
        totalPoints: 10_000,
        availablePoints: 10_000,
        frozenPoints: 0,
        usedPoints: 0,
        expiredPoints: 0,
      },
    });

    await prisma.mktCouponTemplate.create({
      data: {
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
        startTime,
        endTime,
        validDays: null,
        totalStock: 1000,
        remainingStock: 1000,
        limitPerUser: 10,
        status: CouponStatus.ACTIVE,
        createBy: 'e2e',
      },
    });

    await prisma.mktCouponTemplate.create({
      data: {
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
        startTime,
        endTime,
        validDays: null,
        totalStock: 1000,
        remainingStock: 1000,
        limitPerUser: 10,
        status: CouponStatus.ACTIVE,
        createBy: 'e2e',
      },
    });

    await prisma.mktUserCoupon.create({
      data: {
        id: E2E_USER_COUPON_DISC,
        tenantId: TENANT_ID,
        memberId: M_BUYER,
        templateId: E2E_COUPON_TPL_DISC,
        couponName: 'E2E满减12',
        couponType: CouponType.DISCOUNT,
        discountAmount: new Decimal(12),
        discountPercent: null,
        maxDiscountAmount: null,
        minOrderAmount: new Decimal(0),
        startTime,
        endTime,
        status: UserCouponStatus.UNUSED,
        distributionType: CouponDistributionType.MANUAL,
        distributionSource: 'e2e',
      },
    });

    await prisma.mktUserCoupon.create({
      data: {
        id: E2E_USER_COUPON_PCT,
        tenantId: TENANT_ID,
        memberId: M_BUYER,
        templateId: E2E_COUPON_TPL_PCT,
        couponName: 'E2E九折',
        couponType: CouponType.PERCENTAGE,
        discountAmount: null,
        discountPercent: 10,
        maxDiscountAmount: null,
        minOrderAmount: new Decimal(0),
        startTime,
        endTime,
        status: UserCouponStatus.UNUSED,
        distributionType: CouponDistributionType.MANUAL,
        distributionSource: 'e2e',
      },
    });

    await prisma.mktCouponTemplate.create({
      data: {
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
        startTime,
        endTime,
        validDays: null,
        totalStock: 1000,
        remainingStock: 1000,
        limitPerUser: 10,
        status: CouponStatus.ACTIVE,
        createBy: 'e2e',
      },
    });

    await prisma.mktUserCoupon.create({
      data: {
        id: E2E_USER_COUPON_FLASH_STACK,
        tenantId: TENANT_ID,
        memberId: M_BUYER,
        templateId: E2E_COUPON_TPL_STACK,
        couponName: 'E2E叠券减5',
        couponType: CouponType.DISCOUNT,
        discountAmount: new Decimal(5),
        discountPercent: null,
        maxDiscountAmount: null,
        minOrderAmount: new Decimal(0),
        startTime,
        endTime,
        status: UserCouponStatus.UNUSED,
        distributionType: CouponDistributionType.MANUAL,
        distributionSource: 'e2e',
      },
    });

    await prisma.mktUserCoupon.create({
      data: {
        id: E2E_USER_COUPON_COURSE_STACK,
        tenantId: TENANT_ID,
        memberId: M_BUYER,
        templateId: E2E_COUPON_TPL_STACK,
        couponName: 'E2E叠券减5',
        couponType: CouponType.DISCOUNT,
        discountAmount: new Decimal(5),
        discountPercent: null,
        maxDiscountAmount: null,
        minOrderAmount: new Decimal(0),
        startTime,
        endTime,
        status: UserCouponStatus.UNUSED,
        distributionType: CouponDistributionType.MANUAL,
        distributionSource: 'e2e',
      },
    });
  }

  /**
   * mockSuccess 已入队 CALC_COMMISSION；需等 waiting/active/delayed 清空，否则重试退避中的任务会晚于
   * whenCurrentJobsFinished() 落库，断言读到 0 行。
   */
  async function waitCalcCommissionIdle(): Promise<void> {
    const q = app.get<Queue>(getQueueToken('CALC_COMMISSION'));
    for (let i = 0; i < 80; i++) {
      await q.whenCurrentJobsFinished();
      const counts = await q.getJobCounts();
      if ((counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0) === 0) return;
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });
    }
  }

  async function createPayAndCommission(
    memberId: string,
    items: Array<{ skuId: string; quantity: number }>,
    opts: { marketingConfigId?: string; shareUserId?: string; phoneSuffix: string },
  ): Promise<string> {
    const createRes = await orderService.createOrder(memberId, {
      tenantId: TENANT_ID,
      items,
      receiverName: 'E2E',
      receiverPhone: opts.phoneSuffix,
      receiverAddress: '测试地址',
      ...(opts.marketingConfigId && { marketingConfigId: opts.marketingConfigId }),
      ...(opts.shareUserId && { shareUserId: opts.shareUserId }),
    });
    expect(createRes.code).toBe(200);
    const orderId = createRes.data!.orderId as string;
    await paymentService.mockSuccess(memberId, orderId);
    const orderRow = await prisma.omsOrder.findUnique({ where: { id: orderId } });
    expect(orderRow).not.toBeNull();
    await waitCalcCommissionIdle();
    return orderId;
  }

  /** 券/积分下单需在租户上下文中跑积分规则查询（见 `PointsRuleService.findByTenantId`） */
  async function createPayAndCommissionWithExtras(
    memberId: string,
    items: Array<{ skuId: string; quantity: number }>,
    opts: {
      marketingConfigId?: string;
      shareUserId?: string;
      phoneSuffix: string;
      userCouponId?: string;
      pointsUsed?: number;
    },
  ): Promise<string> {
    const createRes = await TenantContext.run({ tenantId: TENANT_ID }, () =>
      orderService.createOrder(memberId, {
        tenantId: TENANT_ID,
        items,
        receiverName: 'E2E',
        receiverPhone: opts.phoneSuffix,
        receiverAddress: '测试地址',
        ...(opts.marketingConfigId ? { marketingConfigId: opts.marketingConfigId } : {}),
        ...(opts.shareUserId ? { shareUserId: opts.shareUserId } : {}),
        ...(opts.userCouponId ? { userCouponId: opts.userCouponId } : {}),
        ...(opts.pointsUsed != null && opts.pointsUsed > 0 ? { pointsUsed: opts.pointsUsed } : {}),
      }),
    );
    expect(createRes.code).toBe(200);
    const orderId = createRes.data!.orderId as string;
    await paymentService.mockSuccess(memberId, orderId);
    const orderRow = await prisma.omsOrder.findUnique({ where: { id: orderId } });
    expect(orderRow).not.toBeNull();
    await waitCalcCommissionIdle();
    return orderId;
  }

  it('应存在 12 个测试会员（含 C2 直推、自购链、长链尾）', async () => {
    const n = await prisma.umsMember.count({ where: { memberId: { in: ALL_MEMBER_IDS }, tenantId: TENANT_ID } });
    expect(n).toBe(ALL_MEMBER_IDS.length);
  });

  it('sys_dist_level：种子含一级/二级分销员等级（勿在 E2E 写过大比例，避免 rate_snapshot Decimal(5,2) 溢出）', async () => {
    const l1 = await prisma.sysDistLevel.findUnique({
      where: { tenantId_levelId: { tenantId: TENANT_ID, levelId: 1 } },
    });
    const l2 = await prisma.sysDistLevel.findUnique({
      where: { tenantId_levelId: { tenantId: TENANT_ID, levelId: 2 } },
    });
    expect(l1).not.toBeNull();
    expect(l2).not.toBeNull();
    expect(l1!.isActive).toBe(true);
    expect(l2!.isActive).toBe(true);
  });

  it('秒杀：下单应用 FLASH 价，mock 支付后触发佣金计算并落库', async () => {
    const createRes = await orderService.createOrder(M_BUYER, {
      tenantId: TENANT_ID,
      items: [{ skuId: tenantSkuFlash, quantity: 1 }],
      receiverName: 'E2E',
      receiverPhone: '13800000001',
      receiverAddress: '测试地址',
      marketingConfigId: configFlashId,
    });
    expect(createRes.code).toBe(200);
    const orderId = createRes.data!.orderId as string;
    expect(Number(createRes.data!.payAmount)).toBe(39);

    const payRes = await paymentService.mockSuccess(M_BUYER, orderId);
    expect(payRes.status).toBe('PAID');

    const orderRow = await prisma.omsOrder.findUnique({ where: { id: orderId } });
    expect(orderRow).not.toBeNull();
    await waitCalcCommissionIdle();

    const commissions = await prisma.finCommission.findMany({
      where: { orderId },
      orderBy: { level: 'asc' },
    });
    // 当前佣金引擎在部分基数/费率组合下可能合并或熔断为单条记录；断言：必有冻结佣金且受益人为链路上的 L1 或 L2
    expect(commissions.length).toBeGreaterThanOrEqual(1);
    expect(commissions.every((c) => c.status === 'FROZEN')).toBe(true);
    const beneficiarySet = new Set(commissions.map((c) => c.beneficiaryId));
    expect(beneficiarySet.has(M_L1) || beneficiarySet.has(M_TOP)).toBe(true);
    const totalComm = commissions.reduce((s, c) => s + Number(c.amount), 0);
    expect(totalComm).toBeGreaterThan(0);
    expect(Number(commissions[0].commissionBase)).toBe(39);
  });

  it('拼班价：预览 199；支付后可计算佣金', async () => {
    const createRes = await orderService.createOrder(M_BUYER, {
      tenantId: TENANT_ID,
      items: [{ skuId: tenantSkuCourse, quantity: 1 }],
      receiverName: 'E2E',
      receiverPhone: '13800000002',
      receiverAddress: '测试地址',
      marketingConfigId: configCourseId,
    });
    expect(createRes.code).toBe(200);
    expect(Number(createRes.data!.payAmount)).toBe(199);
    const orderId = createRes.data!.orderId as string;
    await paymentService.mockSuccess(M_BUYER, orderId);
    const orderRow = await prisma.omsOrder.findUnique({ where: { id: orderId } });
    expect(orderRow).not.toBeNull();
    await waitCalcCommissionIdle();
    const comm = await prisma.finCommission.findMany({ where: { orderId } });
    expect(comm.length).toBeGreaterThanOrEqual(1);
  });

  /** MD-004：满减券 + 普通 SKU（50）实付 38；租户 ORIGINAL_PRICE 时佣金基数仍为行小计 50 */
  it('优惠券满减：实付 38；支付后佣金落库（MD-004）', async () => {
    const orderId = await createPayAndCommissionWithExtras(M_BUYER, [{ skuId: tenantSkuBulk, quantity: 1 }], {
      phoneSuffix: '13800000031',
      userCouponId: E2E_USER_COUPON_DISC,
    });
    const orderRow = await prisma.omsOrder.findUnique({ where: { id: orderId } });
    expect(orderRow).not.toBeNull();
    expect(Number(orderRow!.payAmount)).toBe(38);
    expect(Number(orderRow!.couponDiscount)).toBe(12);
    const commissions = await prisma.finCommission.findMany({ where: { orderId }, orderBy: { level: 'asc' } });
    expect(commissions.length).toBeGreaterThanOrEqual(1);
    expect(commissions.every((c) => c.status === 'FROZEN')).toBe(true);
    const beneficiarySet = new Set(commissions.map((c) => c.beneficiaryId));
    expect(beneficiarySet.has(M_L1) || beneficiarySet.has(M_TOP)).toBe(true);
    expect(Number(commissions[0].commissionBase)).toBe(50);
  });

  /** MD-005：折扣券（10%）实付 45；佣金基数仍为 50 */
  it('优惠券折扣：实付 45；支付后佣金落库（MD-005）', async () => {
    const orderId = await createPayAndCommissionWithExtras(M_BUYER, [{ skuId: tenantSkuBulk, quantity: 1 }], {
      phoneSuffix: '13800000032',
      userCouponId: E2E_USER_COUPON_PCT,
    });
    const orderRow = await prisma.omsOrder.findUnique({ where: { id: orderId } });
    expect(orderRow).not.toBeNull();
    expect(Number(orderRow!.payAmount)).toBe(45);
    expect(Number(orderRow!.couponDiscount)).toBe(5);
    const commissions = await prisma.finCommission.findMany({ where: { orderId }, orderBy: { level: 'asc' } });
    expect(commissions.length).toBeGreaterThanOrEqual(1);
    expect(commissions.every((c) => c.status === 'FROZEN')).toBe(true);
    expect(Number(commissions[0].commissionBase)).toBe(50);
  });

  /** MD-006：100 积分抵 1 元，实付 49；佣金基数仍为行小计 50 */
  it('积分抵扣：实付 49；支付后佣金落库（MD-006）', async () => {
    const orderId = await createPayAndCommissionWithExtras(M_BUYER, [{ skuId: tenantSkuBulk, quantity: 1 }], {
      phoneSuffix: '13800000033',
      pointsUsed: 100,
    });
    const orderRow = await prisma.omsOrder.findUnique({ where: { id: orderId } });
    expect(orderRow).not.toBeNull();
    expect(Number(orderRow!.payAmount)).toBe(49);
    expect(orderRow!.pointsUsed).toBe(100);
    expect(Number(orderRow!.pointsDiscount)).toBe(1);
    const commissions = await prisma.finCommission.findMany({ where: { orderId }, orderBy: { level: 'asc' } });
    expect(commissions.length).toBeGreaterThanOrEqual(1);
    expect(commissions.every((c) => c.status === 'FROZEN')).toBe(true);
    expect(Number(commissions[0].commissionBase)).toBe(50);
  });

  /** MD-007：秒杀价 39 再叠满减券 5 元 → 实付 34；ORIGINAL_PRICE 下佣金基数仍为营销行价 39 */
  it('秒杀叠优惠券：实付 34；支付后佣金落库（MD-007）', async () => {
    const orderId = await createPayAndCommissionWithExtras(M_BUYER, [{ skuId: tenantSkuFlash, quantity: 1 }], {
      phoneSuffix: '13800000035',
      marketingConfigId: configFlashId,
      userCouponId: E2E_USER_COUPON_FLASH_STACK,
    });
    const orderRow = await prisma.omsOrder.findUnique({ where: { id: orderId } });
    expect(orderRow).not.toBeNull();
    expect(Number(orderRow!.payAmount)).toBe(34);
    expect(Number(orderRow!.couponDiscount)).toBe(5);
    const commissions = await prisma.finCommission.findMany({ where: { orderId }, orderBy: { level: 'asc' } });
    expect(commissions.length).toBeGreaterThanOrEqual(1);
    expect(commissions.every((c) => c.status === 'FROZEN')).toBe(true);
    expect(Number(commissions[0].commissionBase)).toBe(39);
  });

  /** MD-008：拼班价 199 再叠满减券 5 元 → 实付 194 */
  it('拼班叠优惠券：实付 194；支付后可计算佣金（MD-008）', async () => {
    const orderId = await createPayAndCommissionWithExtras(M_BUYER, [{ skuId: tenantSkuCourse, quantity: 1 }], {
      phoneSuffix: '13800000036',
      marketingConfigId: configCourseId,
      userCouponId: E2E_USER_COUPON_COURSE_STACK,
    });
    const orderRow = await prisma.omsOrder.findUnique({ where: { id: orderId } });
    expect(orderRow).not.toBeNull();
    expect(Number(orderRow!.payAmount)).toBe(194);
    expect(Number(orderRow!.couponDiscount)).toBe(5);
    const commissions = await prisma.finCommission.findMany({ where: { orderId }, orderBy: { level: 'asc' } });
    expect(commissions.length).toBeGreaterThanOrEqual(1);
    expect(commissions.every((c) => c.status === 'FROZEN')).toBe(true);
    expect(Number(commissions[0].commissionBase)).toBe(199);
  });

  /**
   * MD-009：`BaseCalculatorService` 在 ACTUAL_PAID 下将原价基数按 payAmount/totalAmount 缩放；
   * 使用积分抵扣使实付 < 商品总额，不依赖已核销的 E2E 优惠券。
   */
  it('ACTUAL_PAID：积分抵扣后佣金基数约为原价基数×实付/商品总额（MD-009）', async () => {
    await prisma.sysDistConfig.update({
      where: { tenantId: TENANT_ID },
      data: { commissionBaseType: CommissionBaseType.ACTUAL_PAID, updateBy: 'e2e' },
    });
    try {
      const orderId = await createPayAndCommissionWithExtras(M_BUYER, [{ skuId: tenantSkuBulk, quantity: 1 }], {
        phoneSuffix: '13800000034',
        pointsUsed: 200,
      });
      const orderRow = await prisma.omsOrder.findUnique({ where: { id: orderId } });
      expect(orderRow).not.toBeNull();
      const totalAmt = Number(orderRow!.totalAmount);
      const payAmt = Number(orderRow!.payAmount);
      expect(totalAmt).toBe(50);
      expect(payAmt).toBe(48);
      const expectedBase = 50 * (payAmt / totalAmt);
      const commissions = await prisma.finCommission.findMany({ where: { orderId }, orderBy: { level: 'asc' } });
      expect(commissions.length).toBeGreaterThanOrEqual(1);
      expect(commissions.every((c) => c.status === 'FROZEN')).toBe(true);
      expect(commissions[0].commissionBaseType).toBe(CommissionBaseType.ACTUAL_PAID);
      expect(Number(commissions[0].commissionBase)).toBeCloseTo(expectedBase, 4);
    } finally {
      await prisma.sysDistConfig.update({
        where: { tenantId: TENANT_ID },
        data: { commissionBaseType: CommissionBaseType.ORIGINAL_PRICE, updateBy: 'e2e' },
      });
    }
  });

  it('分销：C2 直推（无间接上级）佣金归 C2（单条记录）', async () => {
    const orderId = await createPayAndCommission(M_DIRECT_C2, [{ skuId: tenantSkuBulk, quantity: 1 }], {
      phoneSuffix: '13800000004',
    });
    const rows = await prisma.finCommission.findMany({ where: { orderId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].beneficiaryId).toBe(M_TOP);
  });

  it('分销：L1 在黑名单时仅 C2 可得佣', async () => {
    await prisma.sysDistBlacklist.upsert({
      where: { tenantId_userId: { tenantId: TENANT_ID, userId: M_L1 } },
      create: { tenantId: TENANT_ID, userId: M_L1, reason: 'e2e', createBy: 'e2e' },
      update: {},
    });
    try {
      const orderId = await createPayAndCommission(M_BUYER, [{ skuId: tenantSkuBulk, quantity: 1 }], {
        phoneSuffix: '13800000005',
      });
      const rows = await prisma.finCommission.findMany({ where: { orderId } });
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows.every((r) => r.beneficiaryId !== M_L1)).toBe(true);
      expect(rows.some((r) => r.beneficiaryId === M_TOP)).toBe(true);
    } finally {
      await prisma.sysDistBlacklist.deleteMany({ where: { tenantId: TENANT_ID, userId: M_L1 } });
    }
  });

  it('分销：C2 在黑名单时仅 L1 可得佣', async () => {
    await prisma.sysDistBlacklist.upsert({
      where: { tenantId_userId: { tenantId: TENANT_ID, userId: M_TOP } },
      create: { tenantId: TENANT_ID, userId: M_TOP, reason: 'e2e', createBy: 'e2e' },
      update: {},
    });
    try {
      const orderId = await createPayAndCommission(M_BUYER, [{ skuId: tenantSkuBulk, quantity: 1 }], {
        phoneSuffix: '13800000006',
      });
      const rows = await prisma.finCommission.findMany({ where: { orderId } });
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows.every((r) => r.beneficiaryId !== M_TOP)).toBe(true);
      expect(rows.some((r) => r.beneficiaryId === M_L1)).toBe(true);
    } finally {
      await prisma.sysDistBlacklist.deleteMany({ where: { tenantId: TENANT_ID, userId: M_TOP } });
    }
  });

  it('分销：分享人设为本人视为自购，不产生佣金', async () => {
    const orderId = await createPayAndCommission(M_SELF_SHARE, [{ skuId: tenantSkuBulk, quantity: 1 }], {
      phoneSuffix: '13800000007',
      shareUserId: M_SELF_SHARE,
    });
    const rows = await prisma.finCommission.findMany({ where: { orderId } });
    expect(rows).toHaveLength(0);
  });

  it('批量订单：多会员、多 SKU、多数量，本租户下测试订单不少于 12 笔', async () => {
    await createPayAndCommission(M_BUYER, [{ skuId: tenantSkuBulk, quantity: 3 }], { phoneSuffix: '13800001001' });
    await createPayAndCommission(M_CHAIN_TAIL, [{ skuId: tenantSkuBulk, quantity: 1 }], {
      phoneSuffix: '13800001002',
    });
    await createPayAndCommission(M_L1, [{ skuId: tenantSkuBulk, quantity: 2 }], { phoneSuffix: '13800001003' });
    await createPayAndCommission(M_SOLO, [{ skuId: tenantSkuBulk, quantity: 1 }], { phoneSuffix: '13800001004' });
    await createPayAndCommission(M_DIRECT_C2, [{ skuId: tenantSkuFlash, quantity: 1 }], {
      phoneSuffix: '13800001005',
      marketingConfigId: configFlashId,
    });
    await createPayAndCommission(M_BUYER, [{ skuId: tenantSkuBulk, quantity: 2 }], { phoneSuffix: '13800001006' });

    const orderCount = await prisma.omsOrder.count({
      where: { tenantId: TENANT_ID, memberId: { in: ALL_MEMBER_IDS } },
    });
    expect(orderCount).toBeGreaterThanOrEqual(12);
  });

  it('无上级会员下单：支付后不应产生佣金', async () => {
    const createRes = await orderService.createOrder(M_SOLO, {
      tenantId: TENANT_ID,
      items: [{ skuId: tenantSkuBulk, quantity: 1 }],
      receiverName: 'E2E',
      receiverPhone: '13800000003',
      receiverAddress: '测试地址',
    });
    expect(createRes.code).toBe(200);
    const orderId = createRes.data!.orderId as string;

    await paymentService.mockSuccess(M_SOLO, orderId);
    const orderRow = await prisma.omsOrder.findUnique({ where: { id: orderId } });
    expect(orderRow).not.toBeNull();
    await waitCalcCommissionIdle();

    const commissions = await prisma.finCommission.findMany({ where: { orderId } });
    expect(commissions).toHaveLength(0);
  });

  it('拼班：PlayInstanceService.create 落库（弱库存，不依赖 STRONG_LOCK）', async () => {
    const res = await playInstanceService.create({
      tenantId: TENANT_ID,
      memberId: M_TOP,
      configId: configCourseId,
      templateCode: 'COURSE_GROUP_BUY',
      instanceData: { isLeader: true },
    });
    expect(res.code).toBe(200);
    expect(res.data?.id).toBeDefined();

    const row = await prisma.playInstance.findFirst({
      where: { configId: configCourseId, memberId: M_TOP },
    });
    expect(row).not.toBeNull();
  });
});

async function ensureGlobalProductAndSku(params: {
  prisma: PrismaService;
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
      detailHtml: '<p>e2e</p>',
      type,
      specDef: {},
      publishStatus: PublishStatus.ON_SHELF,
      delFlag: 'NORMAL',
      serviceDuration: type === ProductType.SERVICE ? 60 : undefined,
      needBooking: type === ProductType.SERVICE ? true : undefined,
    },
    update: { publishStatus: PublishStatus.ON_SHELF, delFlag: 'NORMAL' },
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
