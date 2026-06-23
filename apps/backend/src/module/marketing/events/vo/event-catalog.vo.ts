import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MARKETING_EVENT_CATEGORIES,
  MARKETING_EVENT_PRIVACY_LEVELS,
  MARKETING_EVENT_STATUSES,
  MARKETING_EVENT_USABLE_SCOPES,
  type MarketingEventCatalogItem,
} from '../marketing-event.catalog';

export class EventCatalogBucketVo {
  @ApiProperty({ description: '分组值' })
  value: string;

  @ApiProperty({ description: '分组数量' })
  count: number;
}

export class EventCatalogItemVo {
  @ApiProperty({ description: '事件编码' })
  eventType: string;

  @ApiProperty({ description: '事件分类', enum: MARKETING_EVENT_CATEGORIES })
  category: string;

  @ApiProperty({ description: '展示名称' })
  displayName: string;

  @ApiProperty({ description: '来源模块' })
  sourceModule: string;

  @ApiProperty({ description: '触发时机' })
  triggerTiming: string;

  @ApiProperty({ description: '幂等键语义' })
  idempotencyKey: string;

  @ApiProperty({ description: '顺序键语义' })
  orderingKey: string;

  @ApiProperty({ description: '是否租户内事件' })
  tenantScoped: boolean;

  @ApiProperty({ description: '是否允许被规则触发' })
  ruleTriggerable: boolean;

  @ApiProperty({ description: '是否可重放' })
  replayable: boolean;

  @ApiProperty({ description: '可用范围', enum: MARKETING_EVENT_USABLE_SCOPES, isArray: true })
  usableScopes: string[];

  @ApiProperty({ description: '消费者', type: [String] })
  consumers: string[];

  @ApiProperty({ description: '隐私级别', enum: MARKETING_EVENT_PRIVACY_LEVELS })
  privacyLevel: string;

  @ApiProperty({ description: 'Payload schema 版本' })
  payloadSchemaVersion: number;

  @ApiProperty({ description: '状态', enum: MARKETING_EVENT_STATUSES })
  status: string;
}

export class EventCatalogSummaryVo {
  @ApiProperty({ description: '事件总数' })
  total: number;

  @ApiProperty({ description: '启用事件数' })
  activeCount: number;

  @ApiProperty({ description: '规则可触发事件数' })
  ruleTriggerableCount: number;

  @ApiProperty({ description: '可重放事件数' })
  replayableCount: number;

  @ApiProperty({ description: '租户内事件数' })
  tenantScopedCount: number;

  @ApiProperty({ description: '按分类分组', type: [EventCatalogBucketVo] })
  byCategory: EventCatalogBucketVo[];

  @ApiProperty({ description: '按可用范围分组', type: [EventCatalogBucketVo] })
  byUsableScope: EventCatalogBucketVo[];

  @ApiProperty({ description: '按状态分组', type: [EventCatalogBucketVo] })
  byStatus: EventCatalogBucketVo[];

  @ApiProperty({ description: '按隐私级别分组', type: [EventCatalogBucketVo] })
  byPrivacyLevel: EventCatalogBucketVo[];

  @ApiPropertyOptional({ description: '最近目录 schema 版本' })
  latestPayloadSchemaVersion?: number;
}

export function toEventCatalogItemVo(item: MarketingEventCatalogItem): EventCatalogItemVo {
  return {
    ...item,
    eventType: item.eventType,
    category: item.category,
    usableScopes: [...item.usableScopes],
    consumers: [...item.consumers],
    privacyLevel: item.privacyLevel,
    status: item.status,
  };
}
