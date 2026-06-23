import { classifyMarketingTemplateCode, isExecutableStorePlayTemplateCode } from './template-boundary.catalog';

describe('MarketingTemplateBoundaryCatalog', () => {
  it('classifies play_definition codes as executable store play templates', () => {
    for (const code of ['COURSE_GROUP_BUY', 'FLASH_SALE', 'MEMBER_UPGRADE']) {
      expect(classifyMarketingTemplateCode(code)).toMatchObject({
        code,
        category: 'PLAY_CAPABILITY',
        executable: true,
        source: 'PLAY_DEFINITION',
      });
      expect(isExecutableStorePlayTemplateCode(code)).toBe(true);
    }
  });

  it('classifies PT generated templates as non-executable form templates', () => {
    const boundary = classifyMarketingTemplateCode('PT_MOCK_123456');

    expect(boundary).toMatchObject({
      category: 'PLAY_CONFIG_TEMPLATE',
      executable: false,
      source: 'PLAY_TEMPLATE_TABLE',
    });
    expect(boundary.allowedConsumers).toEqual(['TEMPLATE_FORM']);
    expect(isExecutableStorePlayTemplateCode('PT_MOCK_123456')).toBe(false);
  });

  it('keeps display and entitlement templates out of store play config', () => {
    expect(classifyMarketingTemplateCode('CARD_TEMPLATE')).toMatchObject({
      category: 'DISPLAY_TEMPLATE',
      executable: false,
    });
    expect(classifyMarketingTemplateCode('COUPON_TEMPLATE')).toMatchObject({
      category: 'ENTITLEMENT_TEMPLATE',
      executable: false,
    });
    expect(classifyMarketingTemplateCode('POINTS_RULE')).toMatchObject({
      category: 'ENTITLEMENT_TEMPLATE',
      executable: false,
    });
  });
});
