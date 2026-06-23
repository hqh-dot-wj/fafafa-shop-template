/**
 * 本地/开发环境：写入或更新 C 端会员（ums_member），用于 H5 密码登录联调。
 * 哈希方式与 AuthService.passwordLogin 一致（bcryptjs + genSaltSync(10)）。
 *
 * 注意：
 * - 仅用于你有权操作的数据库；勿用于生产批量造号。
 * - 弱密码无法通过「重置密码 / 设置密码」接口（PasswordPolicyService），但直接写库后可走 password-login。
 *
 * 运行（在 apps/backend 目录，需 DATABASE_URL）:
 *   pnpm exec ts-node scripts/seed/upsert-dev-h5-member.ts -- --mobile=18570467732 --password=123456
 *   pnpm exec ts-node scripts/seed/upsert-dev-h5-member.ts -- --mobile=13800138000 --password=DevPass123 --tenantId=000000
 */
import * as bcrypt from 'bcryptjs';
import { MemberStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArg(name: string, defaultValue?: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return defaultValue;
  const v = hit.slice(prefix.length).trim();
  return v.length > 0 ? v : defaultValue;
}

function assertMobile(v: string): void {
  if (!/^1\d{10}$/.test(v)) {
    throw new Error(`手机号格式无效: ${v}`);
  }
}

async function main(): Promise<void> {
  const mobile = parseArg('mobile');
  const password = parseArg('password');
  const tenantId = parseArg('tenantId', '000000') ?? '000000';

  if (!mobile || !password) {
    console.error(
      '用法: pnpm exec ts-node scripts/seed/upsert-dev-h5-member.ts -- --mobile=1xxxxxxxxx --password=你的密码 [--tenantId=000000]',
    );
    process.exitCode = 1;
    return;
  }

  assertMobile(mobile);

  const tenant = await prisma.sysTenant.findFirst({
    where: { tenantId },
  });
  if (!tenant) {
    console.error(`租户不存在: ${tenantId}，请先在 sys_tenant 中创建或执行 prisma seed。`);
    process.exitCode = 1;
    return;
  }

  const hashed = bcrypt.hashSync(password, bcrypt.genSaltSync(10));

  const row = await prisma.umsMember.upsert({
    where: { mobile },
    create: {
      tenantId,
      mobile,
      password: hashed,
      status: MemberStatus.NORMAL,
      nickname: `用户_${mobile.slice(-4)}`,
      avatar: '',
    },
    update: {
      password: hashed,
      status: MemberStatus.NORMAL,
      tenantId,
    },
  });

  console.log('完成：已 upsert C 端会员（可用于 H5 password-login）');
  console.log(`  memberId: ${row.memberId}`);
  console.log(`  tenantId: ${row.tenantId}`);
  console.log(`  mobile:   ${row.mobile}`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
