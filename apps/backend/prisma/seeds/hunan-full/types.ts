export type HunanProductTheme = 'retail' | 'instant' | 'service';

export type HunanDistributionMode = 'RATIO' | 'FIXED' | 'NONE';
export type HunanCommissionBaseType = 'ORIGINAL_PRICE' | 'ACTUAL_PAID' | 'ZERO';
export type HunanCommissionStatus = 'FROZEN' | 'SETTLED' | 'CANCELLED';
export type HunanWalletStatus = 'NORMAL' | 'FROZEN' | 'DISABLED';
export type HunanMemberStatus = 'NORMAL' | 'DISABLED';
export type HunanCouponType = 'DISCOUNT' | 'PERCENTAGE' | 'EXCHANGE';
export type HunanCouponValidityType = 'FIXED' | 'RELATIVE';
export type HunanPlayInstanceStatus =
  | 'PENDING_PAY'
  | 'PAID'
  | 'ACTIVE'
  | 'SUCCESS'
  | 'TIMEOUT'
  | 'FAILED'
  | 'REFUNDED';
export type HunanOrderType = 'PRODUCT' | 'SERVICE' | 'MIXED';
export type HunanOrderStatus = 'PENDING_PAY' | 'PAID' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
export type HunanPayStatus = 'UNPAID' | 'PAID' | 'REFUNDED';
export type HunanOrderScenarioType =
  | 'product-normal'
  | 'product-flash-sale'
  | 'product-full-reduction'
  | 'product-coupon'
  | 'product-points'
  | 'product-exchange'
  | 'service-normal'
  | 'service-course-group'
  | 'member-upgrade'
  | 'refund-full'
  | 'refund-partial'
  | 'mixed-marketing';

export interface HunanAttrValueBlueprint {
  attrId: number;
  attrName: string;
  value: string;
}

export interface HunanSpecBlueprint {
  name: string;
  values: string[];
}

export interface HunanSkuBlueprint {
  skuId: string;
  specValues: Record<string, string>;
  guidePrice: number;
  costPrice: number;
  tenantPrice: number;
  stock: number;
  distMode: HunanDistributionMode;
  distRate: number;
  pointsRatio: number;
  isPromotionProduct: boolean;
  isExchangeProduct?: boolean;
  newcomerPrice?: number | null;
}

export interface HunanProductBlueprint {
  theme: HunanProductTheme;
  productId: string;
  categoryId: number;
  brandId: number | null;
  name: string;
  subTitle: string;
  type: 'REAL' | 'SERVICE';
  weight?: number;
  serviceDuration?: number;
  serviceRadius?: number;
  needBooking?: boolean;
  isFreeShip: boolean;
  mainImage: string;
  attrValues: HunanAttrValueBlueprint[];
  specs: HunanSpecBlueprint[];
  skus: HunanSkuBlueprint[];
  isHot?: boolean;
  customTitle?: string | null;
  sort?: number;
}

export interface HunanOperatorBlueprint {
  userName: string;
  nickName: string;
  phone: string;
  email: string;
  roleName: string;
  roleKey: string;
  remark: string;
}

export interface HunanMemberBlueprint {
  memberId: string;
  mobile: string;
  nickname: string;
  avatar: string;
  status: HunanMemberStatus;
  levelId: number;
  parentId: string | null;
  indirectParentId: string | null;
  referralCode?: string | null;
  walletStatus: HunanWalletStatus;
  walletBalance: number;
  walletFrozen: number;
  walletIncome: number;
  pointsAvailable: number;
  tags: string[];
}

export interface HunanReferralCodeBlueprint {
  memberId: string;
  code: string;
  qrCodeUrl: string;
  usageCount: number;
  isActive: boolean;
}

export interface HunanDistributorApplicationBlueprint {
  memberId: string;
  status: 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  applyReason: string;
  evidenceOrderId?: string | null;
  evidenceOrderSn?: string | null;
  evidenceScenarioType?: HunanOrderScenarioType | null;
  sourceSceneCode?: string | null;
  sourceModuleCode?: string | null;
  linkedActivityType?: string | null;
  reviewerId?: string | null;
  reviewRemark?: string | null;
  autoReviewed?: boolean;
}

export interface HunanUpgradeApplicationBlueprint {
  memberId: string;
  fromLevel: number;
  toLevel: number;
  applyType: 'PRODUCT_PURCHASE' | 'REFERRAL_CODE';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  orderId?: string | null;
  orderSn?: string | null;
  evidenceScenarioType?: HunanOrderScenarioType | null;
  referralCode?: string | null;
  referrerId?: string | null;
  sourceSceneCode?: string | null;
  sourceModuleCode?: string | null;
  linkedActivityType?: string | null;
  reviewBy?: string | null;
  reviewRemark?: string | null;
}

export interface HunanCouponTemplateBlueprint {
  code: string;
  name: string;
  description: string;
  type: HunanCouponType;
  discountAmount?: number;
  discountPercent?: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
  validityType: HunanCouponValidityType;
  validDays?: number | null;
  applicableProducts: string[];
  applicableCategories: number[];
  memberLevels: number[];
  exchangeProductId?: string | null;
  exchangeSkuId?: string | null;
  totalStock: number;
  limitPerUser: number;
}

export interface HunanActivityBlueprint {
  type: string;
  name: string;
  description: string;
  triggerCondition: Record<string, unknown>;
  rules: Record<string, unknown>;
  rewards: Record<string, unknown>;
  isEnabled: boolean;
  priority: number;
  startOffsetDays?: number | null;
  endOffsetDays?: number | null;
}

export interface HunanActivityTouchpointBlueprint {
  activityType: string;
  kind: 'MESSAGE' | 'SHARE';
  code: string;
  name: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
}

export interface HunanStorePlayConfigBlueprint {
  configId: string;
  serviceId: string;
  serviceType: 'REAL' | 'SERVICE';
  templateCode: string;
  displayPriority: number;
  scopeType: string;
  stockMode: 'LAZY_CHECK' | 'STRONG_LOCK' | 'SOFT_LOCK';
  status: 'ON_SHELF' | 'OFF_SHELF';
  commissionMode: 'NONE' | 'FIXED_RATE' | 'INHERIT';
  commissionRate?: number | null;
  aggregateEnabled: boolean;
  zoneEnabled: boolean;
  rules: Record<string, unknown>;
}

export interface HunanPolicyBlueprint {
  policyCode: string;
  policyName: string;
  policyType: string;
  status: string;
  config: Record<string, unknown>;
}

export interface HunanSceneBlueprint {
  sceneCode: string;
  sceneName: string;
  sceneType: string;
  channelScope: string[];
  pageRoute: string;
  defaultCardTemplateCode: string;
  defaultResolverPolicyCode: string;
  /** 与 admin 场景定义页一致的投放展示配置 */
  placementConfig?: Record<string, unknown>;
  status: string;
}

export interface HunanSceneModuleBlueprint {
  sceneCode: string;
  moduleCode: string;
  moduleName: string;
  moduleType: string;
  title: string;
  subTitle: string;
  displayOrder: number;
  limitSize: number;
  sourcePolicyCode: string;
  resolverPolicyCode: string;
  sortPolicyCode?: string | null;
  audiencePolicyCode?: string | null;
  cardTemplateCode: string;
  attributionPolicyCode?: string | null;
  status: string;
  uiConfig?: Record<string, unknown> | null;
}

export interface HunanOrderItemScenario {
  productId: string;
  skuId: string;
  productName: string;
  productImg: string;
  specData: Record<string, string>;
  price: number;
  quantity: number;
  pointsRatio: number;
  earnedPoints: number;
  activityType?: string | null;
  activityConfigId?: string | null;
  playInstanceId?: string | null;
  activityNameSnapshot?: string | null;
  activityPriceSnapshot?: number | null;
  activityStatusSnapshot?: string | null;
  activityCommissionModeSnapshot?: string | null;
  activityCommissionRateSnapshot?: number | null;
  commissionRuleSource?: string | null;
  commissionPoolSnapshot?: number | null;
  l1WeightSnapshot?: number | null;
  l2WeightSnapshot?: number | null;
  orderItemOriginalAmount?: number | null;
  orderItemDiscountAllocated?: number | null;
  orderItemFinalPaid?: number | null;
  resolutionSnapshot?: Record<string, unknown> | null;
  attribution?: {
    sourceSceneCodeSnapshot?: string | null;
    sourceModuleCodeSnapshot?: string | null;
    sourceChannelSnapshot?: string | null;
    sourcePagePathSnapshot?: string | null;
    shareUserIdSnapshot?: string | null;
    referrerIdSnapshot?: string | null;
    cardTemplateCodeSnapshot?: string | null;
    resolverPolicyCodeSnapshot?: string | null;
    resolverReleaseNoSnapshot?: number | null;
    audienceSnapshot?: Record<string, unknown> | null;
    secondaryBenefitsSnapshot?: Record<string, unknown> | null;
    denyStackReasonsSnapshot?: string[] | null;
    entryContextSnapshot?: Record<string, unknown> | null;
  } | null;
}

export interface HunanCommissionScenario {
  beneficiaryId: string;
  itemIndex?: number;
  level: number;
  amount: number;
  rateSnapshot: number;
  commissionBase: number;
  commissionBaseType: HunanCommissionBaseType;
  orderOriginalPrice: number;
  orderActualPaid: number;
  couponDiscount: number;
  pointsDiscount: number;
  isCapped: boolean;
  status: HunanCommissionStatus;
  commissionRuleSource: string;
  activityType?: string | null;
  activityConfigId?: string | null;
  playInstanceId?: string | null;
  activityCommissionRateSnapshot?: number | null;
  commissionPoolSnapshot?: number | null;
  isCrossTenant?: boolean;
  planSettleOffsetDays?: number;
  settleOffsetDays?: number | null;
}

export interface HunanPlayInstanceScenario {
  playInstanceId: string;
  configId: string;
  templateCode: string;
  status: HunanPlayInstanceStatus;
  instanceData: Record<string, unknown>;
  bindToItemIndex: number;
  payOffsetDays?: number | null;
  endOffsetDays?: number | null;
}

export interface HunanOrderScenario {
  orderId: string;
  orderSn: string;
  scenarioType: HunanOrderScenarioType;
  memberId: string;
  referrerId?: string | null;
  shareUserId?: string | null;
  orderType: HunanOrderType;
  status: HunanOrderStatus;
  payStatus: HunanPayStatus;
  totalAmount: number;
  freightAmount: number;
  discountAmount: number;
  payAmount: number;
  couponDiscount: number;
  pointsUsed: number;
  pointsDiscount: number;
  pointsEarned: number;
  userCouponCode?: string | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  receiverAddress?: string | null;
  bookingOffsetDays?: number | null;
  serviceRemark?: string | null;
  payType?: string | null;
  transactionId?: string | null;
  createOffsetDays: number;
  payOffsetDays?: number | null;
  remark?: string | null;
  items: HunanOrderItemScenario[];
  commissions: HunanCommissionScenario[];
  playInstances?: HunanPlayInstanceScenario[];
}
