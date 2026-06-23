// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import { fetchGetShopSettings, fetchUpdateShopSettings } from './shop-settings';

vi.mock('@/service/request', () => ({
  request: vi.fn((config) => Promise.resolve({ data: config })),
}));

describe('shop-settings api', () => {
  it('fetchGetShopSettings should GET /system/tenant/shop-settings', async () => {
    const res = await fetchGetShopSettings();
    expect(res.data).toMatchObject({ url: '/system/tenant/shop-settings', method: 'get' });
  });

  it('fetchUpdateShopSettings should PUT /system/tenant/shop-settings', async () => {
    const payload = { companyName: '演示店' };
    const res = await fetchUpdateShopSettings(payload);
    expect(res.data).toMatchObject({
      url: '/system/tenant/shop-settings',
      method: 'put',
      data: payload,
    });
  });
});
