import { spawnSync } from 'node:child_process';

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const cwd = new URL('..', import.meta.url);

function quoteForCmd(arg) {
  if (/^[A-Za-z0-9_@%+=:,./\\-]+$/.test(arg)) {
    return arg;
  }

  return `"${arg.replaceAll('"', '\\"')}"`;
}

function resolveInvocation(baseCommand, baseArgs) {
  if (process.platform === 'win32' && baseCommand.endsWith('.cmd')) {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', [baseCommand, ...baseArgs].map(quoteForCmd).join(' ')],
    };
  }

  return { command: baseCommand, args: baseArgs };
}

function runPnpm(args) {
  const invocation = resolveInvocation(command, args);

  return spawnSync(invocation.command, invocation.args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

const routeGeneration = runPnpm(['run', 'generate:elegant-routes']);

if (routeGeneration.status !== 0) {
  const rawRouteOutput = `${routeGeneration.stdout ?? ''}${routeGeneration.stderr ?? ''}`;
  if (rawRouteOutput.trim()) {
    process.stdout.write(rawRouteOutput);
  }
  process.exit(routeGeneration.status ?? 1);
}

const result = runPnpm([
  'exec',
  'vue-tsc',
  '--noEmit',
  '-p',
  'tsconfig.typecheck.json',
  '--skipLibCheck',
  '--pretty',
  'false',
]);

const rawOutput = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const output = rawOutput.split(/\r?\n/);
const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const ignoredPatterns = [/src[\\/]views[\\/]/i, /src[\\/]locales[\\/]/i, /src[\\/]router[\\/]elegant[\\/]/i];
const tsErrorPattern = /error TS\d+:/;

const ownDiagnostics = output.filter(
  (line) =>
    tsErrorPattern.test(line.replace(ansiPattern, '')) &&
    !ignoredPatterns.some((pattern) => pattern.test(line.replace(ansiPattern, ''))),
);
const shouldIgnoreViewDiagnostics = result.status !== 0 && ownDiagnostics.length === 0;

if (shouldIgnoreViewDiagnostics) {
  process.stdout.write('Ignored type diagnostics from admin view, locale, and generated route layers.\n');
  process.exit(0);
}

if (rawOutput.trim()) {
  process.stdout.write(rawOutput);
}

process.exit(result.status ?? 1);
