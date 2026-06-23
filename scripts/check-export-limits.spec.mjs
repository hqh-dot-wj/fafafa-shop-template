import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPORT_ROUTE_KEYWORDS,
  PROTECTION_SIGNALS,
  extractExportMethods,
  hasProtection,
  isExcludedFile,
} from './check-export-limits.mjs';

// ── Invariants ──────────────────────────────────────────────────────────────

test('EXPORT_ROUTE_KEYWORDS 包含 export、download、excel 关键词', () => {
  assert.ok(EXPORT_ROUTE_KEYWORDS.some((k) => k.toLowerCase() === 'export'));
  assert.ok(EXPORT_ROUTE_KEYWORDS.some((k) => k.toLowerCase() === 'download'));
  assert.ok(EXPORT_ROUTE_KEYWORDS.some((k) => k.toLowerCase() === 'excel'));
});

test('PROTECTION_SIGNALS 至少 5 条', () => {
  assert.ok(PROTECTION_SIGNALS.length >= 5);
});

test('extractExportMethods 对空文件返回空数组', () => {
  assert.deepEqual(extractExportMethods(''), []);
});

// ── isExcludedFile ───────────────────────────────────────────────────────────

test('isExcludedFile: *.spec.ts 被排除', () => {
  assert.ok(isExcludedFile('apps/backend/src/export.spec.ts'));
});

test('isExcludedFile: *.controller.ts 不被排除', () => {
  assert.ok(!isExcludedFile('apps/backend/src/module/report/report.controller.ts'));
});

// ── extractExportMethods ─────────────────────────────────────────────────────

test('extractExportMethods 识别含 export 的路由', () => {
  const content = [
    "  @Get('export')",
    '  async exportData(@Query() query: ExportDto) {',
    '    return this.service.export(query);',
    '  }',
  ].join('\n');
  const methods = extractExportMethods(content);
  assert.equal(methods.length, 1);
  assert.ok(methods[0].routeLine.includes('export'));
});

test('extractExportMethods 识别含 excel 的路由', () => {
  const content = [
    "  @Post('download-excel')",
    '  async downloadExcel() {',
    '    return this.service.buildExcel();',
    '  }',
  ].join('\n');
  const methods = extractExportMethods(content);
  assert.equal(methods.length, 1);
});

test('extractExportMethods 不识别普通 @Get 路由', () => {
  const content = ["  @Get('list')", '  async list() {', '    return this.service.list();', '  }'].join('\n');
  const methods = extractExportMethods(content);
  assert.equal(methods.length, 0);
});

test('extractExportMethods 返回正确的 startLine（1-indexed）', () => {
  const content = [`const a = 1;`, `  @Get('export-data')`, `  async export() {}`].join('\n');
  const methods = extractExportMethods(content);
  assert.equal(methods[0].startLine, 2);
});

// ── hasProtection ────────────────────────────────────────────────────────────

test('hasProtection: 含 limit 关键词返回 true', () => {
  assert.ok(hasProtection('const { limit } = query;'));
});

test('hasProtection: 含 count 关键词返回 true', () => {
  assert.ok(hasProtection('if (count > MAX_EXPORT_COUNT)'));
});

test('hasProtection: 含 MAX_ 常量返回 true', () => {
  assert.ok(hasProtection('const MAX_ROWS = 10000;'));
});

test('hasProtection: 含队列 .add() 调用返回 true', () => {
  assert.ok(hasProtection('await this.exportQueue.add(payload);'));
});

test('hasProtection: 无任何保护信号返回 false', () => {
  assert.ok(!hasProtection('return this.service.buildExcel();'));
});

// ── 组合：有保护的接口不产生违规 ──────────────────────────────────────────────

test('含 limit 保护的导出接口不产生违规', () => {
  const content = [
    "  @Get('export')",
    '  async exportData(@Query() query: ExportDto) {',
    '    const limit = query.limit ?? 1000;',
    '    return this.service.export({ limit });',
    '  }',
  ].join('\n');
  const methods = extractExportMethods(content);
  assert.equal(methods.length, 1);
  assert.ok(hasProtection(methods[0].context));
});
