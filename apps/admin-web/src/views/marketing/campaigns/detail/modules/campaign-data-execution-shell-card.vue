<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NDescriptions, NDescriptionsItem, NEmpty, NTag } from 'naive-ui';

defineOptions({ name: 'CampaignDataExecutionShellCard' });

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
    editable: false,
  },
);

const executionStatus = computed(() => readText(props.shell, ['executionStatus', 'status', 'state']));
const executor = computed(() => readText(props.shell, ['executorName', 'operatorName', 'createBy']));
const executedAt = computed(() => formatDateTime(readValue(props.shell, ['executedAt', 'updateTime', 'publishTime'])));
const executionResult = computed(() => readText(props.shell, ['result', 'summary', 'description']));

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

function readText(source: ShellRecord | null | undefined, keys: string[]) {
  const value = readValue(source, keys);
  if (typeof value !== 'string') return '-';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '-';
}

function formatDateTime(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN');
}

function toRecord(value: unknown): ShellRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as ShellRecord;
}
</script>

<template>
  <!-- 数据执行区：展示执行人、时间和结果，执行状态以后端任务为准。 -->
  <NCard title="数据执行工作区" :bordered="false" size="small">
    <template #header-extra>
      <NTag size="small" :type="editable ? 'success' : 'default'">
        {{ editable ? '可编辑' : '只读' }}
      </NTag>
    </template>

    <div v-if="loading" class="text-12px text-gray-500">正在加载数据执行数据...</div>
    <template v-else-if="shell">
      <NDescriptions label-placement="left" :column="2" size="small">
        <NDescriptionsItem label="执行状态">{{ executionStatus }}</NDescriptionsItem>
        <NDescriptionsItem label="执行人">{{ executor }}</NDescriptionsItem>
        <NDescriptionsItem label="执行时间">{{ executedAt }}</NDescriptionsItem>
        <NDescriptionsItem label="执行结果">{{ executionResult }}</NDescriptionsItem>
      </NDescriptions>
    </template>
    <NEmpty v-else description="暂无数据执行数据" />
  </NCard>
</template>
