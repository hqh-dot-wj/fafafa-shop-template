#!/usr/bin/env node
/**
 * check-forwardref-reason
 *
 * 扫描 apps/backend/src/**\/*.ts 中所有 `forwardRef(() => XxxModule)` 调用，
 * 检查上方是否有 `// @reason:` 注释。
 *
 * 配合 apps/backend/AGENTS.md §循环依赖规避 硬规则 #1。
 * 当前为 warn-only。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND_SRC = path.join(repoRoot, 'apps/backend/src');

const FORWARDREF_RE = /forwardRef\s*\(/g;
const MODULE_TARGET_RE = /[A-Z][A-Za-z0-9_]*Module\b/;
const REASON_RE = /\/\/\s*@reason\s*:/;

export function listTsFiles(dir, acc = []) {
  if (!statSync(dir, { throwIfNoEntry: false })) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listTsFiles(full, acc);
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.test.ts')
    ) {
      acc.push(full);
    }
  }
  return acc;
}

function findMatchingParen(content, openParenIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = openParenIndex; i < content.length; i += 1) {
    const ch = content[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function getLineIndex(lineStarts, index) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= index && (mid === lineStarts.length - 1 || lineStarts[mid + 1] > index)) {
      return mid;
    }
    if (lineStarts[mid] > index) high = mid - 1;
    else low = mid + 1;
  }
  return 0;
}

function buildLineStarts(lines) {
  const starts = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  return starts;
}

export function findMissingReasons(content) {
  const findings = [];
  const lines = content.split('\n');
  const lineStarts = buildLineStarts(lines);
  const reportedLines = new Set();
  FORWARDREF_RE.lastIndex = 0;
  let match;
  while ((match = FORWARDREF_RE.exec(content))) {
    const openParenIndex = content.indexOf('(', match.index);
    const closeParenIndex = findMatchingParen(content, openParenIndex);
    if (closeParenIndex === -1) continue;
    const callText = content.slice(match.index, closeParenIndex + 1);
    FORWARDREF_RE.lastIndex = closeParenIndex + 1;
    if (!MODULE_TARGET_RE.test(callText)) continue;
    const lineIndex = getLineIndex(lineStarts, match.index);
    if (reportedLines.has(lineIndex)) continue;
    reportedLines.add(lineIndex);
    // Check the preceding 3 lines for @reason: comment
    const window = lines.slice(Math.max(0, lineIndex - 3), lineIndex).join('\n');
    if (!REASON_RE.test(window)) {
      findings.push({ line: lineIndex + 1, text: lines[lineIndex].trim() });
    }
  }
  return findings;
}

function main() {
  if (!statSync(BACKEND_SRC, { throwIfNoEntry: false })) {
    console.log('[check-forwardref-reason] skip — apps/backend/src not found');
    process.exit(0);
  }
  const files = listTsFiles(BACKEND_SRC);
  const allFindings = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const findings = findMissingReasons(content);
    if (findings.length > 0) {
      allFindings.push({ file: path.relative(repoRoot, file), findings });
    }
  }
  if (allFindings.length === 0) {
    console.log('[check-forwardref-reason] OK — 所有 forwardRef 调用上方都带 // @reason: 注释');
    process.exit(0);
  }
  console.warn('[check-forwardref-reason] 警告：以下 forwardRef 调用上方未发现 `// @reason:` 注释：\n');
  for (const entry of allFindings) {
    console.warn(`  ${entry.file}`);
    for (const f of entry.findings) {
      console.warn(`    ${entry.file}:${f.line}  ${f.text}`);
    }
  }
  console.warn('\n规则参见 apps/backend/AGENTS.md §循环依赖规避 硬规则 #1。');
  console.warn('当前为 warn-only，不阻断构建。');
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check-forwardref-reason.mjs')) {
  main();
}
