#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { REQUIRED_DOCS, checkRequiredDocs } from './check-required-docs.mjs';
import { scanActivePlans } from './check-exec-plan-stale.mjs';
import { validateManifest } from './harness-manifest.mjs';

export const REQUIRED_ROOT_SCRIPTS = [
  'dev',
  'dev:backend',
  'dev:admin',
  'dev:h5',
  'fix:changed',
  'check:slice',
  'generate-types',
  'verify-monorepo',
  'verify:scripts',
  'verify:quality-gates',
  'verify:admin-view-types',
  'report:strict',
  'test:scripts',
  'harness:doctor',
  'harness:docs',
  'harness:maps',
  'harness:manifest',
  'harness:smoke',
  'harness:smoke:backend',
  'harness:smoke:admin',
  'harness:smoke:h5',
];

export const HARNESS_FILE_CHECKS = [
  {
    category: 'runtime',
    level: 'warn',
    path: 'apps/backend/public/openApi.json',
    name: 'backend OpenAPI artifact',
    fix: 'Run pnpm dev:backend until apps/backend/public/openApi.json reflects backend DTO/VO changes; inspect the target schema, then prefer pnpm --filter @libs/common-types contracts:generate. Root pnpm generate-types may run @apps/backend:build as a dependency, but build is not the OpenAPI refresh mechanism. On Windows automation, Start-Process should target pnpm.cmd rather than the pnpm shim.',
  },
  {
    category: 'admin-web',
    level: 'warn',
    path: 'docs/generated/admin-route-page-api-map.md',
    name: 'admin route/page API map',
    fix: 'Run pnpm harness:maps to regenerate agent-legible admin route and page API maps from router and page sources.',
  },
  {
    category: 'backend',
    level: 'warn',
    path: 'docs/generated/openapi-surface-map.md',
    name: 'OpenAPI surface map',
    fix: 'Run pnpm harness:maps after refreshing apps/backend/public/openApi.json to regenerate the OpenAPI surface map.',
  },
  {
    category: 'admin-web',
    level: 'warn',
    path: 'apps/admin-web/playwright.config.ts',
    name: 'admin-web Playwright config',
    fix: 'Restore Playwright config before relying on admin-web E2E harness.',
  },
  {
    category: 'admin-web',
    level: 'warn',
    path: 'apps/admin-web/e2e/smoke.spec.ts',
    name: 'admin-web smoke spec',
    fix: 'Add or restore a low-cost smoke spec for admin-web.',
  },
  {
    category: 'backend',
    level: 'warn',
    path: 'apps/backend/test/jest-e2e.json',
    name: 'backend Jest E2E config',
    fix: 'Restore backend Jest E2E config before running backend E2E harness.',
  },
  {
    category: 'miniapp-client',
    level: 'warn',
    path: 'apps/miniapp-client/vitest.config.ts',
    name: 'miniapp Vitest config',
    fix: 'Restore miniapp Vitest config before relying on miniapp unit harness.',
  },
  {
    category: 'observability',
    level: 'warn',
    path: 'docker-compose.monitoring.yml',
    name: 'monitoring compose file',
    fix: 'Restore monitoring compose file before using docker compose -f docker-compose.monitoring.yml commands.',
  },
  {
    category: 'claude-hooks',
    level: 'warn',
    path: '.claude/hooks/pre-bash-guard.mjs',
    name: 'Claude pre-bash-guard hook',
    fix: 'Restore .claude/hooks/pre-bash-guard.mjs — dangerous Bash command interception is inactive without it.',
  },
  {
    category: 'claude-hooks',
    level: 'warn',
    path: '.claude/hooks/pre-write-guard.mjs',
    name: 'Claude pre-write-guard hook',
    fix: 'Restore .claude/hooks/pre-write-guard.mjs — protected path and sensitive content write guard is inactive.',
  },
  {
    category: 'claude-hooks',
    level: 'warn',
    path: '.claude/hooks/post-edit-format.mjs',
    name: 'Claude post-edit-format hook',
    fix: 'Restore .claude/hooks/post-edit-format.mjs — auto-format on write/edit is inactive.',
  },
  {
    category: 'claude-hooks',
    level: 'warn',
    path: '.claude/hooks/post-edit-chain.mjs',
    name: 'Claude post-edit-chain hook',
    fix: 'Restore .claude/hooks/post-edit-chain.mjs — contract chain change reminders are inactive.',
  },
  {
    category: 'claude-hooks',
    level: 'warn',
    path: '.claude/hooks/stop-summary.mjs',
    name: 'Claude stop-summary hook',
    fix: 'Restore .claude/hooks/stop-summary.mjs — session end verification reminder is inactive.',
  },
  {
    category: 'harness-scripts',
    level: 'warn',
    path: 'scripts/check-node-blocking-patterns.mjs',
    name: 'check-node-blocking-patterns script',
    fix: 'Restore scripts/check-node-blocking-patterns.mjs — blocking pattern scan (readFileSync/hashSync) in check:slice is inactive.',
  },
  {
    category: 'harness-scripts',
    level: 'warn',
    path: 'scripts/check-redis-blocking.mjs',
    name: 'check-redis-blocking script',
    fix: 'Restore scripts/check-redis-blocking.mjs — Redis KEYS/LRANGE scan in check:slice is inactive.',
  },
  {
    category: 'harness-scripts',
    level: 'warn',
    path: 'scripts/check-export-limits.mjs',
    name: 'check-export-limits script',
    fix: 'Restore scripts/check-export-limits.mjs — export endpoint limit/count guard scan is inactive.',
  },
  {
    category: 'harness-scripts',
    level: 'warn',
    path: 'scripts/check-queue-contracts.mjs',
    name: 'check-queue-contracts script',
    fix: 'Restore scripts/check-queue-contracts.mjs — queue jobId/tenantId/failureHandler contract scan is inactive.',
  },
  {
    category: 'harness-scripts',
    level: 'warn',
    path: 'scripts/check-test-spec-coverage.mjs',
    name: 'check-test-spec-coverage script',
    fix: 'Restore scripts/check-test-spec-coverage.mjs — TEST_SPEC_PROTOCOL describe-block coverage scan is inactive.',
  },
  {
    category: 'harness-scripts',
    level: 'warn',
    path: 'scripts/worker-topology-doctor.mjs',
    name: 'worker-topology-doctor script',
    fix: 'Restore scripts/worker-topology-doctor.mjs — API/Worker/Scheduler process topology check is inactive.',
  },
];

export const VALIDATION_ROUTE_HINTS = [
  {
    match: 'apps/backend/**',
    risk: 'backend-only',
    commands: ['pnpm typecheck:backend'],
  },
  {
    match: 'apps/backend/prisma/**',
    risk: 'high-risk prisma',
    commands: ['high-risk confirmation', 'pnpm typecheck:backend'],
  },
  {
    match: 'apps/admin-web/src/views/**',
    risk: 'admin-web views',
    commands: ['pnpm typecheck:admin', 'pnpm verify:admin-view-types'],
  },
  {
    match: 'apps/miniapp-client/src/**',
    risk: 'miniapp-client',
    commands: ['pnpm lint:h5', 'pnpm typecheck:h5'],
  },
  {
    match: 'libs/**',
    risk: 'cross-app contract/shared package',
    commands: [
      'pnpm dev:backend to refresh apps/backend/public/openApi.json when backend contracts changed',
      'inspect target OpenAPI schema',
      'prefer pnpm --filter @libs/common-types contracts:generate; pnpm generate-types may run @apps/backend:build as a dependency',
      'affected frontend typecheck/lint',
    ],
  },
  {
    match: 'apps/backend/public/openApi.json',
    risk: 'OpenAPI contract artifact',
    commands: [
      'pnpm dev:backend refreshes this artifact',
      'on Windows scripted Start-Process should target pnpm.cmd, not pnpm',
      'do not use pnpm build:backend just to refresh OpenAPI',
      'generate common types only after the artifact schema is current; root pnpm generate-types dependency tasks are not the refresh mechanism',
    ],
  },
  {
    match: 'scripts/**',
    risk: 'harness/governance scripts',
    commands: ['node scripts/<script>.mjs', 'pnpm verify:scripts', 'pnpm test:scripts when behavior changed'],
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function exists(rootDir, relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function makeCheck({ level, category, name, message, fix }) {
  return { level, category, name, message, fix };
}

function compareVersions(actual, minimum) {
  const normalize = (value) =>
    String(value)
      .replace(/^v/, '')
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);
  const a = normalize(actual);
  const b = normalize(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function minVersionFromRange(range) {
  return String(range || '').replace(/^[^\d]*/, '');
}

function readPnpmVersion() {
  const result =
    process.platform === 'win32'
      ? spawnSync('pnpm --version', { encoding: 'utf8', shell: true })
      : spawnSync('pnpm', ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim();
}

function checkPackageScripts(pkg, scriptNames, packagePath) {
  return scriptNames.map((scriptName) => {
    const hasScript = Boolean(pkg?.scripts?.[scriptName]);
    return makeCheck({
      level: hasScript ? 'ok' : 'fail',
      category: 'package',
      name: `${packagePath} script:${scriptName}`,
      message: hasScript ? 'script is present' : 'script is missing',
      fix: `Add "${scriptName}" to ${packagePath}.`,
    });
  });
}

function checkRuntime(rootPkg, options) {
  const checks = [];
  const nodeMinimum = minVersionFromRange(rootPkg?.engines?.node);
  if (nodeMinimum) {
    const nodeOk = compareVersions(options.nodeVersion ?? process.version, nodeMinimum) >= 0;
    checks.push(
      makeCheck({
        level: nodeOk ? 'ok' : 'fail',
        category: 'runtime',
        name: 'node version',
        message: nodeOk ? `node ${options.nodeVersion ?? process.version}` : `node must be >= ${nodeMinimum}`,
        fix: `Use Node ${rootPkg.engines.node}.`,
      }),
    );
  }

  const packageManager = rootPkg?.packageManager || '';
  checks.push(
    makeCheck({
      level: packageManager.startsWith('pnpm@') ? 'ok' : 'fail',
      category: 'runtime',
      name: 'package manager declaration',
      message: packageManager || 'packageManager is missing',
      fix: 'Set root packageManager to pnpm@10.5.0 or newer.',
    }),
  );

  const pnpmMinimum = minVersionFromRange(rootPkg?.engines?.pnpm || packageManager.replace(/^pnpm@/, ''));
  const pnpmVersion = options.pnpmVersion === undefined ? readPnpmVersion() : options.pnpmVersion;
  if (!pnpmVersion) {
    checks.push(
      makeCheck({
        level: 'warn',
        category: 'runtime',
        name: 'pnpm executable',
        message: 'pnpm --version is not available',
        fix: `Install pnpm ${rootPkg?.engines?.pnpm || '>=10.5.0'} before running repo commands.`,
      }),
    );
  } else if (pnpmMinimum) {
    const pnpmOk = compareVersions(pnpmVersion, pnpmMinimum) >= 0;
    checks.push(
      makeCheck({
        level: pnpmOk ? 'ok' : 'warn',
        category: 'runtime',
        name: 'pnpm version',
        message: pnpmOk ? `pnpm ${pnpmVersion}` : `pnpm ${pnpmVersion} is below ${pnpmMinimum}`,
        fix: `Use pnpm ${rootPkg?.engines?.pnpm || packageManager}.`,
      }),
    );
  }

  return checks;
}

export function createHarnessDoctorReport(rootDir, options = {}) {
  const checks = [];
  const rootPackagePath = path.join(rootDir, 'package.json');
  const rootPkg = fs.existsSync(rootPackagePath) ? readJson(rootPackagePath) : null;

  if (!rootPkg) {
    checks.push(
      makeCheck({
        level: 'fail',
        category: 'package',
        name: 'root package.json',
        message: 'package.json is missing',
        fix: 'Run harness doctor from the repository root.',
      }),
    );
  } else {
    checks.push(...checkRuntime(rootPkg, options));
    checks.push(...checkPackageScripts(rootPkg, REQUIRED_ROOT_SCRIPTS, 'package.json'));
  }

  const docs = checkRequiredDocs(rootDir, REQUIRED_DOCS);
  for (const docPath of docs.present) {
    checks.push(
      makeCheck({
        level: 'ok',
        category: 'context',
        name: docPath,
        message: 'required context document is present',
        fix: '',
      }),
    );
  }
  for (const docPath of docs.missing) {
    checks.push(
      makeCheck({
        level: 'fail',
        category: 'context',
        name: docPath,
        message: 'required context document is missing',
        fix: `Restore ${docPath} or update REQUIRED_DOCS with a deliberate replacement.`,
      }),
    );
  }

  for (const fileCheck of HARNESS_FILE_CHECKS) {
    const present = exists(rootDir, fileCheck.path);
    checks.push(
      makeCheck({
        level: present ? 'ok' : fileCheck.level,
        category: fileCheck.category,
        name: fileCheck.name,
        message: present ? `${fileCheck.path} is present` : `${fileCheck.path} is missing`,
        fix: fileCheck.fix,
      }),
    );
  }

  const manifestScriptPath = path.join(rootDir, 'scripts/harness-manifest.mjs');
  const manifestReport = fs.existsSync(manifestScriptPath)
    ? validateManifest(rootDir)
    : { ok: true, checkCount: 0, issues: [] };
  if (manifestReport.ok) {
    checks.push(
      makeCheck({
        level: 'ok',
        category: 'manifest',
        name: 'harness-manifest registration',
        message: `${manifestReport.checkCount} checks registered; scripts and package scripts resolve`,
        fix: '',
      }),
    );
  } else {
    for (const issue of manifestReport.issues.filter((item) => item.level === 'fail')) {
      checks.push(
        makeCheck({
          level: 'fail',
          category: 'manifest',
          name: issue.id,
          message: issue.message,
          fix: 'Run pnpm harness:manifest --check and fix scripts/harness-manifest.mjs or package.json scripts.',
        }),
      );
    }
  }
  for (const issue of manifestReport.issues.filter((item) => item.level === 'warn')) {
    checks.push(
      makeCheck({
        level: 'warn',
        category: 'manifest',
        name: issue.id,
        message: issue.message,
        fix: 'Align RULE_FILES, REQUIRED_DOCS, and AGENTS.md §10 index with scripts/harness-manifest.mjs.',
      }),
    );
  }

  const activePlanScan = scanActivePlans(rootDir);
  if (activePlanScan.plans.length === 0) {
    checks.push(
      makeCheck({
        level: 'ok',
        category: 'exec-plan',
        name: 'active exec-plans',
        message: 'No active plans in docs/exec-plans/active/ (OK for doc-only or small diffs)',
        fix: '',
      }),
    );
  } else if (activePlanScan.stale.length === 0) {
    const ids = activePlanScan.plans.map((plan) => plan.taskId).join(', ');
    checks.push(
      makeCheck({
        level: 'ok',
        category: 'exec-plan',
        name: 'active exec-plans',
        message: `${activePlanScan.plans.length} active plan(s), none stale: ${ids}`,
        fix: '',
      }),
    );
  } else {
    for (const plan of activePlanScan.stale) {
      checks.push(
        makeCheck({
          level: 'warn',
          category: 'exec-plan',
          name: `stale plan ${plan.taskId}`,
          message: `${plan.filePath} last updated ${plan.lastUpdated} (${plan.ageDays}d > threshold)`,
          fix: 'Update last_updated, set phase_status=blocked, or move to docs/exec-plans/completed/. Run pnpm harness:plan-stale',
        }),
      );
    }
  }

  const fail = checks.filter((item) => item.level === 'fail').length;
  const warn = checks.filter((item) => item.level === 'warn').length;
  const ok = checks.filter((item) => item.level === 'ok').length;

  return {
    ok: fail === 0,
    summary: { ok, warn, fail },
    checks,
    validationRouteHints: VALIDATION_ROUTE_HINTS,
  };
}

function filterChecks(checks, mode) {
  if (mode === 'docs') {
    return checks.filter((item) => item.category === 'context' || item.name === 'root package.json');
  }
  return checks;
}

function printReport(report, mode) {
  const checks = filterChecks(report.checks, mode);
  const summary = {
    ok: checks.filter((item) => item.level === 'ok').length,
    warn: checks.filter((item) => item.level === 'warn').length,
    fail: checks.filter((item) => item.level === 'fail').length,
  };

  console.log(`Harness doctor: ${summary.fail > 0 ? 'FAIL' : summary.warn > 0 ? 'WARN' : 'OK'}`);
  console.log(`Checks: ${summary.ok} OK, ${summary.warn} WARN, ${summary.fail} FAIL`);

  for (const check of checks) {
    const label = check.level.toUpperCase().padEnd(4);
    console.log(`[${label}] ${check.category} :: ${check.name} - ${check.message}`);
    if (check.level !== 'ok' && check.fix) {
      console.log(`       fix: ${check.fix}`);
    }
  }

  if (mode !== 'docs') {
    console.log('\nValidation route hints:');
    for (const hint of report.validationRouteHints) {
      console.log(`- ${hint.match} (${hint.risk}): ${hint.commands.join('; ')}`);
    }
  }
}

export function main(argv = process.argv.slice(2), rootDir = path.resolve(fileURLToPath(import.meta.url), '..', '..')) {
  const mode = argv.includes('--docs') ? 'docs' : 'full';
  const json = argv.includes('--json');
  const report = createHarnessDoctorReport(rootDir);
  const visibleChecks = filterChecks(report.checks, mode);
  const visibleFailCount = visibleChecks.filter((item) => item.level === 'fail').length;

  if (json) {
    console.log(JSON.stringify({ ...report, checks: visibleChecks }, null, 2));
  } else {
    printReport(report, mode);
  }

  return visibleFailCount > 0 ? 1 : 0;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
