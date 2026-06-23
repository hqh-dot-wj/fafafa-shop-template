import { beforeEach, describe, expect, it, vi } from 'vitest';

const httpGet = vi.fn();

vi.mock('@/http/http', () => ({
  httpGet,
}));

describe('points api', () => {
  beforeEach(() => {
    httpGet.mockReset();
  });

  it('calls client points asset endpoints with query params', async () => {
    httpGet.mockResolvedValue({ rows: [], total: 0 });

    const { getPointsBalance, getPointsLots, getPointsConsumeAllocations, getPointsRefundAllocations } = await import(
      './points'
    );

    await getPointsBalance();
    await getPointsLots({ pageNum: 1, pageSize: 20, relatedId: 'order-1' });
    await getPointsConsumeAllocations({ pageNum: 1, pageSize: 20, relatedId: 'order-1' });
    await getPointsRefundAllocations({ pageNum: 1, pageSize: 20, relatedId: 'order-1' });

    expect(httpGet).toHaveBeenNthCalledWith(1, '/client/marketing/points/balance', undefined, undefined, undefined);
    expect(httpGet).toHaveBeenNthCalledWith(
      2,
      '/client/marketing/points/lots',
      { pageNum: 1, pageSize: 20, relatedId: 'order-1' },
      undefined,
      undefined,
    );
    expect(httpGet).toHaveBeenNthCalledWith(
      3,
      '/client/marketing/points/consume-allocations',
      { pageNum: 1, pageSize: 20, relatedId: 'order-1' },
      undefined,
      undefined,
    );
    expect(httpGet).toHaveBeenNthCalledWith(
      4,
      '/client/marketing/points/refund-allocations',
      { pageNum: 1, pageSize: 20, relatedId: 'order-1' },
      undefined,
      undefined,
    );
  });
});
