import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { EXEC_PLAN_FILE_THRESHOLD } from './harness-manifest.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoots = ['apps/backend/', 'apps/admin-web/', 'apps/miniapp-client/'];

function normalize(file) {
  return file.replaceAll('\\', '/');
}

function readGitLines(args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) {
    return [];
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveBaseRef() {
  for (const ref of ['origin/main', 'origin/master', 'main', 'master']) {
    const probe = spawnSync('git', ['rev-parse', '--verify', ref], { cwd: repoRoot, encoding: 'utf8' });
    if (probe.status === 0) {
      return ref;
    }
  }
  return 'HEAD';
}

/**
 * @returns {string[]}
 */
export function changedFilesAgainstBase(baseRef = resolveBaseRef()) {
  const diff = readGitLines(['diff', '--name-only', `${baseRef}...HEAD`, '--']);
  if (diff.length > 0) {
    return [...new Set(diff.map(normalize))];
  }
  return [...new Set(readGitLines(['diff', '--name-only', 'HEAD', '--']).map(normalize))];
}

export function hasActiveExecPlan(rootDir = repoRoot) {
  const activeDir = path.join(rootDir, 'docs/exec-plans/active');
  if (!fs.existsSync(activeDir)) {
    return false;
  }
  return fs.readdirSync(activeDir).some((name) => name.endsWith('.md') && name.toLowerCase() !== 'readme.md');
}

/**
 * @param {string[]} files
 */
export function analyzeExecPlanPresence(files, options = {}) {
  const threshold = options.threshold ?? EXEC_PLAN_FILE_THRESHOLD;
  const appFiles = files.filter((file) => appRoots.some((root) => file.startsWith(root)));
  const appsHit = new Set(appRoots.filter((root) => appFiles.some((file) => file.startsWith(root))));

  const needsPlan = appFiles.length >= threshold || appsHit.size >= 2;
  const hasPlan = hasActiveExecPlan(options.rootDir ?? repoRoot);

  return {
    needsPlan,
    hasPlan,
    appFileCount: appFiles.length,
    appsHit: [...appsHit],
    threshold,
    level: needsPlan && !hasPlan ? 'warn' : 'ok',
    message:
      needsPlan && !hasPlan
        ? `${appFiles.length} app files changed (threshold ${threshold}) without docs/exec-plans/active/*.md`
        : 'exec-plan presence check passed',
  };
}

export function main(argv = process.argv.slice(2)) {
  const strict = argv.includes('--strict');
  const files = changedFilesAgainstBase();
  const report = analyzeExecPlanPresence(files);

  if (report.level === 'warn') {
    console.warn(`[exec-plan] ⚠️  ${report.message}`);
    console.warn('       Create docs/exec-plans/active/<TASK-ID>.md or use no-exec-plan trailer/label.');
    if (strict) {
      return 1;
    }
    return 0;
  }

  console.log(`[exec-plan] OK (${report.appFileCount} app files vs threshold ${report.threshold})`);
  return 0;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
