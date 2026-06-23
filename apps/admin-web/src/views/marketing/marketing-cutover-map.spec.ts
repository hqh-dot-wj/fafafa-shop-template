import { describe, expect, it } from 'vitest';
import { generatedRoutes } from '../../router/elegant/routes';
import { LEGACY_MARKETING_ROUTE_REGISTRY } from '../../router/elegant/marketing-cutover';

type RouteNode = {
  name?: string;
  children?: RouteNode[];
};

function flattenRouteNames(routes: RouteNode[]): string[] {
  const names: string[] = [];

  const walk = (items: RouteNode[]) => {
    for (const item of items) {
      if (item.name) {
        names.push(item.name);
      }

      if (item.children?.length) {
        walk(item.children);
      }
    }
  };

  walk(routes);

  return names;
}

describe('marketing cutover map', () => {
  it('旧营销路由登记项应全部对应到真实路由树', () => {
    const routeNames = new Set(flattenRouteNames(generatedRoutes as RouteNode[]));

    for (const item of LEGACY_MARKETING_ROUTE_REGISTRY) {
      expect(routeNames.has(item.routeName)).toBe(true);
    }
  });

  it('切换登记项应保留可执行的契约字段', () => {
    const allowedPhases = new Set(['legacy-readonly', 'compat-proxy']);

    expect(LEGACY_MARKETING_ROUTE_REGISTRY.length).toBeGreaterThan(0);
    expect(new Set(LEGACY_MARKETING_ROUTE_REGISTRY.map(item => item.routeName)).size).toBe(
      LEGACY_MARKETING_ROUTE_REGISTRY.length,
    );

    for (const item of LEGACY_MARKETING_ROUTE_REGISTRY) {
      expect(item.routeName).toMatch(/^marketing_/);
      expect(item.replacement).toMatch(/^marketing_/);
      expect(allowedPhases.has(item.phase)).toBe(true);
      expect(item.dropAfter).toMatch(/^2026-\d{2}-\d{2}$/);
    }
  });

  it('切换登记项应覆盖关键旧营销入口', () => {
    const routeNames = LEGACY_MARKETING_ROUTE_REGISTRY.map(item => item.routeName);

    expect(routeNames).toEqual(
      expect.arrayContaining([
        'marketing_config',
        'marketing_policy',
        'marketing_scene',
        'marketing_resolution',
      ]),
    );
  });
});
