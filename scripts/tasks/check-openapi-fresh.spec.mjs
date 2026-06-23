import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isTriggerFile, detectStaleOpenApi, resolveBranchDiffPlan } from './check-openapi-fresh.mjs';

test('isTriggerFile matches controller files (folder pattern)', () => {
  assert.equal(isTriggerFile('apps/backend/src/module/admin/system/controller/user.ts'), true);
  assert.equal(isTriggerFile('apps/backend/src/module/client/order/controllers/order.ts'), true);
});

test('isTriggerFile matches dto/vo folder pattern', () => {
  assert.equal(isTriggerFile('apps/backend/src/module/admin/system/dto/user.dto.ts'), true);
  assert.equal(isTriggerFile('apps/backend/src/module/admin/system/vo/user.vo.ts'), true);
});

test('isTriggerFile matches .controller.ts / .dto.ts / .vo.ts naming', () => {
  assert.equal(isTriggerFile('apps/backend/src/module/admin/system/user.controller.ts'), true);
  assert.equal(isTriggerFile('apps/backend/src/module/admin/system/user.dto.ts'), true);
  assert.equal(isTriggerFile('apps/backend/src/module/admin/system/user.vo.ts'), true);
});

test('isTriggerFile rejects non-contract backend files', () => {
  assert.equal(isTriggerFile('apps/backend/src/module/admin/system/user.service.ts'), false);
  assert.equal(isTriggerFile('apps/backend/src/module/admin/system/user.repository.ts'), false);
  assert.equal(isTriggerFile('apps/backend/src/module/admin/system/user.module.ts'), false);
});

test('isTriggerFile rejects non-backend files', () => {
  assert.equal(isTriggerFile('apps/admin-web/src/views/system/user.vue'), false);
  assert.equal(isTriggerFile('libs/common-types/src/api.d.ts'), false);
});

test('detectStaleOpenApi flags when controller changed but openApi.json did not', () => {
  const result = detectStaleOpenApi([
    'apps/backend/src/module/admin/system/user.controller.ts',
    'apps/backend/src/module/admin/system/user.service.ts',
  ]);
  assert.equal(result.isStale, true);
  assert.equal(result.triggered.length, 1);
  assert.equal(result.openApiChanged, false);
});

test('detectStaleOpenApi clear when openApi.json also changed', () => {
  const result = detectStaleOpenApi([
    'apps/backend/src/module/admin/system/user.controller.ts',
    'apps/backend/public/openApi.json',
  ]);
  assert.equal(result.isStale, false);
  assert.equal(result.openApiChanged, true);
});

test('detectStaleOpenApi clear when generated common types changed', () => {
  const result = detectStaleOpenApi([
    'apps/backend/src/module/admin/system/user.controller.ts',
    'libs/common-types/src/api.d.ts',
  ]);
  assert.equal(result.isStale, false);
  assert.equal(result.openApiChanged, false);
  assert.equal(result.generatedTypesChanged, true);
});

test('detectStaleOpenApi clear when no trigger files changed', () => {
  const result = detectStaleOpenApi([
    'apps/backend/src/module/admin/system/user.service.ts',
    'apps/backend/src/module/admin/system/user.repository.ts',
  ]);
  assert.equal(result.isStale, false);
  assert.equal(result.triggered.length, 0);
});

test('resolveBranchDiffPlan returns base...HEAD range when origin/main is reachable', () => {
  const plan = resolveBranchDiffPlan({
    getMergeBase: (ref) => (ref === 'origin/main' ? 'abc123\n' : ''),
    getHeadSha: () => 'def456\n',
  });
  assert.equal(plan.kind, 'range');
  assert.equal(plan.range, 'abc123...HEAD');
});

test('resolveBranchDiffPlan falls back to local main when origin/main is missing', () => {
  const calls = [];
  const plan = resolveBranchDiffPlan({
    getMergeBase: (ref) => {
      calls.push(ref);
      if (ref === 'origin/main') throw new Error('unknown ref');
      return 'aaa111';
    },
    getHeadSha: () => 'bbb222',
  });
  assert.deepEqual(calls, ['origin/main', 'main']);
  assert.equal(plan.kind, 'range');
  assert.equal(plan.range, 'aaa111...HEAD');
});

test('resolveBranchDiffPlan returns skip when base equals HEAD (running on main)', () => {
  const plan = resolveBranchDiffPlan({
    getMergeBase: () => 'abc123',
    getHeadSha: () => 'abc123',
  });
  assert.equal(plan.kind, 'skip');
  assert.match(plan.reason, /主分支|merge-base/);
});

test('resolveBranchDiffPlan returns skip when no candidate base ref is reachable', () => {
  const plan = resolveBranchDiffPlan({
    getMergeBase: () => {
      throw new Error('unknown ref');
    },
    getHeadSha: () => 'def456',
  });
  assert.equal(plan.kind, 'skip');
  assert.match(plan.reason, /base ref|shallow/);
});
