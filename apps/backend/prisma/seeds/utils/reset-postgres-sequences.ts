import { PrismaClient } from '@prisma/client';

interface ColumnInfo {
  column_name: string;
  column_default: string | null;
}

/**
 * 将常用种子表的主键序列对齐到当前 MAX(id)，避免手工指定 id 后自增冲突。
 */
export async function resetPostgresSequences(prisma: PrismaClient): Promise<void> {
  console.log('正在重置数据库序列...');
  const tableNames = [
    'sys_user',
    'sys_role',
    'sys_menu',
    'sys_dept',
    'sys_post',
    'sys_dict_type',
    'sys_dict_data',
    'sys_config',
    'sys_notice',
    'sys_job',
    'sys_job_log',
    'sys_oper_log',
    'sys_logininfor',
    'sys_tenant',
    'sys_tenant_package',
    'sys_client',
    'gen_table',
    'gen_table_column',
    'sys_file_folder',
    'pms_category',
    /** 种子为 pms_attr_template / pms_attribute 指定了显式主键，必须对齐序列，否则新建模板会报 template_id 唯一冲突 */
    'pms_attr_template',
    'pms_attribute',
    'sys_dist_config',
    'sys_dist_level',
  ];

  for (const tableName of tableNames) {
    try {
      const constraints = await prisma.$queryRawUnsafe<ColumnInfo[]>(
        `SELECT column_name, column_default 
         FROM information_schema.columns 
         WHERE table_name = '${tableName}' 
         AND column_default LIKE 'nextval%'`,
      );

      if (constraints.length > 0) {
        const columnName = constraints[0].column_name;
        await prisma.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('${tableName}', '${columnName}'), (SELECT COALESCE(MAX("${columnName}"), 1) FROM "${tableName}"))`,
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to reset sequence for ${tableName}:`, msg);
    }
  }
  console.log('数据库序列重置完成');
}
