// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import { fetchCampaignPolicySchema, fetchPlayRuleSchema, fetchSceneTemplateSchema } from './orchestration';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('Marketing orchestration schema API', () => {
  it('fetchCampaignPolicySchema should GET policy schema endpoint', async () => {
    const res = await fetchCampaignPolicySchema('FIRST_ORDER');
    expect(res.data).toMatchObject({ url: '/admin/marketing/schema/policy/FIRST_ORDER', method: 'get' });
  });

  it('fetchPlayRuleSchema should GET play schema endpoint', async () => {
    const res = await fetchPlayRuleSchema('COURSE_GROUP_BUY');
    expect(res.data).toMatchObject({ url: '/admin/marketing/schema/play/COURSE_GROUP_BUY', method: 'get' });
  });

  it('fetchSceneTemplateSchema should GET scene template schema endpoint', async () => {
    const res = await fetchSceneTemplateSchema('NEW_CUSTOMER_ZONE');
    expect(res.data).toMatchObject({
      url: '/admin/marketing/schema/scene-template/NEW_CUSTOMER_ZONE',
      method: 'get',
    });
  });
});
