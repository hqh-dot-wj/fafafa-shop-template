// quality-gate allow-source-string-test
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findRouteMetaBlock(source: string, routeName: string) {
  const escapedRouteName = escapeRegExp(routeName);
  const matcher = new RegExp(`name:\\s*'${escapedRouteName}'[\\s\\S]*?meta:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'm');
  const result = source.match(matcher);

  expect(result, `无法定位路由 ${routeName} 的 meta 区块`).not.toBeNull();

  return result?.[1] ?? '';
}

describe('activity orchestration routes', () => {
  it('should expose activity center list/calendar/dashboard/wizard and keep detail hidden', () => {
    const source = readSource('src/router/routes/index.ts');

    expect(source).toContain("name: 'marketing_activity-orchestration'");
    expect(source).toContain("name: 'marketing_activity-center'");
    expect(source).toContain("name: 'marketing_activity_list'");
    expect(source).toContain("name: 'marketing_activity_calendar'");
    expect(source).toContain("name: 'marketing_activity_dashboard'");
    expect(source).toContain("name: 'marketing_campaigns_wizard'");

    const detailMetaBlock = findRouteMetaBlock(source, 'marketing_activity_detail');
    expect(detailMetaBlock).toContain('hideInMenu: true');
  });

  it('legacy marketing entries should stay compatible but not remain as main navigation', () => {
    const source = readSource('src/router/routes/index.ts');

    const legacyRoutes = [
      { name: 'marketing_config', path: '/marketing/config' },
      { name: 'marketing_policy', path: '/marketing/policy' },
      { name: 'marketing_scene', path: '/marketing/scene' },
      { name: 'marketing_scene-module', path: '/marketing/scene-module' },
      { name: 'marketing_resolution', path: '/marketing/resolution' },
    ] as const;

    for (const route of legacyRoutes) {
      expect(source).toContain(`name: '${route.name}'`);
      expect(source).toContain(`path: '${route.path}'`);

      const legacyMetaBlock = findRouteMetaBlock(source, route.name);
      expect(legacyMetaBlock).toContain('hideInMenu: true');
      expect(legacyMetaBlock).toContain("activeMenu: 'marketing_campaigns_wizard'");
    }
  });

  it('activity orchestration should keep entitlement workspace as a visible route', () => {
    const source = readSource('src/router/routes/index.ts');

    expect(source).toContain("name: 'marketing_entitlement-pool'");
    expect(source).toContain("component: 'view.marketing_entitlement-pool'");

    const entitlementMetaBlock = findRouteMetaBlock(source, 'marketing_entitlement-pool');
    expect(entitlementMetaBlock).not.toContain('activeMenu');
    expect(entitlementMetaBlock).not.toContain('hideInMenu');
  });
});
