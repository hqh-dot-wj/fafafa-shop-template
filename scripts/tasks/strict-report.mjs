import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const reports = {
  admin: {
    label: 'admin-web',
    cwd: path.join(repoRoot, 'apps/admin-web'),
    project: 'tsconfig.strict-report.json',
  },
  h5: {
    label: 'miniapp-client',
    cwd: path.join(repoRoot, 'apps/miniapp-client'),
    project: 'tsconfig.strict-report.json',
    vendorDiagnostics: [
      {
        label: 'wot-design-uni',
        pattern: /node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?wot-design-uni[\\/]/i,
      },
    ],
  },
};

const args = process.argv.slice(2);
const failOnError = args.includes('--fail-on-error');
const requestedScopes = args
  .filter((arg) => !arg.startsWith('--'))
  .flatMap((arg) => arg.split(','))
  .filter(Boolean);
const scopes = requestedScopes.length > 0 ? requestedScopes : Object.keys(reports);

let totalErrors = 0;
let totalVendorErrors = 0;

for (const scope of scopes) {
  const report = reports[scope];
  if (!report) {
    console.error(`Unknown strict report scope: ${scope}`);
    process.exit(1);
  }

  const projectFile = path.join(report.cwd, report.project);
  if (!existsSync(projectFile)) {
    console.log(`\n[${report.label}] missing ${report.project}; skipped.`);
    continue;
  }

  console.log(`\n[${report.label}] strict report`);
  const result = spawnPnpm(
    ['exec', 'vue-tsc', '--noEmit', '-p', report.project, '--skipLibCheck', '--pretty', 'false'],
    {
      cwd: report.cwd,
      encoding: 'utf8',
      stdio: 'pipe',
    },
  );
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  const diagnosticBlocks = splitDiagnosticBlocks(output);
  const vendorBuckets = classifyVendorDiagnostics(diagnosticBlocks, report.vendorDiagnostics ?? []);
  const vendorBlocks = new Set(vendorBuckets.flatMap((bucket) => bucket.blocks));
  const ownBlocks = diagnosticBlocks.filter((block) => !vendorBlocks.has(block));
  const errorCount = ownBlocks.length;
  const vendorErrorCount = vendorBlocks.size;
  totalErrors += errorCount;
  totalVendorErrors += vendorErrorCount;

  if (ownBlocks.length > 0) {
    process.stdout.write(`${ownBlocks.map((block) => block.lines.join('\n')).join('\n')}\n`);
  } else if (result.status !== 0 && vendorErrorCount === 0 && output) {
    process.stdout.write(`${output}\n`);
  }

  for (const bucket of vendorBuckets) {
    if (bucket.blocks.length > 0) {
      console.log(`[${report.label}] ignored vendor diagnostics: ${bucket.label}=${bucket.blocks.length}`);
    }
  }

  console.log(
    `[${report.label}] exit=${result.status ?? 1}, tsErrors=${errorCount}, vendorTsErrors=${vendorErrorCount}`,
  );
}

console.log(`\nStrict report own TS errors: ${totalErrors}`);
if (totalVendorErrors > 0) {
  console.log(`Strict report ignored vendor TS errors: ${totalVendorErrors}`);
}
if (totalErrors > 0) {
  console.log('Strict report is non-blocking by default. Use --fail-on-error only for explicit experiments.');
}

if (failOnError && totalErrors > 0) {
  process.exit(1);
}

function quoteForCmd(arg) {
  if (/^[A-Za-z0-9_@%+=:,./\\-]+$/.test(arg)) {
    return arg;
  }

  return `"${arg.replaceAll('"', '\\"')}"`;
}

function spawnPnpm(args, options) {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', [pnpm, ...args].map(quoteForCmd).join(' ')], options);
  }

  return spawnSync(pnpm, args, options);
}

function splitDiagnosticBlocks(output) {
  if (!output) {
    return [];
  }

  const blocks = [];
  let current;
  for (const line of output.split(/\r?\n/)) {
    if (isDiagnosticStart(line)) {
      if (current) {
        blocks.push(current);
      }
      current = { firstLine: line, lines: [line] };
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    blocks.push(current);
  }

  return blocks;
}

function isDiagnosticStart(line) {
  return /^.+\(\d+,\d+\): error TS\d+:/.test(line);
}

function classifyVendorDiagnostics(blocks, vendorDiagnostics) {
  return vendorDiagnostics.map((vendor) => ({
    label: vendor.label,
    blocks: blocks.filter((block) => vendor.pattern.test(block.firstLine)),
  }));
}
