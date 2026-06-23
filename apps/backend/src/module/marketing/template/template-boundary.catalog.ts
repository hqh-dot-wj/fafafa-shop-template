import { isExecutableStorePlayCapabilityCode } from '../play/play-rule-schema.catalog';

export type MarketingTemplateCategory =
  | 'PLAY_CAPABILITY'
  | 'PLAY_CONFIG_TEMPLATE'
  | 'STORE_PLAY_CONFIG'
  | 'ENTITLEMENT_TEMPLATE'
  | 'DISPLAY_TEMPLATE'
  | 'SCENE_COMPOSITION_TEMPLATE'
  | 'UNKNOWN';

export type MarketingTemplateConsumer =
  | 'STORE_PLAY_CONFIG'
  | 'PLAY_INSTANCE'
  | 'TEMPLATE_FORM'
  | 'COUPON'
  | 'POINTS'
  | 'SCENE_POLICY'
  | 'CLIENT_CARD';

export interface MarketingTemplateBoundary {
  code: string;
  category: MarketingTemplateCategory;
  executable: boolean;
  source: 'PLAY_DEFINITION' | 'PLAY_TEMPLATE_TABLE' | 'POLICY' | 'ASSET_DOMAIN' | 'UNKNOWN';
  allowedConsumers: readonly MarketingTemplateConsumer[];
  reason: string;
}

/**
 * 模板边界目录只做分类解释和执行白名单，不把优惠券、积分、展示卡片强塞进 PlayTemplate。
 */
export function classifyMarketingTemplateCode(code: string): MarketingTemplateBoundary {
  const normalizedCode = code.trim();
  if (isExecutableStorePlayCapabilityCode(normalizedCode)) {
    return {
      code: normalizedCode,
      category: 'PLAY_CAPABILITY',
      executable: true,
      source: 'PLAY_DEFINITION',
      allowedConsumers: ['STORE_PLAY_CONFIG', 'PLAY_INSTANCE'],
      reason: '代码在 play_definition 中登记，并有代码处理器，代表可执行玩法能力。',
    };
  }

  if (normalizedCode.startsWith('PT_')) {
    return {
      code: normalizedCode,
      category: 'PLAY_CONFIG_TEMPLATE',
      executable: false,
      source: 'PLAY_TEMPLATE_TABLE',
      allowedConsumers: ['TEMPLATE_FORM'],
      reason: 'PT_ 前缀代表后台表单模板，不代表已经注册策略实现，不能直接用于门店玩法配置。',
    };
  }

  if (normalizedCode === 'CARD_TEMPLATE') {
    return {
      code: normalizedCode,
      category: 'DISPLAY_TEMPLATE',
      executable: false,
      source: 'POLICY',
      allowedConsumers: ['SCENE_POLICY', 'CLIENT_CARD'],
      reason: 'CARD_TEMPLATE 是场景展示策略类型，不是玩法执行模板。',
    };
  }

  if (normalizedCode.includes('COUPON')) {
    return {
      code: normalizedCode,
      category: 'ENTITLEMENT_TEMPLATE',
      executable: false,
      source: 'ASSET_DOMAIN',
      allowedConsumers: ['COUPON'],
      reason: '优惠券模板属于权益资产定义，不进入玩法策略注册表。',
    };
  }

  if (normalizedCode.includes('POINTS')) {
    return {
      code: normalizedCode,
      category: 'ENTITLEMENT_TEMPLATE',
      executable: false,
      source: 'ASSET_DOMAIN',
      allowedConsumers: ['POINTS'],
      reason: '积分规则属于权益资产定义，不进入玩法策略注册表。',
    };
  }

  return {
    code: normalizedCode,
    category: 'UNKNOWN',
    executable: false,
    source: 'UNKNOWN',
    allowedConsumers: [],
    reason: '未识别的模板编码，必须先明确分类和执行边界。',
  };
}

export function isExecutableStorePlayTemplateCode(code: string): boolean {
  const boundary = classifyMarketingTemplateCode(code);
  return boundary.executable && boundary.allowedConsumers.includes('STORE_PLAY_CONFIG');
}
