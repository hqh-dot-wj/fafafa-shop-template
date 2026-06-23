<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NDescriptions, NDescriptionsItem, NEmpty, NTag } from 'naive-ui';

defineOptions({ name: 'CampaignOverviewShellCard' });

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

const title = computed(() => readText(props.shell, ['title', 'name', 'campaignName', 'workbenchName']));
const status = computed(() => readText(props.shell, ['statusLabel', 'statusText', 'status', 'state']));
const owner = computed(() => readText(props.shell, ['ownerName', 'createBy', 'operatorName', 'owner']));
const description = computed(() => readText(props.shell, ['description', 'summary', 'content', 'remark']));
const updatedAt = computed(() => formatDateTime(readValue(props.shell, ['updateTime', 'checkedAt', 'publishTime'])));

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
  <!-- 概览区：展示活动基础信息和编辑状态，不在此处修改活动规则。 -->
  <NCard title="概览工作区" :bordered="false" size="small">
    <template #header-extra>
      <NTag size="small" :type="editable ? 'success' : 'default'">
        {{ editable ? '可编辑' : '只读' }}
      </NTag>
    </template>

    <div v-if="loading" class="text-12px text-gray-500">正在加载概览数据...</div>
    <template v-else-if="shell">
      <NDescriptions label-placement="left" :column="2" size="small">
        <NDescriptionsItem label="名称">{{ title }}</NDescriptionsItem>
        <NDescriptionsItem label="状态">{{ status }}</NDescriptionsItem>
        <NDescriptionsItem label="负责人">{{ owner }}</NDescriptionsItem>
        <NDescriptionsItem label="更新时间">{{ updatedAt }}</NDescriptionsItem>
        <NDescriptionsItem label="描述" :span="2">
          {{ description }}
        </NDescriptionsItem>
      </NDescriptions>
    </template>
    <NEmpty v-else description="暂无概览数据" />
  </NCard>
</template>
