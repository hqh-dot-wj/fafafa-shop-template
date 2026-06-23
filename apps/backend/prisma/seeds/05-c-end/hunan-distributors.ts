import { PrismaClient } from '@prisma/client';

import {
  HUNAN_FULL_BLACKLIST_MEMBER_IDS,
  HUNAN_FULL_DIST_APPLICATIONS,
  HUNAN_FULL_REFERRAL_CODES,
  HUNAN_FULL_UPGRADE_APPLICATIONS,
} from '../hunan-full/catalog-members';
import { assertHunanFullSeedScope, hunanFullAt, HUNAN_FULL_TENANT_ID } from '../hunan-full/shared';

export async function seedHunanDistributors(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanDistributors');
  console.log('[05-CEnd] 湖南完整演示分销人员...');

  await prisma.umsReferralCode.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      memberId: { in: HUNAN_FULL_REFERRAL_CODES.map(code => code.memberId) },
    },
  });

  for (const referralCode of HUNAN_FULL_REFERRAL_CODES) {
    await prisma.umsReferralCode.create({
      data: {
        tenantId: HUNAN_FULL_TENANT_ID,
        memberId: referralCode.memberId,
        code: referralCode.code,
        qrCodeUrl: referralCode.qrCodeUrl,
        usageCount: referralCode.usageCount,
        isActive: referralCode.isActive,
      },
    });
  }

  await prisma.sysDistApplication.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      memberId: { in: HUNAN_FULL_DIST_APPLICATIONS.map(application => application.memberId) },
    },
  });

  await prisma.sysDistApplication.createMany({
    data: HUNAN_FULL_DIST_APPLICATIONS.map((application, index) => ({
      tenantId: HUNAN_FULL_TENANT_ID,
      memberId: application.memberId,
      applyReason:
        [
          application.applyReason,
          application.evidenceOrderId ? `订单ID:${application.evidenceOrderId}` : null,
          application.evidenceOrderSn ? `订单证据:${application.evidenceOrderSn}` : null,
          application.evidenceScenarioType ? `场景类型:${application.evidenceScenarioType}` : null,
          application.sourceSceneCode ? `场景:${application.sourceSceneCode}` : null,
          application.sourceModuleCode ? `模块:${application.sourceModuleCode}` : null,
          application.linkedActivityType ? `活动:${application.linkedActivityType}` : null,
        ]
          .filter(Boolean)
          .join(' | '),
      status: application.status,
      reviewerId: application.reviewerId ?? null,
      reviewTime: application.reviewerId ? hunanFullAt(-6 + index) : null,
      reviewRemark:
        [
          application.reviewRemark ?? null,
          application.evidenceOrderId ? `核验订单ID:${application.evidenceOrderId}` : null,
          application.evidenceOrderSn ? `核验订单:${application.evidenceOrderSn}` : null,
          application.evidenceScenarioType ? `核验场景:${application.evidenceScenarioType}` : null,
        ]
          .filter(Boolean)
          .join(' | ') || null,
      autoReviewed: application.autoReviewed ?? false,
      createTime: hunanFullAt(-12 + index),
      updateTime: hunanFullAt(-6 + index),
    })),
  });

  await prisma.umsUpgradeApply.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      memberId: { in: HUNAN_FULL_UPGRADE_APPLICATIONS.map(application => application.memberId) },
    },
  });

  await prisma.umsUpgradeApply.createMany({
    data: HUNAN_FULL_UPGRADE_APPLICATIONS.map((application, index) => ({
      tenantId: HUNAN_FULL_TENANT_ID,
      memberId: application.memberId,
      fromLevel: application.fromLevel,
      toLevel: application.toLevel,
      applyType: application.applyType,
      orderId: application.orderId ?? null,
      referralCode: application.referralCode ?? null,
      referrerId: application.referrerId ?? null,
      status: application.status,
      reviewBy: application.reviewBy ?? null,
      reviewTime: application.reviewBy ? hunanFullAt(-9 + index) : null,
      reviewRemark:
        [
          application.reviewRemark ?? null,
          application.orderId ? `触发订单ID:${application.orderId}` : null,
          application.orderSn ? `触发订单:${application.orderSn}` : null,
          application.evidenceScenarioType ? `触发场景:${application.evidenceScenarioType}` : null,
          application.sourceSceneCode ? `来源场景:${application.sourceSceneCode}` : null,
          application.sourceModuleCode ? `来源模块:${application.sourceModuleCode}` : null,
          application.linkedActivityType ? `关联活动:${application.linkedActivityType}` : null,
        ]
          .filter(Boolean)
          .join(' | ') || null,
      createTime: hunanFullAt(-15 + index),
    })),
  });

  const approvedDistMembers = HUNAN_FULL_DIST_APPLICATIONS.filter(application => application.status === 'APPROVED')
    .map(application => application.memberId);

  for (const memberId of approvedDistMembers) {
    await prisma.umsMember.update({
      where: { memberId },
      data: {
        levelId: 1,
      },
    });
  }

  const approvedUpgradeApplications = HUNAN_FULL_UPGRADE_APPLICATIONS.filter(
    application => application.status === 'APPROVED',
  );

  for (const [index, application] of approvedUpgradeApplications.entries()) {
    await prisma.umsMember.update({
      where: { memberId: application.memberId },
      data: {
        levelId: application.toLevel,
        upgradedAt: hunanFullAt(-7 + index),
        upgradeOrderId: application.orderId ?? null,
      },
    });
  }

  await prisma.sysDistBlacklist.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      userId: { in: HUNAN_FULL_BLACKLIST_MEMBER_IDS },
    },
  });

  await prisma.sysDistBlacklist.createMany({
    data: HUNAN_FULL_BLACKLIST_MEMBER_IDS.map(memberId => ({
      tenantId: HUNAN_FULL_TENANT_ID,
      userId: memberId,
      reason: '命中风控规则，作为黑名单演示样本',
      createBy: 'seed',
    })),
  });

  await prisma.sysDistLevelLog.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      memberId: {
        in: [
          'hf-member-l1-03',
          'hf-member-l1-07',
          'hf-member-regular-01',
          'hf-member-regular-10',
          'hf-member-regular-15',
          'hf-member-regular-16',
        ],
      },
    },
  });

  await prisma.sysDistLevelLog.createMany({
    data: [
      {
        tenantId: HUNAN_FULL_TENANT_ID,
        memberId: 'hf-member-regular-01',
        fromLevel: 0,
        toLevel: 1,
        changeType: 'UPGRADE',
        reason: '自动审核通过转一级分销员',
        operator: 'hf_dist_reviewer',
        createTime: hunanFullAt(-9),
      },
      {
        tenantId: HUNAN_FULL_TENANT_ID,
        memberId: 'hf-member-l1-03',
        fromLevel: 1,
        toLevel: 2,
        changeType: 'UPGRADE',
        reason: '课程合伙人升级通过',
        operator: 'hf_dist_reviewer',
        createTime: hunanFullAt(-8),
      },
      {
        tenantId: HUNAN_FULL_TENANT_ID,
        memberId: 'hf-member-l1-07',
        fromLevel: 1,
        toLevel: 2,
        changeType: 'MANUAL',
        reason: '购买升级包后人工复核通过',
        operator: 'hf_dist_reviewer',
        createTime: hunanFullAt(-7),
      },
      {
        tenantId: HUNAN_FULL_TENANT_ID,
        memberId: 'hf-member-regular-07',
        fromLevel: 0,
        toLevel: 1,
        changeType: 'UPGRADE',
        reason: '订单达标后通过分销申请与升级审核',
        operator: 'hf_dist_reviewer',
        createTime: hunanFullAt(-6),
      },
      {
        tenantId: HUNAN_FULL_TENANT_ID,
        memberId: 'hf-member-regular-10',
        fromLevel: 0,
        toLevel: 1,
        changeType: 'UPGRADE',
        reason: '满减原价佣金保护单审核通过，升级一级分销员',
        operator: 'hf_dist_reviewer',
        createTime: hunanFullAt(-5),
      },
      {
        tenantId: HUNAN_FULL_TENANT_ID,
        memberId: 'hf-member-regular-15',
        fromLevel: 0,
        toLevel: 1,
        changeType: 'UPGRADE',
        reason: '绑定关系稳定且延迟结算完成，升级一级分销员',
        operator: 'hf_dist_reviewer',
        createTime: hunanFullAt(-4),
      },
      {
        tenantId: HUNAN_FULL_TENANT_ID,
        memberId: 'hf-member-regular-16',
        fromLevel: 0,
        toLevel: 1,
        changeType: 'UPGRADE',
        reason: '购买成长合伙人升级包后通过升级审核',
        operator: 'hf_dist_reviewer',
        createTime: hunanFullAt(-3),
      },
    ],
  });

  console.log('  ✓ 推荐码、分销申请、升级申请、黑名单、等级日志');
}
