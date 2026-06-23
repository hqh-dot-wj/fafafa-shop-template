import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSpecDrift } from './check-spec-drift.mjs';

test('accepts colocated __tests__ spec with matching basename', () => {
  const impl = 'apps/backend/src/module/marketing/resolution/services/resolution-explain.service.ts';
  const spec = 'apps/backend/src/module/marketing/resolution/__tests__/resolution-explain.service.spec.ts';

  const result = checkSpecDrift([impl, spec]);

  assert.equal(result.missing.length, 0);
  assert.equal(result.unsynced.length, 0);
});

test('accepts module spec that imports the changed implementation', () => {
  const impl = 'apps/backend/src/module/client/order/services/order-creation-application.service.ts';
  const spec = 'apps/backend/src/module/client/order/order.service.spec.ts';

  const result = checkSpecDrift([impl, spec]);

  assert.equal(result.missing.length, 0);
  assert.equal(result.unsynced.length, 0);
});

test('reports unsynced when an existing covering spec was not changed', () => {
  const impl = 'apps/backend/src/module/marketing/resolution/services/resolution-explain.service.ts';

  const result = checkSpecDrift([impl]);

  assert.equal(result.missing.length, 0);
  assert.equal(result.unsynced.length, 1);
  assert.equal(
    result.unsynced[0].spec,
    'apps/backend/src/module/marketing/resolution/__tests__/resolution-explain.service.spec.ts',
  );
});

test('reports missing when no exact, __tests__, or importing spec exists', () => {
  const impl = 'apps/backend/src/module/__fixture__/missing.service.ts';

  const result = checkSpecDrift([impl]);

  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0].spec, 'apps/backend/src/module/__fixture__/missing.service.spec.ts');
});
