/**
 * 策略模板预设（供运营/交付复制到策略中心，避免从零配置）。
 * 与具体租户数据解耦，不落库；后续可接「一键套用」接口读取本结构。
 */
export type MarketingPolicyPreset = {
  code: string;
  name: string;
  description: string;
  /** 建议绑定的策略类型与示例 policyCode 命名 */
  bindings: Array<{ policyType: 'SOURCE' | 'AUDIENCE' | 'RESOLVER' | 'SORT'; suggestedPolicyCode: string }>;
  /** 写入 mktPolicy.configJson 的示例骨架（需按租户商品池替换占位符） */
  sampleConfig: Record<string, unknown>;
};

export const MARKETING_POLICY_PRESETS: MarketingPolicyPreset[] = [
  {
    code: 'PRESET_ACQUISITION_HOME',
    name: '拉新首页精选',
    description: '首页曝光：新客优先 + 低价排序，适合拉新活动池。',
    bindings: [
      { policyType: 'SOURCE', suggestedPolicyCode: 'SRC_HOME_ACQ' },
      { policyType: 'AUDIENCE', suggestedPolicyCode: 'AUD_HOME_ACQ' },
      { policyType: 'RESOLVER', suggestedPolicyCode: 'RSV_HOME_ACQ' },
      { policyType: 'SORT', suggestedPolicyCode: 'SRT_HOME_PRICE_ASC' },
    ],
    sampleConfig: {
      productIds: [],
      clauses: [{ type: 'ALL' }],
    },
  },
  {
    code: 'PRESET_REACTIVATION_MEMBER',
    name: '沉默会员促活',
    description: '会员等级圈选 + 会员价/积分玩法组合，适合促活复购。',
    bindings: [
      { policyType: 'SOURCE', suggestedPolicyCode: 'SRC_MEMBER_POOL' },
      { policyType: 'AUDIENCE', suggestedPolicyCode: 'AUD_MEMBER_SILENT' },
      { policyType: 'RESOLVER', suggestedPolicyCode: 'RSV_MEMBER_PRICE' },
      { policyType: 'SORT', suggestedPolicyCode: 'SRT_MARGIN_DESC' },
    ],
    sampleConfig: {
      memberLevels: ['2', '3'],
      channels: ['MINIAPP'],
    },
  },
  {
    code: 'PRESET_CLEARANCE_CATEGORY',
    name: '类目清库存',
    description: '类目圈品 + 强促销排序，适合季末清仓。',
    bindings: [
      { policyType: 'SOURCE', suggestedPolicyCode: 'SRC_CATEGORY_CLEAR' },
      { policyType: 'AUDIENCE', suggestedPolicyCode: 'AUD_ALL' },
      { policyType: 'RESOLVER', suggestedPolicyCode: 'RSV_FLASH_PRIORITY' },
      { policyType: 'SORT', suggestedPolicyCode: 'SRT_STOCK_ASC' },
    ],
    sampleConfig: {
      categoryIds: [],
      productTypes: ['PHYSICAL'],
    },
  },
];
