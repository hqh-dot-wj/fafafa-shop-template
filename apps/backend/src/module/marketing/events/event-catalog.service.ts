import { Injectable } from '@nestjs/common';
import {
  MARKETING_EVENT_CATALOG_LIST,
  MARKETING_EVENT_CATEGORIES,
  MARKETING_EVENT_PRIVACY_LEVELS,
  MARKETING_EVENT_STATUSES,
  MARKETING_EVENT_USABLE_SCOPES,
  type MarketingEventCatalogItem,
} from './marketing-event.catalog';
import { EventCatalogQueryDto } from './dto/event-catalog-query.dto';
import { EventCatalogBucketVo, EventCatalogItemVo, EventCatalogSummaryVo, toEventCatalogItemVo } from './vo/event-catalog.vo';

function countByValues<T extends string>(
  values: readonly T[],
  list: readonly MarketingEventCatalogItem[],
  resolve: (item: MarketingEventCatalogItem) => readonly string[] | string,
): EventCatalogBucketVo[] {
  return values.map((value) => ({
    value,
    count: list.filter((item) => {
      const resolved = resolve(item);
      return Array.isArray(resolved) ? resolved.includes(value) : resolved === value;
    }).length,
  }));
}

function matchesKeyword(item: MarketingEventCatalogItem, keyword?: string): boolean {
  const normalized = keyword?.trim().toLowerCase();
  if (!normalized) return true;

  return [
    item.eventType,
    item.displayName,
    item.sourceModule,
    item.triggerTiming,
    item.idempotencyKey,
    item.orderingKey,
    ...item.consumers,
  ].some(value => value.toLowerCase().includes(normalized));
}

@Injectable()
export class EventCatalogService {
  list(query: EventCatalogQueryDto = {}): EventCatalogItemVo[] {
    return MARKETING_EVENT_CATALOG_LIST.filter((item) => {
      if (query.category && item.category !== query.category) return false;
      if (query.usableScope && !item.usableScopes.includes(query.usableScope)) return false;
      if (query.status && item.status !== query.status) return false;
      if (query.privacyLevel && item.privacyLevel !== query.privacyLevel) return false;
      if (typeof query.ruleTriggerable === 'boolean' && item.ruleTriggerable !== query.ruleTriggerable) return false;
      return matchesKeyword(item, query.keyword);
    }).map(toEventCatalogItemVo);
  }

  summary(): EventCatalogSummaryVo {
    const list = MARKETING_EVENT_CATALOG_LIST;
    const latestPayloadSchemaVersion = Math.max(...list.map(item => item.payloadSchemaVersion));

    return {
      total: list.length,
      activeCount: list.filter(item => item.status === 'ACTIVE').length,
      ruleTriggerableCount: list.filter(item => item.ruleTriggerable).length,
      replayableCount: list.filter(item => item.replayable).length,
      tenantScopedCount: list.filter(item => item.tenantScoped).length,
      byCategory: countByValues(MARKETING_EVENT_CATEGORIES, list, item => item.category),
      byUsableScope: countByValues(MARKETING_EVENT_USABLE_SCOPES, list, item => item.usableScopes),
      byStatus: countByValues(MARKETING_EVENT_STATUSES, list, item => item.status),
      byPrivacyLevel: countByValues(MARKETING_EVENT_PRIVACY_LEVELS, list, item => item.privacyLevel),
      latestPayloadSchemaVersion,
    };
  }
}
