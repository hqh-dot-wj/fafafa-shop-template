import 'reflect-metadata';
import { EventCatalogController } from './event-catalog.controller';
import { EventCatalogService } from './event-catalog.service';

describe('EventCatalogController', () => {
  const controller = new EventCatalogController(new EventCatalogService());

  it('事件目录接口应返回统一 Result 包装的只读列表', () => {
    const result = controller.list({ category: 'CONFIG' });

    expect(result.code).toBe(200);
    expect(result.data?.length).toBeGreaterThan(0);
    expect(result.data?.every(item => item.category === 'CONFIG')).toBe(true);
  });

  it('事件目录汇总接口应返回统一 Result 包装的汇总', () => {
    const result = controller.summary();

    expect(result.code).toBe(200);
    expect(result.data?.total).toBeGreaterThan(0);
  });

  it('事件目录接口应复用营销策略只读权限，避免新增未纳管菜单权限', () => {
    expect(Reflect.getMetadata('permission', EventCatalogController.prototype.list)).toBe('marketing:policy:list');
    expect(Reflect.getMetadata('permission', EventCatalogController.prototype.summary)).toBe('marketing:policy:list');
  });
});
