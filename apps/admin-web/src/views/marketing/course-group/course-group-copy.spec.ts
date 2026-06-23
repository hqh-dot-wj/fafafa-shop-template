import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const baseDir = path.dirname(fileURLToPath(import.meta.url));

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(baseDir, relativePath), 'utf8');
}

function expectSourceIncludes(source: string, text: string) {
  expect(source.includes(text)).toBe(true);
}

function expectSourceExcludes(source: string, text: string) {
  expect(source.includes(text)).toBe(false);
}

describe('course-group page copy consistency', () => {
  it('team list should use unified Chinese titles and actions', () => {
    const source = readSource('team/index.vue');

    expectSourceIncludes(source, '拼课团列表');
    expectSourceIncludes(source, '查看详情');
    expectSourceIncludes(source, '查看成员');
    expectSourceIncludes(source, '关闭拼课');
    expectSourceIncludes(source, '失败处理');
    expectSourceIncludes(source, '查看分佣');
  });

  it('team detail should use unified action labels', () => {
    const source = readSource('team-detail/index.vue');

    expectSourceIncludes(source, '拼课团详情');
    expectSourceIncludes(source, '课程履约总览');
    expectSourceIncludes(source, '排课列表');
    expectSourceIncludes(source, '考勤列表');
    expectSourceIncludes(source, '标记到课');
    expectSourceIncludes(source, '成员列表 / 参与口径');
    expectSourceIncludes(source, '刷新');
    expectSourceIncludes(source, '开始上课');
    expectSourceIncludes(source, '结束上课');
    expectSourceIncludes(source, '关闭拼课');
    expectSourceIncludes(source, '前往失败处理');
    expectSourceExcludes(source, '成员列表 / 履约口径');
  });

  it('failure list should use unified Chinese actions', () => {
    const source = readSource('failure/index.vue');

    expectSourceIncludes(source, '失败团列表');
    expectSourceIncludes(source, '查看详情');
    expectSourceIncludes(source, '关闭拼课');
    expectSourceIncludes(source, '前往团详情');
  });

  it('commission list should not contain obvious English hard-coded copy', () => {
    const source = readSource('commission/index.vue');

    expectSourceIncludes(source, '拼课分佣列表');
    expectSourceIncludes(source, '团编号');
    expectSourceIncludes(source, '门店');
    expectSourceIncludes(source, '重置');
    expectSourceIncludes(source, '搜索');
    expectSourceIncludes(source, '查看详情');
    expectSourceIncludes(source, '失败处理');

    expectSourceExcludes(source, 'Keyword');
    expect(source).not.toMatch(/>\s*Store\s*</);
    expectSourceExcludes(source, 'Search</NButton>');
    expectSourceExcludes(source, 'Reset</NButton>');
    expectSourceExcludes(source, 'Teams');
    expectSourceExcludes(source, 'Paid Members');
    expectSourceExcludes(source, 'Current Members');
    expectSourceExcludes(source, 'Estimated Commission');
    expectSourceExcludes(source, 'Actions');
    expectSourceExcludes(source, 'Team Detail');
    expectSourceExcludes(source, 'Failure Handling');
    expectSourceExcludes(source, 'Course Group Commission Ledger');
  });
});
