import type { PrismaClient } from '@prisma/client';
import { DelFlag } from '@prisma/client';

export const HUNAN_FULL_TENANT_ID = '000000';
export const HUNAN_FULL_STORE_ID = HUNAN_FULL_TENANT_ID;
export const HUNAN_FULL_COMPANY_NAME = '湖南科技有限公司';
export const HUNAN_FULL_BASE_TIME = new Date('2026-04-17T10:00:00+08:00');
export const HUNAN_FULL_MEMBER_PASSWORD_HASH =
  '$2b$10$UrJrjy0kxyrTO1UvhRVsvex35mB1s1jzAraIA9xtzPmlLmRtZXEXS';
export const HUNAN_FULL_DEFAULT_AVATARS = [
  'https://picsum.photos/seed/hunan-full-a/200/200',
  'https://picsum.photos/seed/hunan-full-b/200/200',
  'https://picsum.photos/seed/hunan-full-c/200/200',
] as const;

export function hunanFullAt(dayOffset: number, hour = 10, minute = 0): Date {
  const date = new Date(HUNAN_FULL_BASE_TIME);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export function hunanFullImage(slug: string): string {
  return `https://nest-admin.oss-cn-beijing.aliyuncs.com/2026/04/17/hunan-full-${slug}.png`;
}

export function hunanFullMobile(index: number): string {
  return `1867312${String(index).padStart(4, '0')}`;
}

export async function assertHunanFullSeedScope(prisma: PrismaClient, phase: string): Promise<void> {
  const tenant = await prisma.sysTenant.findUnique({
    where: { tenantId: HUNAN_FULL_TENANT_ID },
    select: { tenantId: true, companyName: true, delFlag: true },
  });

  if (!tenant) {
    throw new Error(`[Hunan-Full] Guard failed at ${phase}: tenant ${HUNAN_FULL_TENANT_ID} not found.`);
  }

  if (tenant.companyName !== HUNAN_FULL_COMPANY_NAME) {
    throw new Error(
      `[Hunan-Full] Guard failed at ${phase}: expected company "${HUNAN_FULL_COMPANY_NAME}", got "${tenant.companyName}".`,
    );
  }

  if (tenant.delFlag !== DelFlag.NORMAL) {
    throw new Error(`[Hunan-Full] Guard failed at ${phase}: tenant ${HUNAN_FULL_TENANT_ID} is deleted.`);
  }
}
