<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NDescriptions, NDescriptionsItem, NEmpty, NTag } from 'naive-ui';
import { type CampaignPrecheckShell, useCampaignPrecheck } from './use-campaign-precheck';

defineOptions({ name: 'CampaignPublishShell' });

const props = withDefaults(
  defineProps<{
    shell?: CampaignPrecheckShell | null;
    loading?: boolean;
    editable?: boolean;
  }>(),
  {
    shell: null,
    loading: false,
    editable: true,
  },
);

const { publishReady, blockedCount } = useCampaignPrecheck(computed(() => props.shell));
const publishStatus = computed(() => (publishReady.value ? '可进入发布入口' : '发布仍被预检项阻塞'));
const publishActionList = computed(() => props.shell?.publishActions ?? []);
</script>

<template>
  <!-- 发布入口区：展示发布资格和可执行动作，最终发布由后端服务校验。 -->
  <NCard title="发布入口" :bordered="false" size="small">
    <template #header-extra>
      <NTag size="small" :type="editable ? 'success' : 'default'">
        {{ editable ? '可编辑' : '只读' }}
      </NTag>
    </template>

    <div v-if="loading" class="text-12px text-gray-500">正在加载发布数据...</div>
    <template v-else-if="shell">
      <NDescriptions label-placement="left" :column="2" size="small">
        <NDescriptionsItem label="发布状态">{{ publishStatus }}</NDescriptionsItem>
        <NDescriptionsItem label="阻塞项数量">{{ blockedCount }}</NDescriptionsItem>
        <NDescriptionsItem label="活动标识">{{ shell.campaignId || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="可执行动作">
          <span v-if="publishActionList.length > 0">{{ publishActionList.join(' / ') }}</span>
          <span v-else>-</span>
        </NDescriptionsItem>
      </NDescriptions>
    </template>
    <NEmpty v-else description="暂无发布数据" />
  </NCard>
</template>
