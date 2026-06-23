import { mkdtempSync, mkdirSync, rmSync, writeFileSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import {
  listOpenApiContractSourceFiles,
  readCachedOpenApiDocument,
  resolveOpenApiArtifactPaths,
  shouldRegenerateOpenApiDocument,
  writeOpenApiArtifacts,
} from './openapi-refresh.util';
import { isOpenApiContractSource } from './openapi-contract-paths';

describe('openapi-contract-paths', () => {
  it('matches controller/dto/vo contract sources', () => {
    expect(isOpenApiContractSource('module/admin/system/user.controller.ts')).toBe(true);
    expect(isOpenApiContractSource('module/admin/system/dto/user.dto.ts')).toBe(true);
    expect(isOpenApiContractSource('module/admin/system/user.service.ts')).toBe(false);
  });
});

describe('openapi-refresh.util', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(tmpdir(), 'openapi-refresh-'));
    mkdirSync(path.join(rootDir, 'public'), { recursive: true });
    mkdirSync(path.join(rootDir, 'src', 'module', 'demo', 'dto'), { recursive: true });
    writeFileSync(path.join(rootDir, 'src', 'module', 'demo', 'dto', 'demo.dto.ts'), 'export class DemoDto {}');
    writeFileSync(path.join(rootDir, 'src', 'module', 'demo', 'demo.service.ts'), 'export class DemoService {}');
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('lists only contract source files', () => {
    const files = listOpenApiContractSourceFiles(path.join(rootDir, 'src'));
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('demo.dto.ts');
  });

  it('resolves artifacts from backend package root when cwd is monorepo root', () => {
    const repoRoot = mkdtempSync(path.join(tmpdir(), 'openapi-monorepo-'));
    try {
      mkdirSync(path.join(repoRoot, 'apps', 'backend', 'src'), { recursive: true });
      writeFileSync(path.join(repoRoot, 'apps', 'backend', 'package.json'), '{}');

      const paths = resolveOpenApiArtifactPaths(repoRoot);
      expect(paths.openApiPath).toBe(path.join(repoRoot, 'apps', 'backend', 'public', 'openApi.json'));
      expect(paths.srcRoot).toBe(path.join(repoRoot, 'apps', 'backend', 'src'));
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('refreshes when openApi.json is missing under dev throttle', () => {
    const result = shouldRegenerateOpenApiDocument({
      paths: {
        openApiPath: path.join(rootDir, 'public', 'openApi.json'),
        stampPath: path.join(rootDir, 'public', '.openapi-contract-max-mtime'),
        srcRoot: path.join(rootDir, 'src'),
      },
      throttleInDev: true,
    });
    expect(result.refresh).toBe(true);
    expect(result.reason).toBe('missing-openapi');
  });

  it('skips refresh when contract sources are older than stamp', () => {
    const dtoPath = path.join(rootDir, 'src', 'module', 'demo', 'dto', 'demo.dto.ts');
    const now = Date.now();
    const old = new Date(now - 60_000);
    utimesSync(dtoPath, old, old);

    writeOpenApiArtifacts(
      {
        openApiPath: path.join(rootDir, 'public', 'openApi.json'),
        stampPath: path.join(rootDir, 'public', '.openapi-contract-max-mtime'),
        srcRoot: path.join(rootDir, 'src'),
      },
      { openapi: '3.0.0', paths: {} },
      now,
    );

    const result = shouldRegenerateOpenApiDocument({
      paths: {
        openApiPath: path.join(rootDir, 'public', 'openApi.json'),
        stampPath: path.join(rootDir, 'public', '.openapi-contract-max-mtime'),
        srcRoot: path.join(rootDir, 'src'),
      },
      throttleInDev: true,
    });
    expect(result.refresh).toBe(false);
    expect(result.reason).toBe('cache-hit');
  });

  it('refreshes when a contract file is newer than stamp', () => {
    const paths = {
      openApiPath: path.join(rootDir, 'public', 'openApi.json'),
      stampPath: path.join(rootDir, 'public', '.openapi-contract-max-mtime'),
      srcRoot: path.join(rootDir, 'src'),
    };
    const past = Date.now() - 120_000;
    writeOpenApiArtifacts(paths, { openapi: '3.0.0' }, past);

    const dtoPath = path.join(rootDir, 'src', 'module', 'demo', 'dto', 'demo.dto.ts');
    const fresh = new Date();
    utimesSync(dtoPath, fresh, fresh);

    const result = shouldRegenerateOpenApiDocument({ paths, throttleInDev: true });
    expect(result.refresh).toBe(true);
    expect(result.reason).toBe('contract-changed');
  });

  it('reads cached openApi document from disk', () => {
    const openApiPath = path.join(rootDir, 'public', 'openApi.json');
    writeFileSync(openApiPath, JSON.stringify({ openapi: '3.0.0', info: { title: 't' } }));
    const doc = readCachedOpenApiDocument(openApiPath);
    expect(doc.info).toEqual({ title: 't' });
  });
});
