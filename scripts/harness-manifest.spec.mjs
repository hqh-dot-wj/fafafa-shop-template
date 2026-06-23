import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  CHECK_ENTRIES,
  EXEC_PLAN_FILE_THRESHOLD,
  REQUIRED_DOCS,
  checkRequiredArtifacts,
  collectPromoteAfterIssues,
  effectiveSeverity,
  formatManifestTable,
  validateManifest,
} from './harness-manifest.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');

test('REQUIRED_DOCS is non-empty and paths are posix-style', () => {
  assert.ok(REQUIRED_DOCS.length >= 10);
  for (const docPath of REQUIRED_DOCS) {
    assert.ok(!docPath.includes('\\'), `expected posix path: ${docPath}`);
  }
});

test('validateManifest passes on repository root', () => {
  const report = validateManifest(repoRoot);
  assert.equal(report.ok, true, report.issues.map((item) => item.message).join('\n'));
});

test('validateManifest fails when a registered script is missing', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-manifest-'));
  const scriptsDir = path.join(tmpDir, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({
      name: 'tmp',
      scripts: {
        'harness:doctor': 'node scripts/harness-doctor.mjs',
        'harness:manifest': 'node scripts/harness-manifest.mjs',
        'verify-monorepo': 'node scripts/verify-monorepo.mjs',
        'verify:scripts': 'node scripts/tasks/package-scripts-governance.mjs',
        'check:slice': 'node scripts/tasks/changed-files.mjs check-slice',
      },
    }),
  );
  const report = validateManifest(tmpDir);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((item) => item.level === 'fail' && item.message.includes('script missing')));
});

test('formatManifestTable includes manifest version and threshold', () => {
  const table = formatManifestTable();
  assert.match(table, /Harness manifest/);
  assert.match(table, new RegExp(`EXEC_PLAN_FILE_THRESHOLD=${EXEC_PLAN_FILE_THRESHOLD}`));
  assert.ok(CHECK_ENTRIES.some((entry) => entry.id === 'check-redis-blocking'));
});

test('effectiveSeverity promotes warn to fail after promoteAfter date', () => {
  const entry = CHECK_ENTRIES.find((item) => item.id === 'check-export-limits');
  assert.ok(entry?.promoteAfter);
  assert.equal(effectiveSeverity(entry, new Date('2026-06-18T12:00:00Z')), 'warn');
  assert.equal(effectiveSeverity(entry, new Date('2026-06-20T12:00:00Z')), 'fail');
});

test('collectPromoteAfterIssues is empty before promoteAfter deadline', () => {
  const entry = CHECK_ENTRIES.find((item) => item.id === 'check-export-limits');
  assert.ok(entry);
  assert.equal(collectPromoteAfterIssues(new Date('2026-06-18T12:00:00Z')).length, 0);
  assert.ok(collectPromoteAfterIssues(new Date('2026-06-20T12:00:00Z')).length >= 1);
});

test('checkRequiredArtifacts matches REQUIRED_DOCS on repo root', () => {
  const { missing } = checkRequiredArtifacts(repoRoot);
  assert.deepEqual(missing, []);
});
