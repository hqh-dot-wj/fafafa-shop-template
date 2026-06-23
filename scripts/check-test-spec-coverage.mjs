#!/usr/bin/env node
/**
 * check-test-spec-coverage.mjs
 * 扫描 backend *.spec.ts 文件，检查是否包含 TEST_SPEC_PROTOCOL.md Phase 1/4 所要求的
 * describe 块：'invariants' 和 'boundary conditions'。
 * 当前为 warn-only，不阻断构建。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
export const BACKEND_SRC = path.join(root, 'apps/backend/src');

/** 仅检查有一定规模的 spec 文件（超过 N 行），小文件通常是胶水代码 */
export const MIN_LINES_TO_CHECK = 30;

export const REQUIRED_DESCRIBE_BLOCKS = [
  { id: 'invariants', pattern: /describe\s*\(\s*['"`]invariants['"`]/, label: "describe('invariants')" },
  {
    id: 'boundary',
    pattern: /describe\s*\(\s*['"`]boundary conditions['"`]/,
    label: "describe('boundary conditions')",
  },
];

export function isSpecFile(filePath) {
  return (
    filePath.endsWith('.spec.ts') || (filePath.endsWith('.e2e-spec.ts') === false && filePath.endsWith('.spec.ts'))
  );
}

export function analyzeSpecFile(filePath, content) {
  const lineCount = content.split(/\r?\n/).length;
  if (lineCount < MIN_LINES_TO_CHECK) return null;

  const missing = REQUIRED_DESCRIBE_BLOCKS.filter(({ pattern }) => !pattern.test(content)).map(({ id }) => id);

  return missing.length > 0 ? { missing } : null;
}

function collectSpecFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectSpecFiles(full));
    } else if (entry.name.endsWith('.spec.ts')) {
      result.push(full);
    }
  }

  return result;
}

export function checkTestSpecCoverage({ dir = BACKEND_SRC } = {}) {
  const files = collectSpecFiles(dir);
  const fileViolations = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = analyzeSpecFile(filePath, content);
    if (result) {
      const relative = path.relative(root, filePath).replace(/\\/g, '/');
      fileViolations.push({ file: relative, missing: result.missing });
    }
  }

  return { scanned: files.length, fileViolations };
}

export function main() {
  console.log('--- Test Spec Coverage (TEST_SPEC_PROTOCOL Phase 1+4) 扫描 ---');

  const { scanned, fileViolations } = checkTestSpecCoverage();
  console.log(`扫描 spec 文件数: ${scanned}`);

  if (fileViolations.length === 0) {
    console.log('✓ 所有合规规模的 spec 文件均包含 invariants 和 boundary conditions 块');
    return { ok: true, warnings: 0 };
  }

  for (const { file, missing } of fileViolations) {
    const labels = missing.map((id) => REQUIRED_DESCRIBE_BLOCKS.find((b) => b.id === id)?.label ?? id);
    console.warn(`  ⚠ ${file}`);
    console.warn(`    → 缺少: ${labels.join(', ')}`);
    console.warn(`    → 按 docs/governance/TEST_SPEC_PROTOCOL.md Phase 1/4 补充对应 describe 块`);
  }

  console.warn(`\n⚠ ${fileViolations.length} 个 spec 文件缺少规格 describe 块（当前为 warn-only）`);
  return { ok: true, warnings: fileViolations.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
