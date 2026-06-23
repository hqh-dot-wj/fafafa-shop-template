import type { PrismaService } from 'src/prisma/prisma.service';

/**
 * 种子或手工插入若使用显式 template_id / attr_id，PostgreSQL 序列可能滞后，
 * 下一次自增会与已有主键冲突。写入前对齐序列，避免新建模板 500。
 */
export async function alignPmsAttrTemplateAndAttributeSequences(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('pms_attr_template', 'template_id'),
      (SELECT COALESCE(MAX(template_id), 1) FROM pms_attr_template)
    )
  `);
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('pms_attribute', 'attr_id'),
      (SELECT COALESCE(MAX(attr_id), 1) FROM pms_attribute)
    )
  `);
}
