<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { NCard, NEmpty, NSpin, NTabPane, NTabs, NTag } from 'naive-ui';
import {
  type CampaignApprovalLog,
  type CampaignPrecheckShell,
  type CampaignWorkbenchShell,
  fetchCampaignApprovalLogShell,
  fetchCampaignPrecheckShell,
  fetchCampaignWorkbenchShell,
} from '@/service/api/marketing';
import CampaignApprovalLogShell from './modules/campaign-approval-log-shell.vue';
import CampaignAudienceRightsShellCard from './modules/campaign-audience-rights-shell-card.vue';
import CampaignCollabShell from './modules/campaign-collab-shell.vue';
import CampaignDataExecutionShellCard from './modules/campaign-data-execution-shell-card.vue';
import CampaignDeliveryScenesShellCard from './modules/campaign-delivery-scenes-shell-card.vue';
import CampaignOverviewShellCard from './modules/campaign-overview-shell-card.vue';
import CampaignPrecheckLimitsShellCard from './modules/campaign-precheck-limits-shell-card.vue';
import CampaignPrecheckShellPanel from './modules/campaign-precheck-shell.vue';
import CampaignPublishShell from './modules/campaign-publish-shell.vue';
import CampaignStagesTriggersShellCard from './modules/campaign-stages-triggers-shell-card.vue';
import { CAMPAIGN_WORKBENCH_TABS, type CampaignWorkbenchTabKey } from './modules/campaign-workbench-tabs';
import { useCampaignPrecheck } from './modules/use-campaign-precheck';

defineOptions({ name: 'MarketingCampaignWorkbenchPage' });

// 活动工作台当前是只读工作区：承载 7 个 Tab、审批日志、预检和发布入口的边界。
// 权益池、试跑中心和活动执行仍由后续页面/后端服务承接，本页不产生运行结果。
const route = useRoute();

const loading = ref(false);
const activeTab = ref(CAMPAIGN_WORKBENCH_TABS[0]?.key ?? 'overview');
const workbenchShell = ref<CampaignWorkbenchShell | null>(null);
const approvalShell = ref<CampaignApprovalLog | null>(null);
const precheckShell = ref<CampaignPrecheckShell | null>(null);

const campaignId = computed(() => String(route.query.campaignId || '').trim());
const tabs = computed(() =>
  workbenchShell.value?.tabs?.length === 7 ? workbenchShell.value.tabs : CAMPAIGN_WORKBENCH_TABS,
);
const precheckMeta = useCampaignPrecheck(precheckShell);
const updatedAt = new Date().toISOString();
const readonlyWorkbench = true;

const overviewShell = computed(() => ({
  campaignName: `活动 ${campaignId.value}`,
  statusText: '只读工作区已建立',
  owner: 'marketing-shell',
  description: '本页只承载总览、7 个 Tab、审批协作和预检发布入口，不执行活动规则。',
  updateTime: updatedAt,
}));

const audienceRightsShell = computed(() => ({
  audienceSummary: '当前工作区展示人群来源、进入规则和排除项入口。',
  rightsSummary: '权益池由独立工作台编译，本页仅展示入口和只读说明。',
  audienceTags: ['audience', 'filters', 'exclusion'],
  rightsTags: ['rights', 'entitlement-shell', 'readonly-boundary'],
}));

const stagesTriggersShell = computed(() => ({
  stages: ['foundation', 'stages', 'publish'],
  triggers: ['manual-entry', 'event-hook', 'schedule-window'],
}));

const deliveryScenesShell = computed(() => ({
  scenes: ['会员触达', '活动工作台', '场景投放'],
  channels: ['admin-web', 'miniapp', 'message-center'],
}));

const precheckLimitsShell = computed(() => ({
  limitTitle: '预检与限制',
  limitSummary: '当前工作区展示预检项、阻塞说明和发布入口，不在前端执行活动规则。',
  limits: precheckShell.value?.checks ?? [],
  warning: precheckMeta.issueCount.value > 0 ? '仍有待处理预检项，需要进入配置页修复。' : '当前无新增阻塞项。',
}));

const dataExecutionShell = computed(() => ({
  executionStatus: '只读',
  executorName: 'campaign-shell',
  executedAt: updatedAt,
  result: '数据执行区保持只读，后续由试跑中心和经营视图展示真实执行结果。',
}));

const collabShell = computed(() => ({
  ownerName: 'marketing-shell',
  collaborators: ['campaign-owner', 'approval-owner'],
  collaborationActions: approvalShell.value?.collaborationActions ?? [],
}));

async function loadWorkbenchShell() {
  if (!campaignId.value) {
    workbenchShell.value = null;
    approvalShell.value = null;
    precheckShell.value = null;
    return;
  }

  loading.value = true;
  try {
    // 方法职责：并行加载工作区、审批日志和预检摘要；接口无数据时只降级展示，不自动创建活动数据。
    const [workbenchRes, approvalRes, precheckRes] = await Promise.all([
      fetchCampaignWorkbenchShell(campaignId.value),
      fetchCampaignApprovalLogShell(campaignId.value),
      fetchCampaignPrecheckShell(campaignId.value),
    ]);

    workbenchShell.value = workbenchRes.data ?? null;
    approvalShell.value = approvalRes.data ?? null;
    precheckShell.value = precheckRes.data ?? null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (typeof route.query.tab === 'string' && route.query.tab) {
    const matchedTab = CAMPAIGN_WORKBENCH_TABS.find((tab) => tab.key === route.query.tab);
    if (matchedTab) {
      activeTab.value = matchedTab.key as CampaignWorkbenchTabKey;
    }
  }
  loadWorkbenchShell();
});
</script>

<template>
  <NSpin :show="loading" class="h-full">
    <div
      class="bg-[linear-gradient(180deg,#fff7ed_0%,#fff 22%,#f8fafc_100%)] h-full min-h-700px flex flex-col gap-16px overflow-hidden p-16px"
    >
      <!-- 页面摘要区：展示当前活动 ID、工作区状态和后端返回的只读面板标识。 -->
      <NCard :bordered="false" class="rounded-18px shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-16px">
          <div>
            <div class="text-20px text-[#111827] font-600">营销活动工作台</div>
            <div class="mt-8px text-13px text-[#64748b]">
              当前活动：{{ campaignId || '-' }}。本页展示 7 个 Tab、审批日志与预检发布入口，不执行权益发放或试跑。
            </div>
          </div>
          <div class="flex flex-wrap gap-8px">
            <NTag type="success" size="small">7 Tabs Frozen</NTag>
            <NTag type="warning" size="small">{{ precheckMeta.statusLabel }}</NTag>
            <NTag v-for="panel in workbenchShell?.shellOnlyPanels ?? []" :key="panel" type="info" size="small">
              {{ panel }}
            </NTag>
          </div>
        </div>
      </NCard>

      <!-- Tab 工作区：按后端工作台定义展示七个只读区域，缺少 campaignId 时阻断后续面板。 -->
      <NCard :bordered="false" class="min-h-0 flex-1 rounded-18px shadow-sm">
        <NEmpty v-if="!campaignId" description="缺少 campaignId，请从活动中心或向导入口进入。" class="py-36px" />
        <NTabs v-else v-model:value="activeTab" type="segment" animated>
          <NTabPane v-for="tab in tabs" :key="tab.key" :name="tab.key" :tab="`${tab.title} · 只读`">
            <CampaignOverviewShellCard
              v-if="tab.key === 'overview'"
              :shell="overviewShell"
              :editable="!readonlyWorkbench"
            />
            <CampaignAudienceRightsShellCard
              v-else-if="tab.key === 'audience-rights'"
              :shell="audienceRightsShell"
              :editable="!readonlyWorkbench"
            />
            <CampaignStagesTriggersShellCard
              v-else-if="tab.key === 'stages-triggers'"
              :shell="stagesTriggersShell"
              :editable="!readonlyWorkbench"
            />
            <CampaignDeliveryScenesShellCard
              v-else-if="tab.key === 'delivery-scenes'"
              :shell="deliveryScenesShell"
              :editable="!readonlyWorkbench"
            />
            <CampaignPrecheckLimitsShellCard
              v-else-if="tab.key === 'precheck-limits'"
              :shell="precheckLimitsShell"
              :editable="!readonlyWorkbench"
            />
            <CampaignDataExecutionShellCard
              v-else-if="tab.key === 'data-execution'"
              :shell="dataExecutionShell"
              :editable="!readonlyWorkbench"
            />
            <CampaignApprovalLogShell
              v-else-if="tab.key === 'approval-logs'"
              :shell="approvalShell"
              :editable="!readonlyWorkbench"
            />
            <NEmpty v-else description="未定义的工作台区域" />
          </NTabPane>
        </NTabs>
      </NCard>

      <!-- 协作与预检区：展示审批协作动作和发布前阻塞项，不在本页修改活动规则。 -->
      <div class="grid gap-16px xl:grid-cols-[1.2fr_0.8fr]">
        <CampaignCollabShell :shell="collabShell" :editable="!readonlyWorkbench" />
        <CampaignPrecheckShellPanel :shell="precheckShell" :editable="!readonlyWorkbench" />
      </div>

      <!-- 发布入口区：根据预检摘要控制发布提示，真实发布动作由后端接口处理。 -->
      <CampaignPublishShell :shell="precheckShell" :editable="!readonlyWorkbench" />
    </div>
  </NSpin>
</template>
