import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  APP_CONTRACT_HINTS,
  checkContractFile,
  checkAppContractFile,
  extractFileHeader,
  GENERATED_FILES,
  isAppContractExceptionCandidate,
  REASON_KEYWORDS,
  EXPIRY_SIGNALS,
} from './check-contract-exceptions.mjs';

test('checkContractFile 对 api.d.ts 返回 null（自动生成文件跳过）', () => {
  const result = checkContractFile('libs/common-types/src/api.d.ts', '// generated');
  assert.equal(result, null);
});

test('checkContractFile 对包含原因和过期信号的文件返回 null', () => {
  const content = [
    '/**',
    ' * Finance API 类型',
    ' * 请求参数来自 OpenAPI operations，响应类型优先使用 components schemas',
    ' */',
    '',
    '/** 佣金记录 - 待后端 @Api(type: CommissionRecordVo) 后切换至 schema */',
    'export interface CommissionRecordVo {',
    '  id: string;',
    '}',
  ].join('\n');

  assert.equal(checkContractFile('libs/common-types/src/finance.d.ts', content), null);
});

test('checkContractFile 对缺少文件头原因说明的文件报告问题', () => {
  const content = [
    '// 无任何关键词',
    '',
    '/** 某个类型 - 待后端对齐 */',
    'export interface SomeVo { id: string; }',
  ].join('\n');

  const result = checkContractFile('libs/common-types/src/some.d.ts', content);
  assert.ok(result !== null);
  assert.ok(result.issues.some((issue) => issue.includes('文件头')));
});

test('checkContractFile 对缺少过期信号的文件报告问题', () => {
  const content = [
    '/**',
    ' * Store VO 类型',
    ' * 与后端 VO 对齐，OpenAPI 未完整定义',
    ' */',
    '',
    'export interface StoreItemVo { id: string; name: string; }',
  ].join('\n');

  const result = checkContractFile('libs/common-types/src/store.d.ts', content);
  assert.ok(result !== null);
  assert.ok(result.issues.some((issue) => issue.includes('过期')));
});

test('checkContractFile 对同时缺少原因和过期信号的文件报告两个问题', () => {
  const content = 'export interface Foo { id: string; }';

  const result = checkContractFile('libs/common-types/src/foo.d.ts', content);
  assert.ok(result !== null);
  assert.equal(result.issues.length, 2);
});

test('extractFileHeader 正确提取 /** */ 注释块', () => {
  const content = [
    '/**',
    ' * Finance API',
    ' * OpenAPI 未完整定义',
    ' */',
    'import type { operations } from "./api";',
  ].join('\n');

  const header = extractFileHeader(content);
  assert.ok(header.includes('Finance API'));
  assert.ok(header.includes('OpenAPI'));
});

test('extractFileHeader 正确提取单行 // 注释', () => {
  const content = ['// PMS 属性类型', '// 与后端 VO 对齐', '', 'export type AttrType = string;'].join('\n');
  const header = extractFileHeader(content);
  assert.ok(header.includes('PMS'));
  assert.ok(header.includes('VO'));
});

test('GENERATED_FILES 包含 api.d.ts', () => {
  assert.ok(GENERATED_FILES.has('api.d.ts'));
});

test('REASON_KEYWORDS 和 EXPIRY_SIGNALS 均为非空数组', () => {
  assert.ok(REASON_KEYWORDS.length > 0);
  assert.ok(EXPIRY_SIGNALS.length > 0);
});

test('finance.d.ts 格式的内容能通过检查', () => {
  const content = [
    '/**',
    ' * Finance API 类型',
    ' * 请求参数来自 OpenAPI operations，响应类型优先使用 components schemas',
    ' */',
    'import type { components, operations } from "./api";',
    '',
    'export type CommissionStatus = "FROZEN" | "SETTLED";',
    '',
    '/** 佣金记录 - 待后端 @Api(type: CommissionRecordVo) 后切换至 schema */',
    'export interface CommissionRecordVo { id: string; }',
  ].join('\n');

  assert.equal(checkContractFile('libs/common-types/src/finance.d.ts', content), null);
});

test('isAppContractExceptionCandidate 能识别 admin API 中的本地契约例外', () => {
  const filePath = path.resolve('apps/admin-web/src/service/api/marketing/ai-prompt.ts');
  const content = [
    '/**',
    ' * AI 平台 Prompt 页面接口',
    ' * 当前 DTO/VO 未进入 @libs/common-types，字段变更时需同步核对 backend DTO。',
    ' */',
    'export interface AiPlatformPromptRow {',
    '  id: string;',
    '}',
  ].join('\n');

  assert.equal(isAppContractExceptionCandidate(filePath, content), true);
  assert.ok(APP_CONTRACT_HINTS.length > 0);
});

test('checkAppContractFile 对缺少过期信号的 app API 契约例外报告问题', () => {
  const filePath = path.resolve('apps/admin-web/src/service/api/marketing/ai-prompt.ts');
  const content = [
    '/**',
    ' * AI 平台 Prompt 页面接口',
    ' * 当前 DTO/VO 未进入 @libs/common-types，字段变更时需同步核对 backend DTO。',
    ' */',
    'export interface AiPlatformPromptRow {',
    '  id: string;',
    '}',
  ].join('\n');

  const result = checkAppContractFile(filePath, content);
  assert.ok(result !== null);
  assert.ok(result.issues.some((issue) => issue.includes('过期')));
});

test('checkAppContractFile 对包含 @expires 的 miniapp API 契约例外返回 null', () => {
  const filePath = path.resolve('apps/miniapp-client/src/api/address.ts');
  const content = [
    '/**',
    ' * 地址管理 API',
    ' * backend openApi 中 AddressVo 暂未独立导出，保留本地类型。',
    ' * @expires backend 导出 AddressVo 后切换至 generate-types。',
    ' */',
    'export interface AddressVo {',
    '  id: string;',
    '}',
  ].join('\n');

  assert.equal(checkAppContractFile(filePath, content), null);
});
