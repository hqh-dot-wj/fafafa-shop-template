<script setup lang="ts">
import { NAlert, NCard, NDescriptions, NDescriptionsItem } from 'naive-ui';

defineProps<{
  statusLabel: string;
  sceneBindingCount: number;
  publishTime: string;
  precheckCheckedAt: string;
  precheckIssues: string[];
}>();
</script>

<template>
  <!-- 发布检查区：展示当前活动状态、关联场景和最近一次页面预检结果。 -->
  <NCard title="发布检查" :bordered="false" size="small">
    <!-- 发布摘要区：汇总发布相关时间和场景绑定数量。 -->
    <NDescriptions label-placement="left" :column="1" size="small">
      <NDescriptionsItem label="当前状态">{{ statusLabel }}</NDescriptionsItem>
      <NDescriptionsItem label="关联场景">{{ sceneBindingCount }}</NDescriptionsItem>
      <NDescriptionsItem label="最近发布时间">{{ publishTime }}</NDescriptionsItem>
      <NDescriptionsItem label="预检时间">{{ precheckCheckedAt }}</NDescriptionsItem>
    </NDescriptions>
    <!-- 预检结果区：仅展示前端预检问题，最终发布拦截仍以后端接口为准。 -->
    <NAlert v-if="precheckIssues.length > 0" type="warning" class="mt-12px">
      <div class="font-medium">预检失败</div>
      <ul class="mt-8px list-disc pl-16px text-sm">
        <li v-for="issue in precheckIssues" :key="issue">{{ issue }}</li>
      </ul>
    </NAlert>
    <NAlert v-else type="success" class="mt-12px">预检通过</NAlert>
  </NCard>
</template>
