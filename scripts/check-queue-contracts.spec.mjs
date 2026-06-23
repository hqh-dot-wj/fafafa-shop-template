import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_SIGNALS, checkQueueContract, isExcludedFile, isQueueFile } from './check-queue-contracts.mjs';

// ── Invariants ──────────────────────────────────────────────────────────────

test('CONTRACT_SIGNALS 包含 jobId、tenantId、failureHandler 三个方面', () => {
  assert.ok('jobId' in CONTRACT_SIGNALS);
  assert.ok('tenantId' in CONTRACT_SIGNALS);
  assert.ok('failureHandler' in CONTRACT_SIGNALS);
});

test('每个 CONTRACT_SIGNALS 方面至少包含 1 个检测 pattern', () => {
  for (const [, patterns] of Object.entries(CONTRACT_SIGNALS)) {
    assert.ok(patterns.length >= 1);
  }
});

test('checkQueueContract 对空内容返回所有三个方面缺失', () => {
  const missing = checkQueueContract('');
  assert.deepEqual(missing.sort(), ['failureHandler', 'jobId', 'tenantId'].sort());
});

// ── isQueueFile ──────────────────────────────────────────────────────────────

test('isQueueFile: *.processor.ts 识别为队列文件', () => {
  assert.ok(isQueueFile('resolution.processor.ts'));
});

test('isQueueFile: *.consumer.ts 识别为队列文件', () => {
  assert.ok(isQueueFile('notification.consumer.ts'));
});

test('isQueueFile: *.worker.ts 识别为队列文件', () => {
  assert.ok(isQueueFile('export.worker.ts'));
});

test('isQueueFile: *.service.ts 不识别为队列文件', () => {
  assert.ok(!isQueueFile('resolution.service.ts'));
});

// ── isExcludedFile ───────────────────────────────────────────────────────────

test('isExcludedFile: *.spec.ts 被排除', () => {
  assert.ok(isExcludedFile('apps/backend/src/queue/resolution.processor.spec.ts'));
});

test('isExcludedFile: *.processor.ts 不被排除', () => {
  assert.ok(!isExcludedFile('apps/backend/src/queue/resolution.processor.ts'));
});

// ── checkQueueContract — jobId ────────────────────────────────────────────────

test('含 jobId 字段不报告 jobId 缺失', () => {
  const content = `async process(job: Job<{ jobId: string; tenantId: string }>) {}`;
  const missing = checkQueueContract(content);
  assert.ok(!missing.includes('jobId'));
});

test('含 job.id 不报告 jobId 缺失', () => {
  const content = `const id = job.id;`;
  const missing = checkQueueContract(content);
  assert.ok(!missing.includes('jobId'));
});

// ── checkQueueContract — tenantId ────────────────────────────────────────────

test('含 tenantId 字段不报告 tenantId 缺失', () => {
  const content = `const { tenantId, jobId } = job.data;`;
  const missing = checkQueueContract(content);
  assert.ok(!missing.includes('tenantId'));
});

// ── checkQueueContract — failureHandler ──────────────────────────────────────

test('含 @OnQueueFailed 不报告 failureHandler 缺失', () => {
  const content = `@OnQueueFailed()\nasync onFailed(job: Job, err: Error) {}`;
  const missing = checkQueueContract(content);
  assert.ok(!missing.includes('failureHandler'));
});

test('含 catch 块不报告 failureHandler 缺失', () => {
  const content = `try { await process(); } catch (err) { this.logger.error(err); }`;
  const missing = checkQueueContract(content);
  assert.ok(!missing.includes('failureHandler'));
});

// ── 完整合规的 processor 不产生任何缺失 ──────────────────────────────────────

test('完整合规的 processor 无任何缺失', () => {
  const content = [
    '@Processor(RESOLUTION_QUEUE)',
    'export class ResolutionProcessor {',
    '  @Process()',
    '  async process(job: Job<{ jobId: string; tenantId: string }>) {',
    '    const { jobId, tenantId } = job.data;',
    '    try {',
    '      await this.service.run(tenantId, jobId);',
    '    } catch (err) {',
    '      this.logger.error(err);',
    '    }',
    '  }',
    '  @OnQueueFailed()',
    '  onFailed(job: Job, err: Error) { this.logger.error(err); }',
    '}',
  ].join('\n');
  assert.deepEqual(checkQueueContract(content), []);
});
