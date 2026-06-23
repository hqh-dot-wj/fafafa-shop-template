/**
 * 已发放优惠券（按租户匹配券模板，避免跨租户 templateId 错绑）
 */
import { PrismaClient, CouponDistributionType, CouponType } from '@prisma/client';

export async function seedCouponsIssued(prisma: PrismaClient) {
  console.log('[05-CEnd] 发放优惠券...');

  const members = await prisma.umsMember.findMany({
    select: { memberId: true, tenantId: true },
    orderBy: [{ tenantId: 'asc' }, { memberId: 'asc' }],
  });

  if (members.length === 0) return;

  const now = new Date();
  let count = 0;

  for (const [index, m] of members.entries()) {
    const templates = await prisma.mktCouponTemplate.findMany({
      where: { tenantId: m.tenantId, status: 'ACTIVE' },
      take: 3,
      orderBy: { createTime: 'asc' },
    });
    if (templates.length === 0) continue;

    const tpl = templates[index % templates.length];
    const start = new Date(now);
    const end = new Date(now);
    end.setDate(end.getDate() + 30);

    const exists = await prisma.mktUserCoupon.findFirst({
      where: { memberId: m.memberId, templateId: tpl.id },
    });
    if (exists) continue;

    await prisma.mktUserCoupon.create({
      data: {
        tenantId: m.tenantId,
        memberId: m.memberId,
        templateId: tpl.id,
        couponName: tpl.name,
        couponType: tpl.type as CouponType,
        discountAmount: tpl.discountAmount,
        discountPercent: tpl.discountPercent,
        maxDiscountAmount: tpl.maxDiscountAmount,
        minOrderAmount: tpl.minOrderAmount,
        startTime: start,
        endTime: end,
        distributionType: CouponDistributionType.MANUAL,
        distributionSource: '种子数据',
      },
    });
    count++;
  }
  console.log(`  ✓ 发放 ${count} 张优惠券`);
}
