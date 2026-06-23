import { Injectable } from '@nestjs/common';
import { MktCampaign, MktCampaignStatus, MktCampaignReleaseStatus, MktEntitlementPoolStatus } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';
import { PrismaService } from 'src/prisma/prisma.service';
import { CampaignRepository } from './campaign.repository';
import { CampaignApprovalLogVo } from './vo/campaign-approval-log.vo';
import { CampaignPrecheckShellVo } from './vo/campaign-precheck-shell.vo';
import { CampaignWizardShellVo } from './vo/campaign-wizard-shell.vo';
import { CampaignWorkbenchShellVo } from './vo/campaign-workbench-shell.vo';

export const CAMPAIGN_WIZARD_STEPS = [
  { key: 'foundation', title: '活动骨架', note: '定义活动类型、时间范围和负责人', readonly: false },
  { key: 'audience', title: '目标人群', note: '定义人群来源、筛选条件和排除项', readonly: false },
  { key: 'rights', title: '权益配置', note: '只冻结壳子边界，不展开权益池深水逻辑', readonly: false },
  { key: 'stages', title: '阶段与触发', note: '定义阶段编排、触发入口和兜底规则', readonly: false },
  { key: 'delivery', title: '投放与场景', note: '定义投放位、场景包和素材入口', readonly: false },
  { key: 'precheck', title: '预检与限制', note: '冻结预检摘要和限制入口，不实现深水规则', readonly: false },
  { key: 'publish', title: '预览与发布', note: '冻结发布前确认、审批和提交入口', readonly: false },
] as const;

export const CAMPAIGN_WORKBENCH_TABS = [
  { key: 'overview', title: '总览', editable: false },
  { key: 'audience-rights', title: '人群与权益', editable: true },
  { key: 'stages-triggers', title: '阶段与触发', editable: true },
  { key: 'delivery-scenes', title: '投放与场景', editable: true },
  { key: 'precheck-limits', title: '预检与限制', editable: true },
  { key: 'data-execution', title: '数据与执行', editable: false },
  { key: 'approval-logs', title: '审批与协作', editable: false },
] as const;

const EXCLUDED_DOMAINS = ['entitlement-pool', 'test-run-center'] as const;
const WIZARD_ACTION_ENTRY = ['save-draft', 'previous-step', 'next-step', 'precheck', 'publish-shell'] as const;
const SHELL_ONLY_PANELS = ['approval-log', 'collab', 'precheck', 'publish'] as const;
const COLLAB_ACTIONS = ['comment', 'mention-owner', 'view-approval-history'] as const;
const PRECHECK_ACTIONS = ['run-precheck', 'view-limit-summary', 'open-publish-shell'] as const;

@Injectable()
export class CampaignShellService {
  constructor(
    private readonly repository: CampaignRepository,
    private readonly prisma: PrismaService,
  ) {}

  getWizardShell(): CampaignWizardShellVo {
    return {
      version: '2026-04-20',
      steps: CAMPAIGN_WIZARD_STEPS.map((item) => ({ ...item })),
      excludedDomains: [...EXCLUDED_DOMAINS],
      actionEntry: [...WIZARD_ACTION_ENTRY],
    };
  }

  async getWorkbenchShell(input: { campaignId: string }): Promise<CampaignWorkbenchShellVo> {
    const campaign = await this.loadCampaign(input.campaignId);
    const writableTabs = this.resolveWritableTabs(campaign.status);
    const readonlyTabs = CAMPAIGN_WORKBENCH_TABS.map((item) => item.key).filter((key) => !writableTabs.includes(key));

    return {
      campaignId: campaign.id,
      tabs: CAMPAIGN_WORKBENCH_TABS.map((item) => ({
        ...item,
        editable: writableTabs.includes(item.key),
      })),
      readWriteBoundary: {
        writableTabs,
        readonlyTabs,
      },
      shellOnlyPanels:
        campaign.status === MktCampaignStatus.ARCHIVED
          ? [...SHELL_ONLY_PANELS, 'archive-summary']
          : [...SHELL_ONLY_PANELS],
    };
  }

  async getApprovalLogShell(input: { campaignId: string }): Promise<CampaignApprovalLogVo> {
    const campaign = await this.loadCampaign(input.campaignId);
    const latestRelease = await this.prisma.mktCampaignRelease.findFirst({
      where: { campaignId: campaign.id, tenantId: campaign.tenantId },
      orderBy: { releaseNo: 'desc' },
      select: {
        id: true,
        releaseNo: true,
        status: true,
        createdBy: true,
        publishedAt: true,
        createTime: true,
      },
    });

    const entries: CampaignApprovalLogVo['entries'] = [
      {
        id: `draft-${campaign.id}-created`,
        actor: campaign.createdBy || 'system',
        action: '草稿创建',
        status: 'CREATED',
        time: campaign.createTime.toISOString(),
      },
      {
        id: `draft-${campaign.id}-status`,
        actor: campaign.updatedBy || 'system',
        action: `当前状态：${campaign.status}`,
        status: 'CURRENT_STATUS',
        time: campaign.updateTime.toISOString(),
      },
    ];

    if (latestRelease) {
      entries.push({
        id: latestRelease.id,
        actor: latestRelease.createdBy || 'system',
        action: `发布记录 #${latestRelease.releaseNo}`,
        status: this.mapReleaseStatus(latestRelease.status),
        time: (latestRelease.publishedAt ?? latestRelease.createTime).toISOString(),
      });
    }

    return {
      campaignId: campaign.id,
      readonly: campaign.status === MktCampaignStatus.ARCHIVED,
      entries,
      collaborationActions: [...COLLAB_ACTIONS],
    };
  }

  async getPrecheckShell(input: { campaignId: string }): Promise<CampaignPrecheckShellVo> {
    const campaign = await this.loadCampaign(input.campaignId);
    const relations = await this.prisma.mktCampaignEntitlementPool.findMany({
      where: {
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
      },
      include: {
        pool: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    const linkedPoolCount = relations.length;
    const compiledPoolCount = relations.filter((item) => item.pool.status === MktEntitlementPoolStatus.COMPILED).length;
    const hasAudience = this.hasNonEmptyObject(campaign.audienceJson);
    const hasDelivery = this.hasNonEmptyObject(campaign.deliveryJson);
    const hasTimeWindow = this.hasFoundationTimeRange(campaign);

    const checks: CampaignPrecheckShellVo['checks'] = [
      {
        key: 'foundation-time-window',
        title: '活动时间窗口',
        status: hasTimeWindow ? 'PASS' : 'FAIL',
        note: hasTimeWindow ? '已配置开始与结束时间。' : '缺少开始或结束时间，请补齐活动骨架。',
      },
      {
        key: 'audience-config',
        title: '人群配置完整性',
        status: hasAudience ? 'PASS' : 'PENDING',
        note: hasAudience ? '已配置人群筛选条件。' : '未配置有效人群条件。',
      },
      {
        key: 'entitlement-binding',
        title: '权益池绑定状态',
        status: linkedPoolCount > 0 ? 'PASS' : 'FAIL',
        note:
          linkedPoolCount > 0
            ? `已绑定 ${linkedPoolCount} 个权益池，已编译 ${compiledPoolCount} 个。`
            : '当前未绑定权益池。',
      },
      {
        key: 'delivery-config',
        title: '投放配置完整性',
        status: hasDelivery ? 'PASS' : 'PENDING',
        note: hasDelivery ? '已配置投放场景与限制。' : '尚未配置投放场景，默认按壳子协议处理。',
      },
    ];
    const publishReady = checks.every((item) => item.status === 'PASS');

    return {
      campaignId: campaign.id,
      publishReady,
      checks,
      publishActions: [...PRECHECK_ACTIONS],
    };
  }

  private resolveWritableTabs(status: MktCampaignStatus): string[] {
    if (status === MktCampaignStatus.ARCHIVED) {
      return [];
    }
    if (status === MktCampaignStatus.PUBLISHED || status === MktCampaignStatus.PAUSED) {
      return ['audience-rights', 'stages-triggers', 'precheck-limits'];
    }
    return ['audience-rights', 'stages-triggers', 'delivery-scenes', 'precheck-limits'];
  }

  private async loadCampaign(campaignId: string): Promise<MktCampaign> {
    const campaign = await this.repository.findOne({ id: campaignId });
    BusinessException.throwIfNull(campaign, '活动不存在');
    return campaign!;
  }

  private hasNonEmptyObject(value: unknown): boolean {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0);
  }

  private hasFoundationTimeRange(campaign: MktCampaign): boolean {
    return Boolean(campaign.startTime && campaign.endTime);
  }

  private mapReleaseStatus(status: MktCampaignReleaseStatus): string {
    if (status === MktCampaignReleaseStatus.PUBLISHED) return 'PUBLISHED';
    if (status === MktCampaignReleaseStatus.ROLLED_BACK) return 'ROLLED_BACK';
    if (status === MktCampaignReleaseStatus.ARCHIVED) return 'ARCHIVED';
    return 'PENDING';
  }
}
