#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const ALLOWED_EXTENSIONS = new Set(['.vue', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const QUALITY_GATE_ALLOW_PREFIX = 'quality-gate allow-';

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function indexToLine(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function collectFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  const entries = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      entries.push(...collectFiles(fullPath));
      continue;
    }
    if (ALLOWED_EXTENSIONS.has(path.extname(entry.name))) {
      entries.push(fullPath);
    }
  }
  return entries;
}

function hasAllowComment(content, allowKey) {
  return content.includes(`${QUALITY_GATE_ALLOW_PREFIX}${allowKey}`);
}

function extractValuesFromOptionBlock(content, startLine) {
  const lines = content.split(/\r?\n/);
  const startIndex = Math.max(0, startLine - 1);
  const source = lines.slice(startIndex).join('\n');
  const endIndex = source.indexOf('];');
  const block = endIndex >= 0 ? source.slice(0, endIndex + 2) : source;

  const values = [];
  const valuePattern = /value\s*:\s*['"]([^'"]+)['"]/g;
  valuePattern.lastIndex = 0;
  for (let match = valuePattern.exec(block); match; match = valuePattern.exec(block)) {
    values.push(match[1]);
  }
  return [...new Set(values)];
}

function extractOptionBlock(content, startLine) {
  const lines = content.split(/\r?\n/);
  const startIndex = Math.max(0, startLine - 1);
  const source = lines.slice(startIndex).join('\n');
  const endIndex = source.indexOf('];');
  return endIndex >= 0 ? source.slice(0, endIndex + 2) : source;
}

function matchesSemanticOptionName(name) {
  return /(status|state|stage|phase|result|role|type|mode|level)/i.test(name);
}

function looksLikeStableBusinessCode(value) {
  return /^[A-Z][A-Z0-9_]+$/.test(value);
}

export function detectHardcodedSemanticOptions(content) {
  if (hasAllowComment(content, 'semantic-options')) {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const matches = [];
  const pattern = /^\s*(?:export\s+)?const\s+([A-Za-z0-9_]+Options)\s*=\s*\[/;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(pattern);
    if (!match) continue;

    const name = match[1];
    const lineNumber = index + 1;
    const block = extractOptionBlock(content, lineNumber);
    const values = extractValuesFromOptionBlock(content, lineNumber);
    const stableCodeValues = values.filter(looksLikeStableBusinessCode);
    const hasInlineOptionLiteral = /label\s*:|value\s*:/.test(block);

    if (!hasInlineOptionLiteral && stableCodeValues.length === 0) {
      continue;
    }

    if (!matchesSemanticOptionName(name) && stableCodeValues.length < 2) {
      continue;
    }

    matches.push({
      name,
      line: lineNumber,
      values,
    });
  }

  return matches;
}

export function detectRawStatusTextUsage(content) {
  if (hasAllowComment(content, 'raw-status-text')) {
    return [];
  }

  const matches = [];
  const pattern = /(?:\.|\?\.)\s*([A-Za-z0-9_]*(?:status|state|role|type)[A-Za-z0-9_]*Text)\b/gi;

  pattern.lastIndex = 0;
  for (let match = pattern.exec(content); match; match = pattern.exec(content)) {
    matches.push({
      field: match[1],
      line: indexToLine(content, match.index),
    });
  }

  return matches;
}

export function detectTsNoCheck(content) {
  const matches = [];
  const pattern = /@ts-nocheck/g;

  pattern.lastIndex = 0;
  for (let match = pattern.exec(content); match; match = pattern.exec(content)) {
    matches.push({
      line: indexToLine(content, match.index),
    });
  }

  return matches;
}

export function detectSourceStringTest(content) {
  if (hasAllowComment(content, 'source-string-test')) {
    return [];
  }

  if (!content.includes('readFileSync(')) {
    return [];
  }

  const pattern = /readFileSync\(/g;
  pattern.lastIndex = 0;
  const first = pattern.exec(content);
  if (!first) return [];

  if (!content.includes('.toContain(') && !content.includes('.not.toContain(')) {
    return [];
  }

  return [{ line: indexToLine(content, first.index) }];
}

export function detectRequestConfigApiSpec(content) {
  if (hasAllowComment(content, 'request-config-test')) {
    return [];
  }

  const mockPattern = /vi\.mock\((['"])@\/service\/request\1/g;
  const mockMatch = mockPattern.exec(content);
  if (!mockMatch) {
    return [];
  }

  if (!/toMatchObject\(\s*\{[\s\S]{0,200}(url|method)\s*:/.test(content)) {
    return [];
  }

  return [{ line: indexToLine(content, mockMatch.index) }];
}

export function detectConditionalE2eFlow(content) {
  if (hasAllowComment(content, 'conditional-e2e')) {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const matches = [];
  const conditionalPatterns = [
    /\bif\s*\(\s*await\s+[\s\S]*?\.isVisible\s*\(/,
    /\bif\s*\(\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?(?:\.length)?\s*(?:>|>=|!==|!=)\s*0\s*\)/,
  ];

  lines.forEach((line, index) => {
    if (conditionalPatterns.some((pattern) => pattern.test(line))) {
      matches.push({ line: index + 1 });
    }
  });

  return dedupeByLine(matches).sort((left, right) => left.line - right.line);
}

export function detectTimedWaitE2eFlow(content) {
  if (hasAllowComment(content, 'timed-wait-e2e')) {
    return [];
  }

  const matches = [];
  const pattern = /\bwaitForTimeout\s*\(/g;

  pattern.lastIndex = 0;
  for (let match = pattern.exec(content); match; match = pattern.exec(content)) {
    matches.push({
      line: indexToLine(content, match.index),
    });
  }

  return dedupeByLine(matches);
}

export function detectLoopedDeleteCalls(content) {
  if (hasAllowComment(content, 'loop-delete')) {
    return [];
  }

  const matches = [];
  const patterns = [
    /Promise\.all\([\s\S]{0,200}?fetchDelete[A-Za-z0-9_]*\(/g,
    /\.forEach\([\s\S]{0,200}?fetchDelete[A-Za-z0-9_]*\(/g,
    /\.map\([\s\S]{0,200}?fetchDelete[A-Za-z0-9_]*\(/g,
    /for\s*\(\s*const[\s\S]{0,120}?of[\s\S]{0,240}?await\s+fetchDelete[A-Za-z0-9_]*\(/g,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(content); match; match = pattern.exec(content)) {
      matches.push({
        line: indexToLine(content, match.index),
      });
    }
  }

  return dedupeByLine(matches);
}

export function detectAwaitDbCallsInLoop(content) {
  if (hasAllowComment(content, 'await-db-loop')) {
    return [];
  }

  const pattern =
    /for\s*\(\s*const[\s\S]{0,120}?of[\s\S]{0,120}?\)\s*\{[\s\S]{0,500}?await[\s\S]{0,120}?(?:repo|Repo|prisma)\.[A-Za-z0-9_]+\(/g;
  const matches = [];

  pattern.lastIndex = 0;
  for (let match = pattern.exec(content); match; match = pattern.exec(content)) {
    matches.push({
      line: indexToLine(content, match.index),
    });
  }

  return dedupeByLine(matches);
}

export function detectPromiseAllWriteMap(content) {
  if (hasAllowComment(content, 'promise-all-write-map')) {
    return [];
  }

  const pattern =
    /Promise\.all\(\s*[\s\S]{0,80}?\.map\([\s\S]{0,120}?(?:repo|Repo|prisma)\.(?:create|createMany|update|updateMany|delete|deleteMany|upsert|findById|count|findMany|findFirst|findUnique)\(/g;
  const matches = [];

  pattern.lastIndex = 0;
  for (let match = pattern.exec(content); match; match = pattern.exec(content)) {
    matches.push({
      line: indexToLine(content, match.index),
    });
  }

  return dedupeByLine(matches);
}

function dedupeByLine(matches) {
  const seen = new Set();
  return matches.filter((match) => {
    const key = String(match.line);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isTestFile(filePath) {
  return /\.(spec|test)\.[cm]?[jt]sx?$/.test(filePath);
}

function isFrontendSource(filePath) {
  return filePath.startsWith('apps/admin-web/src/') || filePath.startsWith('apps/miniapp-client/src/');
}

function isFrontendRenderableFile(filePath) {
  return /\.(vue|tsx|jsx)$/.test(filePath);
}

function isBackendSource(filePath) {
  return filePath.startsWith('apps/backend/src/');
}

function isAdminApiSpec(filePath) {
  return filePath.startsWith('apps/admin-web/src/service/api/') && isTestFile(filePath);
}

function isAdminE2eFile(filePath) {
  return filePath.startsWith('apps/admin-web/e2e/') && /\.(?:ts|tsx)$/.test(filePath);
}

export function evaluateQualityGateFile(filePath, content) {
  const normalizedPath = normalizePath(filePath);
  const hits = [];

  if (isFrontendSource(normalizedPath) && !isTestFile(normalizedPath)) {
    for (const match of detectHardcodedSemanticOptions(content)) {
      hits.push({
        ruleId: 'hardcoded-semantic-options',
        line: match.line,
        message: `存在语义型硬编码选项数组 ${match.name}`,
      });
    }

    if (isFrontendRenderableFile(normalizedPath)) {
      for (const match of detectRawStatusTextUsage(content)) {
        hits.push({
          ruleId: 'raw-status-text',
          line: match.line,
          message: `直接使用原始状态文本字段 ${match.field}`,
        });
      }
    }

    for (const match of detectLoopedDeleteCalls(content)) {
      hits.push({
        ruleId: 'loop-delete-call',
        line: match.line,
        message: '检测到循环调用单条删除接口',
      });
    }
  }

  if (isTestFile(normalizedPath)) {
    for (const match of detectTsNoCheck(content)) {
      hits.push({
        ruleId: 'ts-nocheck-test',
        line: match.line,
        message: '测试文件不应使用 @ts-nocheck',
      });
    }

    for (const match of detectSourceStringTest(content)) {
      hits.push({
        ruleId: 'source-string-test',
        line: match.line,
        message: '检测到源码字符串测试',
      });
    }

    if (isAdminApiSpec(normalizedPath)) {
      for (const match of detectRequestConfigApiSpec(content)) {
        hits.push({
          ruleId: 'request-config-api-spec',
          line: match.line,
          message: '检测到仅验证 request 配置的 API 测试',
        });
      }
    }
  }

  if (isAdminE2eFile(normalizedPath)) {
    for (const match of detectConditionalE2eFlow(content)) {
      hits.push({
        ruleId: 'conditional-e2e-flow',
        line: match.line,
        message: 'E2E 流程存在条件跳过，可能在控件不可见或数据为空时空跑',
      });
    }

    for (const match of detectTimedWaitE2eFlow(content)) {
      hits.push({
        ruleId: 'timed-wait-e2e-flow',
        line: match.line,
        message: 'E2E 流程使用固定等待，优先改为 locator / response / 状态断言等待',
      });
    }
  }

  if (isBackendSource(normalizedPath) && !isTestFile(normalizedPath)) {
    for (const match of detectAwaitDbCallsInLoop(content)) {
      hits.push({
        ruleId: 'await-db-call-in-loop',
        line: match.line,
        message: '检测到循环中的数据库访问',
      });
    }

    for (const match of detectPromiseAllWriteMap(content)) {
      hits.push({
        ruleId: 'promise-all-write-map',
        line: match.line,
        message: '检测到 Promise.all(map(write)) 批量写模式',
      });
    }
  }

  return hits;
}

function resolveTargetFiles(mode, explicitFiles = [], workspaceRoot = root) {
  if (explicitFiles.length > 0) {
    return sanitizeTargetFiles(explicitFiles, workspaceRoot);
  }

  if (mode === 'all') {
    return sanitizeTargetFiles(
      [
        ...collectFiles(path.join(workspaceRoot, 'apps/admin-web/src')),
        ...collectFiles(path.join(workspaceRoot, 'apps/miniapp-client/src')),
        ...collectFiles(path.join(workspaceRoot, 'apps/backend/src')),
      ],
      workspaceRoot,
    );
  }

  if (mode === 'staged') {
    return sanitizeTargetFiles(
      readGitFileList(['diff', '--cached', '--name-only', '--diff-filter=ACMRTUXB'], workspaceRoot),
      workspaceRoot,
    );
  }

  if (mode === 'branch') {
    const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], workspaceRoot);
    if (upstream) {
      const upstreamFiles = readGitFileList(['diff', '--name-only', `${upstream}...HEAD`], workspaceRoot);
      if (upstreamFiles.length > 0) {
        return sanitizeTargetFiles(upstreamFiles, workspaceRoot);
      }
    }

    const lastCommitFiles = readGitFileList(['diff', '--name-only', 'HEAD~1..HEAD'], workspaceRoot);
    return sanitizeTargetFiles(lastCommitFiles, workspaceRoot);
  }

  return [];
}

function sanitizeTargetFiles(files, workspaceRoot) {
  return [
    ...new Set(files.map((file) => normalizePath(path.isAbsolute(file) ? path.relative(workspaceRoot, file) : file))),
  ]
    .filter(
      (file) =>
        (file.startsWith('apps/admin-web/src/') ||
          file.startsWith('apps/admin-web/e2e/') ||
          file.startsWith('apps/miniapp-client/src/') ||
          file.startsWith('apps/backend/src/')) &&
        ALLOWED_EXTENSIONS.has(path.extname(file)),
    )
    .filter((file) => fs.existsSync(path.join(workspaceRoot, file)));
}

function runGit(args, workspaceRoot) {
  try {
    return execFileSync('git', args, { cwd: workspaceRoot, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function readGitFileList(args, workspaceRoot) {
  const output = runGit(args, workspaceRoot);
  if (!output) return [];
  return output.split(/\r?\n/).filter(Boolean);
}

export function loadQualityGateReport({ mode = 'all', files = [], workspaceRoot = root } = {}) {
  const targetFiles = resolveTargetFiles(mode, files, workspaceRoot);
  const violations = [];

  for (const filePath of targetFiles) {
    const fullPath = path.join(workspaceRoot, filePath);
    const content = readText(fullPath);
    const hits = evaluateQualityGateFile(filePath, content);
    if (hits.length > 0) {
      violations.push({
        filePath,
        hits,
      });
    }
  }

  return {
    mode,
    files: targetFiles,
    violations,
  };
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    mode: 'all',
    files: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--staged') {
      parsed.mode = 'staged';
      continue;
    }
    if (arg === '--branch') {
      parsed.mode = 'branch';
      continue;
    }
    if (arg === '--all') {
      parsed.mode = 'all';
      continue;
    }
    if (arg === '--files') {
      parsed.files = args.slice(index + 1);
      break;
    }
  }

  return parsed;
}

export function main(argv = process.argv, workspaceRoot = root) {
  const { mode, files } = parseCliArgs(argv);
  const report = loadQualityGateReport({ mode, files, workspaceRoot });

  console.log('--- Quality Gates 校验结果 ---');
  if (report.files.length === 0) {
    console.log('✓ 无待校验文件');
    return { ok: true, report };
  }

  if (report.violations.length === 0) {
    console.log(`✓ 质量门禁检查通过（模式: ${mode}，文件数: ${report.files.length}）`);
    return { ok: true, report };
  }

  for (const violation of report.violations) {
    console.log(`✗ ${violation.filePath}`);
    for (const hit of violation.hits) {
      console.log(`  - [${hit.ruleId}] L${hit.line}: ${hit.message}`);
    }
  }

  return { ok: false, report };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = main();
  if (!result.ok) {
    process.exit(1);
  }
}
