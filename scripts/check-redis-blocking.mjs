#!/usr/bin/env node
/**
 * check-redis-blocking.mjs
 * 扫描后端业务代码中的 Redis 阻塞/危险操作。
 * 当前为 warn-only，不阻断构建。
 *
 * 覆盖：redis.keys()、LRANGE 0 -1（无上限）、KEYS 命令字符串
 * 排除：*.spec.ts、*.e2e-spec.ts、*.test.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
export const BACKEND_SRC = path.join(root, 'apps/backend/src');

export const EXCLUDED_FILE_PATTERNS = [/\.spec\.ts$/, /\.e2e-spec\.ts$/, /\.test\.ts$/];

/** 这些规则 id 的违规直接 fail（无合法业务用途，误报率极低） */
export const FAIL_RULE_IDS = new Set(['redis-keys']);

export const REDIS_BLOCKING_PATTERNS = [
  {
    id: 'redis-keys',
    pattern: /(?:\b(?:redis|redisService|client)\b|this\.(?:redis|redisService|client))\s*\.\s*keys\s*\(/i,
    message: 'redis.keys() 在大 keyspace 下会阻塞 Redis — 改用 SCAN 迭代游标',
  },
  {
    id: 'lrange-unlimited',
    pattern: /\.lrange\s*\([^)]*,\s*0\s*,\s*-\s*1\s*\)/i,
    message: 'LRANGE 0 -1 读取全量列表无上限 — 加 limit 参数或改用分页游标',
  },
  {
    id: 'keys-command-string',
    pattern: /['"`]KEYS\s+/,
    message: 'KEYS 命令字符串 — Redis KEYS 会阻塞，改用 SCAN',
  },
];

export function isExcludedFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return EXCLUDED_FILE_PATTERNS.some((p) => p.test(normalized));
}

export function scanFileContent(filePath, content) {
  const lines = content.split(/\r?\n/);
  const violations = [];

  for (const { id, pattern, message } of REDIS_BLOCKING_PATTERNS) {
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (pattern.test(line)) {
        violations.push({ id, line: i + 1, text: trimmed.slice(0, 120), message });
      }
    });
  }

  return violations;
}

function collectTsFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts') && !isExcludedFile(full)) {
      result.push(full);
    }
  }

  return result;
}

export function checkRedisBlocking({ dir = BACKEND_SRC } = {}) {
  const files = collectTsFiles(dir);
  const fileViolations = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const violations = scanFileContent(filePath, content);
    if (violations.length > 0) {
      const relative = path.relative(root, filePath).replace(/\\/g, '/');
      fileViolations.push({ file: relative, violations });
    }
  }

  return { scanned: files.length, fileViolations };
}

export function main() {
  console.log('--- Redis Blocking 扫描 ---');

  const { scanned, fileViolations } = checkRedisBlocking();
  console.log(`扫描文件数: ${scanned}`);

  if (fileViolations.length === 0) {
    console.log('✓ 未发现 Redis 阻塞操作');
    return { ok: true, warnings: 0 };
  }

  let total = 0;
  for (const { file, violations } of fileViolations) {
    for (const v of violations) {
      console.warn(`  ⚠ ${file}:${v.line}  [${v.id}]`);
      console.warn(`    ${v.text}`);
      console.warn(`    → ${v.message}`);
      total++;
    }
  }

  const failCount = fileViolations.reduce(
    (n, { violations }) => n + violations.filter((v) => FAIL_RULE_IDS.has(v.id)).length,
    0,
  );
  const warnCount = total - failCount;

  if (failCount > 0) {
    console.error(`\n✗ 发现 ${failCount} 处禁止规则违规（阻断构建）`);
  }
  if (warnCount > 0) {
    console.warn(`⚠ 另有 ${warnCount} 处 warn-only 规则违规`);
  }

  return { ok: failCount === 0, warnings: warnCount, failures: failCount };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = main();
  if (!result.ok) process.exit(1);
}
