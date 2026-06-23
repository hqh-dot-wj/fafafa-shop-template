// quality-gate allow-source-string-test
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_CREATE_WORKFLOW,
  COUPON_CREATE_WORKFLOW,
  ENTITLEMENT_POOL_WORKFLOW,
  PLAY_INSTANCE_WORKFLOW,
  POINTS_RULES_WORKFLOW,
  SCENE_BUILD_WORKFLOW,
} from '../../_orchestration/workflows';

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Campaign orchestration wizard', () => {
  it('registers six marketing workflow metadata definitions', () => {
    const workflows = [
      CAMPAIGN_CREATE_WORKFLOW,
      SCENE_BUILD_WORKFLOW,
      PLAY_INSTANCE_WORKFLOW,
      COUPON_CREATE_WORKFLOW,
      POINTS_RULES_WORKFLOW,
      ENTITLEMENT_POOL_WORKFLOW,
    ];

    expect(workflows.map((item) => item.code)).toEqual([
      'CAMPAIGN_CREATE',
      'SCENE_BUILD',
      'PLAY_INSTANCE',
      'COUPON_CREATE',
      'POINTS_RULES',
      'ENTITLEMENT_POOL',
    ]);
    expect(CAMPAIGN_CREATE_WORKFLOW.branchRules[0].routes.COURSE_GROUP_BUY).toBe('HANDLER_HEAVY');
  });

  it('registers wizard route as a visible orchestration entry and keeps advanced route available', () => {
    const routeSource = readSource('src/router/routes/index.ts');
    const importsSource = readSource('src/router/elegant/imports.ts');
    const wizardMatcher = /name:\s*'marketing_campaigns_wizard'[\s\S]*?meta:\s*\{([\s\S]*?)\n\s*\}/m;
    const wizardMetaBlock = routeSource.match(wizardMatcher)?.[1] ?? '';

    expect(routeSource).toContain("name: 'marketing_activity-orchestration'");
    expect(routeSource).toContain("name: 'marketing_campaigns_wizard'");
    expect(routeSource).toContain("name: 'marketing_campaigns_new'");
    expect(wizardMetaBlock).not.toContain('hideInMenu');
    expect(importsSource).toContain('marketing_campaigns_wizard');
  });
});
