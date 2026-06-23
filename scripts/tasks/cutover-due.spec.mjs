import assert from 'node:assert/strict';
import { findDueEntries } from './cutover-due.mjs';

assert.ok(Array.isArray(findDueEntries(new Date('2026-08-01'))));
console.log('cutover-due.spec.mjs OK');
