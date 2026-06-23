<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NSpin, useMessage } from 'naive-ui';
import { type CampaignWizardShell, fetchCampaignWizardShell, fetchCreateActivity } from '@/service/api/marketing';
import CampaignWizardActions from './modules/campaign-wizard-actions.vue';
import CampaignWizardRail from './modules/campaign-wizard-rail.vue';
import CampaignWizardStepCard from './modules/campaign-wizard-step-card.vue';
import { CAMPAIGN_WIZARD_STEPS } from './modules/campaign-wizard-step-config';

defineOptions({ name: 'MarketingCampaignWizardPage' });

// 新版活动创建向导只拉取 shell 配置并创建初始草稿。
// 草稿创建后进入工作台继续完善，避免在向导页直接提交完整活动规则。
const message = useMessage();
const router = useRouter();

const loading = ref(false);
const saving = ref(false);
const currentStep = ref(0);
const wizardShell = ref<CampaignWizardShell | null>(null);
const draftId = ref('');

const steps = computed(() =>
  wizardShell.value?.steps?.length === 7 ? wizardShell.value.steps : CAMPAIGN_WIZARD_STEPS,
);
const excludedDomains = computed(() => wizardShell.value?.excludedDomains ?? ['entitlement-pool', 'test-run-center']);
const actionEntry = computed(
  () => wizardShell.value?.actionEntry ?? ['save-draft', 'previous-step', 'next-step', 'precheck'],
);

async function loadWizardShell() {
  loading.value = true;
  try {
    const response = await fetchCampaignWizardShell();
    wizardShell.value = response.data ?? null;
  } finally {
    loading.value = false;
  }
}

function goPrevious() {
  currentStep.value = Math.max(0, currentStep.value - 1);
}

function goNext() {
  currentStep.value = Math.min(steps.value.length - 1, currentStep.value + 1);
}

function handleSaveDraft() {
  runAsyncTask(async () => {
    const campaignId = await ensureDraft();
    await router.push({
      name: 'marketing_campaigns_detail',
      query: {
        campaignId,
      },
    });
  });
}

function handlePrecheck() {
  runAsyncTask(async () => {
    const campaignId = await ensureDraft();
    await router.push({
      name: 'marketing_campaigns_detail',
      query: {
        campaignId,
        tab: 'precheck-limits',
      },
    });
  });
}

async function ensureDraft() {
  if (draftId.value) return draftId.value;
  saving.value = true;
  try {
    // 初始草稿默认未启用，避免运营点“保存草稿”后活动立刻进入 C 端出数。
    const now = new Date();
    const name = `营销活动草稿-${now.toLocaleDateString('zh-CN')}-${now.toLocaleTimeString('zh-CN')}`;
    const { data } = await fetchCreateActivity({
      type: 'NEWCOMER_EXCLUSIVE',
      name,
      description: '向导页面自动创建的初始草稿',
      triggerCondition: {},
      rules: {},
      rewards: {},
      priority: 0,
      isEnabled: false,
    });
    const createdId = data?.id || '';
    if (!createdId) {
      throw new Error('草稿创建失败');
    }
    draftId.value = createdId;
    message.success('草稿已创建，正在进入活动工作台');
    return createdId;
  } finally {
    saving.value = false;
  }
}

function runAsyncTask(task: () => Promise<unknown>) {
  task().catch(() => {
    message.error('操作失败，请稍后重试');
  });
}

onMounted(() => {
  loadWizardShell();
});
</script>

<template>
  <!-- 新版创建向导：读取工作区配置并引导运营创建未启用草稿。 -->
  <NSpin :show="loading" class="h-full">
    <div
      class="h-full min-h-640px flex flex-col gap-16px overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-16px lg:grid lg:grid-cols-[320px_minmax(0,1fr)]"
    >
      <!-- 步骤导航区：展示后端配置或本地默认的七步创建流程。 -->
      <CampaignWizardRail :steps="steps" :current="currentStep" />
      <div class="min-h-0 flex flex-col gap-16px">
        <!-- 当前步骤区：解释该步骤负责的业务域和暂不纳入的模块。 -->
        <CampaignWizardStepCard
          :steps="steps"
          :current="currentStep"
          :excluded-domains="excludedDomains"
          :action-entry="actionEntry"
        />
        <!-- 向导操作区：只创建草稿或进入预检，不直接发布活动。 -->
        <CampaignWizardActions
          :current="currentStep"
          :total="steps.length"
          :loading="loading || saving"
          @previous="goPrevious"
          @next="goNext"
          @save-draft="handleSaveDraft"
          @precheck="handlePrecheck"
        />
      </div>
    </div>
  </NSpin>
</template>
