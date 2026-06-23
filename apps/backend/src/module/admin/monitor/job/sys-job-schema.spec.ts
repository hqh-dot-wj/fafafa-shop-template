// quality-gate allow-source-string-test
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('SysJob schema', () => {
  it('包含代码托管任务所需字段与唯一约束', () => {
    const schemaDir = join(process.cwd(), 'prisma');
    const modelDir = join(schemaDir, 'models');
    const schema = [
      readFileSync(join(schemaDir, 'schema.prisma'), 'utf8'),
      ...readdirSync(modelDir)
        .filter((file) => file.endsWith('.prisma'))
        .map((file) => readFileSync(join(modelDir, file), 'utf8')),
    ].join('\n');

    expect(schema).toContain('sourceType');
    expect(schema).toContain('sourceKey');
    expect(schema).toContain('lastSyncedAt');
    expect(schema).toContain('@@unique([sourceType, sourceKey]');
  });

  it('seed 数据包含任务来源字段与业务任务分组', () => {
    const menuSeed = readFileSync(
      join(process.cwd(), 'prisma/seeds/00-platform/sys-menu-and-role-menu.ts'),
      'utf8',
    );
    const platformSeed = readFileSync(
      join(process.cwd(), 'prisma/seeds/00-platform/platform-bootstrap.ts'),
      'utf8',
    );

    expect(menuSeed).toContain("sourceType: 'MANUAL'");
    expect(menuSeed).toContain('sourceKey: null');
    expect(menuSeed).toContain('lastSyncedAt: null');
    expect(platformSeed).toContain("dictValue: 'FINANCE'");
    expect(platformSeed).toContain("dictValue: 'MARKETING'");
    expect(platformSeed).toContain("dictValue: 'STORE'");
  });

  it('init.sql 包含任务来源字段、唯一索引与业务任务分组', () => {
    const initSql = readFileSync(join(process.cwd(), 'db/init.sql'), 'utf8');

    expect(initSql).toContain('"source_type"');
    expect(initSql).toContain('"source_key"');
    expect(initSql).toContain('"last_synced_at"');
    expect(initSql).toContain('uk_sys_job_source');
    expect(initSql).toContain("'FINANCE', 'sys_job_group'");
    expect(initSql).toContain("'MARKETING', 'sys_job_group'");
    expect(initSql).toContain("'STORE', 'sys_job_group'");
  });
});
