import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { analyzePlanFile, scanActivePlans } from './check-exec-plan-stale.mjs';

test('analyzePlanFile marks old last_updated as stale', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-plan-stale-'));
  const planPath = path.join(tmpDir, 'OLD-TASK.md');
  fs.writeFileSync(
    planPath,
    `---
task_id: OLD-TASK
status: active
last_updated: 2020-01-01
---
`,
  );
  const report = analyzePlanFile(planPath, 14);
  assert.equal(report.stale, true);
});

test('scanActivePlans returns empty when no active dir', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-plan-stale-empty-'));
  const report = scanActivePlans(tmpDir);
  assert.deepEqual(report.plans, []);
});
