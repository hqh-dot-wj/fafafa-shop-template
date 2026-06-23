<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NEmpty, NList, NListItem, NSpace, NTag } from 'naive-ui';

defineOptions({ name: 'CampaignApprovalLogShell' });

type ShellRecord = Record<string, unknown>;

interface ApprovalLogItem {
  title: string;
  time: string;
  detail: string;
}

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

const logItems = computed(() => readItems(props.shell, ['entries', 'logs', 'approvalLogs', 'items', 'records']));

function readItems(source: ShellRecord | null | undefined, keys: string[]) {
  const value = readValue(source, keys);
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeItem(item)).filter((item): item is ApprovalLogItem => Boolean(item));
}

function normalizeItem(item: unknown): ApprovalLogItem | null {
  if (typeof item === 'string') {
    const text = item.trim();
    return text ? { title: text, time: '-', detail: '-' } : null;
  }
  if (!item || typeof item !== 'object') return null;
  const record = item as ShellRecord;
  const title = pickText(record, ['title', 'action', 'status', 'name']);
  const time = pickText(record, ['time', 'checkedAt', 'createTime', 'updateTime']);
  const detail = pickText(record, ['detail', 'remark', 'message', 'description']);
  return title !== '-' || time !== '-' || detail !== '-' ? { title, time, detail } : null;
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

function pickText(record: ShellRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      const text = value.trim();
      if (text.length > 0) return text;
    }
  }
  return '-';
}

function toRecord(value: unknown): ShellRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as ShellRecord;
}
</script>

<template>
  <!-- 审批日志区：按后端日志展示流转记录，不在前端补写审批状态。 -->
  <NCard title="审批日志" :bordered="false" size="small">
    <template #header-extra>
      <span class="text-12px text-gray-500">
        {{ editable ? '可编辑' : '只读' }}
      </span>
    </template>

    <div v-if="loading" class="text-12px text-gray-500">正在加载审批日志...</div>
    <template v-else-if="shell">
      <NList v-if="logItems.length > 0" bordered size="small">
        <NListItem v-for="(item, index) in logItems" :key="`${item.title}-${item.time}-${index}`">
          <NSpace vertical size="small" class="w-full">
            <div class="flex items-center justify-between gap-12px">
              <div class="font-medium">{{ item.title }}</div>
              <NTag size="small" type="info">{{ item.time }}</NTag>
            </div>
            <div class="text-12px text-gray-500">{{ item.detail }}</div>
          </NSpace>
        </NListItem>
      </NList>
      <NEmpty v-else description="暂无审批日志" />
    </template>
    <NEmpty v-else description="暂无审批日志数据" />
  </NCard>
</template>
