import assert from 'node:assert/strict';
import test from 'node:test';

import { loadMatrixRoutes, matchGlob, matchQualityAttributes } from './quality-matrix-routes.mjs';

test('matchGlob matches finance module paths', () => {
  assert.equal(
    matchGlob('apps/backend/src/module/finance/ledger.service.ts', 'apps/backend/src/module/finance/**'),
    true,
  );
  assert.equal(matchGlob('apps/admin-web/src/views/home/index.vue', 'apps/backend/src/module/finance/**'), false);
});

test('matchQualityAttributes aggregates required attributes', () => {
  const routes = loadMatrixRoutes();
  const report = matchQualityAttributes(['apps/backend/src/module/finance/foo.service.ts'], routes);
  assert.ok(report.attributes.includes('correctness'));
  assert.ok(report.attributes.includes('security'));
});
