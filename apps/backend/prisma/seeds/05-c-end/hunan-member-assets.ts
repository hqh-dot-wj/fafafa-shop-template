import {
  CouponDistributionType,
  PointsTransactionStatus,
  PointsTransactionType,
  PrismaClient,
  UserCouponStatus,
  WalletStatus,
} from '@prisma/client';

import { Decimal } from '@prisma/client/runtime/library';

import { HUNAN_FULL_MARKETING_BLUEPRINT } from '../hunan-full/catalog-marketing';
import { HUNAN_FULL_MEMBERS } from '../hunan-full/catalog-members';
import { assertHunanFullSeedScope, hunanFullAt, HUNAN_FULL_TENANT_ID } from '../hunan-full/shared';

interface HunanFullCouponAssignment {
  memberId: string;
  code: string;
  distributionType: 'AUTO' | 'ACTIVITY' | 'MANUAL';
  receiveOffsetDays: number;
  status?: UserCouponStatus;
}

interface HunanPointsTransactionSeed {
  type: PointsTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  relatedId: string;
  relatedType: string;
  expireTime: Date | null;
  remark: string;
  createTime: Date;
}

const HUNAN_FULL_COUPON_ASSIGNMENTS: HunanFullCouponAssignment[] = [
  { memberId: 'hf-member-regular-02', code: 'HF-CPN-FLASH-10', distributionType: 'AUTO', receiveOffsetDays: -3 },
  { memberId: 'hf-member-regular-04', code: 'HF-CPN-NEW-20', distributionType: 'ACTIVITY', receiveOffsetDays: -8 },
  {
    memberId: 'hf-member-regular-06',
    code: 'HF-CPN-EXCHANGE-OAT',
    distributionType: 'ACTIVITY',
    receiveOffsetDays: -6,
  },
  { memberId: 'hf-member-regular-07', code: 'HF-CPN-COURSE-120', distributionType: 'MANUAL', receiveOffsetDays: -10 },
  { memberId: 'hf-member-regular-08', code: 'HF-CPN-TEAM-30', distributionType: 'ACTIVITY', receiveOffsetDays: -2 },
  { memberId: 'hf-member-regular-10', code: 'HF-CPN-ALL-90', distributionType: 'MANUAL', receiveOffsetDays: -12 },
  { memberId: 'hf-member-regular-13', code: 'HF-CPN-FLASH-10', distributionType: 'MANUAL', receiveOffsetDays: -4 },
  { memberId: 'hf-member-regular-15', code: 'HF-CPN-NEW-40', distributionType: 'MANUAL', receiveOffsetDays: -1 },
  { memberId: 'hf-member-regular-16', code: 'HF-CPN-SERVICE-EXPR', distributionType: 'MANUAL', receiveOffsetDays: -5 },
  { memberId: 'hf-member-l1-03', code: 'HF-CPN-MEMBER-95', distributionType: 'MANUAL', receiveOffsetDays: -9 },
  {
    memberId: 'hf-rejected-02',
    code: 'HF-CPN-EXCHANGE-GRANOLA',
    distributionType: 'MANUAL',
    receiveOffsetDays: -45,
    status: UserCouponStatus.EXPIRED,
  },
  {
    memberId: 'hf-black-01',
    code: 'HF-CPN-MEMBER-95',
    distributionType: 'MANUAL',
    receiveOffsetDays: -20,
    status: UserCouponStatus.CANCELLED,
  },
];

function buildAddress(memberId: string, index: number) {
  return {
    id: `hf-addr-${memberId}`,
    memberId,
    name: `湖南演示用户${String(index + 1).padStart(2, '0')}`,
    phone: `139000${String(1000 + index).padStart(4, '0')}`,
    province: '湖南省',
    city: '长沙市',
    district: ['岳麓区', '开福区', '雨花区', '天心区'][index % 4],
    detail: `${['麓谷', '五一广场', '梅溪湖', '洋湖'][index % 4]}演示社区${index + 1}栋${(index % 8) + 1}单元`,
    latitude: 28.18 + index * 0.002,
    longitude: 112.93 + index * 0.002,
    isDefault: true,
    tag: ['家', '公司', '学校'][index % 3],
  };
}

function buildPointsState(member: (typeof HUNAN_FULL_MEMBERS)[number]) {
  const frozenPoints = member.walletStatus === 'FROZEN' ? 30 : 0;
  const usedPoints = member.levelId === 2 ? 260 : member.levelId === 1 ? 140 : 40;
  const expiredPoints = member.status === 'DISABLED' ? 20 : member.tags.includes('blacklist') ? 10 : 0;
  const totalPoints = member.pointsAvailable + frozenPoints + usedPoints + expiredPoints;

  return {
    totalPoints,
    availablePoints: member.pointsAvailable,
    frozenPoints,
    usedPoints,
    expiredPoints,
  };
}

function mapWalletStatus(status: (typeof HUNAN_FULL_MEMBERS)[number]['walletStatus']): WalletStatus {
  if (status === 'FROZEN') {
    return WalletStatus.FROZEN;
  }
  if (status === 'DISABLED') {
    return WalletStatus.DISABLED;
  }
  return WalletStatus.NORMAL;
}

function mapDistributionType(type: HunanFullCouponAssignment['distributionType']) {
  if (type === 'AUTO') {
    return CouponDistributionType.AUTO;
  }
  if (type === 'ACTIVITY') {
    return CouponDistributionType.ACTIVITY;
  }
  return CouponDistributionType.MANUAL;
}

export async function seedHunanMemberAssets(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanMemberAssets');
  console.log('[05-CEnd] 湖南完整演示会员资产...');

  const memberIds = HUNAN_FULL_MEMBERS.map((member) => member.memberId);

  await prisma.umsAddress.deleteMany({
    where: { memberId: { in: memberIds } },
  });
  await prisma.mktPointsTransaction.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      memberId: { in: memberIds },
      relatedId: { startsWith: 'HF-PTS::' },
    },
  });
  const existingUserCoupons = await prisma.mktUserCoupon.findMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      memberId: { in: memberIds },
      distributionSource: { startsWith: 'HF-SEED::' },
    },
    select: { id: true },
  });
  if (existingUserCoupons.length > 0) {
    await prisma.mktCouponUsage.deleteMany({
      where: {
        tenantId: HUNAN_FULL_TENANT_ID,
        userCouponId: { in: existingUserCoupons.map((coupon) => coupon.id) },
      },
    });
  }
  await prisma.mktUserCoupon.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      memberId: { in: memberIds },
      distributionSource: { startsWith: 'HF-SEED::' },
    },
  });

  for (const [index, member] of HUNAN_FULL_MEMBERS.entries()) {
    const pointsState = buildPointsState(member);

    await prisma.umsMember.update({
      where: { memberId: member.memberId },
      data: {
        balance: new Decimal(member.walletBalance),
        frozenBalance: new Decimal(member.walletFrozen),
        points: member.pointsAvailable,
      },
    });

    await prisma.umsAddress.create({
      data: buildAddress(member.memberId, index),
    });

    await prisma.finWallet.upsert({
      where: { memberId: member.memberId },
      update: {
        tenantId: HUNAN_FULL_TENANT_ID,
        balance: new Decimal(member.walletBalance),
        frozen: new Decimal(member.walletFrozen),
        totalIncome: new Decimal(member.walletIncome),
        pendingRecovery: new Decimal(0),
        status: mapWalletStatus(member.walletStatus),
        frozenReason: member.walletStatus === 'FROZEN' ? '风控冻结演示样本' : null,
        frozenAt: member.walletStatus === 'FROZEN' ? hunanFullAt(-5) : null,
        frozenBy: member.walletStatus === 'FROZEN' ? 'hf_finance_ops' : null,
        payPassword: null,
        version: 0,
      },
      create: {
        tenantId: HUNAN_FULL_TENANT_ID,
        memberId: member.memberId,
        balance: new Decimal(member.walletBalance),
        frozen: new Decimal(member.walletFrozen),
        totalIncome: new Decimal(member.walletIncome),
        pendingRecovery: new Decimal(0),
        status: mapWalletStatus(member.walletStatus),
        frozenReason: member.walletStatus === 'FROZEN' ? '风控冻结演示样本' : null,
        frozenAt: member.walletStatus === 'FROZEN' ? hunanFullAt(-5) : null,
        frozenBy: member.walletStatus === 'FROZEN' ? 'hf_finance_ops' : null,
        payPassword: null,
        version: 0,
      },
    });

    const account = await prisma.mktPointsAccount.upsert({
      where: {
        tenantId_memberId: {
          tenantId: HUNAN_FULL_TENANT_ID,
          memberId: member.memberId,
        },
      },
      update: {
        totalPoints: pointsState.totalPoints,
        availablePoints: pointsState.availablePoints,
        frozenPoints: pointsState.frozenPoints,
        usedPoints: pointsState.usedPoints,
        expiredPoints: pointsState.expiredPoints,
        version: 0,
      },
      create: {
        tenantId: HUNAN_FULL_TENANT_ID,
        memberId: member.memberId,
        totalPoints: pointsState.totalPoints,
        availablePoints: pointsState.availablePoints,
        frozenPoints: pointsState.frozenPoints,
        usedPoints: pointsState.usedPoints,
        expiredPoints: pointsState.expiredPoints,
        version: 0,
      },
    });

    let balance = pointsState.totalPoints;
    const transactions: HunanPointsTransactionSeed[] = [
      {
        type: PointsTransactionType.EARN_ADMIN,
        amount: pointsState.totalPoints,
        balanceBefore: 0,
        balanceAfter: pointsState.totalPoints,
        relatedId: `HF-PTS::${member.memberId}::EARN`,
        relatedType: 'SEED_BASELINE',
        expireTime: null,
        remark: '演示基础积分资产',
        createTime: hunanFullAt(-30 + (index % 10)),
      },
    ];

    if (pointsState.usedPoints > 0) {
      transactions.push({
        type: PointsTransactionType.USE_ORDER,
        amount: -pointsState.usedPoints,
        balanceBefore: balance,
        balanceAfter: balance - pointsState.usedPoints,
        relatedId: `HF-PTS::${member.memberId}::USE`,
        relatedType: 'ORDER_SAMPLE',
        expireTime: null,
        remark: '演示订单抵扣积分',
        createTime: hunanFullAt(-12 + (index % 6)),
      });
      balance -= pointsState.usedPoints;
    }

    if (pointsState.frozenPoints > 0) {
      transactions.push({
        type: PointsTransactionType.FREEZE,
        amount: -pointsState.frozenPoints,
        balanceBefore: balance,
        balanceAfter: balance - pointsState.frozenPoints,
        relatedId: `HF-PTS::${member.memberId}::FREEZE`,
        relatedType: 'AUDIT_SAMPLE',
        expireTime: null,
        remark: '演示冻结积分',
        createTime: hunanFullAt(-6 + (index % 4)),
      });
      balance -= pointsState.frozenPoints;
    }

    if (pointsState.expiredPoints > 0) {
      transactions.push({
        type: PointsTransactionType.EXPIRE,
        amount: -pointsState.expiredPoints,
        balanceBefore: balance,
        balanceAfter: balance - pointsState.expiredPoints,
        relatedId: `HF-PTS::${member.memberId}::EXPIRE`,
        relatedType: 'EXPIRE_SAMPLE',
        expireTime: hunanFullAt(-1),
        remark: '演示过期积分',
        createTime: hunanFullAt(-1),
      });
    }

    await prisma.mktPointsTransaction.createMany({
      data: transactions.map((transaction) => ({
        tenantId: HUNAN_FULL_TENANT_ID,
        accountId: account.id,
        memberId: member.memberId,
        type: transaction.type,
        amount: transaction.amount,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        relatedId: transaction.relatedId,
        relatedType: transaction.relatedType,
        expireTime: transaction.expireTime,
        status: PointsTransactionStatus.COMPLETED,
        remark: transaction.remark,
        createTime: transaction.createTime,
      })),
    });
  }

  const couponBlueprintByCode = new Map(
    HUNAN_FULL_MARKETING_BLUEPRINT.couponTemplates.map((template) => [template.code, template]),
  );
  const couponNames = [
    ...new Set(HUNAN_FULL_COUPON_ASSIGNMENTS.map((assignment) => couponBlueprintByCode.get(assignment.code)?.name)),
  ].filter((value): value is string => Boolean(value));
  const couponTemplates = await prisma.mktCouponTemplate.findMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      name: { in: couponNames },
    },
  });
  const couponTemplateByName = new Map(couponTemplates.map((template) => [template.name, template]));
  const couponOrdinalByMemberTemplate = new Map<string, number>();

  for (const assignment of HUNAN_FULL_COUPON_ASSIGNMENTS) {
    const blueprint = couponBlueprintByCode.get(assignment.code);
    if (!blueprint) {
      throw new Error(`[Hunan-Full] Missing coupon blueprint for ${assignment.code}.`);
    }

    const template = couponTemplateByName.get(blueprint.name);
    if (!template) {
      throw new Error(`[Hunan-Full] Missing coupon template record for ${assignment.code}.`);
    }

    const receiveTime = hunanFullAt(assignment.receiveOffsetDays, 9, 30);
    const startTime = blueprint.validityType === 'FIXED' ? hunanFullAt(-15, 0, 0) : receiveTime;
    const endTime =
      blueprint.validityType === 'FIXED'
        ? hunanFullAt(90, 23, 59)
        : hunanFullAt(assignment.receiveOffsetDays + (blueprint.validDays ?? 15), 23, 59);
    const ordinalKey = `${assignment.memberId}:${template.id}`;
    const perUserOrd = (couponOrdinalByMemberTemplate.get(ordinalKey) ?? 0) + 1;
    couponOrdinalByMemberTemplate.set(ordinalKey, perUserOrd);

    await prisma.mktUserCoupon.create({
      data: {
        tenantId: HUNAN_FULL_TENANT_ID,
        memberId: assignment.memberId,
        templateId: template.id,
        perUserOrd,
        couponName: template.name,
        couponType: template.type,
        discountAmount: template.discountAmount,
        discountPercent: template.discountPercent,
        maxDiscountAmount: template.maxDiscountAmount,
        minOrderAmount: template.minOrderAmount,
        startTime,
        endTime,
        status: assignment.status ?? UserCouponStatus.UNUSED,
        distributionType: mapDistributionType(assignment.distributionType),
        distributionSource: `HF-SEED::${assignment.code}`,
        usedTime: null,
        orderId: null,
        receiveTime,
      },
    });
  }

  console.log(
    `  ✓ ${HUNAN_FULL_MEMBERS.length} 个会员地址/钱包/积分账户与 ${HUNAN_FULL_COUPON_ASSIGNMENTS.length} 张已领券样本`,
  );
}
