import { Status } from '@prisma/client';
import { parseJobLogListStatusFilter } from './job-log.service';

describe('parseJobLogListStatusFilter', () => {
  it('空或未传返回 undefined', () => {
    expect(parseJobLogListStatusFilter(undefined)).toBeUndefined();
    expect(parseJobLogListStatusFilter('')).toBeUndefined();
  });

  it('0 或 NORMAL 映射为成功状态', () => {
    expect(parseJobLogListStatusFilter('0')).toBe(Status.NORMAL);
    expect(parseJobLogListStatusFilter(Status.NORMAL)).toBe(Status.NORMAL);
  });

  it('1 或 STOP 映射为失败状态', () => {
    expect(parseJobLogListStatusFilter('1')).toBe(Status.STOP);
    expect(parseJobLogListStatusFilter(Status.STOP)).toBe(Status.STOP);
  });

  it('无法识别的字符串不筛选', () => {
    expect(parseJobLogListStatusFilter('x')).toBeUndefined();
  });
});
