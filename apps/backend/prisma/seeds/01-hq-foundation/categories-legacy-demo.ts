/**
 * 旧演示：百货零售 + 素质教育（与 `products.ts` 总部演示商品、属性模板 1/2 绑定，勿改 catId）
 */
import type { PrismaClient } from '@prisma/client';

import { upsertPmsCategoryRows, type PmsCategorySeedRow } from './categories-shared';

const LEGACY_DEMO_CATEGORIES: PmsCategorySeedRow[] = [
  { catId: 1, parentId: null, name: '百货零售', level: 1, icon: '🛒', sort: 1, bindType: 'REAL' },
  { catId: 101, parentId: 1, name: '家居用品', level: 2, icon: '🏠', sort: 1, bindType: 'REAL' },
  { catId: 102, parentId: 1, name: '美妆个护', level: 2, icon: '💄', sort: 2, bindType: 'REAL' },
  { catId: 103, parentId: 1, name: '母婴用品', level: 2, icon: '👶', sort: 3, bindType: 'REAL' },
  { catId: 104, parentId: 1, name: '数码配件', level: 2, icon: '📱', sort: 4, bindType: 'REAL' },
  { catId: 105, parentId: 1, name: '食品饮料', level: 2, icon: '🍎', sort: 5, bindType: 'REAL' },
  { catId: 2, parentId: null, name: '素质教育', level: 1, icon: '📚', sort: 2, bindType: 'SERVICE' },
  { catId: 201, parentId: 2, name: '艺术培训', level: 2, icon: '🎨', sort: 1, bindType: 'SERVICE' },
  { catId: 202, parentId: 2, name: '体育培训', level: 2, icon: '⚽', sort: 2, bindType: 'SERVICE' },
  { catId: 203, parentId: 2, name: '语言培训', level: 2, icon: '🌐', sort: 3, bindType: 'SERVICE' },
  { catId: 204, parentId: 2, name: '科创培训', level: 2, icon: '🤖', sort: 4, bindType: 'SERVICE' },
  { catId: 205, parentId: 2, name: '思维培训', level: 2, icon: '🧩', sort: 5, bindType: 'SERVICE' },
];

export async function seedCategoriesLegacyDemo(prisma: PrismaClient): Promise<void> {
  console.log('[01-HQ] 商品分类（旧演示）...');
  await upsertPmsCategoryRows(prisma, LEGACY_DEMO_CATEGORIES);
  console.log(`  ✓ ${LEGACY_DEMO_CATEGORIES.length} 个分类`);
}
