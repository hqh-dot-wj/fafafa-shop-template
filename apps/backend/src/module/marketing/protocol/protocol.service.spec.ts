import { Test, TestingModule } from '@nestjs/testing';
import { MarketingProtocolService } from './protocol.service';

describe('MarketingProtocolService', () => {
  let service: MarketingProtocolService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [MarketingProtocolService],
    }).compile();

    service = moduleRef.get(MarketingProtocolService);
  });

  it('应返回冻结后的营销协议定义', () => {
    const definition = service.getDefinition();

    expect(definition.version).toBe('2026-04-19');
    expect(definition.canonicalMapping).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          legacy: 'activity',
          canonical: 'CampaignDraft/CampaignRelease',
        }),
      ]),
    );
    expect(definition.stopModes).toContain('pause-new-entry');
    expect(definition.stopModes).toContain('hard-stop');
    expect(definition.mutabilityMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: 'audience',
          published: 'NEW_RELEASE_REQUIRED',
        }),
      ]),
    );
    expect(definition.cutoverRegistry).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          routeName: 'marketing_config',
          replacement: 'marketing_campaign_center',
          phase: 'legacy-readonly',
        }),
      ]),
    );
  });
});
