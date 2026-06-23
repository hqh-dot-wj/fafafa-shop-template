import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  MARKETING_EVENT_CATEGORIES,
  MARKETING_EVENT_PRIVACY_LEVELS,
  MARKETING_EVENT_STATUSES,
  MARKETING_EVENT_USABLE_SCOPES,
  type MarketingEventCategory,
  type MarketingEventPrivacyLevel,
  type MarketingEventStatus,
  type MarketingEventUsableScope,
} from '../marketing-event.catalog';

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

export class EventCatalogQueryDto {
  @ApiPropertyOptional({ description: '事件分类', enum: MARKETING_EVENT_CATEGORIES })
  @IsOptional()
  @IsIn(MARKETING_EVENT_CATEGORIES)
  category?: MarketingEventCategory;

  @ApiPropertyOptional({ description: '可用范围', enum: MARKETING_EVENT_USABLE_SCOPES })
  @IsOptional()
  @IsIn(MARKETING_EVENT_USABLE_SCOPES)
  usableScope?: MarketingEventUsableScope;

  @ApiPropertyOptional({ description: '事件状态', enum: MARKETING_EVENT_STATUSES })
  @IsOptional()
  @IsIn(MARKETING_EVENT_STATUSES)
  status?: MarketingEventStatus;

  @ApiPropertyOptional({ description: '隐私级别', enum: MARKETING_EVENT_PRIVACY_LEVELS })
  @IsOptional()
  @IsIn(MARKETING_EVENT_PRIVACY_LEVELS)
  privacyLevel?: MarketingEventPrivacyLevel;

  @ApiPropertyOptional({ description: '是否允许被规则触发', type: Boolean })
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  ruleTriggerable?: boolean;

  @ApiPropertyOptional({ description: '关键词，匹配事件编码、名称、来源模块、触发时机或消费者', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  keyword?: string;
}
