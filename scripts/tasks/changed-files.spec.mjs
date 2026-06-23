import assert from 'node:assert/strict';
import { test } from 'node:test';
import { affectedSlices } from './changed-files.mjs';

test('affectedSlices marks admin source changes for Vitest and view gate', () => {
  const report = affectedSlices(['apps/admin-web/src/views/system/user/index.vue']);

  assert.equal(report.slices.has('admin'), true);
  assert.equal(report.adminVitest, true);
  assert.equal(report.adminViews, true);
  assert.equal(report.adminE2e, false);
});

test('affectedSlices marks admin e2e and playwright config changes separately', () => {
  const report = affectedSlices(['apps/admin-web/e2e/smoke.spec.ts', 'apps/admin-web/playwright.config.ts']);

  assert.equal(report.slices.has('admin'), true);
  assert.equal(report.adminVitest, false);
  assert.equal(report.adminViews, false);
  assert.equal(report.adminE2e, true);
});
