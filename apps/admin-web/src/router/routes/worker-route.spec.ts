import { describe, expect, it } from 'vitest';
import { createStaticRoutes } from './index';

interface RouteLike {
  name: string;
  path: string;
  component?: string;
  meta?: Record<string, unknown>;
  children?: RouteLike[];
}

function findRoute(routes: RouteLike[], name: string): RouteLike | undefined {
  for (const route of routes) {
    if (route.name === name) {
      return route;
    }
    const matched = route.children ? findRoute(route.children, name) : undefined;
    if (matched) {
      return matched;
    }
  }
  return undefined;
}

describe('builtin constant routes', () => {
  it('keeps public builtin pages outside the authenticated base layout in static route mode', () => {
    const { constantRoutes } = createStaticRoutes();

    for (const routeName of ['403', '404', '500', 'login'] as const) {
      const route = findRoute(constantRoutes, routeName);

      expect(route?.component).toBe(`layout.blank$view.${routeName}`);
      expect(route?.meta?.hideInMenu).toBe(true);
    }
  });
});
