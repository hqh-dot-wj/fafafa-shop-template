import { describe, expect, it, vi } from 'vitest';
import { fetchCampaignWizardShell } from '@/service/api/marketing/campaign';
import { createStaticRoutes } from '@/router/routes';
import { CAMPAIGN_WIZARD_STEPS } from './modules/campaign-wizard-step-config';

const requestMock = vi.hoisted(() => vi.fn());

vi.mock('@/service/request', () => ({
  request: requestMock,
}));

interface RouteLike {
  name: string;
  path: string;
  component?: string;
  meta?: Record<string, unknown>;
  children?: RouteLike[];
}

function findRoute(routes: RouteLike[], name: string): RouteLike | undefined {
  for (const route of routes) {
    if (route.name === name) return route;
    const child = route.children ? findRoute(route.children, name) : undefined;
    if (child) return child;
  }
  return undefined;
}

describe('CampaignWizardSteps', () => {
  it('应固定为 7 步，且不直接展开权益池/试跑中心', () => {
    expect(CAMPAIGN_WIZARD_STEPS).toHaveLength(7);
    expect(CAMPAIGN_WIZARD_STEPS.map((step) => step.key)).toEqual([
      'foundation',
      'audience',
      'rights',
      'stages',
      'delivery',
      'precheck',
      'publish',
    ]);
    expect(CAMPAIGN_WIZARD_STEPS.map((step) => step.title)).toContain('预检与限制');
  });

  it('应暴露向导工作区 API 与隐藏路由入口', async () => {
    requestMock.mockResolvedValue({ data: null, error: null });

    await fetchCampaignWizardShell();

    expect(requestMock).toHaveBeenCalledWith({
      url: '/admin/marketing/campaigns/wizard-shell',
      method: 'get',
    });

    const { authRoutes } = createStaticRoutes();
    const wizardRoute = findRoute(authRoutes as RouteLike[], 'marketing_campaigns_new');

    expect(wizardRoute?.path).toBe('/marketing/campaigns/new');
    expect(wizardRoute?.component).toBe('view.marketing_campaigns_new');
    expect(wizardRoute?.meta?.hideInMenu).toBe(true);
    expect(wizardRoute?.meta?.activeMenu).toBe('marketing_campaigns_wizard');
  });
});
