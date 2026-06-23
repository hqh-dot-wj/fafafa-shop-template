import test from 'node:test';
import assert from 'node:assert/strict';
import { FAIL_RULE_IDS, REDIS_BLOCKING_PATTERNS, isExcludedFile, scanFileContent } from './check-redis-blocking.mjs';

// ── Invariants ──────────────────────────────────────────────────────────────

test('REDIS_BLOCKING_PATTERNS 包含 3 个规则', () => {
  assert.equal(REDIS_BLOCKING_PATTERNS.length, 3);
});

test('每个 REDIS_BLOCKING_PATTERN 都有 id、pattern、message', () => {
  for (const p of REDIS_BLOCKING_PATTERNS) {
    assert.ok(typeof p.id === 'string' && p.id.length > 0);
    assert.ok(p.pattern instanceof RegExp);
    assert.ok(typeof p.message === 'string' && p.message.length > 0);
  }
});

test('scanFileContent 对空文件返回空数组', () => {
  assert.deepEqual(scanFileContent('foo.ts', ''), []);
});

// ── isExcludedFile ───────────────────────────────────────────────────────────

test('isExcludedFile: *.spec.ts 应被排除', () => {
  assert.ok(isExcludedFile('apps/backend/src/cache.spec.ts'));
});

test('isExcludedFile: *.e2e-spec.ts 应被排除', () => {
  assert.ok(isExcludedFile('apps/backend/test/cache.e2e-spec.ts'));
});

test('isExcludedFile: 普通 service 文件不应被排除', () => {
  assert.ok(!isExcludedFile('apps/backend/src/module/cache/cache.service.ts'));
});

// ── redis-keys pattern ───────────────────────────────────────────────────────

test('检测 redis.keys()', () => {
  const content = `const keys = await this.redis.keys('tenant:*');`;
  const violations = scanFileContent('src/cache.service.ts', content);
  assert.ok(violations.some((v) => v.id === 'redis-keys'));
});

test('检测 client.keys()', () => {
  const content = `const keys = await client.keys('user:*');`;
  const violations = scanFileContent('src/cache.service.ts', content);
  assert.ok(violations.some((v) => v.id === 'redis-keys'));
});

test('不误报本地 Map.keys()', () => {
  const content = `const earliestKey = this.l1Cache.keys().next().value;`;
  const violations = scanFileContent('src/product.service.ts', content);
  assert.ok(!violations.some((v) => v.id === 'redis-keys'));
});

// ── lrange-unlimited pattern ─────────────────────────────────────────────────

test('检测 lrange(key, 0, -1)', () => {
  const content = `const items = await this.redis.lrange('queue:items', 0, -1);`;
  const violations = scanFileContent('src/queue.service.ts', content);
  assert.ok(violations.some((v) => v.id === 'lrange-unlimited'));
});

test('不误报有 limit 的 lrange（如 lrange(key, 0, 99)）', () => {
  const content = `const items = await this.redis.lrange('queue:items', 0, 99);`;
  const violations = scanFileContent('src/queue.service.ts', content);
  assert.ok(!violations.some((v) => v.id === 'lrange-unlimited'));
});

// ── keys-command-string pattern ──────────────────────────────────────────────

test('检测 KEYS 命令字符串', () => {
  const content = `await this.redis.call('KEYS tenant:*');`;
  const violations = scanFileContent('src/admin.service.ts', content);
  assert.ok(violations.some((v) => v.id === 'keys-command-string'));
});

// ── 边界：注释行不报告 ────────────────────────────────────────────────────────

test('跳过单行注释中的 redis.keys()', () => {
  const content = `// avoid: this.redis.keys('*')`;
  assert.deepEqual(scanFileContent('src/service.ts', content), []);
});

test('跳过 JSDoc 注释中的 KEYS 命令', () => {
  const content = ` * Example: 'KEYS pattern*'`;
  assert.deepEqual(scanFileContent('src/service.ts', content), []);
});

test('返回正确行号', () => {
  const content = `const a = 1;\nconst keys = await this.redis.keys('*');`;
  const violations = scanFileContent('src/service.ts', content);
  assert.equal(violations[0].line, 2);
});

// ── FAIL_RULE_IDS ─────────────────────────────────────────────────────────────

test('FAIL_RULE_IDS 包含 redis-keys', () => {
  assert.ok(FAIL_RULE_IDS.has('redis-keys'));
});

test('FAIL_RULE_IDS 不包含 lrange-unlimited（仍为 warn）', () => {
  assert.ok(!FAIL_RULE_IDS.has('lrange-unlimited'));
});

test('FAIL_RULE_IDS 不包含 keys-command-string（仍为 warn）', () => {
  assert.ok(!FAIL_RULE_IDS.has('keys-command-string'));
});
