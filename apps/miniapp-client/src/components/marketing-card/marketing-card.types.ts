import type { SeniorProductCardModel } from '../product-card/product-card.types';

export type ActivityKind = 'group' | 'flash' | 'member' | 'normal';
export type CardLayout = 'overlay' | 'split' | 'auto';

export interface MarketingCardModel extends SeniorProductCardModel {
  cardLayout?: CardLayout;
  activityKind: ActivityKind;
  badgeText?: string;
  secondaryHint?: string;
  /** 离满员剩余名额（max − current），已成团时展示 */
  remainingSlots?: number;
  /** 离成班还差人数（min − current），招募中角标用 */
  remainToForm?: number;
  /** 场景 explain 团状态，与详情团 API 对齐 */
  teamStatus?: string;
  /** 拼课大卡 Footer：上课地点 */
  groupClassAddress?: string;
  /** 拼课大卡 Footer：上课时间（已格式化） */
  groupClassTime?: string;
  /** 拼课大卡 Footer：参团提示，如「即将成团，可直接参团」 */
  groupJoinHint?: string;
}
