import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {
  PROCESSOR_FILE_PATTERN,
  WORKER_ENTRY_CANDIDATES,
  SCHEDULER_ENTRY_CANDIDATES,
  checkWorkerTopology,
} from './worker-topology-doctor.mjs';

// ── Invariants ──────────────────────────────────────────────────────────────

test('WORKER_ENTRY_CANDIDATES 至少包含 1 个候选路径', () => {
  assert.ok(WORKER_ENTRY_CANDIDATES.length >= 1);
});

test('SCHEDULER_ENTRY_CANDIDATES 至少包含 1 个候选路径', () => {
  assert.ok(SCHEDULER_ENTRY_CANDIDATES.length >= 1);
});

test('PROCESSOR_FILE_PATTERN 匹配 .processor.ts 和 .consumer.ts', () => {
  assert.ok(PROCESSOR_FILE_PATTERN.test('notification.processor.ts'));
  assert.ok(PROCESSOR_FILE_PATTERN.test('order.consumer.ts'));
  assert.ok(PROCESSOR_FILE_PATTERN.test('export.worker.ts'));
});

test('PROCESSOR_FILE_PATTERN 不匹配 .service.ts', () => {
  assert.ok(!PROCESSOR_FILE_PATTERN.test('resolution.service.ts'));
});

// ── checkWorkerTopology — 空目录 ─────────────────────────────────────────────

test('空目录：无 processor，无 findings', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-'));
  try {
    const { processors, findings } = checkWorkerTopology({ dir: tmpDir });
    assert.equal(processors.length, 0);
    assert.equal(findings.length, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── checkWorkerTopology — 有 processor 但无 Worker 入口 ────────────────────

test('有 processor 文件但无独立 Worker 入口时报告 same-process-workers', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'notify.processor.ts'), '@Process() async handle() {}');
    const { findings } = checkWorkerTopology({ dir: tmpDir });
    assert.ok(findings.some((f) => f.id === 'same-process-workers'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── checkWorkerTopology — spec 文件不被计入 processor 数 ──────────────────

test('*.processor.spec.ts 不被计入 processor 文件', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'notify.processor.spec.ts'), 'describe("x", () => {})');
    const { processors } = checkWorkerTopology({ dir: tmpDir });
    assert.equal(processors.length, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── checkWorkerTopology — findings 结构不变量 ──────────────────────────────

test('每个 finding 都有 id、severity、message、fix', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'job.processor.ts'), 'export class P {}');
    const { findings } = checkWorkerTopology({ dir: tmpDir });
    for (const f of findings) {
      assert.ok(typeof f.id === 'string');
      assert.ok(typeof f.severity === 'string');
      assert.ok(typeof f.message === 'string');
      assert.ok(typeof f.fix === 'string');
      assert.ok(Array.isArray(f.detail));
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
