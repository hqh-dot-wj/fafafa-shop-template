import type { PrismaClient } from '@prisma/client';

/** 平台超级租户（与 sys_menu 种子 tenantId 一致） */
export const SUPER_TENANT_MENU_TENANT_ID = '000000';

/**
 * 删除指定租户下全部菜单及引用这些 menuId 的 sys_role_menu（避免仅 createMany 时主键冲突导致「种子未更新」）。
 */
export async function wipeTenantMenusAndRoleLinks(
  prisma: PrismaClient,
  tenantId: string = SUPER_TENANT_MENU_TENANT_ID,
): Promise<number> {
  const menus = await prisma.sysMenu.findMany({
    where: { tenantId },
    select: { menuId: true },
  });
  const ids = menus.map((m) => m.menuId);
  if (ids.length === 0) {
    return 0;
  }
  await prisma.sysRoleMenu.deleteMany({ where: { menuId: { in: ids } } });
  await prisma.sysMenu.deleteMany({ where: { tenantId } });
  return ids.length;
}
