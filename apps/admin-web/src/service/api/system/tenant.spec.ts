// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchBatchDeleteTenant,
  fetchCreateTenant,
  fetchGetTenantList,
  fetchSyncTenantConfig,
  fetchSyncTenantDict,
  fetchSyncTenantPackage,
  fetchUpdateTenant,
} from './tenant';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('System Tenant API', () => {
  it('fetchGetTenantList should GET /system/tenant/list', async () => {
    const params: Api.System.TenantSearchParams = { pageNum: 1, pageSize: 10 };
    const res = await fetchGetTenantList(params);
    expect(res.data).toMatchObject({ url: '/system/tenant/list', method: 'get', params });
  });

  it('fetchCreateTenant should POST /system/tenant with isEncrypt header', async () => {
    const data: Api.System.TenantOperateParams = { companyName: '新租户', contactUserName: '张三' };
    const res = await fetchCreateTenant(data);
    expect(res.data).toMatchObject({
      url: '/system/tenant',
      method: 'post',
      headers: expect.objectContaining({ isEncrypt: true }),
      data,
    });
  });

  it('fetchUpdateTenant should PUT /system/tenant', async () => {
    const data: Api.System.TenantOperateParams = { id: '1', companyName: '改名租户' };
    const res = await fetchUpdateTenant(data);
    expect(res.data).toMatchObject({ url: '/system/tenant', method: 'put', data });
  });

  it('fetchBatchDeleteTenant should DELETE /system/tenant/:ids (joined)', async () => {
    const res = await fetchBatchDeleteTenant(['1', '2']);
    expect(res.data).toMatchObject({ url: '/system/tenant/1,2', method: 'delete' });
  });

  it('fetchSyncTenantDict should GET /system/tenant/syncTenantDict', async () => {
    const res = await fetchSyncTenantDict();
    expect(res.data).toMatchObject({ url: '/system/tenant/syncTenantDict', method: 'get' });
  });

  it('fetchSyncTenantPackage should GET /system/tenant/syncTenantPackage', async () => {
    const params: Api.System.TenantPackageSyncParams = { packageId: 'pkg-1' };
    const res = await fetchSyncTenantPackage(params);
    expect(res.data).toMatchObject({ url: '/system/tenant/syncTenantPackage', method: 'get', params });
  });

  it('fetchSyncTenantConfig should GET /system/tenant/syncTenantConfig', async () => {
    const res = await fetchSyncTenantConfig();
    expect(res.data).toMatchObject({ url: '/system/tenant/syncTenantConfig', method: 'get' });
  });

  // FAFAFA-PIVOT-PHASE2-2026-06：原 fetchChangeTenant / fetchClearTenant 测试已随
  // 单实例单租户改造一并移除，对应实现已从 tenant.ts 删除。
});
