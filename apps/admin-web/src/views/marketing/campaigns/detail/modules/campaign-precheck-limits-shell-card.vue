<script setup lang="ts">
import { computed } from 'vue';
import { NAlert, NCard, NDescriptions, NDescriptionsItem, NEmpty } from 'naive-ui';

defineOptions({ name: 'CampaignPrecheckLimitsShellCard' });

type ShellRecord = Record<string, unknown>;

const props = withDefaults(
  defineProps<{
    shell?: ShellRecord | null;
    loading?: boolean;
    editable?: boolean;
  }>(),
  {
    shell: null,
    loading: false,
    editable: true,
  },
);

const limitTitle = computed(() => readText(props.shell, ['limitTitle', 'title', 'name']));
const limitSummary = computed(() => readText(props.shell, ['limitSummary', 'summary', 'description']));
const limitCount = computed(() => readItems(props.shell, ['limits', 'rules', 'items']).length);
const warningText = computed(() => readText(props.shell, ['warning', 'risk', 'message']));

function readText(source: ShellRecord | null | undefined, keys: string[]) {
  const value = readValue(source, keys);
  if (typeof value !== 'string') return '-';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '-';
}

function readItems(source: ShellRecord | null | undefined, keys: string[]) {
  const value = readValue(source, keys);
  return Array.isArray(value) ? value : [];
}

function readValue(source: ShellRecord | null | undefined, keys: string[]) {
  const record = toRecord(source);
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
}

function toRecord(value: unknown): ShellRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as ShellRecord;
}
</script>

<template>
  <!-- 预检限制区：展示当前限制和风险提示，真实发布拦截以后端预检为准。 -->
  <NCard title="预检限制工作区" :bordered="false" size="small">
    <template #header-extra>
      <span class="text-12px text-gray-500">
        {{ editable ? '可编辑' : '只读' }}
      </span>
    </template>

    <div v-if="loading" class="text-12px text-gray-500">正在加载预检限制数据...</div>
    <template v-else-if="shell">
      <NDescriptions label-placement="left" :column="2" size="small">
        <NDescriptionsItem label="限制名称">{{ limitTitle }}</NDescriptionsItem>
        <NDescriptionsItem label="限制数量">{{ limitCount }}</NDescriptionsItem>
        <NDescriptionsItem label="限制说明" :span="2">{{ limitSummary }}</NDescriptionsItem>
      </NDescriptions>
      <NAlert v-if="warningText !== '-'" type="warning" class="mt-12px">
        {{ warningText }}
      </NAlert>
    </template>
    <NEmpty v-else description="暂无预检限制数据" />
  </NCard>
</template>
