/**
 * 与 `00-platform/sys-menu-and-role-menu.ts` 种子末尾 deleteMany 清理的菜单一致。
 * 套餐 menuIds（CSV）须同步剔除，避免 bindTenantPackageMenusForRole 反复引用已退役 ID。
 */
/** Prisma `in` 过滤器需要可变 number[]，勿用 `as const`。 */
export const RETIRED_SYSTEM_MESSAGE_MENU_IDS: number[] = [122, 1207];

export const OBSOLETE_DISTRIBUTION_PRODUCT_MENU_IDS: number[] = [228, 1190, 1191, 1192, 1193, 1194];

const RETIRED_PACKAGE_MENU_ID_SET = new Set<number>([
  ...RETIRED_SYSTEM_MESSAGE_MENU_IDS,
  ...OBSOLETE_DISTRIBUTION_PRODUCT_MENU_IDS,
]);

/** 从套餐 menuIds CSV 中剔除已退役菜单 ID（幂等）。 */
export function stripRetiredMenuIdsFromPackageCsv(menuIds: string): string {
  const ids = menuIds
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0 && !RETIRED_PACKAGE_MENU_ID_SET.has(id));

  return [...new Set(ids)].join(',');
}
