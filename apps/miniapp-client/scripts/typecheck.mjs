import { spawnSync } from 'node:child_process';
import process from 'node:process';

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const args = ['exec', 'vue-tsc', '--noEmit', '-p', 'tsconfig.typecheck.json', '--skipLibCheck'];
const invocation = resolveInvocation(command, args);
const result = spawnSync(invocation.command, invocation.args, {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
  stdio: 'pipe',
});

function quoteForCmd(arg) {
  if (/^[\w@%+=:,./\\-]+$/.test(arg)) {
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

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.split(/\r?\n/);
const dependencyPattern = /node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/])?wot-design-uni[\\/]/i;
const tsErrorPattern = /error TS\d+:/;
const lifecyclePattern =
  /ELIFECYCLE|Command failed with exit code|ERROR: command finished with error|run failed: command exited|Failed:\s+@apps\/miniapp-client#typecheck/;

const ownDiagnostics = output.filter((line) => tsErrorPattern.test(line) && !dependencyPattern.test(line));
const shouldIgnoreDependencyErrors = result.status !== 0 && ownDiagnostics.length === 0;

const visibleLines = output.filter((line) => {
  if (!line.trim()) {
    return false;
  }

  if (shouldIgnoreDependencyErrors && dependencyPattern.test(line)) {
    return false;
  }

  if (shouldIgnoreDependencyErrors && lifecyclePattern.test(line)) {
    return false;
  }

  return true;
});

if (visibleLines.length > 0) {
  process.stdout.write(`${visibleLines.join('\n')}\n`);
}

if (shouldIgnoreDependencyErrors) {
  process.stdout.write('Ignored type diagnostics from wot-design-uni dependency.\n');
  process.exit(0);
}

process.exit(result.status ?? 1);
