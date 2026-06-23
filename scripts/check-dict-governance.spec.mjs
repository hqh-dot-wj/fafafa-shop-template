import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  collectHardcodedOptionFindings,
  detectGovernedHardcodedOptions,
  detectHardcodedOptions,
  detectMissingDictTypes,
} from './check-dict-governance.mjs';

test('detectMissingDictTypes 会返回 registry 中缺失于 seed/init 的 dictType', () => {
  const registryTypes = ['sys_user_sex', 'sys_show_hide', 'sys_user_sex', 'sys_job_status', 'pms_publish_status'];
  const seedTypes = ['sys_show_hide', 'sys_job_status'];

  assert.deepEqual(detectMissingDictTypes(registryTypes, seedTypes), ['sys_user_sex', 'pms_publish_status']);
});

test('detectHardcodedOptions 会识别 const *Options = [ 的硬编码选项', () => {
  const content = [
    'const statusOptions = [',
    "  { label: '启用', value: '1' },",
    '];',
    '',
    'export const typeOptions = [',
    "  { label: 'A', value: 'a' },",
    '];',
    '',
    'const notOptions = {',
    '  foo: []',
    '};',
  ].join('\n');

  assert.deepEqual(detectHardcodedOptions(content), [
    { name: 'statusOptions', line: 1 },
    { name: 'typeOptions', line: 5 },
  ]);
});

test('detectGovernedHardcodedOptions 仅识别可映射到治理字典且未 useDict 的选项', () => {
  const content = [
    'const statusOptions = [',
    "  { label: '已上架', value: 'ON_SHELF' },",
    "  { label: '已下架', value: 'OFF_SHELF' },",
    '];',
    '',
    'const localOptions = [',
    "  { label: '草稿', value: 'DRAFT' },",
    "  { label: '发布', value: 'PUBLISHED' },",
    '];',
    '',
    "const { options } = useDict('pms_publish_status', true);",
    '',
    'const alreadyDictOptions = [',
    "  { label: '上架', value: 'ON_SHELF' },",
    "  { label: '下架', value: 'OFF_SHELF' },",
    '];',
  ].join('\n');

  const dictValueMap = new Map([
    ['pms_publish_status', new Set(['ON_SHELF', 'OFF_SHELF'])],
    ['store_product_status', new Set(['ON_SHELF', 'OFF_SHELF'])],
  ]);

  assert.deepEqual(detectGovernedHardcodedOptions(content, dictValueMap), []);
});

test('detectGovernedHardcodedOptions 会标记未接入 useDict 的治理字典选项', () => {
  const content = [
    'const statusOptions = [',
    "  { label: '已上架', value: 'ON_SHELF' },",
    "  { label: '已下架', value: 'OFF_SHELF' },",
    '];',
  ].join('\n');

  const dictValueMap = new Map([
    ['pms_publish_status', new Set(['ON_SHELF', 'OFF_SHELF'])],
    ['store_product_status', new Set(['ON_SHELF', 'OFF_SHELF'])],
  ]);

  assert.deepEqual(detectGovernedHardcodedOptions(content, dictValueMap), [
    {
      name: 'statusOptions',
      line: 1,
      candidateDictTypes: ['pms_publish_status', 'store_product_status'],
      values: ['ON_SHELF', 'OFF_SHELF'],
    },
  ]);
});

test('collectHardcodedOptionFindings 支持阻塞与提示扫描范围分层', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dict-governance-'));
  try {
    fs.mkdirSync(path.join(tmpDir, 'apps/admin-web/src/views/store/product'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'apps/admin-web/src/views/system/message'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'apps/miniapp-client/src/pages/order'), { recursive: true });

    const source = [
      'const statusOptions = [',
      "  { label: '启用', value: 'ENABLE' },",
      "  { label: '停用', value: 'DISABLE' },",
      '];',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, 'apps/admin-web/src/views/store/product/index.vue'), source);
    fs.writeFileSync(path.join(tmpDir, 'apps/admin-web/src/views/system/message/index.vue'), source);
    fs.writeFileSync(path.join(tmpDir, 'apps/miniapp-client/src/pages/order/index.vue'), source);

    const findings = collectHardcodedOptionFindings(
      tmpDir,
      new Map([['sys_normal_disable', new Set(['ENABLE', 'DISABLE'])]]),
    );

    assert.deepEqual(
      findings.map((item) => [item.filePath, item.level]),
      [
        ['apps/admin-web/src/views/store/product/index.vue', 'fail'],
        ['apps/admin-web/src/views/system/message/index.vue', 'warn'],
        ['apps/miniapp-client/src/pages/order/index.vue', 'warn'],
      ],
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
