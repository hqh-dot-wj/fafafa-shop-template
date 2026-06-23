<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NSpace } from 'naive-ui';

defineOptions({ name: 'CampaignWizardActions' });

const props = defineProps<{
  current: number;
  total: number;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'previous'): void;
  (e: 'next'): void;
  (e: 'saveDraft'): void;
  (e: 'precheck'): void;
}>();

const isFirstStep = computed(() => props.current <= 0);
const isLastStep = computed(() => props.current >= props.total - 1);
</script>

<template>
  <!-- 向导动作区：只切换步骤、保存草稿或进入预检入口，不直接发布活动。 -->
  <div
    class="flex flex-wrap items-center justify-between gap-12px rounded-16px bg-[#0f172a] px-18px py-14px text-white shadow-sm"
  >
    <div class="text-13px text-white/75">
      当前处于第 {{ current + 1 }} 步，共 {{ total }} 步。本区只处理向导动作，不直接提交运行规则。
    </div>
    <NSpace wrap>
      <NButton secondary @click="emit('saveDraft')">保存草稿</NButton>
      <NButton secondary :disabled="isFirstStep || loading" @click="emit('previous')">上一步</NButton>
      <NButton secondary :disabled="loading" @click="emit('precheck')">预检入口</NButton>
      <NButton type="primary" :disabled="isLastStep || loading" @click="emit('next')">下一步</NButton>
    </NSpace>
  </div>
</template>
