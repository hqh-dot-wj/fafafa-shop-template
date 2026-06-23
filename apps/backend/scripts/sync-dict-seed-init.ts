import { DICT_GOVERNANCE_REGISTRY } from '@libs/common-constants';

export interface DictTypeSeedRow {
  dictId: number;
  dictName: string;
  dictType: string;
}

/**
 * 基于治理清单生成字典类型基础行（去重后）
 */
export function buildDictTypeRows(startDictId = 1): DictTypeSeedRow[] {
  const seen = new Set<string>();
  const rows: DictTypeSeedRow[] = [];
  let dictId = startDictId;

  for (const item of DICT_GOVERNANCE_REGISTRY) {
    if (seen.has(item.dictType)) {
      continue;
    }
    seen.add(item.dictType);
    rows.push({
      dictId,
      dictName: item.enumName,
      dictType: item.dictType,
    });
    dictId += 1;
  }

  return rows;
}

/**
 * 生成 init.sql 片段（仅 sys_dict_type 记录）
 */
export function buildDictTypeInsertSql(startDictId = 1): string {
  return buildDictTypeRows(startDictId)
    .map(
      (row) =>
        `INSERT INTO "public"."sys_dict_type" ("dict_id", "tenant_id", "dict_name", "dict_type", "status", "create_by", "create_time", "update_by", "update_time", "remark", "del_flag") VALUES (${row.dictId}, '000000', '${row.dictName}', '${row.dictType}', '0', 'admin', '2025-02-28 08:52:10', '', NULL, '字典治理自动同步', '0');`,
    )
    .join('\n');
}

if (process.argv[1] && process.argv[1].endsWith('sync-dict-seed-init.ts')) {
  // 仅用于人工比对，默认不直接改文件
  // eslint-disable-next-line no-console
  console.log(buildDictTypeInsertSql(1));
}
