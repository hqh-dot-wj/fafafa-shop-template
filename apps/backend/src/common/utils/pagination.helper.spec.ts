import { PaginationHelper } from './pagination.helper';

describe('PaginationHelper', () => {
  describe('getPagination', () => {
    it('Given 默认参数, When getPagination, Then 返回 page=1 size=10 skip=0', () => {
      const result = PaginationHelper.getPagination();
      expect(result).toEqual({ skip: 0, take: 10, pageNum: 1, pageSize: 10 });
    });

    it('Given pageNum=2 pageSize=20, When getPagination, Then 返回 skip=20', () => {
      const result = PaginationHelper.getPagination({ pageNum: 2, pageSize: 20 });
      expect(result).toEqual({ skip: 20, take: 20, pageNum: 2, pageSize: 20 });
    });

    it('Given 字符串参数, When getPagination, Then 正确转换为数字', () => {
      const result = PaginationHelper.getPagination({ pageNum: '3', pageSize: '15' });
      expect(result).toEqual({ skip: 30, take: 15, pageNum: 3, pageSize: 15 });
    });

    it('Given pageNum=0, When getPagination, Then 修正为 page=1', () => {
      const result = PaginationHelper.getPagination({ pageNum: 0 });
      expect(result.pageNum).toBe(1);
      expect(result.skip).toBe(0);
    });

    it('Given 负数 pageNum, When getPagination, Then 修正为 page=1', () => {
      const result = PaginationHelper.getPagination({ pageNum: -1 });
      expect(result.pageNum).toBe(1);
    });

    it('Given 负数 pageSize, When getPagination, Then 修正为 size=10', () => {
      const result = PaginationHelper.getPagination({ pageSize: -5 });
      expect(result.pageSize).toBe(10);
    });

    it('Given offset 超过 5000, When getPagination, Then 抛出深分页限制错误', () => {
      expect(() => PaginationHelper.getPagination({ pageNum: 502, pageSize: 10 })).toThrow(/分页深度超出限制/);
    });

    it('Given offset 恰好 5000, When getPagination, Then 不抛错', () => {
      expect(() => PaginationHelper.getPagination({ pageNum: 501, pageSize: 10 })).not.toThrow();
    });
  });

  describe('paginate', () => {
    it('Given findMany 和 count, When paginate, Then 并行执行并返回结果', async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      const findMany = jest.fn().mockResolvedValue(rows);
      const count = jest.fn().mockResolvedValue(100);

      const result = await PaginationHelper.paginate(findMany, count);

      expect(result).toEqual({ rows, total: 100 });
      expect(findMany).toHaveBeenCalled();
      expect(count).toHaveBeenCalled();
    });

    it('Given 空结果, When paginate, Then 返回空数组和 total=0', async () => {
      const result = await PaginationHelper.paginate(
        () => Promise.resolve([]),
        () => Promise.resolve(0),
      );

      expect(result).toEqual({ rows: [], total: 0 });
    });
  });

  describe('buildDateRange', () => {
    it('Given beginTime 和 endTime, When buildDateRange, Then 返回 gte 和 lte', () => {
      const result = PaginationHelper.buildDateRange({
        beginTime: '2026-01-01',
        endTime: '2026-12-31',
      });

      expect(result).toEqual({
        gte: new Date('2026-01-01'),
        lte: new Date('2026-12-31'),
      });
    });

    it('Given 仅 beginTime, When buildDateRange, Then 仅返回 gte', () => {
      const result = PaginationHelper.buildDateRange({ beginTime: '2026-01-01' });
      expect(result).toEqual({ gte: new Date('2026-01-01') });
    });

    it('Given 仅 endTime, When buildDateRange, Then 仅返回 lte', () => {
      const result = PaginationHelper.buildDateRange({ endTime: '2026-12-31' });
      expect(result).toEqual({ lte: new Date('2026-12-31') });
    });

    it('Given 无参数, When buildDateRange, Then 返回 undefined', () => {
      expect(PaginationHelper.buildDateRange()).toBeUndefined();
      expect(PaginationHelper.buildDateRange({})).toBeUndefined();
    });
  });

  describe('buildStringFilter', () => {
    it('Given 有值, When buildStringFilter, Then 返回 contains 过滤', () => {
      expect(PaginationHelper.buildStringFilter('test')).toEqual({ contains: 'test' });
    });

    it('Given 空字符串, When buildStringFilter, Then 返回 undefined', () => {
      expect(PaginationHelper.buildStringFilter('')).toBeUndefined();
    });

    it('Given undefined, When buildStringFilter, Then 返回 undefined', () => {
      expect(PaginationHelper.buildStringFilter()).toBeUndefined();
    });
  });

  describe('buildInFilter', () => {
    it('Given 非空数组, When buildInFilter, Then 返回 in 过滤', () => {
      expect(PaginationHelper.buildInFilter([1, 2, 3])).toEqual({ in: [1, 2, 3] });
    });

    it('Given 空数组, When buildInFilter, Then 返回 undefined', () => {
      expect(PaginationHelper.buildInFilter([])).toBeUndefined();
    });

    it('Given undefined, When buildInFilter, Then 返回 undefined', () => {
      expect(PaginationHelper.buildInFilter()).toBeUndefined();
    });
  });
});
