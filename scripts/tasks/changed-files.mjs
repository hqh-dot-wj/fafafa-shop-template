import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkSpecDrift } from '../check-spec-drift.mjs';
import { analyzeExecPlanPresence, changedFilesAgainstBase } from '../check-exec-plan-presence.mjs';
import { formatPrChecklistSuggestions } from './quality-matrix-routes.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const formatExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsonc',
  '.jsx',
  '.less',
  '.mjs',
  '.md',
  '.scss',
  '.ts',
  '.tsx',
  '.vue',
  '.yaml',
  '.yml',
]);
const lintExtensions = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx', '.vue']);
const ignoredSegments = new Set(['node_modules', 'dist', '.turbo', 'db', 'upload', 'logs']);
const ignoredPrefixes = ['.codex/tmp/', '.codex/runtime-logs/'];

function normalizePath(file) {
  return file.replaceAll('\\', '/').replace(/^\.\//, '');
}

function resolveRepoFile(file) {
  const absolute = path.isAbsolute(file) ? path.resolve(file) : path.resolve(repoRoot, file);
  if (!isInsideRepoAbsolute(absolute)) {
    return null;
  }

  return {
    absolute,
    relative: normalizePath(path.relative(repoRoot, absolute)),
  };
}

function isInsideRepoAbsolute(absolute) {
  return absolute === repoRoot || absolute.startsWith(`${repoRoot}${path.sep}`);
}

function isIgnored(file) {
  const normalized = normalizePath(file);
  if (ignoredPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }

  return normalized.split('/').some((segment) => ignoredSegments.has(segment));
}

function run(command, args, options = {}) {
  const label = [command, ...args].join(' ');
  console.log(`> ${label}`);
  const invocation = resolveInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });

  if (options.capture) {
    return result;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
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

function runChunked(command, fixedArgs, targets, options = {}) {
  const chunks = [];
  let current = [];
  let currentLength = [command, ...fixedArgs].join(' ').length;

  for (const target of targets) {
    const nextLength = currentLength + target.length + 1;
    if (current.length > 0 && (nextLength > 3000 || current.length >= 10)) {
      chunks.push(current);
      current = [];
      currentLength = [command, ...fixedArgs].join(' ').length;
    }

    current.push(target);
    currentLength += target.length + 1;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  for (const chunk of chunks) {
    run(command, [...fixedArgs, ...chunk], options);
  }
}

function readGitFiles(args) {
  const result = run('git', args, { capture: true });
  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasHead() {
  return run('git', ['rev-parse', '--verify', 'HEAD'], { capture: true }).status === 0;
}

function changedFiles({ stagedOnly = false } = {}) {
  if (stagedOnly) {
    return readGitFiles(['diff', '--name-only', '--cached', '--diff-filter=ACMR', '--']);
  }

  if (!hasHead()) {
    return readGitFiles(['ls-files', '--others', '--modified', '--exclude-standard']);
  }

  return [
    ...readGitFiles(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD', '--']),
    ...readGitFiles(['diff', '--name-only', '--cached', '--diff-filter=ACMR', '--']),
    ...readGitFiles(['ls-files', '--others', '--exclude-standard']),
  ];
}

function sanitizeFiles(files) {
  const resolved = files.map(resolveRepoFile).filter(Boolean);

  return [...new Set(resolved.map((file) => file.relative))]
    .filter((file) => file && !isIgnored(file))
    .filter((file) => existsSync(path.join(repoRoot, file)));
}

function extname(file) {
  const base = path.basename(file);
  if (base === 'Dockerfile') {
    return '.dockerfile';
  }
  return path.extname(file).toLowerCase();
}

function relativeToApp(file, appRoot) {
  return normalizePath(path.relative(path.join(repoRoot, appRoot), path.join(repoRoot, file)));
}

function isAdminTestFile(file) {
  return (
    /^apps\/admin-web\/src\/.*\.(?:spec|test)\.(?:ts|tsx|vue)$/.test(file) ||
    /^apps\/admin-web\/src\/test\/.*\.(?:ts|tsx|vue)$/.test(file) ||
    /^apps\/admin-web\/e2e\/.*\.(?:ts|tsx)$/.test(file) ||
    file === 'apps/admin-web/tsconfig.test.json' ||
    file === 'apps/admin-web/vitest.config.ts' ||
    file === 'apps/admin-web/playwright.config.ts'
  );
}

function groupLintFiles(files) {
  const groups = {
    backend: [],
    admin: [],
    miniapp: [],
    cweb: [],
    root: [],
  };

  for (const file of files.filter((item) => lintExtensions.has(extname(item)))) {
    if (file.startsWith('apps/backend/')) {
      groups.backend.push(relativeToApp(file, 'apps/backend'));
    } else if (file.startsWith('apps/admin-web/')) {
      groups.admin.push(relativeToApp(file, 'apps/admin-web'));
    } else if (file.startsWith('apps/miniapp-client/')) {
      groups.miniapp.push(relativeToApp(file, 'apps/miniapp-client'));
    } else if (file.startsWith('apps/c-web/')) {
      groups.cweb.push(relativeToApp(file, 'apps/c-web'));
    } else {
      groups.root.push(file);
    }
  }

  return groups;
}

function fixFiles(files) {
  const targets = sanitizeFiles(files);
  if (targets.length === 0) {
    console.log('No changed files to fix.');
    return;
  }

  const formatTargets = targets.filter((file) => formatExtensions.has(extname(file)));
  if (formatTargets.length > 0) {
    runChunked(pnpm, ['exec', 'prettier', '--write', '--ignore-unknown'], formatTargets);
  }

  const lintGroups = groupLintFiles(targets);
  if (lintGroups.backend.length > 0) {
    runChunked(pnpm, ['exec', 'eslint', '--fix'], lintGroups.backend, { cwd: path.join(repoRoot, 'apps/backend') });
  }
  if (lintGroups.admin.length > 0) {
    runChunked(pnpm, ['exec', 'eslint', '--fix'], lintGroups.admin, { cwd: path.join(repoRoot, 'apps/admin-web') });
  }
  if (lintGroups.miniapp.length > 0) {
    runChunked(pnpm, ['exec', 'eslint', '--fix'], lintGroups.miniapp, {
      cwd: path.join(repoRoot, 'apps/miniapp-client'),
    });
  }
  if (lintGroups.cweb.length > 0) {
    runChunked(pnpm, ['exec', 'eslint', '--fix'], lintGroups.cweb, {
      cwd: path.join(repoRoot, 'apps/c-web'),
    });
  }
  if (lintGroups.root.length > 0) {
    runChunked(pnpm, ['exec', 'eslint', '--fix'], lintGroups.root);
  }
}

export function affectedSlices(files) {
  const targets = sanitizeFiles(files);
  const slices = new Set();
  let adminViews = false;
  let adminVitest = false;
  let adminE2e = false;
  let adminTests = false;

  for (const file of targets) {
    if (file.startsWith('apps/backend/')) {
      slices.add('backend');
    } else if (file.startsWith('apps/admin-web/')) {
      slices.add('admin');
      if (file.startsWith('apps/admin-web/src/views/')) {
        adminViews = true;
      }
      if (file.startsWith('apps/admin-web/src/') || file === 'apps/admin-web/vitest.config.ts') {
        adminVitest = true;
      }
      if (file.startsWith('apps/admin-web/e2e/') || file === 'apps/admin-web/playwright.config.ts') {
        adminE2e = true;
      }
      if (isAdminTestFile(file)) {
        adminTests = true;
      }
    } else if (file.startsWith('apps/miniapp-client/')) {
      slices.add('miniapp');
    } else if (file.startsWith('apps/c-web/')) {
      slices.add('cweb');
    } else if (file.startsWith('scripts/') || ['package.json', 'turbo.json', 'eslint.config.mjs'].includes(file)) {
      slices.add('scripts');
    } else if (file.startsWith('docs/')) {
      continue;
    } else if (!file.endsWith('.md')) {
      slices.add('repo-config');
    }
  }

  return { slices, adminViews, adminVitest, adminE2e, adminTests, targets };
}

function checkSlice(files) {
  const { slices, adminViews, adminVitest, adminE2e, adminTests, targets } = affectedSlices(files);
  if (targets.length === 0) {
    console.log('No changed files found for slice check.');
    return;
  }

  console.log(`Affected files: ${targets.length}`);
  console.log(`Affected slices: ${[...slices].join(', ') || 'docs-only'}`);

  if (slices.has('scripts') || slices.has('repo-config')) {
    run(pnpm, ['verify:scripts']);
  }
  if (slices.has('backend')) {
    run(pnpm, ['--filter', '@apps/backend', 'lint']);
    run(pnpm, ['--filter', '@apps/backend', 'typecheck']);
    run(process.execPath, ['scripts/check-node-blocking-patterns.mjs']);
    run(process.execPath, ['scripts/check-redis-blocking.mjs']);
    run(process.execPath, ['scripts/check-export-limits.mjs']);
    run(process.execPath, ['scripts/check-queue-contracts.mjs']);
    run(process.execPath, ['scripts/check-test-spec-coverage.mjs']);
    run(process.execPath, ['scripts/worker-topology-doctor.mjs']);
    const { missing, unsynced } = checkSpecDrift(targets);
    if (missing.length > 0) {
      console.error('\n[spec-drift] ❌ 实现文件缺少对应 spec（请补充）：');
      for (const { impl, spec } of missing) {
        console.error(`  ${impl}  →  缺失: ${spec}`);
      }
      process.exit(1);
    }
    if (unsynced.length > 0) {
      console.warn('\n[spec-drift] ⚠️  实现已修改，spec 未同步（请确认）：');
      for (const { impl, spec } of unsynced) {
        console.warn(`  ${impl}  →  ${spec}`);
      }
    }
  }
  if (slices.has('admin')) {
    run(pnpm, ['--filter', '@apps/admin-web', 'lint']);
    run(pnpm, ['--filter', '@apps/admin-web', 'typecheck']);
    if (adminVitest) {
      run(pnpm, ['--filter', '@apps/admin-web', 'test']);
    }
    if (adminViews) {
      run(pnpm, ['verify:admin-view-types']);
    }
    if (adminTests) {
      run(pnpm, ['--filter', '@apps/admin-web', 'typecheck:tests']);
    }
    if (adminE2e) {
      console.log(
        'Admin E2E files changed: run pnpm --filter @apps/admin-web test:e2e for full backend-backed flows, or test:e2e:smoke for unauthenticated route smoke.',
      );
    }
  }
  if (slices.has('miniapp')) {
    run(pnpm, ['--filter', '@apps/miniapp-client', 'lint']);
    run(pnpm, ['--filter', '@apps/miniapp-client', 'typecheck']);
  }
  if (slices.has('cweb')) {
    run(pnpm, ['--filter', '@apps/c-web', 'lint']);
    run(pnpm, ['--filter', '@apps/c-web', 'typecheck']);
  }

  if (slices.size === 0) {
    console.log('Docs-only change: no code slice check required.');
  }

  const branchFiles = [...new Set([...targets, ...changedFilesAgainstBase()])];
  const execPlanReport = analyzeExecPlanPresence(branchFiles);
  if (execPlanReport.level === 'warn') {
    console.warn(`\n[exec-plan] ⚠️  ${execPlanReport.message}`);
    console.warn('       Create docs/exec-plans/active/<TASK-ID>.md or use no-exec-plan trailer/label.');
  }

  const checklist = formatPrChecklistSuggestions(branchFiles);
  if (!checklist.startsWith('No quality-attribute')) {
    console.log(`\n${checklist}`);
    console.log('(Paste suggested sections into .github/PULL_REQUEST_TEMPLATE.md checklist)');
  }
}

function parse(argv) {
  const [command, ...rest] = argv;
  const stagedOnly = rest.includes('--staged') || rest.includes('--staged-files');
  const files = rest.filter((arg) => !arg.startsWith('--'));
  return { command, stagedOnly, files };
}

export function main(argv = process.argv.slice(2)) {
  const { command, stagedOnly, files } = parse(argv);
  const selectedFiles = files.length > 0 ? files : changedFiles({ stagedOnly });

  if (command === 'fix') {
    fixFiles(selectedFiles);
    return;
  }

  if (command === 'check-slice') {
    checkSlice(selectedFiles);
    return;
  }

  console.error('Usage: node scripts/tasks/changed-files.mjs <fix|check-slice> [--staged] [files...]');
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
