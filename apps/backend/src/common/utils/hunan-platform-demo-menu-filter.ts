/**
 * 湖南总平台演示只读角色：从菜单元数据选出应绑定的 menuId（与种子 `seed-hunan-platform-overrides` 共用逻辑）。
 */
export function selectDemoReadonlyMenuIds(
  menus: ReadonlyArray<{ menuId: number; menuType: string; perms: string }>,
): number[] {
  const ids = new Set<number>();
  for (const m of menus) {
    if (m.menuType === 'M' || m.menuType === 'C') {
      ids.add(m.menuId);
      continue;
    }
    if (m.menuType === 'F') {
      const p = m.perms ?? '';
      if (p.endsWith(':list') || p.endsWith(':query')) {
        ids.add(m.menuId);
      }
    }
  }
  return [...ids].sort((a, b) => a - b);
}

export function isReadonlyButtonPerm(perms: string): boolean {
  if (!perms) return false;
  return perms.endsWith(':list') || perms.endsWith(':query');
}
