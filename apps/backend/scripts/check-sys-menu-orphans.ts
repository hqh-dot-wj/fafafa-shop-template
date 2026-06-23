/**
 * 校验 sys_menu 中是否存在 parentId 指向不存在菜单的「孤儿」节点（parentId>0）。
 * 用于种子/迁移后的结构自检（P2-03）。
 */
import { DelFlag, PrismaClient, Status } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const menus = await prisma.sysMenu.findMany({
      where: {
        delFlag: DelFlag.NORMAL,
        status: Status.NORMAL,
      },
      select: { menuId: true, parentId: true, menuName: true, path: true },
    });
    const idSet = new Set(menus.map((m) => m.menuId));
    const orphans = menus.filter((m) => m.parentId > 0 && !idSet.has(m.parentId));
    if (orphans.length > 0) {
      console.error(`发现 ${orphans.length} 条孤儿菜单（parent 不存在）：`);
      for (const row of orphans) {
        console.error(`  menuId=${row.menuId} parentId=${row.parentId} name=${row.menuName} path=${row.path}`);
      }
      process.exitCode = 1;
      return;
    }
    console.log(`sys_menu 孤儿校验通过（共 ${menus.length} 条有效菜单）`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
