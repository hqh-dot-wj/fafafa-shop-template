// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchCreateShareQrcode,
  fetchCreateShareToken,
  fetchGetApplicationList,
  fetchGetCommissionPreview,
  fetchGetDistributionConfig,
  fetchGetDistributionConfigLogs,
  fetchGetDistributionDashboard,
  fetchGetLevelList,
  fetchGetReviewConfig,
  fetchGetSharePolicy,
  fetchGetShareTokenLogs,
  fetchUpdateDistributionConfig,
  fetchUpdateSharePolicy,
} from './distribution';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

function expectRequestConfig(
  actual: unknown,
  expected: {
    url: string;
    method: string;
    params?: unknown;
    data?: unknown;
  },
) {
  const config = actual as Record<string, unknown>;
  expect(config.url).toBe(expected.url);
  expect(config.method).toBe(expected.method);
  if ('params' in expected) {
    expect(config.params).toEqual(expected.params);
  }
  if ('data' in expected) {
    expect(config.data).toEqual(expected.data);
  }
}

describe('Distribution API', () => {
  it('fetchGetDistributionConfig should have correct config', async () => {
    const res = await fetchGetDistributionConfig();
    expectRequestConfig(res.data, {
      url: '/store/distribution/config',
      method: 'get',
    });
  });

  it('fetchUpdateDistributionConfig should have correct config', async () => {
    const data: Api.Store.DistributionConfigUpdateParams = {
      level1Rate: 10,
      level2Rate: 5,
      enableLV0: true,
      enableCrossTenant: false,
      crossTenantRate: 80,
      crossMaxDaily: 500,
      commissionBaseType: 'ORIGINAL_PRICE',
      maxCommissionRate: 50,
    };
    const res = await fetchUpdateDistributionConfig(data);
    expectRequestConfig(res.data, {
      url: '/store/distribution/config',
      method: 'post',
      data,
    });
  });

  it('fetchGetDistributionConfigLogs should have correct config with pagination', async () => {
    const params = { pageNum: 1, pageSize: 10 };
    const res = await fetchGetDistributionConfigLogs(params);
    expectRequestConfig(res.data, {
      url: '/store/distribution/config/logs',
      method: 'get',
      params,
    });
  });

  it('fetchGetCommissionPreview should have correct config', async () => {
    const data: Api.Store.CommissionPreviewDto = {
      tenantId: 'T001',
      items: [{ skuId: 'sku1', quantity: 2 }],
      shareUserId: 'user1',
    };
    const res = await fetchGetCommissionPreview(data);
    expectRequestConfig(res.data, {
      url: '/store/distribution/commission/preview',
      method: 'post',
      data,
    });
  });

  it('fetchGetDistributionDashboard should have correct config', async () => {
    const params: Api.Store.GetDashboardDto = { startDate: '2026-01-01', endDate: '2026-01-31' };
    const res = await fetchGetDistributionDashboard(params);
    expectRequestConfig(res.data, {
      url: '/store/distribution/dashboard',
      method: 'get',
      params,
    });
  });

  it('fetchGetLevelList should have correct config', async () => {
    const params: Api.Store.LevelSearchParams = {};
    const res = await fetchGetLevelList(params);
    expectRequestConfig(res.data, {
      url: '/store/distribution/level/list',
      method: 'get',
    });
  });

  it('fetchGetApplicationList should have correct config', async () => {
    const params: Api.Store.ListApplicationDto = { pageNum: 1, pageSize: 10 };
    const res = await fetchGetApplicationList(params);
    expectRequestConfig(res.data, {
      url: '/store/distribution/application/list',
      method: 'get',
      params,
    });
  });

  it('fetchGetReviewConfig should have correct config', async () => {
    const res = await fetchGetReviewConfig();
    expectRequestConfig(res.data, {
      url: '/store/distribution/application/config',
      method: 'get',
    });
  });

  it('fetchGetSharePolicy should have correct config', async () => {
    const res = await fetchGetSharePolicy();
    expectRequestConfig(res.data, {
      url: '/store/distribution/share-policy',
      method: 'get',
    });
  });

  it('fetchUpdateSharePolicy should have correct config', async () => {
    const data: Api.Store.UpdateSharePolicyDto = {
      linkExpireMinutes: 1440,
      maxClickCount: 100,
      maxBindCount: 20,
      maxOrderCount: 20,
      bindingMode: 'BOTH',
      attributionMode: 'LAST_TOUCH',
      attributionWindowMinutes: 10080,
      enableCrossTenantBind: false,
      isActive: true,
    };

    const res = await fetchUpdateSharePolicy(data);
    expectRequestConfig(res.data, {
      url: '/store/distribution/share-policy',
      method: 'post',
      data,
    });
  });

  it('fetchCreateShareToken should have correct config', async () => {
    const data: Api.Store.CreateShareTokenDto = {
      shareUserId: 'M1001',
      bizType: 'PRODUCT',
      bizId: 'P1001',
    };
    const res = await fetchCreateShareToken(data);
    expectRequestConfig(res.data, {
      url: '/store/distribution/share-token',
      method: 'post',
      data,
    });
  });

  it('fetchCreateShareQrcode should have correct config', async () => {
    const data: Api.Store.CreateShareQrcodeDto = {
      sid: 'DST_xxx',
      width: 430,
      envVersion: 'release',
    };
    const res = await fetchCreateShareQrcode(data);
    expectRequestConfig(res.data, {
      url: '/store/distribution/share-token/qrcode',
      method: 'post',
      data,
    });
  });

  it('fetchGetShareTokenLogs should have correct config', async () => {
    const params: Api.Store.ListShareTokenLogDto = {
      pageNum: 1,
      pageSize: 10,
      sid: 'DST_xxx',
    };
    const res = await fetchGetShareTokenLogs(params);
    expectRequestConfig(res.data, {
      url: '/store/distribution/share-token/logs',
      method: 'get',
      params,
    });
  });
});
