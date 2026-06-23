import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectAwaitDbCallsInLoop,
  detectConditionalE2eFlow,
  detectHardcodedSemanticOptions,
  detectLoopedDeleteCalls,
  detectPromiseAllWriteMap,
  detectRawStatusTextUsage,
  detectRequestConfigApiSpec,
  detectSourceStringTest,
  detectTimedWaitE2eFlow,
  detectTsNoCheck,
  evaluateQualityGateFile,
} from './check-quality-gates.mjs';

test('detectHardcodedSemanticOptions 会识别语义型硬编码选项数组', () => {
  const content = [
    'const statusOptions = [',
    "  { label: '进行中', value: 'UNDERWAY' },",
    "  { label: '已暂停', value: 'PAUSED' },",
    '];',
  ].join('\n');

  assert.deepEqual(detectHardcodedSemanticOptions(content), [
    { name: 'statusOptions', line: 1, values: ['UNDERWAY', 'PAUSED'] },
  ]);
});

test('detectHardcodedSemanticOptions 遇到允许注释时忽略命中', () => {
  const content = [
    '// quality-gate allow-semantic-options',
    'const statusOptions = [',
    "  { label: '进行中', value: 'UNDERWAY' },",
    "  { label: '已暂停', value: 'PAUSED' },",
    '];',
  ].join('\n');

  assert.deepEqual(detectHardcodedSemanticOptions(content), []);
});

test('detectHardcodedSemanticOptions 不应误判共享常量展开写法', () => {
  const content = [
    "import { COURSE_GROUP_TEAM_STATUS_OPTIONS } from '@libs/common-constants';",
    'const statusOptions = [...COURSE_GROUP_TEAM_STATUS_OPTIONS];',
  ].join('\n');

  assert.deepEqual(detectHardcodedSemanticOptions(content), []);
});

test('detectRawStatusTextUsage 会识别直接使用状态文本字段', () => {
  const content = "{{ detail?.teamStatusText || '-' }}";

  assert.deepEqual(detectRawStatusTextUsage(content), [{ field: 'teamStatusText', line: 1 }]);
});

test('detectTsNoCheck 会识别测试文件中的 ts-nocheck', () => {
  const content = ['// @ts-nocheck', "describe('x', () => {})"].join('\n');

  assert.deepEqual(detectTsNoCheck(content), [{ line: 1 }]);
});

test('detectSourceStringTest 会识别源码字符串测试', () => {
  const content = [
    "import fs from 'node:fs';",
    "const source = fs.readFileSync(sourcePath, 'utf8');",
    "expect(source).toContain(`useDict('pms_publish_status', true)`);",
  ].join('\n');

  assert.deepEqual(detectSourceStringTest(content), [{ line: 2 }]);
});

test('detectRequestConfigApiSpec 会识别 request 配置型 API 测试', () => {
  const content = [
    "vi.mock('@/service/request', () => ({ request: vi.fn() }));",
    "expect(res.data).toMatchObject({ url: '/system/user/list', method: 'get' });",
  ].join('\n');

  assert.deepEqual(detectRequestConfigApiSpec(content), [{ line: 1 }]);
});

test('detectConditionalE2eFlow 会识别条件跳过式 E2E 流程', () => {
  const content = [
    'if (await addButton.isVisible({ timeout: 3000 })) {',
    '  await addButton.click();',
    '}',
    'if (rows > 0) {',
    '  await page.getByText("编辑").click();',
    '}',
  ].join('\n');

  assert.deepEqual(detectConditionalE2eFlow(content), [{ line: 1 }, { line: 4 }]);
});

test('detectConditionalE2eFlow 遇到允许注释时忽略命中', () => {
  const content = [
    '// quality-gate allow-conditional-e2e',
    'if (await addButton.isVisible({ timeout: 3000 })) {',
    '  await addButton.click();',
    '}',
  ].join('\n');

  assert.deepEqual(detectConditionalE2eFlow(content), []);
});

test('detectTimedWaitE2eFlow 会识别固定等待', () => {
  const content = ['await page.waitForTimeout(500);', 'await expect(page.getByText("保存成功")).toBeVisible();'].join(
    '\n',
  );

  assert.deepEqual(detectTimedWaitE2eFlow(content), [{ line: 1 }]);
});

test('detectTimedWaitE2eFlow 遇到允许注释时忽略命中', () => {
  const content = ['// quality-gate allow-timed-wait-e2e', 'await page.waitForTimeout(500);'].join('\n');

  assert.deepEqual(detectTimedWaitE2eFlow(content), []);
});

test('detectLoopedDeleteCalls 会识别循环单删', () => {
  const content = [
    'await Promise.all(ids.map(id => fetchDeleteUser(id)));',
    'rows.forEach(item => fetchDeleteRole(item.id));',
  ].join('\n');

  assert.deepEqual(detectLoopedDeleteCalls(content), [{ line: 1 }, { line: 2 }]);
});

test('detectAwaitDbCallsInLoop 会识别循环中的数据库访问', () => {
  const content = [
    'for (const dictId of dictIds) {',
    '  const dictType = await this.dictTypeRepo.findById(dictId);',
    '  const count = await this.prisma.sysDictData.count({ where: { dictId } });',
    '}',
  ].join('\n');

  assert.deepEqual(detectAwaitDbCallsInLoop(content), [{ line: 1 }]);
});

test('detectPromiseAllWriteMap 会识别 Promise.all(map(update)) 批量写模式', () => {
  const content = [
    'await Promise.all(sortList.map(item => this.dictDataRepo.update(item.dictCode, { dictSort: item.dictSort })));',
  ].join('\n');

  assert.deepEqual(detectPromiseAllWriteMap(content), [{ line: 1 }]);
});

test('evaluateQualityGateFile 会按文件类型组合对应规则', () => {
  const adminViewContent = [
    'const statusOptions = [',
    "  { label: '进行中', value: 'UNDERWAY' },",
    "  { label: '已暂停', value: 'PAUSED' },",
    '];',
    "{{ detail?.teamStatusText || '-' }}",
  ].join('\n');

  const adminTestContent = [
    "vi.mock('@/service/request', () => ({ request: vi.fn() }));",
    "expect(res.data).toMatchObject({ url: '/system/user/list', method: 'get' });",
  ].join('\n');

  const backendContent = [
    'for (const dictId of dictIds) {',
    '  await this.dictTypeRepo.findById(dictId);',
    '}',
    'await Promise.all(sortList.map(item => this.dictDataRepo.update(item.dictCode, { dictSort: item.dictSort })));',
  ].join('\n');

  const adminE2eContent = [
    'if (await addButton.isVisible({ timeout: 3000 })) {',
    '  await addButton.click();',
    '}',
    'await page.waitForTimeout(500);',
  ].join('\n');

  assert.deepEqual(
    evaluateQualityGateFile('apps/admin-web/src/views/marketing/activity/list/index.vue', adminViewContent).map(
      (item) => item.ruleId,
    ),
    ['hardcoded-semantic-options', 'raw-status-text'],
  );

  assert.deepEqual(
    evaluateQualityGateFile('apps/admin-web/src/service/api/system/user.spec.ts', adminTestContent).map(
      (item) => item.ruleId,
    ),
    ['request-config-api-spec'],
  );

  assert.deepEqual(
    evaluateQualityGateFile('apps/backend/src/module/admin/system/dict/dict.service.ts', backendContent).map(
      (item) => item.ruleId,
    ),
    ['await-db-call-in-loop', 'promise-all-write-map'],
  );

  assert.deepEqual(
    evaluateQualityGateFile('apps/admin-web/e2e/system-user.spec.ts', adminE2eContent).map((item) => item.ruleId),
    ['conditional-e2e-flow', 'timed-wait-e2e-flow'],
  );
});
