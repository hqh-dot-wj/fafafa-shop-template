import { describe, expect, it, vi } from 'vitest';
import type { MarketingEventCatalogItem, MarketingEventCatalogSummary } from './event-catalog';
import { fetchMarketingEventCatalog, fetchMarketingEventCatalogSummary } from './event-catalog';

const requestMock = vi.hoisted(() => vi.fn());

vi.mock('@/service/request', () => ({
  request: requestMock,
}));

describe('Marketing Event Catalog API', () => {
  it('拉取事件目录应透传筛选参数', async () => {
    const rows: MarketingEventCatalogItem[] = [
      {
        eventType: 'order.paid',
        category: 'ORDER',
        displayName: '订单支付成功',
        sourceModule: 'client/order',
        triggerTiming: '支付成功后',
        idempotencyKey: 'tenantId + orderId',
        orderingKey: 'tenantId + orderId',
        tenantScoped: true,
        ruleTriggerable: true,
        replayable: true,
        usableScopes: ['POINTS', 'TOUCHPOINT'],
        consumers: ['points'],
        privacyLevel: 'ASSET',
        payloadSchemaVersion: 1,
        status: 'ACTIVE',
      },
    ];
    requestMock.mockResolvedValue({ data: rows, error: null });

    const result = await fetchMarketingEventCatalog({
      category: 'ORDER',
      usableScope: 'POINTS',
      status: 'ACTIVE',
      ruleTriggerable: true,
      keyword: 'order',
    });

    expect(requestMock).toHaveBeenCalledWith({
      url: '/admin/marketing/events/catalog',
      method: 'get',
      params: {
        category: 'ORDER',
        usableScope: 'POINTS',
        status: 'ACTIVE',
        ruleTriggerable: true,
        keyword: 'order',
      },
    });
    expect(result).toEqual(rows);
  });

  it('拉取事件目录汇总应指向只读汇总接口', async () => {
    const summary: MarketingEventCatalogSummary = {
      total: 1,
      activeCount: 1,
      ruleTriggerableCount: 1,
      replayableCount: 1,
      tenantScopedCount: 1,
      byCategory: [{ value: 'ORDER', count: 1 }],
      byUsableScope: [{ value: 'POINTS', count: 1 }],
      byStatus: [{ value: 'ACTIVE', count: 1 }],
      byPrivacyLevel: [{ value: 'ASSET', count: 1 }],
      latestPayloadSchemaVersion: 1,
    };
    requestMock.mockResolvedValue({ data: summary, error: null });

    const result = await fetchMarketingEventCatalogSummary();

    expect(requestMock).toHaveBeenCalledWith({
      url: '/admin/marketing/events/catalog/summary',
      method: 'get',
    });
    expect(result).toEqual(summary);
  });
});
