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

const activityDetailPath = 'src/views/marketing/activity/detail/index.vue';
const activitySearchPath = 'src/views/marketing/activity/modules/activity-search.vue';
const sceneDefinitionSearchPath = 'src/views/marketing/scene-placement/definition/modules/scene-definition-search.vue';
const scenePreviewSearchPath = 'src/views/marketing/scene-placement/preview/modules/scene-preview-search.vue';
const courseGroupTeamSearchPath = 'src/views/marketing/course-group/team/modules/course-group-team-search.vue';
const courseGroupFailureSearchPath = 'src/views/marketing/course-group/failure/modules/course-group-failure-search.vue';
const courseGroupCommissionSearchPath =
  'src/views/marketing/course-group/commission/modules/course-group-commission-search.vue';
const entitlementPoolSearchPath = 'src/views/marketing/entitlement-pool/modules/entitlement-pool-search.vue';

describe('marketing page consistency', () => {
  it('activity list should use backend status instead of local derived status', () => {
    const source = readSource('src/views/marketing/activity/modules/activity-table-columns.tsx');

    expect(source).toContain('row.status');
    expect(source).not.toContain('resolveActivityStatus(row)');
  });

  it('activity detail should not keep legacy english operator copy', () => {
    const source = readSource(activityDetailPath);

    const bannedPhrases = [
      'Activity not loaded',
      'No activity items configured',
      'No stores bound',
      'Activity time range incomplete',
      'Activity name is required',
      'Activity saved',
      'Precheck failed',
      'Activity published',
      'Activity paused',
      'Please input store ids',
      'Please input product name',
      'Activity item updated',
      'Activity item created',
      'Activity item deleted',
      'Play Rules',
      'Failure Policy',
      'Commission Rate',
      'Leader Mode',
      'Allow User Open',
      'Allow Staff Proxy Open',
      'Owner',
      'User id',
    ];

    for (const phrase of bannedPhrases) {
      expect(source).not.toContain(phrase);
    }
  });

  it('search areas should use common i18n action keys', () => {
    const files = [
      activitySearchPath,
      entitlementPoolSearchPath,
      sceneDefinitionSearchPath,
      scenePreviewSearchPath,
      courseGroupTeamSearchPath,
      courseGroupFailureSearchPath,
      courseGroupCommissionSearchPath,
    ];

    for (const file of files) {
      const source = readSource(file);
      expect(source).toContain("$t('common.search')");
      expect(source).toContain("$t('common.reset')");
    }
  });

  it('course group commission page should not contain malformed duplicated status blocks', () => {
    const commissionSourcePaths = [
      'src/views/marketing/course-group/commission/index.vue',
      'src/views/marketing/course-group/commission/modules/course-group-commission-table-columns.tsx',
    ];
    const source = commissionSourcePaths.map((p) => readSource(p)).join('\n');

    expect(source).not.toContain("''RECRUITING''");
    expect(source).not.toContain("''FORMED''");
    expect(source).not.toContain("''IN_CLASS''");
    expect(source).not.toContain("''FINISHED''");
    expect(source).not.toContain("''FAILED''");
    expect(source).not.toContain("''CLOSED''");

    expect(source).toContain('getCourseGroupTeamStatusMeta');
    expect(source).not.toContain('function mapTeamStatus');
  });

  it('campaign wizard should be visible and advanced/workbench routes should keep active menu targets', () => {
    const source = readSource('src/router/routes/index.ts');

    const wizardMatcher = /name:\s*'marketing_campaigns_wizard'[\s\S]*?meta:\s*\{([\s\S]*?)\n\s*\}/m;
    const wizardMetaBlock = source.match(wizardMatcher)?.[1] ?? '';

    expect(source).toContain("name: 'marketing_campaigns_wizard'");
    expect(source).toContain("name: 'marketing_campaigns_new'");
    expect(source).toContain("name: 'marketing_campaigns_detail'");
    expect(wizardMetaBlock).not.toContain('hideInMenu');
    expect(source).toContain("activeMenu: 'marketing_campaigns_wizard'");
    expect(source).toContain("activeMenu: 'marketing_activity_list'");
  });

  it('entitlement workspace route should stay visible under activity orchestration', () => {
    const source = readSource('src/router/routes/index.ts');

    expect(source).toContain("name: 'marketing_activity-orchestration'");
    expect(source).toContain("name: 'marketing_entitlement-pool'");
    expect(source).toContain("path: '/marketing/entitlement-pool'");

    const entitlementMatcher = /name:\s*'marketing_entitlement-pool'[\s\S]*?meta:\s*\{([\s\S]*?)\n\s*\}/m;
    const entitlementMetaBlock = source.match(entitlementMatcher)?.[1] ?? '';
    expect(entitlementMetaBlock).not.toContain('activeMenu');
    expect(entitlementMetaBlock).not.toContain('hideInMenu');
  });

  it('legacy marketing entries should be hidden while preserving compatibility paths', () => {
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

      const escapedName = escapeRegExp(route.name);
      const legacyRouteMatcher = new RegExp(
        `name:\\s*'${escapedName}'[\\s\\S]*?hideInMenu:\\s*true[\\s\\S]*?activeMenu:\\s*'marketing_campaigns_wizard'`,
        'm',
      );

      expect(source).toMatch(legacyRouteMatcher);
    }
  });
});
