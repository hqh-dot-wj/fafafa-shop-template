/**
 * 将超级租户下「营销管理」(menu_id=7)、「商品中心」(menu_id=8) 的 parent_id 纠正为 0（顶级），
 * 避免侧栏被画成会员/营销下的子级。
 *
 * 运行（在 apps/backend）: pnpm exec ts-node scripts/fix-marketing-pms-top-level-parent.ts
 */
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../.env') });

const TENANT = '000000';

async function main() {
  const prisma = new PrismaClient();
  try {
    const before = await prisma.sysMenu.findMany({
      where: { tenantId: TENANT, menuId: { in: [5, 6, 7, 8] } },
      select: { menuId: true, parentId: true, menuName: true, path: true },
      orderBy: { menuId: 'asc' },
    });
    console.log('[fix-marketing-pms-top-level] 当前 sys_menu (tenant %s, menu_id 5–8):', TENANT);
    console.table(before);

    const result = await prisma.sysMenu.updateMany({
      where: { tenantId: TENANT, menuId: { in: [7, 8] }, parentId: { not: 0 } },
      data: { parentId: 0 },
    });

    if (result.count === 0) {
      console.log('menu_id 7、8 的 parent_id 已是 0，未写入变更。');
    } else {
      console.log('已更新行数:', result.count, '（7、8 的 parent_id → 0）');
    }

    const after = await prisma.sysMenu.findMany({
      where: { tenantId: TENANT, menuId: { in: [5, 6, 7, 8] } },
      select: { menuId: true, parentId: true, menuName: true, path: true },
      orderBy: { menuId: 'asc' },
    });
    console.log('修正后:');
    console.table(after);
    console.log('若侧栏仍异常，请清菜单相关 Redis 缓存后重新登录。');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
