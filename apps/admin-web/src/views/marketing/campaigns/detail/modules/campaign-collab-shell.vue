<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NDescriptions, NDescriptionsItem, NEmpty, NSpace, NTag } from 'naive-ui';

defineOptions({ name: 'CampaignCollabShell' });

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

const owner = computed(() => readText(props.shell, ['ownerName', 'owner', 'createBy']));
const collaborators = computed(() => readTags(props.shell, ['collaborators', 'members', 'users', 'participants']));
const roles = computed(() => readTags(props.shell, ['collaborationActions', 'roles', 'collabRoles', 'permissions']));

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
  const candidate = record.label ?? record.name ?? record.title ?? record.code ?? record.nickname;
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
  <!-- 协作区：展示负责人、成员和角色，只读解释协作配置来源。 -->
  <NCard title="协作工作区" :bordered="false" size="small">
    <template #header-extra>
      <NTag size="small" :type="editable ? 'success' : 'default'">
        {{ editable ? '可编辑' : '只读' }}
      </NTag>
    </template>

    <div v-if="loading" class="text-12px text-gray-500">正在加载协作数据...</div>
    <template v-else-if="shell">
      <NDescriptions label-placement="left" :column="1" size="small">
        <NDescriptionsItem label="负责人">{{ owner }}</NDescriptionsItem>
        <NDescriptionsItem label="协作成员">
          <NSpace v-if="collaborators.length > 0" size="small" wrap>
            <NTag v-for="member in collaborators" :key="member" size="small">{{ member }}</NTag>
          </NSpace>
          <span v-else>-</span>
        </NDescriptionsItem>
        <NDescriptionsItem label="协作角色">
          <NSpace v-if="roles.length > 0" size="small" wrap>
            <NTag v-for="role in roles" :key="role" size="small" type="info">{{ role }}</NTag>
          </NSpace>
          <span v-else>-</span>
        </NDescriptionsItem>
      </NDescriptions>
    </template>
    <NEmpty v-else description="暂无协作数据" />
  </NCard>
</template>
