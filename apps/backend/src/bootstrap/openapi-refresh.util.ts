import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import path from 'path';
import { isOpenApiContractSource, isSkippableSourceScanFile } from './openapi-contract-paths';

export interface OpenApiArtifactPaths {
  openApiPath: string;
  stampPath: string;
  srcRoot: string;
}

export interface ShouldRegenerateOpenApiResult {
  refresh: boolean;
  reason: string;
  contractMaxMtimeMs: number;
  stampMs: number;
}

function resolveBackendRoot(cwd: string): string {
  const nestedBackendRoot = path.join(cwd, 'apps', 'backend');
  if (existsSync(path.join(nestedBackendRoot, 'package.json')) && existsSync(path.join(nestedBackendRoot, 'src'))) {
    return nestedBackendRoot;
  }
  return cwd;
}

export function resolveOpenApiArtifactPaths(cwd: string = process.cwd()): OpenApiArtifactPaths {
  const backendRoot = resolveBackendRoot(cwd);
  const publicDir = path.join(backendRoot, 'public');
  return {
    openApiPath: path.join(publicDir, 'openApi.json'),
    stampPath: path.join(publicDir, '.openapi-contract-max-mtime'),
    srcRoot: path.join(backendRoot, 'src'),
  };
}

export function listOpenApiContractSourceFiles(srcRoot: string): string[] {
  const files: string[] = [];

  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.ts') || isSkippableSourceScanFile(entry.name)) {
        continue;
      }
      const relative = path.relative(srcRoot, fullPath).replace(/\\/g, '/');
      if (isOpenApiContractSource(relative)) {
        files.push(fullPath);
      }
    }
  };

  walk(srcRoot);
  return files;
}

export function getLatestMtimeMs(filePaths: string[]): number {
  let latest = 0;
  for (const filePath of filePaths) {
    try {
      const mtime = statSync(filePath).mtimeMs;
      if (mtime > latest) latest = mtime;
    } catch {
      // 文件在扫描与 stat 之间被删除时忽略
    }
  }
  return latest;
}

export function readOpenApiStampMs(stampPath: string): number {
  if (!existsSync(stampPath)) return 0;
  try {
    const raw = readFileSync(stampPath, 'utf8').trim();
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function writeOpenApiStamp(stampPath: string, contractMaxMtimeMs: number): void {
  mkdirSync(path.dirname(stampPath), { recursive: true });
  writeFileSync(stampPath, String(Math.trunc(contractMaxMtimeMs)), 'utf8');
}

export function shouldRegenerateOpenApiDocument(options: {
  paths: OpenApiArtifactPaths;
  forceRefresh?: boolean;
  throttleInDev?: boolean;
  listContractFiles?: (srcRoot: string) => string[];
  readStampMs?: (stampPath: string) => number;
  getLatestMtime?: (files: string[]) => number;
  exists?: (filePath: string) => boolean;
}): ShouldRegenerateOpenApiResult {
  const {
    paths,
    forceRefresh = false,
    throttleInDev = false,
    listContractFiles = listOpenApiContractSourceFiles,
    readStampMs = readOpenApiStampMs,
    getLatestMtime = getLatestMtimeMs,
    exists = existsSync,
  } = options;

  const contractFiles = listContractFiles(paths.srcRoot);
  const contractMaxMtimeMs = getLatestMtime(contractFiles);
  const stampMs = readStampMs(paths.stampPath);

  if (forceRefresh) {
    return { refresh: true, reason: 'force', contractMaxMtimeMs, stampMs };
  }
  if (!throttleInDev) {
    return { refresh: true, reason: 'no-throttle', contractMaxMtimeMs, stampMs };
  }
  if (!exists(paths.openApiPath)) {
    return { refresh: true, reason: 'missing-openapi', contractMaxMtimeMs, stampMs };
  }
  if (contractMaxMtimeMs <= 0) {
    return { refresh: true, reason: 'no-contract-sources', contractMaxMtimeMs, stampMs };
  }
  if (stampMs <= 0) {
    const openApiMtime = statSync(paths.openApiPath).mtimeMs;
    if (contractMaxMtimeMs > openApiMtime) {
      return { refresh: true, reason: 'stamp-missing-stale-openapi', contractMaxMtimeMs, stampMs };
    }
    return { refresh: false, reason: 'stamp-missing-fresh-openapi', contractMaxMtimeMs, stampMs };
  }
  if (contractMaxMtimeMs > stampMs) {
    return { refresh: true, reason: 'contract-changed', contractMaxMtimeMs, stampMs };
  }
  return { refresh: false, reason: 'cache-hit', contractMaxMtimeMs, stampMs };
}

export function readCachedOpenApiDocument<T = Record<string, unknown>>(openApiPath: string): T {
  return JSON.parse(readFileSync(openApiPath, 'utf8')) as T;
}

export function writeOpenApiArtifacts(
  paths: OpenApiArtifactPaths,
  document: unknown,
  contractMaxMtimeMs: number,
): void {
  mkdirSync(path.dirname(paths.openApiPath), { recursive: true });
  writeFileSync(paths.openApiPath, JSON.stringify(document, null, 2));
  writeOpenApiStamp(paths.stampPath, contractMaxMtimeMs);
}

export function isOpenApiDevThrottleEnabled(nodeEnv: string | undefined): boolean {
  return (nodeEnv ?? process.env.NODE_ENV ?? 'development') === 'development';
}

export function isOpenApiForceRefreshEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OPENAPI_ONLY === 'true' || env.OPENAPI_FORCE_REFRESH === 'true';
}
