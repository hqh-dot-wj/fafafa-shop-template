#!/usr/bin/env node
/**
 * check-repo-artifacts.mjs
 * 阻止日志、grep 输出、临时产物进入版本库。
 * 用法：node scripts/check-repo-artifacts.mjs [--staged|--all]
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/** 已知历史债务路径。完成索引清理后应保持为空。 */
const KNOWN_DEBT = new Set([]);

/** 禁止提交的路径模式（顺序优先，命中即报）。 */
export const FORBIDDEN = [
  { pattern: /^logs\//, reason: '运行日志目录；加入 .gitignore 并执行 git rm --cached' },
  { pattern: /^upload\/(?!\.gitkeep$|README\.md$)/, reason: '本地上传产物；不应进入版本库' },
  { pattern: /^\.codex\/tmp\//, reason: '.codex/tmp 是临时目录，禁止提交' },
  { pattern: /^\.codex\/runtime-logs\//, reason: '.codex/runtime-logs 是运行数据，禁止提交' },
  { pattern: /(^|\/)grep_output\.[^/]*$/, reason: 'grep 临时输出文件；运行后应删除，不要提交' },
  { pattern: /\.(log|log\.\d+|log\.gz|log\.zip)$/, reason: '日志文件；加入 .gitignore 并执行 git rm --cached' },
  { pattern: /\.tmp$/, reason: '临时文件；不应提交' },
];

function runGit(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export function normalizePath(p) {
  return p.replaceAll('\\', '/');
}

function getFiles(mode) {
  if (mode === 'staged') {
    const out = runGit(['diff', '--staged', '--name-only', '--diff-filter=ACMR']);
    return out ? out.split(/\r?\n/).filter(Boolean) : [];
  }
  const out = runGit(['ls-files']);
  return out ? out.split(/\r?\n/).filter(Boolean) : [];
}

/** 检查单个文件路径是否命中禁止模式。返回原因字符串，未命中返回 null。 */
export function checkFile(filePath) {
  const normalized = normalizePath(filePath);
  for (const { pattern, reason } of FORBIDDEN) {
    if (pattern.test(normalized)) {
      return reason;
    }
  }
  return null;
}

export function loadArtifactReport({ mode = 'all' } = {}) {
  const files = getFiles(mode);
  const violations = [];
  const knownDebt = [];

  for (const file of files) {
    const normalized = normalizePath(file);
    const reason = checkFile(normalized);
    if (!reason) continue;

    if (KNOWN_DEBT.has(normalized)) {
      knownDebt.push({ file: normalized, reason });
    } else {
      violations.push({ file: normalized, reason });
    }
  }

  return { mode, files, violations, knownDebt };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  return { mode: args.includes('--staged') ? 'staged' : 'all' };
}

export function main(argv = process.argv) {
  const { mode } = parseArgs(argv);
  const report = loadArtifactReport({ mode });

  console.log('--- Repo Artifacts 校验结果 ---');

  if (report.knownDebt.length > 0) {
    console.warn(`⚠ 已知历史债务（${report.knownDebt.length} 项，等待清理）：`);
    for (const v of report.knownDebt) {
      console.warn(`  ~ ${v.file}`);
    }
    console.warn('  清理：git rm --cached <file> 并加入 .gitignore，完成后从 KNOWN_DEBT 移除');
  }

  if (report.violations.length === 0) {
    console.log(`✓ 无新 artifact 违规（模式: ${mode}，扫描: ${report.files.length} 文件）`);
    return { ok: true, report };
  }

  console.error(`\n✗ 发现 ${report.violations.length} 处新 artifact 违规：`);
  for (const v of report.violations) {
    console.error(`  ${v.file}: ${v.reason}`);
  }
  console.error('\n修复方式：');
  console.error('  1. 将路径加入 .gitignore');
  console.error('  2. git rm --cached <file>');
  console.error('  3. 如确实需要版本跟踪，在脚本 KNOWN_DEBT 中登记并注明原因');

  return { ok: false, report };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = main();
  if (!result.ok) {
    process.exit(1);
  }
}
