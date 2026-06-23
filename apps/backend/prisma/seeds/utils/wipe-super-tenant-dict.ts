import type { PrismaClient } from '@prisma/client';

import { SUPER_TENANT_MENU_TENANT_ID } from './wipe-super-tenant-menus';

/**
 * 删除超级租户（000000）下全部平台字典，避免重复执行 seed 时 createMany + skipDuplicates
 * 因主键 dictCode 冲突或历史脏数据导致字典项重复/缺失。
 */
export async function wipeSuperTenantPlatformDict(
  prisma: PrismaClient,
  tenantId: string = SUPER_TENANT_MENU_TENANT_ID,
): Promise<{ dataRemoved: number; typeRemoved: number }> {
  const dataResult = await prisma.sysDictData.deleteMany({ where: { tenantId } });
  const typeResult = await prisma.sysDictType.deleteMany({ where: { tenantId } });
  return { dataRemoved: dataResult.count, typeRemoved: typeResult.count };
}
