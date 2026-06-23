import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const nodeTestSpecs = [
  'scripts/check-dict-governance.spec.mjs',
  'scripts/check-quality-gates.spec.mjs',
  'scripts/check-admin-view-types.spec.mjs',
  'scripts/check-repo-artifacts.spec.mjs',
  'scripts/check-contract-exceptions.spec.mjs',
  'scripts/check-node-blocking-patterns.spec.mjs',
  'scripts/check-redis-blocking.spec.mjs',
  'scripts/check-spec-drift.spec.mjs',
  'scripts/check-export-limits.spec.mjs',
  'scripts/check-queue-contracts.spec.mjs',
  'scripts/check-test-spec-coverage.spec.mjs',
  'scripts/worker-topology-doctor.spec.mjs',
  'scripts/verify-monorepo.spec.mjs',
  'scripts/harness-doctor.spec.mjs',
  'scripts/harness-manifest.spec.mjs',
  'scripts/eval-phase.spec.mjs',
  'scripts/tasks/quality-matrix-routes.spec.mjs',
  'scripts/check-exec-plan-stale.spec.mjs',
  'scripts/harness-smoke.spec.mjs',
  'scripts/tasks/package-scripts-governance.spec.mjs',
  'scripts/tasks/changed-files.spec.mjs',
  'scripts/tasks/generate-project-maps.spec.mjs',
  'scripts/tasks/check-agents-consistency.spec.mjs',
  'scripts/tasks/check-openapi-fresh.spec.mjs',
  'scripts/check-forwardref-reason.spec.mjs',
  'scripts/tasks/cutover-due.spec.mjs',
];

function run(command, args) {
  console.log(`> ${[command, ...args].join(' ')}`);
  const invocation = resolveInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function quoteForCmd(arg) {
  if (/^[A-Za-z0-9_@%+=:,./\\-]+$/.test(arg)) {
    return arg;
  }

  return `"${arg.replaceAll('"', '\\"')}"`;
}

function resolveInvocation(command, args) {
  if (process.platform === 'win32' && command.endsWith('.cmd')) {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', [command, ...args].map(quoteForCmd).join(' ')],
    };
  }

  return { command, args };
}

run(process.execPath, ['--test', ...nodeTestSpecs]);
run(pnpm, ['exec', 'vitest', '--config', 'scripts/vitest.config.mjs', 'run']);
