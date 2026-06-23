// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import { fetchInstanceDetail, fetchInstanceList, fetchUpdateInstanceStatus } from './instance';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('Marketing Instance API', () => {
  it('fetchInstanceList should GET /marketing/instance/list', async () => {
    const params = { pageNum: 1, pageSize: 10, memberId: 'u1' };
    const res = await fetchInstanceList(params);
    expect(res.data).toMatchObject({ url: '/marketing/instance/list', method: 'get', params });
  });

  it('fetchInstanceDetail should GET /marketing/instance/:id', async () => {
    const res = await fetchInstanceDetail('ins-1');
    expect(res.data).toMatchObject({ url: '/marketing/instance/ins-1', method: 'get' });
  });

  it('fetchUpdateInstanceStatus should PATCH /marketing/instance/:id/status', async () => {
    const res = await fetchUpdateInstanceStatus('ins-1', 'SUCCESS', { orderId: 'o1' });
    expect(res.data).toMatchObject({
      url: '/marketing/instance/ins-1/status',
      method: 'patch',
      data: { status: 'SUCCESS', extraData: { orderId: 'o1' } },
    });
  });
});
