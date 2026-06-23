import { describe, expect, it } from 'vitest';
import { parseJobLogStatusFromQuery } from './job-log-route-search';

describe('parseJobLogStatusFromQuery', () => {
  it('应接受 0 与 1', () => {
    expect(parseJobLogStatusFromQuery('0')).toBe('0');
    expect(parseJobLogStatusFromQuery('1')).toBe('1');
  });

  it('非法或缺失时应为 null', () => {
    expect(parseJobLogStatusFromQuery(undefined)).toBeNull();
    expect(parseJobLogStatusFromQuery('2')).toBeNull();
    expect(parseJobLogStatusFromQuery('')).toBeNull();
    expect(parseJobLogStatusFromQuery(1)).toBeNull();
  });
});
