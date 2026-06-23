import { EventCatalogService } from './event-catalog.service';
import { MARKETING_EVENT_CATALOG_LIST } from './marketing-event.catalog';

describe('EventCatalogService', () => {
  const service = new EventCatalogService();

  it('查询事件目录应默认返回完整代码白名单', () => {
    const rows = service.list();

    expect(rows).toHaveLength(MARKETING_EVENT_CATALOG_LIST.length);
    expect(rows[0].usableScopes).toBeInstanceOf(Array);
    expect(rows[0].consumers).toBeInstanceOf(Array);
  });

  it('查询事件目录应支持分类、范围和规则触发过滤', () => {
    const rows = service.list({ category: 'PLAY', usableScope: 'TOUCHPOINT', ruleTriggerable: true });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(row => row.category === 'PLAY')).toBe(true);
    expect(rows.every(row => row.usableScopes.includes('TOUCHPOINT'))).toBe(true);
    expect(rows.every(row => row.ruleTriggerable)).toBe(true);
  });

  it('查询事件目录应支持关键词匹配事件编码和来源模块', () => {
    expect(service.list({ keyword: 'COURSE_GROUP' }).some(row => row.eventType.includes('course_group'))).toBe(true);
    expect(service.list({ keyword: 'marketing/points' }).every(row => row.sourceModule.includes('marketing/points'))).toBe(
      true,
    );
  });

  it('汇总信息应与目录数量保持一致', () => {
    const summary = service.summary();

    expect(summary.total).toBe(MARKETING_EVENT_CATALOG_LIST.length);
    expect(summary.byCategory.reduce((total, item) => total + item.count, 0)).toBe(summary.total);
    expect(summary.byStatus.find(item => item.value === 'ACTIVE')?.count).toBe(summary.activeCount);
    expect(summary.latestPayloadSchemaVersion).toBeGreaterThanOrEqual(1);
  });
});
