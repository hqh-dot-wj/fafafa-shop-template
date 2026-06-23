import { MarketingStockMode } from '@prisma/client';
import { CourseGroupBuyRulesDto } from './dto/course-group-buy.dto';
import { FlashSaleRulesDto } from './dto/flash-sale.dto';
import { MemberUpgradeRulesDto } from './dto/member-upgrade.dto';

export interface PlayRuleSchemaMetadata {
  code: string;
  name: string;
  ruleSchema?: new (...args: unknown[]) => unknown;
  defaultStockMode: MarketingStockMode;
}

const STORE_PLAY_RULE_SCHEMAS: Record<string, PlayRuleSchemaMetadata> = {
  COURSE_GROUP_BUY: {
    code: 'COURSE_GROUP_BUY',
    name: '拼班课程',
    ruleSchema: CourseGroupBuyRulesDto,
    defaultStockMode: MarketingStockMode.LAZY_CHECK,
  },
  FLASH_SALE: {
    code: 'FLASH_SALE',
    name: '限时秒杀',
    ruleSchema: FlashSaleRulesDto,
    defaultStockMode: MarketingStockMode.STRONG_LOCK,
  },
  MEMBER_UPGRADE: {
    code: 'MEMBER_UPGRADE',
    name: '会员升级',
    ruleSchema: MemberUpgradeRulesDto,
    defaultStockMode: MarketingStockMode.LAZY_CHECK,
  },
};

export const STORE_PLAY_CAPABILITY_CODES = Object.freeze(Object.keys(STORE_PLAY_RULE_SCHEMAS));

export function getPlayRuleSchemaMetadata(code: string): PlayRuleSchemaMetadata | undefined {
  return STORE_PLAY_RULE_SCHEMAS[code];
}

export function isExecutableStorePlayCapabilityCode(code: string): boolean {
  return code in STORE_PLAY_RULE_SCHEMAS;
}
