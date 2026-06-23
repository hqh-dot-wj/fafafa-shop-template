import { describe, expect, it } from 'vitest';
import { buildOrderExportQueryParams } from './order-export-query';

describe('buildOrderExportQueryParams', () => {
  it('应包含列表筛选项与扁平时间键', () => {
    const sp = {
      pageNum: 2,
      pageSize: 20,
      orderSn: 'SO1',
      receiverPhone: '138',
      status: 'PAID' as const,
      orderType: 'PRODUCT' as const,
      memberId: 'm1',
      'params.beginTime': '2026-01-01',
      'params.endTime': '2026-01-31',
    } as unknown as Api.Order.SearchParams;

    expect(buildOrderExportQueryParams(sp)).toEqual({
      orderSn: 'SO1',
      receiverPhone: '138',
      status: 'PAID',
      orderType: 'PRODUCT',
      memberId: 'm1',
      'params.beginTime': '2026-01-01',
      'params.endTime': '2026-01-31',
    });
  });

  it('应支持嵌套 params 时间（与扁平键二选一）', () => {
    const sp = {
      orderSn: null,
      params: { beginTime: '2026-02-01', endTime: '2026-02-28' },
    } as unknown as Api.Order.SearchParams;

    expect(buildOrderExportQueryParams(sp)).toEqual({
      'params.beginTime': '2026-02-01',
      'params.endTime': '2026-02-28',
    });
  });

  it('空值不应进入查询串', () => {
    const sp = {
      orderSn: '',
      status: null,
      'params.beginTime': null,
    } as unknown as Api.Order.SearchParams;

    expect(buildOrderExportQueryParams(sp)).toEqual({});
  });
});
