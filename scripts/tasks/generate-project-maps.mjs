#!/usr/bin/env node
/**
 * Generate agent-legible project maps from real repository sources.
 *
 * Sources:
 * - apps/backend/public/openApi.json
 * - apps/admin-web/src/router/elegant/routes.ts
 * - apps/admin-web/src/router/elegant/imports.ts
 * - apps/admin-web/src/router/routes/index.ts
 * - apps/admin-web/src/views/**
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const generatedDir = path.join(repoRoot, 'docs/generated');

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
const SOURCE_EXTENSIONS = new Set(['.vue', '.ts', '.tsx']);

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toPosix(filePath) {
  return filePath.replaceAll('\\', '/');
}

function relativePath(rootDir, filePath) {
  return toPosix(path.relative(rootDir, filePath));
}

function listSourceFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractRefs(value, refs = new Set()) {
  if (!value || typeof value !== 'object') return refs;
  if (typeof value.$ref === 'string') {
    refs.add(value.$ref.replace('#/components/schemas/', ''));
  }
  for (const nested of Object.values(value)) {
    extractRefs(nested, refs);
  }
  return refs;
}

export function collectOpenApiSurface(openApi) {
  const paths = openApi?.paths ?? {};
  const rows = [];

  for (const apiPath of Object.keys(paths).sort()) {
    const pathItem = paths[apiPath] ?? {};
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      const refs = new Set();
      extractRefs(operation.requestBody, refs);
      extractRefs(operation.responses, refs);
      rows.push({
        method: method.toUpperCase(),
        path: apiPath,
        tags: (operation.tags ?? []).join(', '),
        operationId: operation.operationId ?? '',
        summary: operation.summary ?? '',
        schemas: [...refs].sort().join(', '),
      });
    }
  }

  return rows;
}

export function parseElegantViewImports(source) {
  const map = new Map();
  const pattern = /^\s*['"]?([^'":]+)['"]?\s*:\s*\(\)\s*=>\s*import\(['"]@\/views\/([^'"]+)['"]\)/gm;

  pattern.lastIndex = 0;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    map.set(match[1], match[2]);
  }

  return map;
}

export function parseRouteEntries(source) {
  const routes = [];
  let current = null;

  for (const line of source.split(/\r?\n/)) {
    const nameMatch = line.match(/^\s*name:\s*['"]([^'"]+)['"]/);
    if (nameMatch) {
      current = { name: nameMatch[1], path: '', viewKey: '' };
      continue;
    }

    if (!current) continue;

    const pathMatch = line.match(/^\s*path:\s*['"]([^'"]+)['"]/);
    if (pathMatch) {
      current.path = pathMatch[1];
      continue;
    }

    const componentMatch = line.match(/^\s*component:\s*['"][^'"]*(?:\$?view\.)([^'"]+)['"]/);
    if (componentMatch) {
      current.viewKey = componentMatch[1];
      if (current.name && current.path) {
        routes.push(current);
      }
      current = null;
    }
  }

  return routes;
}

export function extractServiceApiImports(source) {
  const imports = new Set();
  const patterns = [/from\s+['"]@\/service\/api\/([^'"]+)['"]/g, /import\(\s*['"]@\/service\/api\/([^'"]+)['"]\s*\)/g];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
      imports.add(match[1].replace(/\.(ts|tsx|js|jsx)$/, ''));
    }
  }

  return [...imports].sort();
}

function collectApisForView(rootDir, viewPath) {
  if (!viewPath) return [];
  const absoluteViewPath = path.join(rootDir, 'apps/admin-web/src/views', viewPath);
  const viewDir =
    fs.existsSync(absoluteViewPath) && fs.statSync(absoluteViewPath).isDirectory()
      ? absoluteViewPath
      : path.dirname(absoluteViewPath);
  const imports = new Set();

  for (const filePath of listSourceFiles(viewDir)) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const apiImport of extractServiceApiImports(content)) {
      imports.add(apiImport);
    }
  }

  return [...imports].sort();
}

export function collectAdminRoutePageApiMap(rootDir = repoRoot) {
  const importsSource = readTextIfExists(path.join(rootDir, 'apps/admin-web/src/router/elegant/imports.ts'));
  const generatedRoutesSource = readTextIfExists(path.join(rootDir, 'apps/admin-web/src/router/elegant/routes.ts'));
  const customRoutesSource = readTextIfExists(path.join(rootDir, 'apps/admin-web/src/router/routes/index.ts'));
  const viewImports = parseElegantViewImports(importsSource);
  const routes = [...parseRouteEntries(generatedRoutesSource), ...parseRouteEntries(customRoutesSource)];
  const seen = new Set();
  const rows = [];

  for (const route of routes) {
    const viewPath = viewImports.get(route.viewKey) ?? '';
    const key = `${route.name}|${route.path}|${viewPath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      name: route.name,
      routePath: route.path,
      viewKey: route.viewKey,
      viewPath,
      apiImports: collectApisForView(rootDir, viewPath),
    });
  }

  rows.sort((a, b) => a.routePath.localeCompare(b.routePath) || a.name.localeCompare(b.name));
  return rows;
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((value) => String(value || '-').replaceAll('|', '\\|')).join(' | ')} |`),
  ].join('\n');
}

export function renderOpenApiSurfaceMap(rows, { generatedAt = new Date() } = {}) {
  const date = generatedAt.toISOString().slice(0, 10);
  return [
    '---',
    'title: OpenAPI Surface Map',
    'status: generated',
    'doc_type: governance',
    `last_verified: ${date}`,
    '---',
    '',
    '# OpenAPI Surface Map',
    '',
    '> Generated by `pnpm harness:maps`. Do not hand-edit.',
    '',
    `Total operations: ${rows.length}`,
    '',
    markdownTable(
      ['Method', 'Path', 'Tags', 'OperationId', 'Summary', 'Schemas'],
      rows.map((row) => [row.method, row.path, row.tags, row.operationId, row.summary, row.schemas]),
    ),
    '',
  ].join('\n');
}

export function renderAdminRoutePageApiMap(rows, { generatedAt = new Date() } = {}) {
  const date = generatedAt.toISOString().slice(0, 10);
  return [
    '---',
    'title: Admin Route Page API Map',
    'status: generated',
    'doc_type: governance',
    `last_verified: ${date}`,
    '---',
    '',
    '# Admin Route Page API Map',
    '',
    '> Generated by `pnpm harness:maps`. Do not hand-edit.',
    '',
    `Total routes with views: ${rows.length}`,
    '',
    markdownTable(
      ['Route', 'Name', 'View', 'API Imports'],
      rows.map((row) => [row.routePath, row.name, row.viewPath, row.apiImports.join(', ')]),
    ),
    '',
  ].join('\n');
}

export function generateProjectMaps(rootDir = repoRoot, outputDir = generatedDir) {
  ensureDir(outputDir);

  const openApiPath = path.join(rootDir, 'apps/backend/public/openApi.json');
  const openApi = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
  const openApiRows = collectOpenApiSurface(openApi);
  const adminRows = collectAdminRoutePageApiMap(rootDir);

  const outputs = [
    {
      path: path.join(outputDir, 'openapi-surface-map.md'),
      content: renderOpenApiSurfaceMap(openApiRows),
    },
    {
      path: path.join(outputDir, 'admin-route-page-api-map.md'),
      content: renderAdminRoutePageApiMap(adminRows),
    },
  ];

  for (const output of outputs) {
    fs.writeFileSync(output.path, output.content);
  }

  return outputs.map((output) => relativePath(rootDir, output.path));
}

export function main(rootDir = repoRoot) {
  const outputs = generateProjectMaps(rootDir);
  console.log('--- Project Maps 生成结果 ---');
  for (const output of outputs) {
    console.log(`✓ ${output}`);
  }
  return { ok: true, outputs };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
