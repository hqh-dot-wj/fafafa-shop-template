/**
 * 优惠券 / 大额熔断 / 兑换品 / 混合行 / 实付基数 — 与真实下单 + mock 支付 + 分佣计算对齐的 E2E。
 * 租户固定 000000；资源前缀 ccpt_*，避免与 order-full-chain 的 fchain_* 冲突。
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { WechatService } from '../src/module/client/common/service/wechat.service';
import { RiskService } from '../src/module/risk/risk.service';
import { CommissionService } from '../src/module/finance/commission/commission.service';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderStatus } from '@prisma/client';
import { createE2eApp } from './helpers/e2e-app';

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

const TENANT_ID = '000000';
const CCPT_PRODUCT_ID = 'ccpt_prod_001';
const CCPT_GLOBAL_MAIN = 'ccpt_global_main';
const CCPT_GLOBAL_EX = 'ccpt_global_ex';
const CCPT_TSKU_MAIN = 'ccpt_tsku_main';
const CCPT_TSKU_EX = 'ccpt_tsku_ex';
const CCPT_TPL_DISCOUNT = 'ccpt_tpl_discount_001';
const CCPT_TPL_BIG = 'ccpt_tpl_big_001';
const CCPT_TPL_EXCHANGE = 'ccpt_tpl_exchange_001';

describe('Commission with Coupon & Points (e2e)', () => {
  jest.setTimeout(40000);

  let app: INestApplication;
  let apiPath: (path: string) => string;
  let prisma: PrismaService;
  let commissionService: CommissionService;

  let loginSuffix: string;
  let l2Id: string;
  let l1Id: string;
  let buyerId: string;
  let buyerToken: string;

  beforeAll(async () => {
    loginSuffix = `${Date.now()}`;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WechatService)
      .useValue(mockWechatService)
      .overrideProvider(RiskService)
      .useValue(mockRiskService)
      .compile();

    const e2eApp = await createE2eApp(moduleFixture);
    app = e2eApp.app;
    apiPath = e2eApp.apiPath;
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    commissionService = moduleFixture.get<CommissionService>(CommissionService);

    await setupCatalogAndDist();
    await registerChain();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  function tenantHeader() {
    return { 'tenant-id': TENANT_ID };
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function setupCatalogAndDist() {
    await prisma.sysTenant.upsert({
      where: { tenantId: TENANT_ID },
      create: {
        tenantId: TENANT_ID,
        companyName: 'CCPT E2E Tenant',
        status: 'NORMAL',
        delFlag: 'NORMAL',
      },
      update: {},
    });

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
        createBy: 'ccpt-e2e',
        updateBy: 'ccpt-e2e',
      },
      update: {
        level1Rate: new Decimal(0.1),
        level2Rate: new Decimal(0.05),
        maxCommissionRate: new Decimal(0.5),
        commissionBaseType: 'ORIGINAL_PRICE',
        updateBy: 'ccpt-e2e',
      },
    });

    const distLevels: Array<{
      levelId: number;
      levelName: string;
      level1Rate: Decimal;
      level2Rate: Decimal;
    }> = [
      { levelId: 0, levelName: '普通用户', level1Rate: new Decimal(0), level2Rate: new Decimal(0) },
      { levelId: 1, levelName: '初级分销员', level1Rate: new Decimal(0.1), level2Rate: new Decimal(0.06) },
      { levelId: 2, levelName: '中级分销员', level1Rate: new Decimal(0.1), level2Rate: new Decimal(0.05) },
    ];
    for (const row of distLevels) {
      await prisma.sysDistLevel.upsert({
        where: { tenantId_levelId: { tenantId: TENANT_ID, levelId: row.levelId } },
        create: {
          tenantId: TENANT_ID,
          levelId: row.levelId,
          levelName: row.levelName,
          level1Rate: row.level1Rate,
          level2Rate: row.level2Rate,
          sort: row.levelId,
          isActive: true,
          createBy: 'ccpt-e2e',
          updateBy: 'ccpt-e2e',
        },
        update: {
          level1Rate: row.level1Rate,
          level2Rate: row.level2Rate,
          levelName: row.levelName,
          updateBy: 'ccpt-e2e',
        },
      });
    }

    const category = await prisma.pmsCategory.findFirst();
    if (!category) throw new Error('需要至少一条 pms_category（请先 seed）');

    await prisma.pmsProduct.upsert({
      where: { productId: CCPT_PRODUCT_ID },
      create: {
        productId: CCPT_PRODUCT_ID,
        categoryId: category.catId,
        name: 'CCPT 测试商品',
        mainImages: [],
        detailHtml: '<p>ccpt</p>',
        type: 'REAL',
        specDef: {},
        publishStatus: 'ON_SHELF',
        delFlag: 'NORMAL',
      },
      update: { publishStatus: 'ON_SHELF', delFlag: 'NORMAL' },
    });

    await prisma.pmsGlobalSku.upsert({
      where: { skuId: CCPT_GLOBAL_MAIN },
      create: {
        skuId: CCPT_GLOBAL_MAIN,
        productId: CCPT_PRODUCT_ID,
        specValues: {},
        guidePrice: new Decimal(100),
        distMode: 'RATIO',
        guideRate: new Decimal(1),
      },
      update: {},
    });

    await prisma.pmsGlobalSku.upsert({
      where: { skuId: CCPT_GLOBAL_EX },
      create: {
        skuId: CCPT_GLOBAL_EX,
        productId: CCPT_PRODUCT_ID,
        specValues: {},
        guidePrice: new Decimal(50),
        distMode: 'RATIO',
        guideRate: new Decimal(1),
      },
      update: {},
    });

    const tenantProduct = await prisma.pmsTenantProduct.upsert({
      where: { tenantId_productId: { tenantId: TENANT_ID, productId: CCPT_PRODUCT_ID } },
      create: { tenantId: TENANT_ID, productId: CCPT_PRODUCT_ID, status: 'ON_SHELF' },
      update: { status: 'ON_SHELF' },
    });

    await prisma.pmsTenantSku.upsert({
      where: { id: CCPT_TSKU_MAIN },
      create: {
        id: CCPT_TSKU_MAIN,
        tenantId: TENANT_ID,
        tenantProductId: tenantProduct.id,
        globalSkuId: CCPT_GLOBAL_MAIN,
        price: new Decimal(100),
        stock: 999,
        isActive: true,
        distMode: 'RATIO',
        distRate: new Decimal(1),
        isExchangeProduct: false,
        pointsRatio: 100,
      },
      update: { stock: 999, isActive: true, distMode: 'RATIO', distRate: new Decimal(1), isExchangeProduct: false },
    });

    await prisma.pmsTenantSku.upsert({
      where: { id: CCPT_TSKU_EX },
      create: {
        id: CCPT_TSKU_EX,
        tenantId: TENANT_ID,
        tenantProductId: tenantProduct.id,
        globalSkuId: CCPT_GLOBAL_EX,
        price: new Decimal(50),
        stock: 999,
        isActive: true,
        distMode: 'RATIO',
        distRate: new Decimal(1),
        isExchangeProduct: true,
        pointsRatio: 100,
      },
      update: { stock: 999, isActive: true, isExchangeProduct: true, distMode: 'RATIO', distRate: new Decimal(1) },
    });

    await prisma.mktPointsRule.upsert({
      where: { tenantId: TENANT_ID },
      create: {
        tenantId: TENANT_ID,
        orderPointsEnabled: true,
        orderPointsRatio: new Decimal(1),
        orderPointsBase: new Decimal(1),
        pointsRedemptionEnabled: true,
        pointsRedemptionRatio: new Decimal(10),
        pointsRedemptionBase: new Decimal(1),
        systemEnabled: true,
        createBy: 'ccpt-e2e',
      },
      update: { pointsRedemptionRatio: new Decimal(10) },
    });

    await prisma.mktCouponTemplate.upsert({
      where: { id: CCPT_TPL_DISCOUNT },
      create: {
        id: CCPT_TPL_DISCOUNT,
        tenantId: TENANT_ID,
        name: 'CCPT 满减20',
        type: 'DISCOUNT',
        discountAmount: new Decimal(20),
        minOrderAmount: new Decimal(50),
        minActualPayAmount: new Decimal(10),
        applicableProducts: [],
        applicableCategories: [],
        memberLevels: [],
        validityType: 'RELATIVE',
        validDays: 30,
        totalStock: 1000,
        remainingStock: 1000,
        limitPerUser: 20,
        status: 'ACTIVE',
        createBy: 'ccpt-e2e',
      },
      update: { remainingStock: 1000, status: 'ACTIVE' },
    });
  }

  async function registerChain() {
    const resL2 = await request(app.getHttpServer())
      .post(apiPath('/client/auth/register'))
      .send({
        loginCode: `ccpt-l2-${loginSuffix}`,
        tenantId: TENANT_ID,
        userInfo: { nickName: 'CCPT L2', avatarUrl: 'http://a.com/l2' },
      });
    expect(resL2.status).toBe(201);
    expect(resL2.body.code).toBe(200);
    l2Id = resL2.body.data.userInfo.memberId;
    await prisma.umsMember.update({ where: { memberId: l2Id }, data: { levelId: 2 } });

    const resL1 = await request(app.getHttpServer())
      .post(apiPath('/client/auth/register'))
      .send({
        loginCode: `ccpt-l1-${loginSuffix}`,
        tenantId: TENANT_ID,
        referrerId: l2Id,
        userInfo: { nickName: 'CCPT L1', avatarUrl: 'http://a.com/l1' },
      });
    expect(resL1.status).toBe(201);
    expect(resL1.body.code).toBe(200);
    l1Id = resL1.body.data.userInfo.memberId;
    await prisma.umsMember.update({ where: { memberId: l1Id }, data: { levelId: 1 } });

    const resBuyer = await request(app.getHttpServer())
      .post(apiPath('/client/auth/register'))
      .send({
        loginCode: `ccpt-buyer-${loginSuffix}`,
        tenantId: TENANT_ID,
        referrerId: l1Id,
        userInfo: { nickName: 'CCPT Buyer', avatarUrl: 'http://a.com/b' },
      });
    expect(resBuyer.status).toBe(201);
    expect(resBuyer.body.code).toBe(200);
    buyerId = resBuyer.body.data.userInfo.memberId;
    buyerToken = resBuyer.body.data.token;
  }

  async function restoreTenantSeedMarketingAndDist(): Promise<void> {
    await prisma.sysDistConfig.update({
      where: { tenantId: TENANT_ID },
      data: {
        level1Rate: new Decimal(0.04),
        level2Rate: new Decimal(0.06),
        commissionBaseType: 'ORIGINAL_PRICE',
        maxCommissionRate: new Decimal(0.5),
        updateBy: 'ccpt-e2e-cleanup',
      },
    });
    const seedLevels: Array<{
      levelId: number;
      levelName: string;
      level1Rate: Decimal;
      level2Rate: Decimal;
    }> = [
      { levelId: 0, levelName: '普通用户', level1Rate: new Decimal(0), level2Rate: new Decimal(0) },
      { levelId: 1, levelName: '初级分销员', level1Rate: new Decimal(0.04), level2Rate: new Decimal(0.06) },
      { levelId: 2, levelName: '中级分销员', level1Rate: new Decimal(0.05), level2Rate: new Decimal(0.07) },
    ];
    for (const row of seedLevels) {
      await prisma.sysDistLevel.updateMany({
        where: { tenantId: TENANT_ID, levelId: row.levelId },
        data: {
          level1Rate: row.level1Rate,
          level2Rate: row.level2Rate,
          levelName: row.levelName,
          updateBy: 'ccpt-e2e-cleanup',
        },
      });
    }
    await prisma.mktPointsRule.updateMany({
      where: { tenantId: TENANT_ID },
      data: {
        pointsRedemptionRatio: new Decimal(100),
        updateBy: 'ccpt-e2e-cleanup',
      },
    });
  }

  async function cleanup() {
    const memberIds = [l2Id, l1Id, buyerId].filter(Boolean);
    if (memberIds.length === 0) {
      await restoreTenantSeedMarketingAndDist();
      return;
    }

    await prisma.finCommission.deleteMany({
      where: { order: { memberId: { in: memberIds } } },
    });
    await prisma.omsOrderItem.deleteMany({
      where: { order: { memberId: { in: memberIds } } },
    });
    await prisma.omsOrder.deleteMany({ where: { memberId: { in: memberIds } } });
    await prisma.mktCouponUsage.deleteMany({
      where: { tenantId: TENANT_ID, memberId: { in: memberIds } },
    });
    await prisma.mktUserCoupon.deleteMany({
      where: { tenantId: TENANT_ID, memberId: { in: memberIds } },
    });

    await prisma.mktCouponTemplate.deleteMany({
      where: { id: { in: [CCPT_TPL_DISCOUNT, CCPT_TPL_BIG, CCPT_TPL_EXCHANGE] } },
    });

    await prisma.pmsTenantSku.deleteMany({
      where: { id: { in: [CCPT_TSKU_MAIN, CCPT_TSKU_EX] } },
    });
    await prisma.pmsTenantProduct.deleteMany({
      where: { tenantId: TENANT_ID, productId: CCPT_PRODUCT_ID },
    });
    await prisma.pmsGlobalSku.deleteMany({
      where: { skuId: { in: [CCPT_GLOBAL_MAIN, CCPT_GLOBAL_EX] } },
    });
    await prisma.pmsProduct.deleteMany({ where: { productId: CCPT_PRODUCT_ID } });

    await restoreTenantSeedMarketingAndDist();
    await prisma.sysSocialUser.deleteMany({ where: { memberId: { in: memberIds } } });
    await prisma.umsMember.deleteMany({ where: { memberId: { in: memberIds } } });
  }

  async function createUserCoupon(templateId: string) {
    const template = await prisma.mktCouponTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new Error(`missing template ${templateId}`);
    const start = new Date();
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const row = await prisma.mktUserCoupon.create({
      data: {
        tenantId: TENANT_ID,
        memberId: buyerId,
        templateId: template.id,
        couponName: template.name,
        couponType: template.type,
        discountAmount: template.discountAmount,
        minOrderAmount: template.minOrderAmount,
        startTime: start,
        endTime: end,
        status: 'UNUSED',
        distributionType: 'MANUAL',
      },
    });
    return row.id;
  }

  async function createOrderAndPay(opts: { items: Array<{ skuId: string; quantity: number }>; userCouponId?: string }) {
    const body: Record<string, unknown> = {
      tenantId: TENANT_ID,
      items: opts.items,
      receiverName: 'CCPT',
      receiverPhone: '13800000000',
      receiverAddress: 'CCPT Addr',
    };
    if (opts.userCouponId) body.userCouponId = opts.userCouponId;

    const res = await request(app.getHttpServer())
      .post(apiPath('/client/order/create'))
      .set(auth(buyerToken))
      .set(tenantHeader())
      .set('x-client-info', JSON.stringify({ ipaddr: '127.0.0.1' }))
      .send(body);
    expect([200, 201]).toContain(res.status);
    expect(res.body.code).toBe(200);
    const orderId = res.body.data.orderId as string;

    const payRes = await request(app.getHttpServer())
      .post(apiPath('/client/payment/mock-success'))
      .set(auth(buyerToken))
      .set(tenantHeader())
      .send({ orderId });
    expect([200, 201]).toContain(payRes.status);
    expect(payRes.body.code).toBe(200);

    const order = await prisma.omsOrder.findUnique({ where: { id: orderId } });
    if (order) {
      await commissionService.calculateCommission(orderId, order.tenantId);
    }
    await new Promise((r) => setTimeout(r, 400));
    return orderId;
  }

  describe('场景1: 券后实付 + 原价基数', () => {
    it('佣金按引擎分摊：基数100、实付80，L1/L2 为 12.5 / 6.25', async () => {
      const userCouponId = await createUserCoupon(CCPT_TPL_DISCOUNT);
      const orderId = await createOrderAndPay({
        items: [{ skuId: CCPT_TSKU_MAIN, quantity: 1 }],
        userCouponId,
      });

      const order = await prisma.omsOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe(OrderStatus.PAID);
      expect(Number(order?.payAmount)).toBe(80);
      expect(Number(order?.couponDiscount)).toBe(20);

      const commissions = await prisma.finCommission.findMany({
        where: { orderId },
        orderBy: { level: 'asc' },
      });
      expect(commissions).toHaveLength(2);
      expect(commissions[0].beneficiaryId).toBe(l1Id);
      expect(commissions[1].beneficiaryId).toBe(l2Id);
      expect(Number(commissions[0].commissionBase)).toBe(100);
      expect(Number(commissions[0].amount)).toBeCloseTo(12.5, 2);
      expect(Number(commissions[1].amount)).toBeCloseTo(6.25, 2);
      expect(commissions[0].commissionBaseType).toBe('ORIGINAL_PRICE');
      expect(Number(commissions[0].orderActualPaid)).toBe(80);
    });
  });

  describe('场景2: 大额券触发熔断', () => {
    it('总佣金不超过实付×maxCommissionRate，并标记 isCapped', async () => {
      await prisma.mktCouponTemplate.create({
        data: {
          id: CCPT_TPL_BIG,
          tenantId: TENANT_ID,
          name: 'CCPT 大额券',
          type: 'DISCOUNT',
          discountAmount: new Decimal(90),
          minOrderAmount: new Decimal(100),
          minActualPayAmount: new Decimal(1),
          applicableProducts: [],
          applicableCategories: [],
          memberLevels: [],
          validityType: 'RELATIVE',
          validDays: 30,
          totalStock: 100,
          remainingStock: 100,
          limitPerUser: 5,
          status: 'ACTIVE',
          createBy: 'ccpt-e2e',
        },
      });

      const userCouponId = await createUserCoupon(CCPT_TPL_BIG);
      const orderId = await createOrderAndPay({
        items: [{ skuId: CCPT_TSKU_MAIN, quantity: 1 }],
        userCouponId,
      });

      const order = await prisma.omsOrder.findUnique({ where: { id: orderId } });
      expect(Number(order?.payAmount)).toBe(10);

      const commissions = await prisma.finCommission.findMany({
        where: { orderId },
        orderBy: { level: 'asc' },
      });
      expect(commissions).toHaveLength(2);
      const total = commissions.reduce((s, c) => s + Number(c.amount), 0);
      expect(total).toBeCloseTo(5, 2);
      expect(commissions.every((c) => c.isCapped)).toBe(true);
    });
  });

  describe('场景3: 仅兑换品行', () => {
    it('分佣基数为零，不产生佣金', async () => {
      await prisma.mktCouponTemplate.create({
        data: {
          id: CCPT_TPL_EXCHANGE,
          tenantId: TENANT_ID,
          name: 'CCPT 兑换券',
          type: 'EXCHANGE',
          minOrderAmount: new Decimal(0),
          applicableProducts: [],
          applicableCategories: [],
          memberLevels: [],
          exchangeProductId: CCPT_PRODUCT_ID,
          exchangeSkuId: CCPT_GLOBAL_EX,
          validityType: 'RELATIVE',
          validDays: 30,
          totalStock: 100,
          remainingStock: 100,
          limitPerUser: 5,
          status: 'ACTIVE',
          createBy: 'ccpt-e2e',
        },
      });

      const userCouponId = await createUserCoupon(CCPT_TPL_EXCHANGE);
      const orderId = await createOrderAndPay({
        items: [{ skuId: CCPT_TSKU_EX, quantity: 1 }],
        userCouponId,
      });

      const commissions = await prisma.finCommission.findMany({ where: { orderId } });
      expect(commissions).toHaveLength(0);
    });
  });

  describe('场景4: 混合行（普通 + 兑换）', () => {
    it('仅普通行计入基数，金额同单行 100 场景', async () => {
      const orderId = await createOrderAndPay({
        items: [
          { skuId: CCPT_TSKU_MAIN, quantity: 1 },
          { skuId: CCPT_TSKU_EX, quantity: 1 },
        ],
      });

      const commissions = await prisma.finCommission.findMany({
        where: { orderId },
        orderBy: { level: 'asc' },
      });
      expect(commissions).toHaveLength(2);
      expect(Number(commissions[0].commissionBase)).toBe(100);
      expect(Number(commissions[0].amount)).toBe(10);
      expect(Number(commissions[1].amount)).toBe(5);
    });
  });

  describe('场景5: ACTUAL_PAID', () => {
    it('记录基数约 80；分摊后 L1=10 L2=5', async () => {
      await prisma.sysDistConfig.update({
        where: { tenantId: TENANT_ID },
        data: { commissionBaseType: 'ACTUAL_PAID' },
      });

      const userCouponId = await createUserCoupon(CCPT_TPL_DISCOUNT);
      const orderId = await createOrderAndPay({
        items: [{ skuId: CCPT_TSKU_MAIN, quantity: 1 }],
        userCouponId,
      });

      const commissions = await prisma.finCommission.findMany({
        where: { orderId },
        orderBy: { level: 'asc' },
      });
      expect(commissions).toHaveLength(2);
      expect(commissions[0].commissionBaseType).toBe('ACTUAL_PAID');
      expect(Number(commissions[0].commissionBase)).toBeCloseTo(80, 1);
      expect(Number(commissions[0].amount)).toBeCloseTo(10, 1);
      expect(Number(commissions[1].amount)).toBeCloseTo(5, 1);

      await prisma.sysDistConfig.update({
        where: { tenantId: TENANT_ID },
        data: { commissionBaseType: 'ORIGINAL_PRICE' },
      });
    });
  });
});
