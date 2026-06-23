import { describe, expect, it, vi } from 'vitest';
import {
  fetchCampaignPolicySchema,
  fetchPlayRuleSchema,
  fetchSceneTemplateSchema,
} from '@/service/api/marketing/orchestration';
import { resolveNodeSchema } from './schema-resolver';

vi.mock('@/service/api/marketing/orchestration', () => ({
  fetchCampaignPolicySchema: vi.fn(),
  fetchPlayRuleSchema: vi.fn(),
  fetchSceneTemplateSchema: vi.fn(),
}));

describe('schema-resolver', () => {
  it('resolves static schema locally', async () => {
    const schema = await resolveNodeSchema(
      { source: 'static', schemaId: 'campaign-type-select' },
      { workflowData: {}, nodeFormData: {} },
    );

    expect(schema.properties.type?.enum).toContain('FIRST_ORDER');
  });

  it('fetches campaign policy schema from context fallback', async () => {
    vi.mocked(fetchCampaignPolicySchema).mockResolvedValueOnce({
      data: { type: 'object', properties: { discountAmount: { type: 'string' } } },
    } as never);

    const schema = await resolveNodeSchema(
      { source: 'campaign-policy', contextRef: 'campaign.type' },
      { workflowData: {}, nodeFormData: { 'select-type': { type: 'FIRST_ORDER' } } },
    );

    expect(fetchCampaignPolicySchema).toHaveBeenCalledWith('FIRST_ORDER');
    expect(schema.properties.discountAmount.type).toBe('string');
  });

  it('fetches play and scene-template schema endpoints', async () => {
    vi.mocked(fetchPlayRuleSchema).mockResolvedValueOnce({ data: { type: 'object', properties: {} } } as never);
    vi.mocked(fetchSceneTemplateSchema).mockResolvedValueOnce({ data: { type: 'object', properties: {} } } as never);

    await resolveNodeSchema(
      { source: 'play-rule', contextRef: 'campaign.type' },
      { workflowData: {}, nodeFormData: { 'select-type': { type: 'FLASH_SALE' } } },
    );
    await resolveNodeSchema(
      { source: 'scene-template', contextRef: 'scene.templateCode' },
      { workflowData: {}, nodeFormData: { 'select-template': { templateCode: 'NEW_CUSTOMER_ZONE' } } },
    );

    expect(fetchPlayRuleSchema).toHaveBeenCalledWith('FLASH_SALE');
    expect(fetchSceneTemplateSchema).toHaveBeenCalledWith('NEW_CUSTOMER_ZONE');
  });
});
