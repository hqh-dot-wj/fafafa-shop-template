export interface CampaignWizardStepConfig {
  key: string;
  title: string;
  note: string;
  readonly: boolean;
}

export const CAMPAIGN_WIZARD_STEPS: CampaignWizardStepConfig[] = [
  { key: 'foundation', title: '活动骨架', note: '定义活动类型、时间范围和负责人。', readonly: false },
  { key: 'audience', title: '目标人群', note: '定义人群来源、进入规则和排除条件。', readonly: false },
  { key: 'rights', title: '权益配置', note: '展示权益池入口和配置边界，具体编译由权益池工作台处理。', readonly: false },
  { key: 'stages', title: '阶段与触发', note: '定义阶段模板、触发入口和异常说明。', readonly: false },
  { key: 'delivery', title: '投放与场景', note: '定义投放位、场景包和素材接入入口。', readonly: false },
  { key: 'precheck', title: '预检与限制', note: '承接预检摘要、限制说明和修复入口。', readonly: false },
  { key: 'publish', title: '预览与发布', note: '承接发布前确认、审批和提交入口。', readonly: false },
];
