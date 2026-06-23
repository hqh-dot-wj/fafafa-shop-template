#!/usr/bin/env node
import * as childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const adminWebRoot = path.join(root, 'apps/admin-web');
const ALLOWED_EXTENSIONS = new Set(['.vue', '.ts', '.tsx']);
const ADMIN_GENERATED_ROUTE_FILES = [
  'src/typings/elegant-router.d.ts',
  'src/router/elegant/imports.ts',
  'src/router/elegant/routes.ts',
  'src/router/elegant/transform.ts',
];

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function isTargetAdminViewFile(filePath) {
  return filePath.startsWith('apps/admin-web/src/views/') && ALLOWED_EXTENSIONS.has(path.extname(filePath));
}

export function getAdminGeneratedRouteFiles(workspaceRoot = root) {
  return ADMIN_GENERATED_ROUTE_FILES.map((filePath) => path.join(workspaceRoot, 'apps/admin-web', filePath));
}

export function hasRequiredAdminGeneratedRoutes(workspaceRoot = root) {
  return getAdminGeneratedRouteFiles(workspaceRoot).every((filePath) => {
    try {
      const stat = fs.statSync(filePath);
      return stat.isFile() && stat.size > 0;
    } catch {
      return false;
    }
  });
}

export function ensureAdminGeneratedRoutes(workspaceRoot = root, execFileSyncFn = childProcess.execFileSync) {
  if (hasRequiredAdminGeneratedRoutes(workspaceRoot)) {
    return false;
  }

  execFileSyncFn('pnpm', ['--filter', '@apps/admin-web', 'generate:elegant-routes'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return true;
}

function runGit(args, workspaceRoot) {
  try {
    return childProcess.execFileSync('git', args, { cwd: workspaceRoot, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function readGitFileList(args, workspaceRoot) {
  const output = runGit(args, workspaceRoot);
  if (!output) return [];
  return output.split(/\r?\n/).filter(Boolean);
}

function collectFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  const entries = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      entries.push(...collectFiles(fullPath));
      continue;
    }

    if (ALLOWED_EXTENSIONS.has(path.extname(entry.name))) {
      entries.push(fullPath);
    }
  }

  return entries;
}

function sanitizeTargetFiles(files, workspaceRoot) {
  return [
    ...new Set(files.map((file) => normalizePath(path.isAbsolute(file) ? path.relative(workspaceRoot, file) : file))),
  ]
    .filter(isTargetAdminViewFile)
    .filter((file) => fs.existsSync(path.join(workspaceRoot, file)));
}

function resolveTargetFiles(mode, explicitFiles = [], workspaceRoot = root) {
  if (explicitFiles.length > 0) {
    return sanitizeTargetFiles(explicitFiles, workspaceRoot);
  }

  if (mode === 'staged') {
    return sanitizeTargetFiles(
      readGitFileList(['diff', '--cached', '--name-only', '--diff-filter=ACMRTUXB'], workspaceRoot),
      workspaceRoot,
    );
  }

  if (mode === 'branch') {
    const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], workspaceRoot);
    if (upstream) {
      const upstreamFiles = readGitFileList(['diff', '--name-only', `${upstream}...HEAD`], workspaceRoot);
      if (upstreamFiles.length > 0) {
        return sanitizeTargetFiles(upstreamFiles, workspaceRoot);
      }
    }

    return sanitizeTargetFiles(readGitFileList(['diff', '--name-only', 'HEAD~1..HEAD'], workspaceRoot), workspaceRoot);
  }

  if (mode === 'all') {
    return sanitizeTargetFiles(collectFiles(path.join(workspaceRoot, 'apps/admin-web/src/views')), workspaceRoot);
  }

  return [];
}

function normalizeDiagnosticPath(rawPath, workspaceRoot) {
  const normalizedRawPath = normalizePath(rawPath);
  const adminWebMarker = 'apps/admin-web/';
  const adminWebIndex = normalizedRawPath.indexOf(adminWebMarker);

  if (adminWebIndex >= 0) {
    return normalizedRawPath.slice(adminWebIndex);
  }

  const absolutePath =
    path.isAbsolute(rawPath) || path.win32.isAbsolute(rawPath) ? rawPath : path.join(adminWebRoot, rawPath);
  return normalizePath(path.relative(workspaceRoot, absolutePath));
}

export function parseVueTscDiagnostics(output, workspaceRoot = root) {
  const diagnostics = [];
  const pattern = /^(.+?)\((\d+),(\d+)\): error TS\d+: (.+)$/gm;

  pattern.lastIndex = 0;
  for (let match = pattern.exec(output); match; match = pattern.exec(output)) {
    diagnostics.push({
      filePath: normalizeDiagnosticPath(match[1].trim(), workspaceRoot),
      line: Number(match[2]),
      column: Number(match[3]),
      message: match[4].trim(),
    });
  }

  return diagnostics;
}

function runVueTsc(workspaceRoot = root) {
  try {
    ensureAdminGeneratedRoutes(workspaceRoot);
  } catch (error) {
    const stdout = error.stdout?.toString?.() ?? '';
    const stderr = error.stderr?.toString?.() ?? '';
    return {
      ok: false,
      output: `${stdout}\n${stderr}`.trim(),
      setupError:
        '无法生成 admin-web elegant-router 类型文件，请先执行 pnpm --filter @apps/admin-web generate:elegant-routes',
    };
  }

  try {
    const stdout = childProcess.execFileSync(
      'pnpm',
      ['--filter', '@apps/admin-web', 'exec', 'vue-tsc', '--noEmit', '--pretty', 'false'],
      { cwd: workspaceRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { ok: true, output: stdout };
  } catch (error) {
    const stdout = error.stdout?.toString?.() ?? '';
    const stderr = error.stderr?.toString?.() ?? '';
    return { ok: false, output: `${stdout}\n${stderr}`.trim() };
  }
}

export function filterDiagnosticsByTargetFiles(diagnostics, targetFiles) {
  const targetSet = new Set(targetFiles.map(normalizePath));
  return diagnostics.filter((diagnostic) => targetSet.has(normalizePath(diagnostic.filePath)));
}

export function loadAdminViewTypeReport({
  mode = 'staged',
  files = [],
  workspaceRoot = root,
  resolveTargetFilesFn = resolveTargetFiles,
  runVueTscFn = runVueTsc,
} = {}) {
  const targetFiles = resolveTargetFilesFn(mode, files, workspaceRoot);
  if (targetFiles.length === 0) {
    return {
      mode,
      targetFiles,
      diagnostics: [],
      ignoredDiagnostics: 0,
      vueTscOk: true,
    };
  }

  const vueTscResult = runVueTscFn(workspaceRoot);
  const diagnostics = parseVueTscDiagnostics(vueTscResult.output, workspaceRoot);
  const relevantDiagnostics = filterDiagnosticsByTargetFiles(diagnostics, targetFiles);

  return {
    mode,
    targetFiles,
    diagnostics: relevantDiagnostics,
    ignoredDiagnostics: diagnostics.length - relevantDiagnostics.length,
    vueTscOk: vueTscResult.ok,
    setupError: vueTscResult.setupError ?? '',
  };
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const parsed = { mode: 'staged', files: [] };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--staged') {
      parsed.mode = 'staged';
      continue;
    }

    if (arg === '--branch') {
      parsed.mode = 'branch';
      continue;
    }

    if (arg === '--all') {
      parsed.mode = 'all';
      continue;
    }

    if (arg === '--files') {
      parsed.files = args.slice(index + 1);
      break;
    }
  }

  return parsed;
}

export function main(argv = process.argv, workspaceRoot = root) {
  const { mode, files } = parseCliArgs(argv);
  const report = loadAdminViewTypeReport({ mode, files, workspaceRoot });

  console.log('--- Admin View Type Check ---');
  if (report.targetFiles.length === 0) {
    console.log('OK no targeted admin-web view files');
    return { ok: true, report };
  }

  if (report.setupError) {
    console.log(`ERROR ${report.setupError}`);
    return { ok: false, report };
  }

  if (report.diagnostics.length === 0) {
    const ignoredText =
      report.ignoredDiagnostics > 0 ? `; ignored ${report.ignoredDiagnostics} unrelated historical diagnostics` : '';
    console.log(
      `OK admin-web view type check passed (mode: ${mode}, files: ${report.targetFiles.length}${ignoredText})`,
    );
    return { ok: true, report };
  }

  for (const diagnostic of report.diagnostics) {
    console.log(`ERROR ${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column}`);
    console.log(`  - ${diagnostic.message}`);
  }

  return { ok: false, report };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = main();
  if (!result.ok) {
    process.exit(1);
  }
}
