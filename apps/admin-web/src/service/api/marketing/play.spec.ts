import { describe, expect, it, vi } from 'vitest';
import type { MarketingExecutablePlay } from './play';
import { buildMarketingPlayTypeNameByCode, fetchMarketingExecutablePlayTypes } from './play';

const requestMock = vi.hoisted(() => vi.fn());

vi.mock('@/service/request', () => ({
  request: requestMock,
}));

describe('Marketing Play API', () => {
  it('玩法名称映射应以执行玩法编码为准', () => {
    const map = buildMarketingPlayTypeNameByCode([
      {
        code: 'COURSE_GROUP_BUY',
        name: '拼课',
        hasInstance: true,
        hasState: true,
        canFail: true,
        canParallel: true,
        defaultStockMode: 'LAZY_CHECK',
      },
      {
        code: 'FLASH_SALE',
        name: '秒杀',
        hasInstance: true,
        hasState: true,
        canFail: false,
        canParallel: false,
        defaultStockMode: 'STRONG_LOCK',
      },
    ]);

    expect(map).toEqual({
      COURSE_GROUP_BUY: '拼课',
      FLASH_SALE: '秒杀',
    });
  });

  it('拉取可执行玩法应指向后端玩法注册表接口', async () => {
    const expectedRows: MarketingExecutablePlay[] = [
      {
        code: 'COURSE_GROUP_BUY',
        name: '拼课',
        hasInstance: true,
        hasState: true,
        canFail: true,
        canParallel: true,
        defaultStockMode: 'LAZY_CHECK',
      },
    ];
    requestMock.mockResolvedValue({
      data: expectedRows,
      error: null,
    });

    const rows = await fetchMarketingExecutablePlayTypes();

    expect(requestMock).toHaveBeenCalledWith({
      url: '/admin/marketing/play/types',
      method: 'get',
    });
    expect(rows).toEqual(expectedRows);
  });
});
