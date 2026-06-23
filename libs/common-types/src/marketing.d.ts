/**
 * Marketing 手写 contract 类型。
 *
 * 原因：当前后端营销聚合展示 VO 尚未完整进入 OpenAPI schema，前端需要在 admin-web 与
 * miniapp-client 之间共享商品营销展示契约，因此临时在 common-types 中手写并与后端 VO 对齐。
 * 过期信号：待后端 ProductMarketingView / ProductCardMarketingView 等 VO 进入 OpenAPI 后，
 * 执行 generate-types，并将本文件替换为 components['schemas'] 生成类型。
 */

/** 商品营销展示视图（完整版，用于商品详情页） */
export interface ProductMarketingView {
  productId: string;
  primaryOffer: MarketingOfferView | null;
  secondaryOffers: MarketingOfferView[];
  runtime: MarketingRuntimeView | null;
  visibility: {
    visible: boolean;
    reasonCode?: string;
    reasonText?: string;
  };
  actionBar: ProductActionBarView;
  /** 运营诊断数组；client 端点恒返回空数组，admin 端点返回完整数据 */
  explain: MarketingExplainItem[];
}

/** 商品营销摘要（轻量版，用于列表卡片） */
export interface ProductCardMarketingView {
  activityType: string;
  activityContextKey: string | null;
  priceLabel: string;
  displayPrice: number;
  originalPrice?: number;
  summary: string;
  statusText: string;
  action: MarketingAction;
}

/** 营销权益视图 */
export interface MarketingOfferView {
  activityType: string;
  activityContextKey: string;
  activityName: string;
  offerPrice: number;
  originalPrice?: number;
  label?: string;
}

/** 营销运行态视图（适配拼课、拼团等结果型活动） */
export interface MarketingRuntimeView {
  activityType: string;
  playInstanceId?: string;
  statusCode: string;
  statusText: string;
  progress?: { current: number; target: number; unit: string };
  scheduledAt?: string;
  expiredAt?: string;
  extra?: Record<string, unknown>;
}

/** 统一行动栏 */
export interface ProductActionBarView {
  primary: MarketingAction;
  secondary?: MarketingAction;
  tools?: MarketingAction[];
}

/** 行动描述 */
export interface MarketingAction {
  code:
    | 'JOIN_GROUP'
    | 'OPEN_GROUP'
    | 'JOIN_TARGET_TEAM'
    | 'VIEW_MY_TEAM'
    | 'SHARE_TEAM'
    | 'BUY_NOW'
    | 'ADD_CART'
    | 'FLASH_BUY'
    | 'UPGRADE_MEMBER'
    | 'VIEW_BENEFITS';
  label: string;
  enabled: boolean;
  disabledReason?: string;
  params?: Record<string, string>;
}

/** 运营诊断条目 */
export interface MarketingExplainItem {
  domain: 'eligibility' | 'audience' | 'priority' | 'scene';
  code: string;
  message: string;
  severity: 'INFO' | 'WARN';
}
