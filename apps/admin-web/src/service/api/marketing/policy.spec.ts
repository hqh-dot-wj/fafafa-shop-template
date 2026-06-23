// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import { fetchPolicyList, fetchSaveResolverPolicy, fetchSaveSourcePolicy } from './policy';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('Marketing Policy API', () => {
  it('fetchPolicyList should GET /marketing/policy/list', async () => {
    const res = await fetchPolicyList({ pageNum: 1, pageSize: 10 });
    expect(res.data).toMatchObject({ url: '/marketing/policy/list', method: 'get' });
  });

  it('fetchSaveSourcePolicy should POST /marketing/policy/source', async () => {
    const res = await fetchSaveSourcePolicy({
      policyCode: 'SRC_001',
      policyName: '热销商品',
      clauses: [{ type: 'ALL' }],
    });
    expect(res.data).toMatchObject({ url: '/marketing/policy/source', method: 'post' });
  });

  it('fetchSaveResolverPolicy should POST /marketing/policy/resolver', async () => {
    const res = await fetchSaveResolverPolicy({
      policyCode: 'RSV_001',
      policyName: '标准裁决',
      primaryOfferTypes: ['DISCOUNT'],
      conflictMatrix: {},
    });
    expect(res.data).toMatchObject({ url: '/marketing/policy/resolver', method: 'post' });
  });
});
