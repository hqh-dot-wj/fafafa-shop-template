import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFile, normalizePath, FORBIDDEN } from './check-repo-artifacts.mjs';

test('checkFile 对 logs/ 下的文件返回违规原因', () => {
  assert.ok(checkFile('logs/app-development-2025-12-17.log'));
  assert.ok(checkFile('logs/error.log'));
});

test('checkFile 对 grep_output.txt 返回违规原因', () => {
  assert.ok(checkFile('libs/common-types/src/grep_output.txt'));
  assert.ok(checkFile('some/dir/grep_output.json'));
});

test('checkFile 对 .log 扩展名返回违规原因', () => {
  assert.ok(checkFile('some/debug.log'));
  assert.ok(checkFile('apps/backend/server.log'));
});

test('checkFile 对 .codex/tmp/ 下的文件返回违规原因', () => {
  assert.ok(checkFile('.codex/tmp/session-data.json'));
  assert.ok(checkFile('.codex/runtime-logs/run.log'));
});

test('checkFile 对 .tmp 文件返回违规原因', () => {
  assert.ok(checkFile('some/file.tmp'));
});

test('checkFile 对正常源码文件返回 null', () => {
  assert.equal(checkFile('apps/backend/src/app.module.ts'), null);
  assert.equal(checkFile('apps/admin-web/src/views/index.vue'), null);
  assert.equal(checkFile('libs/common-types/src/api.d.ts'), null);
  assert.equal(checkFile('AGENTS.md'), null);
  assert.equal(checkFile('package.json'), null);
  assert.equal(checkFile('scripts/check-repo-artifacts.mjs'), null);
});

test('checkFile 对 upload/.gitkeep 放行', () => {
  assert.equal(checkFile('upload/.gitkeep'), null);
  assert.equal(checkFile('upload/README.md'), null);
});

test('checkFile 对 upload/ 下的实际文件返回违规原因', () => {
  assert.ok(checkFile('upload/images/photo.jpg'));
  assert.ok(checkFile('upload/2025/01/file.pdf'));
});

test('normalizePath 将反斜线统一为正斜线', () => {
  assert.equal(normalizePath('logs\\app.log'), 'logs/app.log');
  assert.equal(normalizePath('apps\\backend\\src'), 'apps/backend/src');
});

test('FORBIDDEN 数组不为空且每项均有 pattern 和 reason', () => {
  assert.ok(FORBIDDEN.length > 0);
  for (const entry of FORBIDDEN) {
    assert.ok(entry.pattern instanceof RegExp, `pattern 应是正则`);
    assert.ok(typeof entry.reason === 'string' && entry.reason.length > 0, `reason 应是非空字符串`);
  }
});
