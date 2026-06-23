import { describe, expect, it, vi } from 'vitest';
import {
  fetchCampaignApprovalLogShell,
  fetchCampaignPrecheckShell,
  fetchCampaignWorkbenchShell,
} from '@/service/api/marketing/campaign';
import { createStaticRoutes } from '@/router/routes';
import { CAMPAIGN_WORKBENCH_TABS } from './modules/campaign-workbench-tabs';

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

describe('CampaignWorkbenchTabs', () => {
  it('应固定 7 个 Tab，且数据与执行区只读', () => {
    expect(CAMPAIGN_WORKBENCH_TABS.map((tab) => tab.key)).toEqual([
      'overview',
      'audience-rights',
      'stages-triggers',
      'delivery-scenes',
      'precheck-limits',
      'data-execution',
      'approval-logs',
    ]);
    expect(CAMPAIGN_WORKBENCH_TABS.find((tab) => tab.key === 'data-execution')?.editable).toBe(false);
    expect(CAMPAIGN_WORKBENCH_TABS.find((tab) => tab.key === 'approval-logs')?.editable).toBe(false);
  });

  it('应暴露工作台 API 与隐藏路由入口', async () => {
    requestMock.mockResolvedValue({ data: null, error: null });

    await fetchCampaignWorkbenchShell('cmp-001');
    await fetchCampaignApprovalLogShell('cmp-001');
    await fetchCampaignPrecheckShell('cmp-001');

    expect(requestMock).toHaveBeenNthCalledWith(1, {
      url: '/admin/marketing/campaigns/cmp-001/workbench-shell',
      method: 'get',
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, {
      url: '/admin/marketing/campaigns/cmp-001/approval-log-shell',
      method: 'get',
    });
    expect(requestMock).toHaveBeenNthCalledWith(3, {
      url: '/admin/marketing/campaigns/cmp-001/precheck-shell',
      method: 'get',
    });

    const { authRoutes } = createStaticRoutes();
    const workbenchRoute = findRoute(authRoutes as RouteLike[], 'marketing_campaigns_detail');

    expect(workbenchRoute?.path).toBe('/marketing/campaigns/workbench');
    expect(workbenchRoute?.component).toBe('view.marketing_campaigns_detail');
    expect(workbenchRoute?.meta?.hideInMenu).toBe(true);
    expect(workbenchRoute?.meta?.activeMenu).toBe('marketing_activity_list');
  });
});
