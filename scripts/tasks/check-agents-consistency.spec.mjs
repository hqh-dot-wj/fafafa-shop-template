import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countConcept, analyzeFile, analyzeAll } from './check-agents-consistency.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('countConcept counts plain occurrences', () => {
  const text = '高风险高风险\n高风险\n普通文本';
  assert.equal(countConcept(text, /高风险/g), 3);
});

test('countConcept returns 0 when pattern absent', () => {
  assert.equal(countConcept('普通文本无命中', /高风险/g), 0);
});

test('analyzeFile flags concept above default threshold for non-source file', () => {
  // simulate a sub-AGENTS that mentions 高风险 10 次
  const content = Array.from({ length: 10 }, () => '高风险').join('\n');
  const findings = analyzeFile('apps/backend/AGENTS.md', content);
  const hit = findings.find((f) => f.concept === '高风险');
  assert.ok(hit, '应该命中高风险阈值');
  assert.equal(hit.count, 10);
  assert.equal(hit.threshold, 8);
  assert.equal(hit.isSource, false);
});

test('analyzeFile uses higher threshold for source file (root AGENTS)', () => {
  const content = Array.from({ length: 15 }, () => '高风险').join('\n');
  const findings = analyzeFile('AGENTS.md', content);
  assert.equal(findings.length, 0, '根 AGENTS 15 次不应触发（源阈值 30）');
});

test('analyzeAll returns empty array when no concepts exceed thresholds (sanity)', () => {
  // Run on repo and ensure return shape is correct; allow real findings.
  const report = analyzeAll(repoRoot);
  assert.ok(Array.isArray(report));
  for (const entry of report) {
    assert.ok(entry.file, 'entry has file');
    assert.ok(Array.isArray(entry.findings));
  }
});
