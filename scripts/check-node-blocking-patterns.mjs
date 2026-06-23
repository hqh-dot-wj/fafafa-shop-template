#!/usr/bin/env node
/**
 * check-node-blocking-patterns.mjs
 * 扫描后端业务代码中的 Node.js 同步阻塞模式。
 * 当前为 warn-only，不阻断构建。
 *
 * 覆盖：readFileSync、hashSync/bcrypt.hashSync、pbkdf2Sync、execSync
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
export const FAIL_RULE_IDS = new Set(['hashSync']);

export const BLOCKING_PATTERNS = [
  {
    id: 'readFileSync',
    pattern: /\breadFileSync\b/,
    message: 'readFileSync 阻塞事件循环 — 改用 fs.promises.readFile 或移至启动初始化阶段',
  },
  {
    id: 'hashSync',
    pattern: /\bhashSync\b/,
    message: 'hashSync/bcrypt.hashSync 是 CPU 密集型阻塞调用 — 改用 hash() 异步版本',
  },
  {
    id: 'pbkdf2Sync',
    pattern: /\bpbkdf2Sync\b/,
    message: 'pbkdf2Sync 是 CPU 密集型阻塞调用 — 改用 crypto.pbkdf2() 异步版本',
  },
  {
    id: 'execSync',
    pattern: /\bexecSync\b/,
    message: 'execSync 阻塞事件循环 — 改用 execFile/spawn 异步版本',
  },
];

export function isExcludedFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return EXCLUDED_FILE_PATTERNS.some((p) => p.test(normalized));
}

export function scanFileContent(filePath, content) {
  const lines = content.split(/\r?\n/);
  const violations = [];

  for (const { id, pattern, message } of BLOCKING_PATTERNS) {
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

export function checkNodeBlockingPatterns({ dir = BACKEND_SRC } = {}) {
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
  console.log('--- Node Blocking Patterns 扫描 ---');

  const { scanned, fileViolations } = checkNodeBlockingPatterns();
  console.log(`扫描文件数: ${scanned}`);

  if (fileViolations.length === 0) {
    console.log('✓ 未发现阻塞模式');
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
