/**
 * 删除 menu_name 精确为「营销活动」「营销活动配置」的 sys_menu（及子菜单、sys_role_menu）。
 * 不删除「分销活动」等标准种子菜单。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAMES_TO_REMOVE = ['营销活动', '营销活动配置'];

async function collectDescendantMenuIds(rootIds) {
  const all = new Set(rootIds);
  let frontier = [...rootIds];
  while (frontier.length) {
    const children = await prisma.sysMenu.findMany({
      where: { parentId: { in: frontier } },
      select: { menuId: true },
    });
    frontier = [];
    for (const c of children) {
      if (!all.has(c.menuId)) {
        all.add(c.menuId);
        frontier.push(c.menuId);
      }
    }
  }
  return [...all];
}

async function main() {
  const targets = await prisma.sysMenu.findMany({
    where: { menuName: { in: NAMES_TO_REMOVE } },
    select: {
      menuId: true,
      menuName: true,
      tenantId: true,
      path: true,
      parentId: true,
    },
  });

  if (targets.length === 0) {
    console.warn('未找到 menu_name 为「营销活动」或「营销活动配置」的行，无需删除。');
    await prisma.$disconnect();
    return;
  }

  console.warn('将删除以下菜单及其子菜单、sys_role_menu 关联：');
  console.warn(JSON.stringify(targets, null, 2));

  const allIds = await collectDescendantMenuIds(targets.map((t) => t.menuId));

  const rm = await prisma.sysRoleMenu.deleteMany({ where: { menuId: { in: allIds } } });
  console.warn(`已删除 sys_role_menu 关联 ${rm.count} 条`);

  const dm = await prisma.sysMenu.deleteMany({ where: { menuId: { in: allIds } } });
  console.warn(`已删除 sys_menu ${dm.count} 条`);

  try {
    await prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('sys_menu', 'menu_id'),
        (SELECT COALESCE(MAX(menu_id), 1) FROM sys_menu)
      )
    `);
    console.warn('已同步 sys_menu.menu_id 序列');
  } catch (e) {
    console.warn('序列同步跳过:', e?.message ?? e);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
