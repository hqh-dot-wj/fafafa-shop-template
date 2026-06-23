#!/usr/bin/env node
/**
 * 检测 docs/exec-plans/active/ 中超过 staleDays 未更新的 plan（默认 14 天）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultStaleDays = 14;

/**
 * @param {string} content
 */
function parseFrontmatterDate(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

/**
 * @param {string} filePath
 * @param {number} staleDays
 */
export function analyzePlanFile(filePath, staleDays = defaultStaleDays) {
  const content = fs.readFileSync(filePath, 'utf8');
  const taskId = parseFrontmatterDate(content, 'task_id') ?? path.basename(filePath, '.md');
  const status = parseFrontmatterDate(content, 'status') ?? 'active';
  const lastUpdated = parseFrontmatterDate(content, 'last_updated');

  let referenceDate;
  if (lastUpdated) {
    referenceDate = new Date(lastUpdated);
  } else {
    referenceDate = fs.statSync(filePath).mtime;
  }

  const ageMs = Date.now() - referenceDate.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const stale = ageDays > staleDays && status !== 'completed';

  return {
    taskId,
    status,
    filePath,
    ageDays: Math.floor(ageDays),
    stale,
    lastUpdated: referenceDate.toISOString().slice(0, 10),
  };
}

/**
 * @param {string} rootDir
 * @param {{ staleDays?: number }} [options]
 */
export function scanActivePlans(rootDir = repoRoot, options = {}) {
  const staleDays = options.staleDays ?? defaultStaleDays;
  const activeDir = path.join(rootDir, 'docs/exec-plans/active');
  if (!fs.existsSync(activeDir)) {
    return { plans: [], stale: [] };
  }

  const plans = fs
    .readdirSync(activeDir)
    .filter((name) => name.endsWith('.md') && name.toLowerCase() !== 'readme.md')
    .map((name) => analyzePlanFile(path.join(activeDir, name), staleDays));

  return {
    plans,
    stale: plans.filter((plan) => plan.stale),
  };
}

export function main(argv = process.argv.slice(2), rootDir = repoRoot) {
  const strict = argv.includes('--strict');
  const staleDaysArg = argv.find((arg) => arg.startsWith('--days='));
  const staleDays = staleDaysArg ? Number.parseInt(staleDaysArg.split('=')[1], 10) : defaultStaleDays;
  const { plans, stale } = scanActivePlans(rootDir, { staleDays });

  if (plans.length === 0) {
    console.log('[exec-plan-stale] No active plans in docs/exec-plans/active/');
    return 0;
  }

  console.log(`[exec-plan-stale] Scanned ${plans.length} active plan(s) (threshold ${staleDays} days)`);
  for (const plan of plans) {
    const label = plan.stale ? 'STALE' : 'OK';
    console.log(
      `  [${label}] ${plan.taskId} — ${plan.ageDays}d since ${plan.lastUpdated} (${path.relative(rootDir, plan.filePath)})`,
    );
  }

  if (stale.length > 0) {
    console.warn(
      '\n[exec-plan-stale] ⚠️  Move to docs/exec-plans/completed/ or update last_updated / phase_status=blocked',
    );
    return strict ? 1 : 0;
  }

  return 0;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
