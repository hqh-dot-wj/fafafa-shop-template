/**
 * H5 密码登录联调账号（client/auth/password-login）
 * 明文密码与 prisma/seeds/03-tenants/tenants.ts 中 PASSWORD_HASH 注释一致：123456
 */
import { DelFlag, MemberStatus, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { DEMO_MEMBER_PLAIN_PASSWORD, hashMemberPassword } from './utils/member-password-hash';

const HUNAN_TENANT_ID = '000000';
const HUNAN_COMPANY_NAME = '湖南科技有限公司';

const H5_DEMO_MOBILE = '18570467732';
const H5_DEMO_MEMBER_ID = 'h5-demo-password-login';

async function assertHunanPlatformTenant(prisma: PrismaClient, phase: string): Promise<void> {
  const tenant = await prisma.sysTenant.findUnique({
    where: { tenantId: HUNAN_TENANT_ID },
    select: { tenantId: true, companyName: true, delFlag: true },
  });
  if (!tenant) {
    throw new Error(`[H5-Demo-Member] Guard failed at ${phase}: tenant ${HUNAN_TENANT_ID} not found.`);
  }
  if (tenant.companyName !== HUNAN_COMPANY_NAME) {
    throw new Error(
      `[H5-Demo-Member] Guard failed at ${phase}: tenant ${HUNAN_TENANT_ID} companyName mismatch (expected "${HUNAN_COMPANY_NAME}", actual "${tenant.companyName}").`,
    );
  }
  if (tenant.delFlag !== DelFlag.NORMAL) {
    throw new Error(`[H5-Demo-Member] Guard failed at ${phase}: tenant ${HUNAN_TENANT_ID} is deleted.`);
  }
}

export async function seedH5DemoPasswordMember(prisma: PrismaClient): Promise<void> {
  await assertHunanPlatformTenant(prisma, 'seedH5DemoPasswordMember');

  const passwordHash = hashMemberPassword(DEMO_MEMBER_PLAIN_PASSWORD);

  await prisma.umsMember.upsert({
    where: { mobile: H5_DEMO_MOBILE },
    create: {
      memberId: H5_DEMO_MEMBER_ID,
      tenantId: HUNAN_TENANT_ID,
      mobile: H5_DEMO_MOBILE,
      password: passwordHash,
      nickname: 'H5密码联调',
      avatar: '',
      status: MemberStatus.NORMAL,
      levelId: 0,
      balance: new Decimal(0),
      frozenBalance: new Decimal(0),
      points: 0,
    },
    update: {
      tenantId: HUNAN_TENANT_ID,
      password: passwordHash,
      status: MemberStatus.NORMAL,
      nickname: 'H5密码联调',
    },
  });

  console.log(
    `[H5-Demo-Member] ✓ C端密码登录：${H5_DEMO_MOBILE} / ${DEMO_MEMBER_PLAIN_PASSWORD}（租户 ${HUNAN_TENANT_ID}）`,
  );
}
