// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchCreateStoreConfig,
  fetchDeleteStoreConfig,
  fetchGetStoreConfigList,
  fetchUpdateStoreConfig,
  fetchUpdateStoreConfigStatus,
} from './config';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('Marketing Config API', () => {
  it('fetchGetStoreConfigList should GET /marketing/config/list', async () => {
    const params: Api.Marketing.StoreConfigSearchParams = { pageNum: 1, pageSize: 10 };
    const res = await fetchGetStoreConfigList(params);
    expect(res.data).toMatchObject({ url: '/marketing/config/list', method: 'get', params });
  });

  it('fetchCreateStoreConfig should POST /marketing/config', async () => {
    const data: Api.Marketing.StoreConfigCreate = {
      serviceId: 'svc-1',
      serviceType: 'campaign',
      templateCode: 'tpl-1',
      rules: {},
      stockMode: 'SHARED',
    };
    const res = await fetchCreateStoreConfig(data);
    expect(res.data).toMatchObject({ url: '/marketing/config', method: 'post', data });
  });

  it('fetchUpdateStoreConfig should PUT /marketing/config/:id', async () => {
    const data: Api.Marketing.StoreConfigUpdate = { status: 'ENABLED' };
    const res = await fetchUpdateStoreConfig('cfg-1', data);
    expect(res.data).toMatchObject({ url: '/marketing/config/cfg-1', method: 'put', data });
  });

  it('fetchUpdateStoreConfigStatus should PATCH /marketing/config/:id/status', async () => {
    const res = await fetchUpdateStoreConfigStatus('cfg-1', '1');
    expect(res.data).toMatchObject({
      url: '/marketing/config/cfg-1/status',
      method: 'patch',
      data: { status: '1' },
    });
  });

  it('fetchDeleteStoreConfig should DELETE /marketing/config/:id', async () => {
    const res = await fetchDeleteStoreConfig('cfg-1');
    expect(res.data).toMatchObject({ url: '/marketing/config/cfg-1', method: 'delete' });
  });
});
