// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  type ApproveParams,
  type ManualLevelParams,
  fetchApproveUpgrade,
  fetchGetUpgradeApplyList,
  fetchGetUpgradeStats,
  fetchManualLevel,
} from './upgrade';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('Member Upgrade API', () => {
  it('fetchGetUpgradeApplyList should GET /admin/upgrade/list', async () => {
    const params: Api.Member.UpgradeApplySearchParams = { pageNum: 1, pageSize: 10 };
    const res = await fetchGetUpgradeApplyList(params);
    expect(res.data).toMatchObject({ url: '/admin/upgrade/list', method: 'get', params });
  });

  it('fetchGetUpgradeApplyList should work without params', async () => {
    const res = await fetchGetUpgradeApplyList();
    expect(res.data).toMatchObject({ url: '/admin/upgrade/list', method: 'get' });
  });

  it('fetchGetUpgradeStats should GET /admin/upgrade/stats', async () => {
    const res = await fetchGetUpgradeStats();
    expect(res.data).toMatchObject({ url: '/admin/upgrade/stats', method: 'get' });
  });

  it('fetchApproveUpgrade should PUT /admin/upgrade/:id/approve with approve action', async () => {
    const data: ApproveParams = { action: 'approve' };
    const res = await fetchApproveUpgrade('apply-1', data);
    expect(res.data).toMatchObject({ url: '/admin/upgrade/apply-1/approve', method: 'put', data });
  });

  it('fetchApproveUpgrade should PUT with reject action and reason', async () => {
    const data: ApproveParams = { action: 'reject', reason: '资料不符' };
    const res = await fetchApproveUpgrade('apply-2', data);
    expect(res.data).toMatchObject({ url: '/admin/upgrade/apply-2/approve', method: 'put', data });
  });

  it('fetchManualLevel should PUT /admin/upgrade/member/:memberId/level', async () => {
    const data: ManualLevelParams = { targetLevel: 3, reason: '手动调级' };
    const res = await fetchManualLevel('m1', data);
    expect(res.data).toMatchObject({ url: '/admin/upgrade/member/m1/level', method: 'put', data });
  });
});
