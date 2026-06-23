<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NDescriptions, NDescriptionsItem, NEmpty, NSpace, NTag } from 'naive-ui';

defineOptions({ name: 'CampaignStagesTriggersShellCard' });

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

const stageCount = computed(() => readItems(props.shell, ['stages', 'stageList', 'phases']).length);
const triggerCount = computed(() => readItems(props.shell, ['triggers', 'triggerList', 'conditions']).length);
const stageTags = computed(() => readItems(props.shell, ['stages', 'stageList', 'phases']).map((item) => item.label));
const triggerTags = computed(() =>
  readItems(props.shell, ['triggers', 'triggerList', 'conditions']).map((item) => item.label),
);

interface TagItem {
  label: string;
}

function readItems(source: ShellRecord | null | undefined, keys: string[]): TagItem[] {
  const value = readValue(source, keys);
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeItem(item)).filter((item): item is TagItem => Boolean(item));
}

function normalizeItem(item: unknown): TagItem | null {
  if (typeof item === 'string') {
    const label = item.trim();
    return label ? { label } : null;
  }
  if (!item || typeof item !== 'object') return null;
  const record = item as ShellRecord;
  const candidate =
    record.label ?? record.name ?? record.title ?? record.code ?? record.stageName ?? record.triggerName;
  if (typeof candidate !== 'string') return null;
  const label = candidate.trim();
  return label ? { label } : null;
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
  <!-- 阶段触发区：展示阶段和触发条件摘要，不在前端推演活动状态机。 -->
  <NCard title="阶段与触发工作区" :bordered="false" size="small">
    <template #header-extra>
      <NTag size="small" :type="editable ? 'success' : 'default'">
        {{ editable ? '可编辑' : '只读' }}
      </NTag>
    </template>

    <div v-if="loading" class="text-12px text-gray-500">正在加载阶段与触发数据...</div>
    <template v-else-if="shell">
      <NDescriptions label-placement="left" :column="2" size="small">
        <NDescriptionsItem label="阶段数量">{{ stageCount }}</NDescriptionsItem>
        <NDescriptionsItem label="触发数量">{{ triggerCount }}</NDescriptionsItem>
        <NDescriptionsItem label="阶段标签" :span="2">
          <NSpace v-if="stageTags.length > 0" size="small" wrap>
            <NTag v-for="tag in stageTags" :key="tag" size="small">{{ tag }}</NTag>
          </NSpace>
          <span v-else>-</span>
        </NDescriptionsItem>
        <NDescriptionsItem label="触发标签" :span="2">
          <NSpace v-if="triggerTags.length > 0" size="small" wrap>
            <NTag v-for="tag in triggerTags" :key="tag" size="small" type="info">{{ tag }}</NTag>
          </NSpace>
          <span v-else>-</span>
        </NDescriptionsItem>
      </NDescriptions>
    </template>
    <NEmpty v-else description="暂无阶段与触发数据" />
  </NCard>
</template>
