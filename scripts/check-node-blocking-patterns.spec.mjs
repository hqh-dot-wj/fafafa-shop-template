import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKING_PATTERNS, FAIL_RULE_IDS, isExcludedFile, scanFileContent } from './check-node-blocking-patterns.mjs';

// ── Invariants ──────────────────────────────────────────────────────────────

test('BLOCKING_PATTERNS 包含 4 个规则', () => {
  assert.equal(BLOCKING_PATTERNS.length, 4);
});

test('每个 BLOCKING_PATTERN 都有 id、pattern、message', () => {
  for (const p of BLOCKING_PATTERNS) {
    assert.ok(typeof p.id === 'string' && p.id.length > 0);
    assert.ok(p.pattern instanceof RegExp);
    assert.ok(typeof p.message === 'string' && p.message.length > 0);
  }
});

test('scanFileContent 对空文件返回空数组', () => {
  const result = scanFileContent('foo.ts', '');
  assert.deepEqual(result, []);
});

// ── isExcludedFile ───────────────────────────────────────────────────────────

test('isExcludedFile: *.spec.ts 应被排除', () => {
  assert.ok(isExcludedFile('apps/backend/src/foo.spec.ts'));
});

test('isExcludedFile: *.e2e-spec.ts 应被排除', () => {
  assert.ok(isExcludedFile('apps/backend/src/auth.e2e-spec.ts'));
});

test('isExcludedFile: *.test.ts 应被排除', () => {
  assert.ok(isExcludedFile('apps/backend/src/utils/hash.test.ts'));
});

test('isExcludedFile: 普通 .ts 文件不应被排除', () => {
  assert.ok(!isExcludedFile('apps/backend/src/module/resolution/resolution.service.ts'));
});

// ── scanFileContent — 各 pattern 检测 ───────────────────────────────────────

test('scanFileContent 检测 readFileSync', () => {
  const content = `import { readFileSync } from 'fs';\nconst data = readFileSync('config.json', 'utf8');`;
  const violations = scanFileContent('src/service.ts', content);
  assert.ok(violations.some((v) => v.id === 'readFileSync'));
});

test('scanFileContent 检测 hashSync', () => {
  const content = `const hashed = bcrypt.hashSync(password, 10);`;
  const violations = scanFileContent('src/auth.service.ts', content);
  assert.ok(violations.some((v) => v.id === 'hashSync'));
});

test('scanFileContent 检测 pbkdf2Sync', () => {
  const content = `const key = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512');`;
  const violations = scanFileContent('src/crypto.ts', content);
  assert.ok(violations.some((v) => v.id === 'pbkdf2Sync'));
});

test('scanFileContent 检测 execSync', () => {
  const content = `const out = execSync('ls -la');`;
  const violations = scanFileContent('src/deploy.ts', content);
  assert.ok(violations.some((v) => v.id === 'execSync'));
});

// ── scanFileContent — 边界条件 ───────────────────────────────────────────────

test('scanFileContent 跳过单行注释中的模式', () => {
  const content = `// const data = readFileSync('x.json');`;
  const violations = scanFileContent('src/service.ts', content);
  assert.deepEqual(violations, []);
});

test('scanFileContent 跳过 JSDoc 注释中的模式', () => {
  const content = ` * Use readFileSync only at startup`;
  const violations = scanFileContent('src/service.ts', content);
  assert.deepEqual(violations, []);
});

test('scanFileContent 返回正确行号', () => {
  const content = `const a = 1;\nconst b = readFileSync('x');`;
  const violations = scanFileContent('src/service.ts', content);
  assert.equal(violations[0].line, 2);
});

test('scanFileContent text 截断为 120 字符', () => {
  const longLine = `const data = readFileSync(${'x'.repeat(200)});`;
  const violations = scanFileContent('src/service.ts', longLine);
  assert.ok(violations[0].text.length <= 120);
});

// ── FAIL_RULE_IDS ─────────────────────────────────────────────────────────────

test('FAIL_RULE_IDS 包含 hashSync', () => {
  assert.ok(FAIL_RULE_IDS.has('hashSync'));
});

test('FAIL_RULE_IDS 不包含 readFileSync（仍为 warn）', () => {
  assert.ok(!FAIL_RULE_IDS.has('readFileSync'));
});

test('FAIL_RULE_IDS 不包含 execSync（仍为 warn）', () => {
  assert.ok(!FAIL_RULE_IDS.has('execSync'));
});
