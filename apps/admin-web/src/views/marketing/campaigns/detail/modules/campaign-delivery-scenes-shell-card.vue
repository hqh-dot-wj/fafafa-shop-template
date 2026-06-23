<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NDescriptions, NDescriptionsItem, NEmpty, NSpace, NTag } from 'naive-ui';

defineOptions({ name: 'CampaignDeliveryScenesShellCard' });

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

const sceneCount = computed(() => readItems(props.shell, ['scenes', 'deliveryScenes', 'sceneList']).length);
const channelCount = computed(() => readItems(props.shell, ['channels', 'deliveryChannels', 'channelList']).length);
const sceneTags = computed(() =>
  readItems(props.shell, ['scenes', 'deliveryScenes', 'sceneList']).map((item) => item.label),
);
const channelTags = computed(() =>
  readItems(props.shell, ['channels', 'deliveryChannels', 'channelList']).map((item) => item.label),
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
  const candidate = record.label ?? record.name ?? record.title ?? record.code ?? record.sceneName;
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
  <!-- 投放场景区：展示场景和渠道归属，只读说明活动会出现在哪里。 -->
  <NCard title="投放场景工作区" :bordered="false" size="small">
    <template #header-extra>
      <NTag size="small" :type="editable ? 'success' : 'default'">
        {{ editable ? '可编辑' : '只读' }}
      </NTag>
    </template>

    <div v-if="loading" class="text-12px text-gray-500">正在加载投放场景数据...</div>
    <template v-else-if="shell">
      <NDescriptions label-placement="left" :column="2" size="small">
        <NDescriptionsItem label="场景数量">{{ sceneCount }}</NDescriptionsItem>
        <NDescriptionsItem label="渠道数量">{{ channelCount }}</NDescriptionsItem>
        <NDescriptionsItem label="场景标签" :span="2">
          <NSpace v-if="sceneTags.length > 0" size="small" wrap>
            <NTag v-for="tag in sceneTags" :key="tag" size="small">{{ tag }}</NTag>
          </NSpace>
          <span v-else>-</span>
        </NDescriptionsItem>
        <NDescriptionsItem label="渠道标签" :span="2">
          <NSpace v-if="channelTags.length > 0" size="small" wrap>
            <NTag v-for="tag in channelTags" :key="tag" size="small" type="info">{{ tag }}</NTag>
          </NSpace>
          <span v-else>-</span>
        </NDescriptionsItem>
      </NDescriptions>
    </template>
    <NEmpty v-else description="暂无投放场景数据" />
  </NCard>
</template>
