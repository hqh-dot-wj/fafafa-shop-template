<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NDescriptions, NDescriptionsItem, NEmpty, NSpace, NTag } from 'naive-ui';

defineOptions({ name: 'CampaignAudienceRightsShellCard' });

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

const audienceSummary = computed(() => readText(props.shell, ['audienceSummary', 'audience', 'audienceScope']));
const rightsSummary = computed(() => readText(props.shell, ['rightsSummary', 'rights', 'permissions']));
const audienceTags = computed(() => readTags(props.shell, ['audienceTags', 'segments', 'targets']));
const rightsTags = computed(() => readTags(props.shell, ['rightsTags', 'permissionCodes', 'scopes']));

function readText(source: ShellRecord | null | undefined, keys: string[]) {
  const value = readValue(source, keys);
  if (typeof value !== 'string') return '-';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '-';
}

function readTags(source: ShellRecord | null | undefined, keys: string[]) {
  const value = readValue(source, keys);
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeTag(item)).filter((item): item is string => item.length > 0);
}

function normalizeTag(item: unknown) {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  const record = item as ShellRecord;
  const candidate = record.label ?? record.name ?? record.title ?? record.code;
  if (typeof candidate !== 'string') return '';
  return candidate.trim();
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
  <!-- 受众权限区：展示目标人群和权限范围，实际准入仍以后端预检结果为准。 -->
  <NCard title="受众权限工作区" :bordered="false" size="small">
    <template #header-extra>
      <NTag size="small" :type="editable ? 'success' : 'default'">
        {{ editable ? '可编辑' : '只读' }}
      </NTag>
    </template>

    <div v-if="loading" class="text-12px text-gray-500">正在加载受众权限数据...</div>
    <template v-else-if="shell">
      <NDescriptions label-placement="left" :column="1" size="small">
        <NDescriptionsItem label="受众概述">{{ audienceSummary }}</NDescriptionsItem>
        <NDescriptionsItem label="权限概述">{{ rightsSummary }}</NDescriptionsItem>
        <NDescriptionsItem label="受众标签">
          <NSpace v-if="audienceTags.length > 0" size="small" wrap>
            <NTag v-for="tag in audienceTags" :key="tag" size="small">{{ tag }}</NTag>
          </NSpace>
          <span v-else>-</span>
        </NDescriptionsItem>
        <NDescriptionsItem label="权限标签">
          <NSpace v-if="rightsTags.length > 0" size="small" wrap>
            <NTag v-for="tag in rightsTags" :key="tag" size="small" type="info">{{ tag }}</NTag>
          </NSpace>
          <span v-else>-</span>
        </NDescriptionsItem>
      </NDescriptions>
    </template>
    <NEmpty v-else description="暂无受众权限数据" />
  </NCard>
</template>
