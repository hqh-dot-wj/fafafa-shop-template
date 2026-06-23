import { describe, expect, it } from 'vitest';
import { getNextSortValue } from './sort';

describe('getNextSortValue', () => {
  it('Given 空列表, When 计算下一个排序, Then 返回 fallback 默认值 1', () => {
    const next = getNextSortValue([], () => 0);
    expect(next).toBe(1);
  });

  it('Given 有效排序列表, When 计算下一个排序, Then 返回最大值加 1', () => {
    const rows = [{ sort: 3 }, { sort: 7 }, { sort: 5 }];
    const next = getNextSortValue(rows, (row) => row.sort);
    expect(next).toBe(8);
  });

  it('Given 含无效排序值, When 计算下一个排序, Then 忽略无效值', () => {
    const rows = [{ sort: 'abc' }, { sort: null }, { sort: 2 }, { sort: '9' }];
    const next = getNextSortValue(rows, (row) => row.sort);
    expect(next).toBe(10);
  });

  it('Given 指定 fallback 与 step, When 计算下一个排序, Then 按配置递增', () => {
    const rows = [{ sort: 4 }];
    const next = getNextSortValue(rows, (row) => row.sort, { fallback: 10, step: 5 });
    expect(next).toBe(9);
  });
});
