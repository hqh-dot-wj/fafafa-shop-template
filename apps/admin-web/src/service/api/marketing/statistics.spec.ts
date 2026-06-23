// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import { fetchGetCouponStatistics, fetchGetPointsStatistics } from './statistics';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('Marketing Statistics API', () => {
  it('fetchGetCouponStatistics should GET /admin/marketing/coupon/statistics', async () => {
    const res = await fetchGetCouponStatistics({ templateId: 'tpl-1' });
    expect(res.data).toMatchObject({
      url: '/admin/marketing/coupon/statistics',
      method: 'get',
      params: { templateId: 'tpl-1' },
    });
  });

  it('fetchGetCouponStatistics should work without params', async () => {
    const res = await fetchGetCouponStatistics();
    expect(res.data).toMatchObject({ url: '/admin/marketing/coupon/statistics', method: 'get' });
  });

  it('fetchGetPointsStatistics should GET /admin/marketing/points/statistics/balance', async () => {
    const res = await fetchGetPointsStatistics();
    expect(res.data).toMatchObject({ url: '/admin/marketing/points/statistics/balance', method: 'get' });
  });
});
