import { request } from '@/service/request';

/**
 * 活动编排壳接口，对应 backend CampaignShellController。
 * 这些接口只返回向导、工作台、审批日志、预检发布的壳数据，不承担活动创建/发布等写操作。
 */
export type CampaignWizardStep = Api.Marketing.CampaignWizardStep;
export type CampaignWizardShell = Api.Marketing.CampaignWizardShell;
export type CampaignWorkbenchTab = Api.Marketing.CampaignWorkbenchTab;
export type CampaignWorkbenchShell = Api.Marketing.CampaignWorkbenchShell;
export type CampaignApprovalLog = Api.Marketing.CampaignApprovalLog;
export type CampaignPrecheckShell = Api.Marketing.CampaignPrecheckShell;
export type CampaignShellPath = Api.Marketing.CampaignShellPath;

export function fetchCampaignWizardShell() {
  return request<CampaignWizardShell>({
    url: '/admin/marketing/campaigns/wizard-shell',
    method: 'get',
  });
}

export function fetchCampaignWorkbenchShell(campaignId: string) {
  return request<CampaignWorkbenchShell>({
    url: `/admin/marketing/campaigns/${campaignId}/workbench-shell`,
    method: 'get',
  });
}

export function fetchCampaignApprovalLogShell(campaignId: string) {
  return request<CampaignApprovalLog>({
    url: `/admin/marketing/campaigns/${campaignId}/approval-log-shell`,
    method: 'get',
  });
}

export function fetchCampaignPrecheckShell(campaignId: string) {
  return request<CampaignPrecheckShell>({
    url: `/admin/marketing/campaigns/${campaignId}/precheck-shell`,
    method: 'get',
  });
}
