// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchApplySettlement,
  fetchAuditSettlement,
  fetchConsumeAsset,
  fetchGetSettlementList,
  fetchGetUserAssetList,
} from './finance';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('Marketing Finance API', () => {
  it('fetchGetSettlementList should GET /marketing/settlement/list', async () => {
    const params: Api.Marketing.SettlementSearchParams = { pageNum: 1, pageSize: 10 };
    const res = await fetchGetSettlementList(params);
    expect(res.data).toMatchObject({ url: '/marketing/settlement/list', method: 'get', params });
  });

  it('fetchApplySettlement should POST /marketing/settlement/apply', async () => {
    const data: Api.Marketing.SettlementApply = { storeId: 'store-1', applyAmount: 100, orderCount: 2 };
    const res = await fetchApplySettlement(data);
    expect(res.data).toMatchObject({ url: '/marketing/settlement/apply', method: 'post', data });
  });

  it('fetchAuditSettlement should PATCH /marketing/settlement/:id/audit', async () => {
    const data: Api.Marketing.SettlementAudit = { status: 'APPROVED', remark: '通过' };
    const res = await fetchAuditSettlement('stl-1', data);
    expect(res.data).toMatchObject({ url: '/marketing/settlement/stl-1/audit', method: 'patch', data });
  });

  it('fetchGetUserAssetList should GET /marketing/asset/list', async () => {
    const res = await fetchGetUserAssetList();
    expect(res.data).toMatchObject({ url: '/marketing/asset/list', method: 'get' });
  });

  it('fetchConsumeAsset should POST /marketing/asset/:id/consume', async () => {
    const res = await fetchConsumeAsset('asset-1', 50);
    expect(res.data).toMatchObject({
      url: '/marketing/asset/asset-1/consume',
      method: 'post',
      data: { amount: 50 },
    });
  });
});
