/**
 * Phase 5 商品详情营销区子组件展示模型。
 *
 * 这些类型仅描述子组件 Props 视图模型，不与 Phase 3 marketing-card.types.ts 混淆。
 * activityKind 直接 re-export Phase 3 定义，禁止重复声明。
 */
export type { ActivityKind } from '@/components/marketing-card/marketing-card.types';

/** 团成员头像展示（拼多多式头像墙） */
export interface TeamMemberAvatar {
  memberId: string;
  avatar?: string;
  role: string;
}

/** ProductSummaryCard Props */
export interface ProductSummaryProps {
  name: string;
  subTitle?: string;
  /** 活动标签 badge 文案（拼课中 / 限时优惠 / 会员权益），无活动时不传 */
  activityBadge?: string;
  /** 门店名称（显示为位置 pill） */
  storeName?: string;
}

/** MarketingOfferCard Props */
export interface MarketingOfferProps {
  /** 当前活动价格 */
  displayPrice: number | string;
  /** 原价 */
  originalPrice?: number | string | null;
  /** 价格标签（拼课价 / 秒杀价 / 会员价，来自 useMarketingDisplay.activityLabel） */
  priceLabel?: string;
  /** 营销区块标题（后端 displayData.offerTitle，如"这个课可以拼课报名"） */
  offerTitle?: string;
  /** 营销区块描述（后端 displayData.offerDesc） */
  offerDesc?: string;
  /** 说明条目列表（后端 displayData.explainItems，如 ["3人成班，最多8人", "不成班可退款或转班"]） */
  explainItems?: string[];
  /** 分销佣金提示 */
  commissionHint?: string;
  /** 是否可赚佣 */
  canEarnCommission?: boolean;
}

/** RecommendedTeamCard Props（仅拼课时显示） */
export interface RecommendedTeamProps {
  /** 标题（默认"已为您优先选择"，分享入口可改为"好友邀请您加入这个团"） */
  headerTitle?: string;
  /** 推荐原因文字（如"离您最近，还差1人成班"） */
  reasonText?: string;
  /** 门店/位置标签 */
  storeName?: string;

  /** 团长名（如"李老师"），用于组合团标题"李老师推荐团" */
  leaderName?: string;
  /** 已加入成员头像列表（拼多多式头像墙，不显示名字） */
  memberAvatars?: TeamMemberAvatar[];
  /** 成团最小人数，用于空位占位圈计算 */
  minCount?: number;
  /** 成团最大人数 */
  maxCount?: number;
  /** 当前有效成员数 */
  currentMembers?: number;
  /** 剩余席位 */
  remainingSlots?: number;

  /** 上课时间（来自推荐团实际数据，优先于活动规则） */
  scheduleText: string;
  /** 上课地址（来自推荐团实际数据，优先于活动规则） */
  addressText: string;
  /** 是否可以自己开团 */
  canOpen?: boolean;
  /** 开团中 loading */
  opening?: boolean;
  /** 推荐团 ID，用于跳转参团 */
  teamId?: string;
  /** 团是否可加入 */
  joinable?: boolean;
  /** 团状态（RECRUITING / FORMED / …），驱动成班进度文案 */
  teamStatus?: string;
}

/** 拼课无推荐团 / 仅已成团时的说明卡 */
export interface CourseGroupPendingProps {
  headerTitle?: string;
  hintText?: string;
  storeName?: string;
  countText?: string;
  scheduleText?: string;
  addressText?: string;
  canOpen?: boolean;
  opening?: boolean;
}

/** SimpleRuntimeCard Props */
export interface SimpleRuntimeProps {
  /** 是否服务类商品 */
  isService: boolean;
  /** 是否实物商品 */
  isReal: boolean;
  /** 服务时长（分钟） */
  serviceDuration?: number;
  /** 服务范围（米） */
  serviceRadius?: number;
  /** 是否需要预约 */
  needBooking?: boolean;
  /** 是否包邮 */
  isFreeShip?: boolean;
}

/** FulfillmentInfoCard Props */
export interface FulfillmentInfoProps {
  /** 是否为拼课活动 */
  isCourseGroup: boolean;
  /** 上课地址 */
  addressText?: string;
  /** 上课时间 */
  scheduleText?: string;
  /** 成班人数文字 */
  countText?: string;
  /** 失败处理说明 */
  failureHint?: string;
  /** 门店/活动阻断原因 */
  blockedReason?: string;
}
