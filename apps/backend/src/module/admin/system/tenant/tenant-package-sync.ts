import { Prisma, type PrismaClient, type SysMenu } from '@prisma/client';
import { DelFlagEnum, StatusEnum } from 'src/common/enum/index';
import { TenantContext } from 'src/common/tenant/tenant.context';
import type { PrismaService } from 'src/prisma/prisma.service';

type PrismaLike = PrismaClient | Prisma.TransactionClient | PrismaService;

export type TenantPackageSyncOptions = {
  operator?: string;
  onWarn?: (message: string) => void;
};

/**
 * 将平台套餐 menuIds 同步为租户菜单，并绑定到指定角色（与 TenantService.syncPackage 中菜单链路一致）。
 * 种子与运行时共用，避免演示租户仅有用户/角色却无 sys_role_menu 导致 marketing:activity:list 等接口 403。
 */
/**
 * 平台租户（000000）按菜单根节点收集子树 menuId，用于种子给分角色账号绑定 sys_role_menu。
 */
export async function bindPlatformMenuSubtreeForRole(
  prisma: PrismaLike,
  input: { roleId: number; rootMenuIds: number[] },
  options: TenantPackageSyncOptions = {},
): Promise<number> {
  const menuIds = await resolvePlatformMenuSubtreeIds(prisma, input.rootMenuIds);
  await syncTenantAdminRoleMenus(prisma, input.roleId, menuIds);
  return menuIds.length;
}

export async function resolvePlatformMenuSubtreeIds(prisma: PrismaLike, rootMenuIds: number[]): Promise<number[]> {
  if (rootMenuIds.length === 0) {
    return [];
  }

  const platformMenus = await prisma.sysMenu.findMany({
    where: {
      tenantId: TenantContext.SUPER_TENANT_ID,
      delFlag: DelFlagEnum.NORMAL,
      status: StatusEnum.NORMAL,
    },
    select: { menuId: true, parentId: true },
  });

  const childrenByParent = new Map<number, number[]>();
  for (const menu of platformMenus) {
    const siblings = childrenByParent.get(menu.parentId) ?? [];
    siblings.push(menu.menuId);
    childrenByParent.set(menu.parentId, siblings);
  }

  const collected = new Set<number>();
  const queue = [...rootMenuIds];
  while (queue.length > 0) {
    const menuId = queue.shift();
    if (menuId === undefined || collected.has(menuId)) {
      continue;
    }
    collected.add(menuId);
    const children = childrenByParent.get(menuId) ?? [];
    for (const childId of children) {
      if (!collected.has(childId)) {
        queue.push(childId);
      }
    }
  }

  return [...collected].sort((left, right) => left - right);
}

export async function bindTenantPackageMenusForRole(
  prisma: PrismaLike,
  input: {
    tenantId: string;
    packageMenuIds: string | null | undefined;
    roleId: number;
  },
  options: TenantPackageSyncOptions = {},
): Promise<number> {
  const sourceMenuIds = parsePackageMenuIds(input.packageMenuIds);
  const tenantMenuIds = await syncTenantMenusFromPackage(prisma, input.tenantId, sourceMenuIds, options);
  await syncTenantAdminRoleMenus(prisma, input.roleId, tenantMenuIds);
  return tenantMenuIds.length;
}

export function parsePackageMenuIds(menuIds?: string | null): number[] {
  if (!menuIds) {
    return [];
  }
  return [
    ...new Set(
      menuIds
        .split(',')
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
}

export async function syncTenantMenusFromPackage(
  prisma: PrismaLike,
  tenantId: string,
  sourceMenuIds: number[],
  options: TenantPackageSyncOptions = {},
): Promise<number[]> {
  if (sourceMenuIds.length === 0) {
    return [];
  }

  const operator = options.operator ?? 'system';
  const warn = options.onWarn ?? (() => undefined);

  const platformMenus = await prisma.sysMenu.findMany({
    where: {
      tenantId: TenantContext.SUPER_TENANT_ID,
      delFlag: DelFlagEnum.NORMAL,
      status: StatusEnum.NORMAL,
    },
    orderBy: [{ parentId: 'asc' }, { orderNum: 'asc' }, { menuId: 'asc' }],
  });
  const platformMenuById = new Map(platformMenus.map((menu) => [menu.menuId, menu]));
  const expandedSourceMenuIds = expandMenuIdsWithAncestors(sourceMenuIds, platformMenuById);

  if (expandedSourceMenuIds.length === 0) {
    return [];
  }

  const sourceMenus = expandedSourceMenuIds
    .map((menuId) => platformMenuById.get(menuId))
    .filter((menu): menu is SysMenu => Boolean(menu))
    .sort(
      (left, right) =>
        getMenuDepth(left, platformMenuById) - getMenuDepth(right, platformMenuById) ||
        left.parentId - right.parentId ||
        left.orderNum - right.orderNum ||
        left.menuId - right.menuId,
    );

  const tenantMenus = await prisma.sysMenu.findMany({
    where: {
      tenantId,
      delFlag: DelFlagEnum.NORMAL,
    },
    orderBy: [{ parentId: 'asc' }, { orderNum: 'asc' }, { menuId: 'asc' }],
  });
  const tenantMenuByIdentity = new Map(tenantMenus.map((menu) => [buildTenantMenuIdentity(menu), menu]));
  const sourceToTenantMenuId = new Map<number, number>();

  for (const sourceMenu of sourceMenus) {
    const tenantParentId = sourceMenu.parentId === 0 ? 0 : sourceToTenantMenuId.get(sourceMenu.parentId);
    if (tenantParentId === undefined) {
      warn(`租户 ${tenantId} 菜单 ${sourceMenu.menuId} 缺少父级映射，已跳过`);
      continue;
    }

    const menuData = buildTenantMenuData(sourceMenu, tenantId, tenantParentId, operator);
    const identity = buildTenantMenuIdentity(menuData);
    const existingMenu = tenantMenuByIdentity.get(identity);

    if (existingMenu) {
      const updatedMenu = await prisma.sysMenu.update({
        where: { menuId: existingMenu.menuId },
        data: {
          orderNum: menuData.orderNum,
          query: menuData.query,
          isFrame: menuData.isFrame,
          isCache: menuData.isCache,
          visible: menuData.visible,
          status: menuData.status,
          icon: menuData.icon,
          remark: menuData.remark,
          updateBy: operator,
        },
      });
      sourceToTenantMenuId.set(sourceMenu.menuId, updatedMenu.menuId);
    } else {
      const createdMenu = await prisma.sysMenu.create({
        data: menuData,
      });
      tenantMenuByIdentity.set(identity, createdMenu);
      sourceToTenantMenuId.set(sourceMenu.menuId, createdMenu.menuId);
    }
  }

  return expandedSourceMenuIds
    .map((sourceMenuId) => sourceToTenantMenuId.get(sourceMenuId))
    .filter((menuId): menuId is number => typeof menuId === 'number');
}

export async function syncTenantAdminRoleMenus(prisma: PrismaLike, roleId: number, menuIds: number[]): Promise<void> {
  await prisma.sysRoleMenu.deleteMany({
    where: { roleId },
  });

  if (menuIds.length === 0) {
    return;
  }

  await prisma.sysRoleMenu.createMany({
    data: menuIds.map((menuId) => ({ roleId, menuId })),
    skipDuplicates: true,
  });
}

function expandMenuIdsWithAncestors(menuIds: number[], menuById: Map<number, SysMenu>): number[] {
  const expanded = new Set<number>();
  for (const menuId of menuIds) {
    let current = menuById.get(menuId);
    while (current) {
      expanded.add(current.menuId);
      if (current.parentId <= 0) {
        break;
      }
      current = menuById.get(current.parentId);
    }
  }
  return [...expanded];
}

function getMenuDepth(menu: SysMenu, menuById: Map<number, SysMenu>): number {
  let depth = 0;
  const visited = new Set<number>();
  let parentId = menu.parentId;

  while (parentId > 0 && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = menuById.get(parentId);
    if (!parent) {
      break;
    }
    depth++;
    parentId = parent.parentId;
  }

  return depth;
}

function buildTenantMenuData(
  sourceMenu: SysMenu,
  tenantId: string,
  parentId: number,
  operator: string,
): Prisma.SysMenuCreateInput {
  return {
    tenantId,
    menuName: sourceMenu.menuName,
    parentId,
    orderNum: sourceMenu.orderNum,
    path: sourceMenu.path ?? '',
    component: sourceMenu.component ?? '',
    query: sourceMenu.query ?? '',
    isFrame: sourceMenu.isFrame,
    isCache: sourceMenu.isCache,
    menuType: sourceMenu.menuType,
    visible: sourceMenu.visible,
    status: sourceMenu.status,
    perms: sourceMenu.perms ?? '',
    icon: sourceMenu.icon ?? '',
    createBy: operator,
    updateBy: operator,
    remark: sourceMenu.remark,
    delFlag: DelFlagEnum.NORMAL,
  };
}

function buildTenantMenuIdentity(menu: {
  parentId: number;
  menuName?: string | null;
  path?: string | null;
  component?: string | null;
  menuType?: string | null;
  perms?: string | null;
}): string {
  return [
    menu.parentId,
    menu.menuName ?? '',
    menu.path ?? '',
    menu.component ?? '',
    menu.menuType ?? '',
    menu.perms ?? '',
  ].join('|');
}
