export interface ProductMarketingViewVo {
  productId: string;
  primaryOffer: MarketingOfferViewVo | null;
  secondaryOffers: MarketingOfferViewVo[];
  runtime: MarketingRuntimeViewVo | null;
  visibility: { visible: boolean; reasonCode?: string; reasonText?: string };
  actionBar: ProductActionBarViewVo;
  explain: MarketingExplainItemVo[];
}

export interface MarketingOfferViewVo {
  activityType: string;
  activityContextKey: string;
  activityName: string;
  offerPrice: number;
  originalPrice?: number;
  label?: string;
}

export interface MarketingRuntimeViewVo {
  activityType: string;
  playInstanceId?: string;
  statusCode: string;
  statusText: string;
  progress?: { current: number; target: number; unit: string };
  scheduledAt?: string;
  expiredAt?: string;
  extra?: Record<string, unknown>;
}

export interface ProductActionBarViewVo {
  primary: MarketingActionVo;
  secondary?: MarketingActionVo;
  tools?: MarketingActionVo[];
}

export interface MarketingActionVo {
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

export interface MarketingExplainItemVo {
  domain: 'eligibility' | 'audience' | 'priority' | 'scene';
  code: string;
  message: string;
  severity: 'INFO' | 'WARN';
}
