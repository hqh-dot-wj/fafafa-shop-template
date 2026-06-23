import { MemberStatus, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { HUNAN_FULL_MEMBERS, HUNAN_FULL_MEMBER_PASSWORD } from '../hunan-full/catalog-members';
import { assertHunanFullSeedScope, HUNAN_FULL_TENANT_ID } from '../hunan-full/shared';

const HUNAN_FULL_LEGACY_MEMBER_IDS = [
  'hf-member-apply-pending-01',
  'hf-member-apply-pending-02',
  'hf-member-apply-pending-03',
  'hf-member-apply-pending-04',
  'hf-member-apply-rejected-01',
  'hf-member-apply-rejected-02',
  'hf-member-apply-rejected-03',
  'hf-member-wallet-frozen-01',
  'hf-member-wallet-frozen-02',
  'hf-member-disabled-01',
  'hf-member-disabled-02',
  'hf-member-blacklist-01',
  'hf-member-blacklist-02',
] as const;

export async function seedHunanMembers(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanMembers');
  console.log('[05-CEnd] 湖南完整演示会员...');

  await prisma.umsMember.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      memberId: { in: [...HUNAN_FULL_LEGACY_MEMBER_IDS] },
    },
  });

  for (const member of HUNAN_FULL_MEMBERS) {
    await prisma.umsMember.upsert({
      where: { memberId: member.memberId },
      update: {
        tenantId: HUNAN_FULL_TENANT_ID,
        nickname: member.nickname,
        avatar: member.avatar,
        mobile: member.mobile,
        password: HUNAN_FULL_MEMBER_PASSWORD,
        status: member.status === 'NORMAL' ? MemberStatus.NORMAL : MemberStatus.DISABLED,
        levelId: member.levelId,
        balance: new Decimal(0),
        frozenBalance: new Decimal(0),
        points: 0,
        parentId: member.parentId,
        indirectParentId: member.indirectParentId,
        referralCode: member.referralCode ?? null,
      },
      create: {
        memberId: member.memberId,
        tenantId: HUNAN_FULL_TENANT_ID,
        nickname: member.nickname,
        avatar: member.avatar,
        mobile: member.mobile,
        password: HUNAN_FULL_MEMBER_PASSWORD,
        status: member.status === 'NORMAL' ? MemberStatus.NORMAL : MemberStatus.DISABLED,
        levelId: member.levelId,
        balance: new Decimal(0),
        frozenBalance: new Decimal(0),
        points: 0,
        parentId: member.parentId,
        indirectParentId: member.indirectParentId,
        referralCode: member.referralCode ?? null,
      },
    });
  }

  console.log(`  ✓ ${HUNAN_FULL_MEMBERS.length} 个会员与推荐链`);
}
