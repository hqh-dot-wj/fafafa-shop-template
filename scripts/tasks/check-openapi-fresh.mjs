#!/usr/bin/env node
/**
 * check-openapi-fresh
 *
 * 当 git diff 命中 backend Controller / DTO / VO 变更，
 * 但生成契约产物未同步时发出警告。
 *
 * 提醒维护者：契约变更后须运行 pnpm dev:backend 刷新 OpenAPI，
 * 再跑 pnpm generate-types 让前端类型链路同步。
 *
 * 当前为 warn-only。模式：--branch（默认）/ --staged。
 */
import { execSync } from 'node:child_process';
import process from 'node:process';

const OPENAPI_PATH = 'apps/backend/public/openApi.json';
const GENERATED_TYPES_PATH = 'libs/common-types/src/api.d.ts';

import { isOpenApiContractSource as isTriggerFile } from './openapi-contract-paths.mjs';

export { isTriggerFile };

export function detectStaleOpenApi(
  changedFiles,
  { openApiPath = OPENAPI_PATH, generatedTypesPath = GENERATED_TYPES_PATH } = {},
) {
  const triggered = changedFiles.filter(isTriggerFile);
  const openApiChanged = changedFiles.includes(openApiPath);
  const generatedTypesChanged = changedFiles.includes(generatedTypesPath);
  return {
    triggered,
    openApiChanged,
    generatedTypesChanged,
    isStale: triggered.length > 0 && !openApiChanged && !generatedTypesChanged,
  };
}

const DEFAULT_BASE_CANDIDATES = ['origin/main', 'main'];

/**
 * 纯函数：根据 git 状态推算 branch 模式下要扫描的 diff 范围。
 * 不直接执行 git，便于单元测试。
 *
 * 返回 { kind, range?, reason? }：
 *   - 'range'         { range }  使用 `git diff --name-only <range>`
 *   - 'skip'          { reason } 无法可靠判断（在主分支、shallow checkout、无 main ref），上层应给出提示并跳过
 */
export function resolveBranchDiffPlan({ candidateBases = DEFAULT_BASE_CANDIDATES, getMergeBase, getHeadSha }) {
  const headSha = (getHeadSha() || '').trim();
  for (const ref of candidateBases) {
    let base = '';
    try {
      base = (getMergeBase(ref) || '').trim();
    } catch {
      base = '';
    }
    if (!base) continue;
    if (headSha && base === headSha) {
      // base 与 HEAD 相同：当前就在 main 分支顶端，无法用 base...HEAD 推算 PR 变更
      return {
        kind: 'skip',
        reason: `当前 HEAD 与 ${ref} 的 merge-base 相同（通常意味着正运行在 ${ref} 上），无法在主分支视角判断契约变更。请在 PR 分支上跑，或改用 --staged。`,
      };
    }
    return { kind: 'range', range: `${base}...HEAD` };
  }
  return {
    kind: 'skip',
    reason: `未找到任何可用的 base ref（尝试过：${candidateBases.join(', ')}）。可能是 shallow checkout，请在 CI 中 fetch 完整 main，或改用 --staged。`,
  };
}

function splitLines(out) {
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getChangedFiles(mode) {
  try {
    if (mode === 'staged') {
      return splitLines(execSync('git diff --cached --name-only', { encoding: 'utf-8' }));
    }
    const plan = resolveBranchDiffPlan({
      getMergeBase: (ref) => execSync(`git merge-base HEAD ${ref}`, { encoding: 'utf-8' }),
      getHeadSha: () => execSync('git rev-parse HEAD', { encoding: 'utf-8' }),
    });
    if (plan.kind === 'skip') {
      console.warn(`[check-openapi-fresh] 跳过 branch 模式：${plan.reason}`);
      return [];
    }
    return splitLines(execSync(`git diff --name-only ${plan.range}`, { encoding: 'utf-8' }));
  } catch (error) {
    console.warn('[check-openapi-fresh] 无法获取 git diff（可能不在 git 仓库或无 base）：', error.message);
    return [];
  }
}

function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--staged') ? 'staged' : 'branch';
  const changedFiles = getChangedFiles(mode);

  if (changedFiles.length === 0) {
    console.log('[check-openapi-fresh] OK — 无 backend 文件改动');
    process.exit(0);
  }

  const result = detectStaleOpenApi(changedFiles);
  if (!result.isStale) {
    console.log('[check-openapi-fresh] OK');
    process.exit(0);
  }

  console.warn('[check-openapi-fresh] 警告：backend 契约文件已改动，但生成契约产物未同步：\n');
  for (const f of result.triggered) console.warn('  -', f);
  console.warn('\n提示：');
  console.warn('  1. 运行 `pnpm dev:backend`（改 dto/controller/vo 会自动刷新；也可设 OPENAPI_FORCE_REFRESH=true 强制刷新）');
  console.warn('  2. 再跑 `pnpm generate-types` 同步前端类型');
  console.warn(
    '  3. 提交中通常应包含 `libs/common-types/src/api.d.ts` 变化；`apps/backend/public/openApi.json` 当前被 .gitignore 忽略，仅作为本地源产物',
  );
  console.warn('  4. 详细流程见 `.codex/playbooks/backend-safe-change.md` §跨 app 契约与 OpenAPI 刷新');
  console.warn('\n当前为 warn-only，不阻断构建。');
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check-openapi-fresh.mjs')) {
  main();
}
