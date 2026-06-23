import { Result } from 'src/common/response';
import { CampaignShellController } from './campaign-shell.controller';
import { CampaignShellService } from './campaign-shell.service';

describe('CampaignShellController', () => {
  let controller: CampaignShellController;
  let service: jest.Mocked<
    Pick<CampaignShellService, 'getWizardShell' | 'getWorkbenchShell' | 'getApprovalLogShell' | 'getPrecheckShell'>
  >;

  beforeEach(() => {
    service = {
      getWizardShell: jest.fn().mockReturnValue({
        version: '2026-04-19',
        steps: [{ key: 'foundation', title: '活动骨架', readonly: false }],
        excludedDomains: ['entitlement-pool'],
        actionEntry: ['save-draft'],
      }),
      getWorkbenchShell: jest.fn().mockResolvedValue({
        campaignId: 'cmp_001',
        tabs: [{ key: 'overview', title: '总览', editable: false }],
        readWriteBoundary: {
          writableTabs: [],
          readonlyTabs: ['overview'],
        },
        shellOnlyPanels: ['approval-log'],
      }),
      getApprovalLogShell: jest.fn().mockResolvedValue({
        campaignId: 'cmp_001',
        readonly: true,
        entries: [],
        collaborationActions: ['comment'],
      }),
      getPrecheckShell: jest.fn().mockResolvedValue({
        campaignId: 'cmp_001',
        publishReady: false,
        checks: [],
        publishActions: ['precheck'],
      }),
    };

    controller = new CampaignShellController(service as unknown as CampaignShellService);
  });

  it('应返回向导壳子响应', async () => {
    const result = await controller.getWizardShell();

    expect(service.getWizardShell).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      Result.ok({
        version: '2026-04-19',
        steps: [{ key: 'foundation', title: '活动骨架', readonly: false }],
        excludedDomains: ['entitlement-pool'],
        actionEntry: ['save-draft'],
      }),
    );
  });

  it('应返回工作台、审批日志与预检发布壳子响应', async () => {
    const workbench = await controller.getWorkbenchShell({ campaignId: 'cmp_001' });
    const approval = await controller.getApprovalLogShell({ campaignId: 'cmp_001' });
    const precheck = await controller.getPrecheckShell({ campaignId: 'cmp_001' });

    expect(service.getWorkbenchShell).toHaveBeenCalledWith({ campaignId: 'cmp_001' });
    expect(service.getApprovalLogShell).toHaveBeenCalledWith({ campaignId: 'cmp_001' });
    expect(service.getPrecheckShell).toHaveBeenCalledWith({ campaignId: 'cmp_001' });
    expect((workbench.data as { campaignId: string }).campaignId).toBe('cmp_001');
    expect((approval.data as { readonly: boolean }).readonly).toBe(true);
    expect((precheck.data as { publishReady: boolean }).publishReady).toBe(false);
  });
});
