// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchAdjustMemberPoints,
  fetchGetMemberList,
  fetchGetMemberOperationLogs,
  fetchGetMemberPointHistory,
  fetchUpdateMemberLevel,
  fetchUpdateMemberReferrer,
  fetchUpdateMemberStatus,
  fetchUpdateMemberTenant,
} from './member';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('Member API', () => {
  it('fetchGetMemberList should GET /admin/member/list', async () => {
    const params: Api.Member.MemberSearchParams = { pageNum: 1, pageSize: 10 };
    const res = await fetchGetMemberList(params);
    expect(res.data).toMatchObject({ url: '/admin/member/list', method: 'get', params });
  });

  it('fetchGetMemberList should work without params', async () => {
    const res = await fetchGetMemberList();
    expect(res.data).toMatchObject({ url: '/admin/member/list', method: 'get' });
  });

  it('fetchUpdateMemberReferrer should PUT /admin/member/referrer', async () => {
    const data = { memberId: 'm1', referrerId: 'm2' };
    const res = await fetchUpdateMemberReferrer(data);
    expect(res.data).toMatchObject({ url: '/admin/member/referrer', method: 'put', data });
  });

  it('fetchUpdateMemberTenant should PUT /admin/member/tenant', async () => {
    const data = { memberId: 'm1', tenantId: 't1' };
    const res = await fetchUpdateMemberTenant(data);
    expect(res.data).toMatchObject({ url: '/admin/member/tenant', method: 'put', data });
  });

  it('fetchUpdateMemberStatus should PUT /admin/member/status', async () => {
    const data = { memberId: 'm1', status: '1' };
    const res = await fetchUpdateMemberStatus(data);
    expect(res.data).toMatchObject({ url: '/admin/member/status', method: 'put', data });
  });

  it('fetchUpdateMemberLevel should PUT /admin/member/level', async () => {
    const data = { memberId: 'm1', levelId: 2 };
    const res = await fetchUpdateMemberLevel(data);
    expect(res.data).toMatchObject({ url: '/admin/member/level', method: 'put', data });
  });

  it('fetchGetMemberPointHistory should GET /admin/member/point/history', async () => {
    const params: Api.Member.PointHistorySearchParams = { memberId: 'm1', pageNum: 1, pageSize: 10 };
    const res = await fetchGetMemberPointHistory(params);
    expect(res.data).toMatchObject({ url: '/admin/member/point/history', method: 'get', params });
  });

  it('fetchAdjustMemberPoints should POST /admin/member/point/adjust', async () => {
    const data: Api.Member.PointAdjustment = { memberId: 'm1', amount: 100, remark: '补偿' };
    const res = await fetchAdjustMemberPoints(data);
    expect(res.data).toMatchObject({ url: '/admin/member/point/adjust', method: 'post', data });
  });

  it('fetchGetMemberOperationLogs should GET /admin/member/operation-logs', async () => {
    const params: Api.Member.MemberOperationLogParams = { memberId: 'm1', pageNum: 1, pageSize: 10 };
    const res = await fetchGetMemberOperationLogs(params);
    expect(res.data).toMatchObject({ url: '/admin/member/operation-logs', method: 'get', params });
  });
});
