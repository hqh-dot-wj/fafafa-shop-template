#!/usr/bin/env node
/**
 * check-contract-exceptions.mjs
 * 扫描 libs/common-types/src/ 中的手写契约例外文件，
 * 要求每个文件具备：① 说明存在原因的文件头注释，② 过期/对齐条件信号。
 * OpenAPI 生成文件（api.d.ts）自动跳过。
 *
 * 用法：node scripts/check-contract-exceptions.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
export const TYPES_DIR = path.join(root, 'libs/common-types/src');
export const APP_CONTRACT_DIRS = [
  path.join(root, 'apps/admin-web/src/service/api'),
  path.join(root, 'apps/miniapp-client/src/api'),
];

/** OpenAPI 自动生成文件，不是契约例外，跳过检查。 */
export const GENERATED_FILES = new Set(['api.d.ts']);
export const APP_CONTRACT_HINTS = ['@libs/common-types', 'OpenAPI', '未进入 @libs/common-types', '保留本地类型'];

/**
 * 文件头注释中必须出现的关键词之一，证明作者知道这是手写例外。
 * 大小写不敏感。
 */
export const REASON_KEYWORDS = ['OpenAPI', '后端', 'VO', 'DTO', 'schema', 'contract', '手写', '对齐', 'manual'];

/**
 * 文件内任意位置必须出现的过期信号之一，说明何时可以切换到生成类型。
 * 区分大小写。
 */
export const EXPIRY_SIGNALS = [
  '待后端',
  'TODO',
  '切换',
  'when backend',
  'after backend',
  '@expires',
  '替换',
  'generate-types',
];

/**
 * 提取文件开头的注释块（最多扫描 10 行）。
 * 遇到空行且不在块注释内时停止，只取第一个连续注释段。
 */
export function extractFileHeader(content) {
  const lines = content.split(/\r?\n/);
  const headerLines = [];
  let inBlock = false;

  for (const line of lines.slice(0, 10)) {
    const trimmed = line.trim();

    if (trimmed === '') {
      if (!inBlock) break;
      continue;
    }

    if (!inBlock && trimmed.startsWith('/**')) {
      inBlock = true;
      headerLines.push(trimmed);
      if (trimmed.endsWith('*/') && trimmed.length > 4) break;
      continue;
    }

    if (inBlock) {
      headerLines.push(trimmed);
      if (trimmed.endsWith('*/')) break;
      continue;
    }

    if (trimmed.startsWith('//')) {
      headerLines.push(trimmed);
      continue;
    }

    break;
  }

  return headerLines.join('\n');
}

/**
 * 检查单个契约文件。
 * 返回 null 表示通过，返回对象表示存在问题。
 */
export function checkContractFile(filePath, content) {
  const fileName = path.basename(filePath);
  if (GENERATED_FILES.has(fileName)) return null;

  const issues = [];
  const header = extractFileHeader(content);

  const hasReason = REASON_KEYWORDS.some((kw) => header.toLowerCase().includes(kw.toLowerCase()));
  if (!hasReason) {
    issues.push(`文件头缺少原因说明（需包含以下关键词之一：${REASON_KEYWORDS.join('、')}）`);
  }

  const hasExpiry = EXPIRY_SIGNALS.some((signal) => content.includes(signal));
  if (!hasExpiry) {
    issues.push(`缺少过期/对齐信号（需包含以下关键词之一：${EXPIRY_SIGNALS.join('、')}）`);
  }

  return issues.length > 0 ? { fileName, issues } : null;
}

export function isAppContractExceptionCandidate(filePath, content) {
  const normalizedPath = filePath.split(path.sep).join('/');
  const inSupportedDir = APP_CONTRACT_DIRS.some((dirPath) =>
    normalizedPath.startsWith(dirPath.split(path.sep).join('/')),
  );

  if (!inSupportedDir) return false;

  const header = extractFileHeader(content);
  const hasLocalContractType =
    /export\s+interface\s+[A-Z]\w*/.test(content) ||
    /export\s+type\s+[A-Z]\w*\s*=\s*(?:Omit<|Partial<|Pick<|Record<|[^;\n]*&\s*\{|{)/.test(content);
  if (!hasLocalContractType) return false;

  return APP_CONTRACT_HINTS.some((hint) => header.includes(hint));
}

export function checkAppContractFile(filePath, content) {
  if (!isAppContractExceptionCandidate(filePath, content)) return null;

  const issues = [];
  const header = extractFileHeader(content);
  const fileName = path.relative(root, filePath).split(path.sep).join('/');

  const hasReason = REASON_KEYWORDS.some((kw) => header.toLowerCase().includes(kw.toLowerCase()));
  if (!hasReason) {
    issues.push(`文件头缺少原因说明（需包含以下关键词之一：${REASON_KEYWORDS.join('、')}）`);
  }

  const hasExpiry = EXPIRY_SIGNALS.some((signal) => content.includes(signal));
  if (!hasExpiry) {
    issues.push(`缺少过期/对齐信号（需包含以下关键词之一：${EXPIRY_SIGNALS.join('、')}）`);
  }

  return issues.length > 0 ? { fileName, issues } : null;
}

function collectFiles(dirPath, extensions) {
  if (!fs.existsSync(dirPath)) return [];

  const files = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const resolvedPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(resolvedPath, extensions));
      continue;
    }

    if (extensions.some((extension) => entry.name.endsWith(extension))) {
      files.push(resolvedPath);
    }
  }

  return files;
}

export function loadContractExceptionsReport({ dir = TYPES_DIR } = {}) {
  const typeFiles = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.d.ts') && !GENERATED_FILES.has(f))
    : [];
  const appFiles = APP_CONTRACT_DIRS.flatMap((dirPath) => collectFiles(dirPath, ['.ts']));
  const files = [
    ...typeFiles.map((fileName) => path.join(dir, fileName)),
    ...appFiles.filter((filePath) => isAppContractExceptionCandidate(filePath, fs.readFileSync(filePath, 'utf8'))),
  ];

  const violations = [];
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = filePath.endsWith('.d.ts')
      ? checkContractFile(filePath, content)
      : checkAppContractFile(filePath, content);
    if (result) violations.push(result);
  }

  return {
    files: files.map((filePath) =>
      filePath.startsWith(dir) ? path.basename(filePath) : path.relative(root, filePath).split(path.sep).join('/'),
    ),
    violations,
  };
}

export function main() {
  const report = loadContractExceptionsReport();

  console.log('--- Contract Exceptions 校验结果 ---');

  if (report.files.length === 0) {
    console.log('✓ 无手写契约例外文件');
    return { ok: true, report };
  }

  const okCount = report.files.length - report.violations.length;
  if (okCount > 0) {
    console.log(`✓ ${okCount} 个契约例外文件文档完整`);
  }

  if (report.violations.length === 0) {
    console.log(`✓ 所有 ${report.files.length} 个手写契约例外均有原因说明与过期信号`);
    return { ok: true, report };
  }

  console.error(`\n✗ ${report.violations.length} 个契约例外文件文档不完整：`);
  for (const v of report.violations) {
    console.error(`  ${v.fileName}:`);
    for (const issue of v.issues) {
      console.error(`    - ${issue}`);
    }
  }
  console.error('\n修复方式：');
  console.error('  1. 在文件头加 /** ... */ 注释，说明为何不能从 OpenAPI 生成（含"后端"/"VO"/"DTO"等关键词）');
  console.error('  2. 对每个手写 interface/type 加内联注释，说明何时切换到生成类型（"待后端..."/"切换至 schema"）');
  console.error('  3. 参考 libs/common-types/src/finance.d.ts 的文档格式');

  return { ok: false, report };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = main();
  if (!result.ok) {
    process.exit(1);
  }
}
