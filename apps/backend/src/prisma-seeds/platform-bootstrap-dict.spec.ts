// quality-gate allow-source-string-test
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function parsePlatformDictSeedRows(source: string) {
  const types: string[] = [];
  const typeStart = source.indexOf('// sys_dict_type');
  const dataStart = source.indexOf('// sys_dict_data');
  const typeBlock = source.slice(typeStart, dataStart);
  for (const match of typeBlock.matchAll(/dictType:\s*'([^']+)'/g)) {
    types.push(match[1]);
  }

  const dataBlock = source.slice(dataStart);
  const entries: Array<{ dictCode: number; dictType: string; dictValue: string }> = [];
  const parts = dataBlock.split(/(?=\s+dictCode:)/);
  for (const part of parts) {
    const codeMatch = part.match(/dictCode:\s*(\d+)/);
    const typeMatch = part.match(/dictType:\s*'([^']+)'/);
    const valueMatch = part.match(/dictValue:\s*'([^']+)'/);
    if (codeMatch && typeMatch && valueMatch) {
      entries.push({
        dictCode: Number(codeMatch[1]),
        dictType: typeMatch[1],
        dictValue: valueMatch[1],
      });
    }
  }

  return { types, entries };
}

describe('platform-bootstrap dict seed', () => {
  const platformSeed = readFileSync(join(process.cwd(), 'prisma/seeds/00-platform/platform-bootstrap.ts'), 'utf8');
  const parsed = parsePlatformDictSeedRows(platformSeed);

  it('dictType 段内无重复 dictType', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const dictType of parsed.types) {
      if (seen.has(dictType)) {
        duplicates.push(dictType);
      }
      seen.add(dictType);
    }
    expect(duplicates).toEqual([]);
  });

  it('dict_data 段内 dictCode 全局唯一（避免 createMany 主键冲突漏插）', () => {
    const byCode = new Map<number, string>();
    const collisions: string[] = [];
    for (const row of parsed.entries) {
      const label = `${row.dictType}/${row.dictValue}`;
      const existing = byCode.get(row.dictCode);
      if (existing) {
        collisions.push(`${row.dictCode}: ${existing} vs ${label}`);
      } else {
        byCode.set(row.dictCode, label);
      }
    }
    expect(collisions).toEqual([]);
  });

  it('dict_data 段内 (dictType, dictValue) 唯一', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const row of parsed.entries) {
      const key = `${row.dictType}|${row.dictValue}`;
      if (seen.has(key)) {
        duplicates.push(key);
      }
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it('营销场景类型与任务分组均保留种子项', () => {
    const values = new Set(parsed.entries.map((row) => `${row.dictType}/${row.dictValue}`));
    expect(values.has('sys_job_group/FINANCE')).toBe(true);
    expect(values.has('sys_job_group/MARKETING')).toBe(true);
    expect(values.has('sys_job_group/STORE')).toBe(true);
    expect(values.has('marketing_scene_type/HOMEPAGE')).toBe(true);
    expect(values.has('marketing_scene_type/PRODUCT_DETAIL')).toBe(true);
    expect(values.has('marketing_scene_type/ACTIVITY_ZONE')).toBe(true);
  });

  it('播种前会清空超级租户平台字典', () => {
    expect(platformSeed).toContain('wipeSuperTenantPlatformDict');
  });
});
