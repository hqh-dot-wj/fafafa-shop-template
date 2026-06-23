#!/usr/bin/env node
/**
 * 静态验证 OpenAPI 节流与 nest-cli 拆分（不启动 Nest）。
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isOpenApiContractSource } from './openapi-contract-paths.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const backendDir = path.join(rootDir, 'apps/backend');

function readJson(rel) {
  return JSON.parse(readFileSync(path.join(backendDir, rel), 'utf8'));
}

// 1) nest-cli 拆分
const devCli = readJson('nest-cli.json');
const buildCli = readJson('nest-cli.build.json');
assert.equal(devCli.compilerOptions?.plugins, undefined, 'dev nest-cli 不应含 swagger plugin');
assert.deepEqual(buildCli.compilerOptions?.plugins, ['@nestjs/swagger'], 'build nest-cli 应含 swagger plugin');
assert.match(
  readFileSync(path.join(backendDir, 'package.json'), 'utf8'),
  /nest build --type-check --config nest-cli\.build\.json/,
  'build 脚本应指向 nest-cli.build.json',
);
assert.doesNotMatch(
  readFileSync(path.join(backendDir, 'package.json'), 'utf8'),
  /nest start --watch.*nest-cli\.build/,
  'dev watch 不应使用 build 配置',
);

// 2) 真实仓库契约文件扫描规模（仅 stat，不启动服务）
import { readdirSync } from 'node:fs';
function listContractFilesSync(srcRoot) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
        const rel = path.relative(srcRoot, full).replace(/\\/g, '/');
        if (isOpenApiContractSource(rel)) files.push(full);
      }
    }
  };
  walk(srcRoot);
  return files;
}

const srcRoot = path.join(backendDir, 'src');
const contractFiles = listContractFilesSync(srcRoot);
const t0 = performance.now();
let maxMtime = 0;
for (const f of contractFiles) {
  const m = statSync(f).mtimeMs;
  if (m > maxMtime) maxMtime = m;
}
const scanMs = performance.now() - t0;

assert.ok(contractFiles.length > 50, `应扫描到足够多契约文件，实际 ${contractFiles.length}`);
assert.ok(scanMs < 500, `契约 mtime 扫描应在 500ms 内，实际 ${scanMs.toFixed(1)}ms`);

// 3) bootstrap 接线：development + 无 force 时会走 shouldRegenerate
const bootstrapSrc = readFileSync(path.join(backendDir, 'src/bootstrap/apply-app-bootstrap.ts'), 'utf8');
assert.match(bootstrapSrc, /shouldRegenerateOpenApiDocument/);
assert.match(bootstrapSrc, /readCachedOpenApiDocument/);
assert.match(bootstrapSrc, /isOpenApiDevThrottleEnabled/);
assert.match(bootstrapSrc, /if \(refreshDecision\.refresh\)[\s\S]*SwaggerModule\.createDocument/);
assert.match(bootstrapSrc, /} else \{[\s\S]*readCachedOpenApiDocument/);
assert.equal(
  (bootstrapSrc.match(/SwaggerModule\.createDocument\(/g) ?? []).length,
  1,
  'createDocument 调用应仅在 refresh 分支出现一次',
);

// 4) 模拟「只改 service」：契约 max mtime 不变 → 应 cache-hit（需本地已有 openApi）
const openApiPath = path.join(backendDir, 'public/openApi.json');
const stampPath = path.join(backendDir, 'public/.openapi-contract-max-mtime');
let simNote = '跳过（本地无 openApi.json）';
if (existsSync(openApiPath)) {
  const stampMs = existsSync(stampPath) ? Number(readFileSync(stampPath, 'utf8')) : 0;
  const openApiMtime = statSync(openApiPath).mtimeMs;
  const wouldSkip = stampMs > 0 ? maxMtime <= stampMs : maxMtime <= openApiMtime;
  simNote = wouldSkip
    ? `当前磁盘状态会跳过 createDocument（cache-hit 条件满足，stamp=${stampMs || '无'}）`
    : `当前磁盘状态会触发 refresh（契约 mtime=${maxMtime} > stamp/openApi）`;
}

console.log('[verify-openapi-throttle] OK');
console.log(`  nest-cli: dev 无 plugin / build 有 plugin — 接线正确`);
console.log(`  契约文件数: ${contractFiles.length}，mtime 扫描耗时: ${scanMs.toFixed(1)}ms`);
console.log(`  本地 openApi 模拟: ${simNote}`);
