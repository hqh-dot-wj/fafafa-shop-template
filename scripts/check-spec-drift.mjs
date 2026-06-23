#!/usr/bin/env node
/**
 * check-spec-drift.mjs
 *
 * 检测后端 Service / Processor / Scheduler / Adapter 文件改动后，
 * 对应 spec 文件是否同步更新。
 *
 * 退出码：
 *   0 — 无漂移，或仅警告（spec 存在但未同步改动）
 *   1 — 严重漂移：spec 文件完全缺失
 *
 * 用法：
 *   node scripts/check-spec-drift.mjs                     # 检查当前分支改动
 *   node scripts/check-spec-drift.mjs --branch            # 同上
 *   node scripts/check-spec-drift.mjs --staged            # 只看暂存区
 *   node scripts/check-spec-drift.mjs path/to/file.ts ... # 指定文件列表
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 需要检查共演的后端源文件后缀模式
const IMPL_PATTERNS = [/\.service\.ts$/, /\.processor\.ts$/, /\.scheduler\.ts$/, /\.adapter\.ts$/];

function normalizePath(file) {
  return file.replaceAll('\\', '/').replace(/^\.\//, '');
}

function gitLines(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function hasHead() {
  return spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: repoRoot, stdio: 'pipe' }).status === 0;
}

function changedFiles({ stagedOnly = false } = {}) {
  if (stagedOnly) {
    return gitLines(['diff', '--name-only', '--cached', '--diff-filter=ACMR', '--']);
  }
  if (!hasHead()) {
    return gitLines(['ls-files', '--others', '--modified', '--exclude-standard']);
  }
  return [
    ...gitLines(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD', '--']),
    ...gitLines(['diff', '--name-only', '--cached', '--diff-filter=ACMR', '--']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ];
}

function specPath(implFile) {
  for (const pattern of IMPL_PATTERNS) {
    if (pattern.test(implFile)) {
      return implFile.replace(pattern, (m) => m.replace('.ts', '.spec.ts'));
    }
  }
  return null;
}

const specFileCache = new Map();

function moduleRoot(file) {
  const parts = normalizePath(file).split('/');
  const moduleIndex = parts.indexOf('module');
  if (moduleIndex >= 0 && parts.length > moduleIndex + 2) {
    return parts.slice(0, moduleIndex + 2).join('/');
  }
  return path.posix.dirname(normalizePath(file));
}

function collectSpecFiles(dir) {
  const normalizedDir = normalizePath(dir);
  if (specFileCache.has(normalizedDir)) {
    return specFileCache.get(normalizedDir);
  }

  const absoluteDir = path.join(repoRoot, normalizedDir);
  const result = [];
  if (!existsSync(absoluteDir)) {
    specFileCache.set(normalizedDir, result);
    return result;
  }

  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.name.endsWith('.spec.ts')) {
        result.push(normalizePath(path.relative(repoRoot, absolute)));
      }
    }
  };

  visit(absoluteDir);
  specFileCache.set(normalizedDir, result);
  return result;
}

function directCandidateSpecs(implFile, spec) {
  const candidates = [spec];
  const specFileName = path.posix.basename(spec);
  const root = moduleRoot(implFile);
  let dir = path.posix.dirname(implFile);

  while (dir.startsWith(root)) {
    candidates.push(`${dir}/__tests__/${specFileName}`);
    if (dir === root) break;
    dir = path.posix.dirname(dir);
  }

  return [...new Set(candidates)].filter((candidate) => existsSync(path.join(repoRoot, candidate)));
}

function importSpecifiers(content) {
  const specifiers = [];
  const pattern = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
  let match;
  while ((match = pattern.exec(content))) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

function resolveSpecifier(specFile, specifier) {
  if (specifier.startsWith('.')) {
    return normalizePath(path.relative(repoRoot, path.resolve(repoRoot, path.dirname(specFile), specifier)));
  }
  if (specifier.startsWith('src/')) {
    return normalizePath(path.join('apps/backend', specifier));
  }
  return null;
}

function specReferencesImpl(specFile, implFile) {
  const content = readFileSync(path.join(repoRoot, specFile), 'utf8');
  for (const specifier of importSpecifiers(content)) {
    const resolved = resolveSpecifier(specFile, specifier);
    if (!resolved) continue;

    const candidates = [resolved, `${resolved}.ts`, `${resolved}/index.ts`];
    if (candidates.includes(implFile)) {
      return true;
    }
  }
  return false;
}

function referencingSpecCandidates(implFile) {
  return collectSpecFiles(moduleRoot(implFile)).filter((specFile) => specReferencesImpl(specFile, implFile));
}

function existingSpecCandidates(implFile, spec) {
  return [...new Set([...directCandidateSpecs(implFile, spec), ...referencingSpecCandidates(implFile)])];
}

export function checkSpecDrift(files) {
  const normalized = [...new Set(files.map(normalizePath))];
  const changedSet = new Set(normalized);

  const missing = [];
  const unsynced = [];

  for (const file of normalized) {
    if (!file.startsWith('apps/backend/src/')) continue;
    if (file.includes('.spec.')) continue;

    const isImpl = IMPL_PATTERNS.some((p) => p.test(file));
    if (!isImpl) continue;

    const spec = specPath(file);
    if (!spec) continue;

    const candidates = existingSpecCandidates(file, spec);

    if (candidates.length === 0) {
      missing.push({ impl: file, spec });
    } else if (!candidates.some((candidate) => changedSet.has(candidate))) {
      unsynced.push({ impl: file, spec: candidates[0] });
    }
  }

  return { missing, unsynced };
}

function main(argv = process.argv.slice(2)) {
  const stagedOnly = argv.includes('--staged');
  const positional = argv.filter((a) => !a.startsWith('--'));

  const files = positional.length > 0 ? positional : changedFiles({ stagedOnly });

  if (files.length === 0) {
    console.log('[spec-drift] 没有变更文件，跳过检查。');
    return;
  }

  const { missing, unsynced } = checkSpecDrift(files);

  if (missing.length === 0 && unsynced.length === 0) {
    console.log('[spec-drift] 检查通过，无规格漂移。');
    return;
  }

  let hasError = false;

  if (missing.length > 0) {
    hasError = true;
    console.error('\n[spec-drift] ❌ 以下实现文件缺少对应 spec（需要补充）：');
    for (const { impl, spec } of missing) {
      console.error(`  ${impl}`);
      console.error(`  └─ 缺失: ${spec}`);
    }
  }

  if (unsynced.length > 0) {
    console.warn('\n[spec-drift] ⚠️  以下实现文件已修改，但 spec 未同步更新：');
    for (const { impl, spec } of unsynced) {
      console.warn(`  ${impl}`);
      console.warn(`  └─ 未更新: ${spec}`);
    }
    console.warn('  → 请确认行为变更已在 spec 中覆盖，或在 PR 说明中说明无需更新的理由。');
  }

  if (hasError) {
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
