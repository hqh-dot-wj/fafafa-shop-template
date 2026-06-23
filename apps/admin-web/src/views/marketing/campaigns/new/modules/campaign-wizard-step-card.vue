<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NTag } from 'naive-ui';
import type { CampaignWizardStepConfig } from './campaign-wizard-step-config';

defineOptions({ name: 'CampaignWizardStepCard' });

const props = defineProps<{
  steps: CampaignWizardStepConfig[];
  current: number;
  excludedDomains: string[];
  actionEntry: string[];
}>();

const currentStep = computed(() => props.steps[props.current] ?? props.steps[0]);
</script>

<template>
  <!-- 当前步骤说明区：解释该步骤负责的字段范围和下一步配置边界。 -->
  <NCard :bordered="false" class="rounded-16px shadow-sm">
    <template #header>
      <div class="flex items-center justify-between gap-12px">
        <div>
          <div class="text-18px text-[#0f172a] font-600">{{ currentStep?.title }}</div>
          <div class="mt-6px text-13px text-[#64748b]">{{ currentStep?.note }}</div>
        </div>
        <NTag type="info" size="small">Step {{ current + 1 }} / {{ steps.length }}</NTag>
      </div>
    </template>

    <div class="grid gap-16px lg:grid-cols-[1.25fr_0.75fr]">
      <!-- 边界说明区：告诉运营当前向导只保存草稿结构，不直接落运行规则。 -->
      <div class="rounded-14px bg-[#f8fafc] p-16px">
        <div class="text-13px text-[#334155] font-600">当前步骤边界</div>
        <ul class="mt-12px list-disc pl-18px text-13px text-[#475569] leading-7">
          <li>当前步骤只维护字段边界、入口动作和说明文案。</li>
          <li>权益池、试跑中心和复杂审批流由独立页面或后端服务处理。</li>
          <li>7 步主链路顺序保持稳定，后续只补充具体能力。</li>
        </ul>
      </div>

      <!-- 只读标签区：展示当前步骤排除的业务域和可触达的动作入口。 -->
      <div class="border border-[#cbd5e1] rounded-14px border-dashed p-16px space-y-12px">
        <div>
          <div class="text-12px text-[#94a3b8] font-600 tracking-[0.12em] uppercase">排除域</div>
          <div class="mt-10px flex flex-wrap gap-8px">
            <NTag v-for="item in excludedDomains" :key="item" type="warning" size="small">{{ item }}</NTag>
          </div>
        </div>

        <div>
          <div class="text-12px text-[#94a3b8] font-600 tracking-[0.12em] uppercase">入口动作</div>
          <div class="mt-10px flex flex-wrap gap-8px">
            <NTag v-for="item in actionEntry" :key="item" type="success" size="small">{{ item }}</NTag>
          </div>
        </div>
      </div>
    </div>
  </NCard>
</template>
