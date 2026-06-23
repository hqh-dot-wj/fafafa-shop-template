import type { PrismaClient } from '@prisma/client';

export type PmsCategorySeedRow = {
  catId: number;
  parentId: number | null;
  name: string;
  level: number;
  icon: string;
  sort: number;
  bindType: 'REAL' | 'SERVICE';
};

export async function upsertPmsCategoryRows(prisma: PrismaClient, rows: PmsCategorySeedRow[]): Promise<void> {
  for (const row of rows) {
    await prisma.pmsCategory.upsert({
      where: { catId: row.catId },
      update: {
        name: row.name,
        level: row.level,
        sort: row.sort,
        bindType: row.bindType,
        icon: row.icon,
      },
      create: {
        ...row,
        attrTemplateId: null,
      } as Parameters<typeof prisma.pmsCategory.create>[0]['data'],
    });
  }
}
