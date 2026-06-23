<script setup lang="ts">
import { NStep, NSteps } from 'naive-ui';
import type { CampaignWizardStepConfig } from './campaign-wizard-step-config';

defineOptions({ name: 'CampaignWizardRail' });

defineProps<{
  steps: CampaignWizardStepConfig[];
  current: number;
}>();
</script>

<template>
  <!-- 向导步骤导航：展示七步创建顺序，只负责定位当前步骤，不提交业务数据。 -->
  <div class="rounded-16px bg-white px-20px py-20px shadow-sm">
    <div class="mb-12px text-18px text-[#1f2937] font-600">新建营销活动</div>
    <div class="mb-8px text-13px text-[#64748b]">先完成 7 步主链路，再进入权益池、试跑中心和发布预检。</div>
    <NSteps vertical :current="current + 1" size="small">
      <NStep v-for="step in steps" :key="step.key" :title="step.title" :description="step.note" />
    </NSteps>
  </div>
</template>
