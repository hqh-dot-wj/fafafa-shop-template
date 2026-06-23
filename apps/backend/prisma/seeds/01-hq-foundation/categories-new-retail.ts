/**
 * 新零售：酒水饮料 + 水果鲜花（独立 catId 段；模板绑定见 `attr-templates-new-retail.ts`）
 */
import type { PrismaClient } from '@prisma/client';

import { upsertPmsCategoryRows, type PmsCategorySeedRow } from './categories-shared';

const NEW_RETAIL_CATEGORIES: PmsCategorySeedRow[] = [
  {
    catId: 30,
    parentId: null,
    name: '酒水饮料',
    level: 1,
    icon: 'https://nest-admin.oss-cn-beijing.aliyuncs.com/2026/04/14/ce3242ae78ed476ba77ddadc307db65b.png',
    sort: 10,
    bindType: 'REAL',
  },
  { catId: 31, parentId: 30, name: '啤酒', level: 2, icon: '🍺', sort: 1, bindType: 'REAL' },
  { catId: 32, parentId: 30, name: '白酒与洋酒', level: 2, icon: '🥃', sort: 2, bindType: 'REAL' },
  { catId: 36, parentId: 30, name: '乳饮与植物蛋白', level: 2, icon: '🥛', sort: 6, bindType: 'REAL' },
  { catId: 38, parentId: 30, name: '冲调饮品与麦片', level: 2, icon: '🥣', sort: 8, bindType: 'REAL' },
  {
    catId: 40,
    parentId: null,
    name: '水果鲜花',
    level: 1,
    icon: 'https://nest-admin.oss-cn-beijing.aliyuncs.com/2026/04/14/05908e493c564e0e98133bd3b89b4587.png',
    sort: 11,
    bindType: 'REAL',
  },
  { catId: 41, parentId: 40, name: '时令鲜果', level: 2, icon: '🍎', sort: 1, bindType: 'REAL' },
  { catId: 42, parentId: 40, name: '进口水果', level: 2, icon: '🥝', sort: 2, bindType: 'REAL' },
  { catId: 43, parentId: 40, name: '果切与拼盘', level: 2, icon: '🍉', sort: 3, bindType: 'REAL' },
];

export async function seedCategoriesNewRetail(prisma: PrismaClient): Promise<void> {
  console.log('[01-HQ] 商品分类（新零售）...');
  await upsertPmsCategoryRows(prisma, NEW_RETAIL_CATEGORIES);
  await prisma.pmsCategory.deleteMany({
    where: { catId: { in: [33, 34, 35, 37, 44, 45, 46] } },
  });
  console.log(`  ✓ ${NEW_RETAIL_CATEGORIES.length} 个分类`);
}
