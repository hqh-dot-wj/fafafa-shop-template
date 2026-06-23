import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateScripts } from './package-scripts-governance.mjs';

test('accepts stable public script families', () => {
  const violations = validateScripts({
    dev: 'turbo run dev',
    'dev:backend': 'turbo run dev --filter=@apps/backend',
    'dev:h5': 'pnpm dev:mp',
    'build:h5': 'pnpm build:mp',
    'fix:changed': 'node scripts/tasks/changed-files.mjs fix',
    'check:slice': 'node scripts/tasks/changed-files.mjs check-slice',
    'report:strict': 'node scripts/tasks/strict-report.mjs',
    'verify:scripts': 'node scripts/tasks/package-scripts-governance.mjs',
    'contracts:generate': 'turbo run generate-types --filter=@libs/common-types',
    'harness:maps': 'node scripts/tasks/generate-project-maps.mjs',
  });

  assert.deepEqual(violations, []);
});

test('rejects forbidden changed-file aliases and domain root scripts', () => {
  const violations = validateScripts({
    'format:changed': 'prettier --write',
    'report:strict:admin': 'vue-tsc',
    'ledger:marketing-runtime': 'pnpm --filter @apps/backend ledger:marketing-runtime',
    'monitoring:up': 'docker compose up',
  });

  assert.equal(violations.length, 4);
  assert.ok(violations.some((violation) => violation.startsWith('format:changed:')));
  assert.ok(violations.some((violation) => violation.startsWith('report:strict:admin:')));
  assert.ok(violations.some((violation) => violation.startsWith('ledger:marketing-runtime:')));
  assert.ok(violations.some((violation) => violation.startsWith('monitoring:up:')));
});
