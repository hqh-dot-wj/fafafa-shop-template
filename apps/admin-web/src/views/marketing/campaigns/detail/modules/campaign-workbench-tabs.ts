export type CampaignWorkbenchTabKey =
  | 'overview'
  | 'audience-rights'
  | 'stages-triggers'
  | 'delivery-scenes'
  | 'precheck-limits'
  | 'data-execution'
  | 'approval-logs';

export interface CampaignWorkbenchTab {
  key: CampaignWorkbenchTabKey;
  title: string;
  editable: boolean;
}

export const CAMPAIGN_WORKBENCH_TABS: CampaignWorkbenchTab[] = [
  {
    key: 'overview',
    title: '总览',
    editable: false,
  },
  {
    key: 'audience-rights',
    title: '人群与权益',
    editable: true,
  },
  {
    key: 'stages-triggers',
    title: '阶段与触发',
    editable: true,
  },
  {
    key: 'delivery-scenes',
    title: '投放与场景',
    editable: true,
  },
  {
    key: 'precheck-limits',
    title: '预检与限制',
    editable: true,
  },
  {
    key: 'data-execution',
    title: '数据与执行',
    editable: false,
  },
  {
    key: 'approval-logs',
    title: '审批与协作',
    editable: false,
  },
];
