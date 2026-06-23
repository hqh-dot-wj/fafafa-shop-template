import { MktCampaignKind } from '@prisma/client';

export const CAMPAIGN_TYPE = {
  FIRST_ORDER: 'FIRST_ORDER',
  FULL_REDUCTION: 'FULL_REDUCTION',
  MEMBER_DAY: 'MEMBER_DAY',
  PROMOTION_PRICE: 'PROMOTION_PRICE',
  BIRTHDAY: 'BIRTHDAY',
  NEWCOMER_EXCLUSIVE: 'NEWCOMER_EXCLUSIVE',
  DISTRIBUTION_GROWTH: 'DISTRIBUTION_GROWTH',
  COURSE_GROUP_BUY: 'COURSE_GROUP_BUY',
  FLASH_SALE: 'FLASH_SALE',
  MEMBER_UPGRADE: 'MEMBER_UPGRADE',
} as const;

export const POLICY_CAMPAIGN_TYPES = [
  CAMPAIGN_TYPE.FIRST_ORDER,
  CAMPAIGN_TYPE.FULL_REDUCTION,
  CAMPAIGN_TYPE.MEMBER_DAY,
  CAMPAIGN_TYPE.PROMOTION_PRICE,
  CAMPAIGN_TYPE.BIRTHDAY,
] as const;

export const HANDLER_CAMPAIGN_TYPES = [
  CAMPAIGN_TYPE.NEWCOMER_EXCLUSIVE,
  CAMPAIGN_TYPE.DISTRIBUTION_GROWTH,
  CAMPAIGN_TYPE.COURSE_GROUP_BUY,
  CAMPAIGN_TYPE.FLASH_SALE,
  CAMPAIGN_TYPE.MEMBER_UPGRADE,
] as const;

const POLICY_TYPE_SET = new Set<string>(POLICY_CAMPAIGN_TYPES);

export function isPolicyCampaignType(type: string): boolean {
  return POLICY_TYPE_SET.has(type);
}

export function resolveCampaignKind(type: string): MktCampaignKind {
  return isPolicyCampaignType(type) ? MktCampaignKind.POLICY : MktCampaignKind.HANDLER;
}

/**
 * 统一判定一个 campaign-like 对象是否走 POLICY 链路。
 *
 * 历史上"判定 policy"在两处出现：
 *   - DB 行：读 `MktCampaign.kind === POLICY`（写入时已通过 `resolveCampaignKind` 持久化）
 *   - 配置/code：读 `isPolicyCampaignType(code)`（schema 字符串判定）
 * 两套口径在 `play.dispatcher.ts` 等位置以 if-else 串联，容易在加新 type 时漏改一处。
 * 本函数把两套口径收敛为单一入口：优先信任 DB 行的 `kind`，缺失时按 code 兜底判定。
 */
export function isPolicyCampaign(
  input: { kind?: MktCampaignKind | string | null; type?: string | null } | string,
): boolean {
  if (typeof input === 'string') return isPolicyCampaignType(input);
  if (input.kind === MktCampaignKind.POLICY || input.kind === 'POLICY') return true;
  if (input.kind === MktCampaignKind.HANDLER || input.kind === 'HANDLER') return false;
  return input.type ? isPolicyCampaignType(input.type) : false;
}
