import {
  MARKETING_EVENT_CATALOG,
  getMarketingEventTypesByUsableScope,
  hasMarketingEventUsableScope,
  isKnownMarketingEventType,
} from './marketing-event.catalog';
import { MarketingEventType } from './marketing-event.types';

describe('MarketingEventCatalog', () => {
  it('covers every MarketingEventType exactly once', () => {
    const eventTypes = Object.values(MarketingEventType).sort();
    const catalogTypes = Object.keys(MARKETING_EVENT_CATALOG).sort();

    expect(catalogTypes).toEqual(eventTypes);
    expect(catalogTypes.every(type => MARKETING_EVENT_CATALOG[type as MarketingEventType].eventType === type)).toBe(true);
  });

  it('keeps config and cache events out of rule-triggered user asset scopes', () => {
    const configEvents = Object.values(MARKETING_EVENT_CATALOG).filter(item => item.category === 'CONFIG');

    expect(configEvents.length).toBeGreaterThan(0);
    for (const event of configEvents) {
      expect(event.ruleTriggerable).toBe(false);
      expect(event.usableScopes).toContain('CACHE');
      expect(event.usableScopes).not.toContain('POINTS');
      expect(event.usableScopes).not.toContain('COUPON');
      expect(event.usableScopes).not.toContain('TOUCHPOINT');
    }
  });

  it('prevents asset ledger events from triggering the same asset again', () => {
    expect(hasMarketingEventUsableScope(MarketingEventType.POINTS_EARNED, 'POINTS')).toBe(false);
    expect(hasMarketingEventUsableScope(MarketingEventType.POINTS_USED, 'POINTS')).toBe(false);
    expect(hasMarketingEventUsableScope(MarketingEventType.POINTS_EXPIRED, 'POINTS')).toBe(false);
    expect(hasMarketingEventUsableScope(MarketingEventType.COUPON_CLAIMED, 'COUPON')).toBe(false);
    expect(hasMarketingEventUsableScope(MarketingEventType.COUPON_USED, 'COUPON')).toBe(false);
    expect(hasMarketingEventUsableScope(MarketingEventType.COUPON_EXPIRED, 'COUPON')).toBe(false);
  });

  it('derives touchpoint whitelist from catalog scopes', () => {
    const touchpointEvents = getMarketingEventTypesByUsableScope('TOUCHPOINT');

    expect(touchpointEvents).toContain(MarketingEventType.INSTANCE_SUCCESS);
    expect(touchpointEvents).toContain(MarketingEventType.GROUP_FULL);
    expect(touchpointEvents).toContain(MarketingEventType.COURSE_GROUP_TEAM_FORMED);
    expect(touchpointEvents).not.toContain(MarketingEventType.INSTANCE_CREATED);
    expect(touchpointEvents).not.toContain(MarketingEventType.COURSE_GROUP_VIRTUAL_FILLED);
    expect(touchpointEvents).not.toContain(MarketingEventType.SCENE_RELEASE_PUBLISHED);
  });

  it('recognizes only cataloged runtime event names', () => {
    expect(isKnownMarketingEventType(MarketingEventType.INSTANCE_SUCCESS)).toBe(true);
    expect(isKnownMarketingEventType('not.registered')).toBe(false);
  });

  it('keeps course-group fulfillment axes distinct', () => {
    expect(hasMarketingEventUsableScope(MarketingEventType.COURSE_GROUP_TEAM_FORMED, 'TOUCHPOINT')).toBe(true);
    expect(hasMarketingEventUsableScope(MarketingEventType.COURSE_GROUP_TEAM_FORMED, 'POINTS')).toBe(false);
    expect(hasMarketingEventUsableScope(MarketingEventType.COURSE_GROUP_ATTENDANCE_CONFIRMED, 'POINTS')).toBe(true);
    expect(hasMarketingEventUsableScope(MarketingEventType.COURSE_GROUP_VIRTUAL_FILLED, 'POINTS')).toBe(false);
    expect(hasMarketingEventUsableScope(MarketingEventType.COURSE_GROUP_VIRTUAL_FILLED, 'COUPON')).toBe(false);
    expect(hasMarketingEventUsableScope(MarketingEventType.COURSE_GROUP_VIRTUAL_FILLED, 'TOUCHPOINT')).toBe(false);
  });
});
