/**
 * 扫描 apps/backend/src 中带 tenantId 的 Prisma delegate 读调用，
 * 且邻近行未出现 readWhereForDelegate / scopeReadWhere / applyTenantFilter。
 * 排除 *.spec.ts / *.test.ts；extends BaseRepository 且使用 this.delegate 的读调用视为已走仓储（跳过）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');

const TENANT_DELEGATES = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'tenantId') && m.name !== 'SysTenant')
    .map((m) => m.name.charAt(0).toLowerCase() + m.name.slice(1)),
);

const PRISMA_READ = /(?:\bthis\.)?\bprisma\.(\w+)\.(findMany|findFirst|findUnique|count|aggregate|groupBy)\s*\(/g;
const TX_READ = /\b(tx|prismaTx)\.(\w+)\.(findMany|findFirst|findUnique|count|aggregate|groupBy)\s*\(/g;
function walkTs(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTs(p, out);
    else if (ent.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

function shouldSkipFile(rel) {
  if (rel.endsWith('.spec.ts') || rel.endsWith('.test.ts')) return true;
  if (rel.includes(`${path.sep}test-utils${path.sep}`)) return true;
  return false;
}

function windowText(lines, i, radius = 8) {
  const parts = [];
  for (let j = Math.max(0, i - radius); j <= Math.min(lines.length - 1, i + radius); j++) {
    parts.push(lines[j]);
  }
  return parts.join('\n');
}

function hasTenantMergeHint(text) {
  return (
    text.includes('readWhereForDelegate') ||
    text.includes('scopeReadWhere') ||
    text.includes('applyTenantFilter') ||
    text.includes('addTenantFilter') ||
    /\bscopedWhere\b/.test(text) ||
    /\bscopedReadWhere\b/.test(text) ||
    /\btenantScopedWhere\b/.test(text)
  );
}

function main() {
  const files = walkTs(SRC).filter((p) => !shouldSkipFile(path.relative(SRC, p)));
  const findings = [];

  for (const filePath of files) {
    const rel = path.relative(SRC, filePath).split(path.sep).join('/');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const win = windowText(lines, i);
      if (line.includes('//') && line.trim().startsWith('//')) continue;

      let m;
      PRISMA_READ.lastIndex = 0;
      while ((m = PRISMA_READ.exec(line))) {
        const [, delegate, method] = m;
        if (!TENANT_DELEGATES.has(delegate)) continue;
        if (rel.includes('common/tenant/tenant.helper')) continue;
        if (hasTenantMergeHint(win)) continue;
        findings.push({
          file: rel,
          line: i + 1,
          delegate,
          method,
          kind: 'prisma',
          preview: line.trim().slice(0, 140),
        });
      }

      TX_READ.lastIndex = 0;
      while ((m = TX_READ.exec(line))) {
        const [, , delegate, method] = m;
        if (!TENANT_DELEGATES.has(delegate)) continue;
        if (hasTenantMergeHint(win)) continue;
        findings.push({
          file: rel,
          line: i + 1,
          delegate,
          method,
          kind: 'tx',
          preview: line.trim().slice(0, 140),
        });
      }
    }
  }

  const byFile = new Map();
  for (const f of findings) {
    const arr = byFile.get(f.file) || [];
    arr.push(f);
    byFile.set(f.file, arr);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    note: '启发式：邻近 ±8 行内无 readWhereForDelegate / scopeReadWhere / applyTenantFilter / scopedWhere 等则命中；findUnique 仍受 Prisma 扩展事后校验。',
    tenantDelegateCount: TENANT_DELEGATES.size,
    findingCount: findings.length,
    byMethod: findings.reduce((acc, f) => {
      acc[f.method] = (acc[f.method] || 0) + 1;
      return acc;
    }, {}),
    byFile: Object.fromEntries([...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
  };

  const outPath = path.join(__dirname, '..', 'reports', 'tenant-prisma-read-scan.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outPath} (findings: ${findings.length})`);
}

main();
