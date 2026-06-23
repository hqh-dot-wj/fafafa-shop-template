import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_LINES_TO_CHECK, REQUIRED_DESCRIBE_BLOCKS, analyzeSpecFile } from './check-test-spec-coverage.mjs';

// ── Invariants ──────────────────────────────────────────────────────────────

test('REQUIRED_DESCRIBE_BLOCKS 包含 invariants 和 boundary conditions', () => {
  assert.ok(REQUIRED_DESCRIBE_BLOCKS.some((b) => b.id === 'invariants'));
  assert.ok(REQUIRED_DESCRIBE_BLOCKS.some((b) => b.id === 'boundary'));
});

test('analyzeSpecFile 对 null 短文件（< MIN_LINES_TO_CHECK 行）返回 null', () => {
  const short = Array(MIN_LINES_TO_CHECK - 1)
    .fill("it('x', () => {})")
    .join('\n');
  assert.equal(analyzeSpecFile('src/foo.spec.ts', short), null);
});

// ── analyzeSpecFile — 合规文件 ───────────────────────────────────────────────

test('同时包含 invariants 和 boundary conditions 块的文件返回 null', () => {
  const lines = Array(MIN_LINES_TO_CHECK).fill('// filler');
  lines.push("describe('invariants', () => {});");
  lines.push("describe('boundary conditions', () => {});");
  const content = lines.join('\n');
  assert.equal(analyzeSpecFile('src/foo.spec.ts', content), null);
});

test('双引号 describe 块也能被识别', () => {
  const lines = Array(MIN_LINES_TO_CHECK).fill('// filler');
  lines.push('describe("invariants", () => {});');
  lines.push('describe("boundary conditions", () => {});');
  assert.equal(analyzeSpecFile('src/foo.spec.ts', lines.join('\n')), null);
});

// ── analyzeSpecFile — 缺失检测 ──────────────────────────────────────────────

test('缺少 invariants 块时报告 invariants 缺失', () => {
  const lines = Array(MIN_LINES_TO_CHECK).fill('// filler');
  lines.push("describe('boundary conditions', () => {});");
  const result = analyzeSpecFile('src/foo.spec.ts', lines.join('\n'));
  assert.ok(result !== null);
  assert.ok(result.missing.includes('invariants'));
  assert.ok(!result.missing.includes('boundary'));
});

test('缺少 boundary conditions 块时报告 boundary 缺失', () => {
  const lines = Array(MIN_LINES_TO_CHECK).fill('// filler');
  lines.push("describe('invariants', () => {});");
  const result = analyzeSpecFile('src/foo.spec.ts', lines.join('\n'));
  assert.ok(result !== null);
  assert.ok(result.missing.includes('boundary'));
  assert.ok(!result.missing.includes('invariants'));
});

test('同时缺少两个块时报告两个缺失', () => {
  const lines = Array(MIN_LINES_TO_CHECK + 1).fill("it('x', () => {});");
  const result = analyzeSpecFile('src/foo.spec.ts', lines.join('\n'));
  assert.ok(result !== null);
  assert.deepEqual(result.missing.sort(), ['boundary', 'invariants'].sort());
});

// ── 边界：MIN_LINES_TO_CHECK 精确阈值 ────────────────────────────────────────

test('恰好等于 MIN_LINES_TO_CHECK 行的文件触发检查', () => {
  const lines = Array(MIN_LINES_TO_CHECK).fill("it('x', () => {});");
  const result = analyzeSpecFile('src/foo.spec.ts', lines.join('\n'));
  // 没有 describe 块，应该报告缺失（不是 null）
  assert.ok(result !== null);
});

test('比 MIN_LINES_TO_CHECK 少一行的文件跳过检查返回 null', () => {
  const lines = Array(MIN_LINES_TO_CHECK - 1).fill("it('x', () => {});");
  assert.equal(analyzeSpecFile('src/foo.spec.ts', lines.join('\n')), null);
});
