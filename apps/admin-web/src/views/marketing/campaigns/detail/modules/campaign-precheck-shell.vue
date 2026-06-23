<script setup lang="ts">
import { computed } from 'vue';
import { NAlert, NCard, NDescriptions, NDescriptionsItem, NEmpty, NList, NListItem } from 'naive-ui';
import { type CampaignPrecheckShell, useCampaignPrecheck } from './use-campaign-precheck';

defineOptions({ name: 'CampaignPrecheckShell' });

const props = withDefaults(
  defineProps<{
    shell?: CampaignPrecheckShell | null;
    loading?: boolean;
    editable?: boolean;
  }>(),
  {
    shell: null,
    loading: false,
    editable: false,
  },
);

const shellModel = computed(() => props.shell);

const { statusLabel, statusType, issueCount, issueList, checkedAtText, moduleCountText } =
  useCampaignPrecheck(shellModel);
</script>

<template>
  <!-- 预检区：汇总后端返回的检查项，用于解释发布入口是否被阻塞。 -->
  <NCard title="预检工作区" :bordered="false" size="small">
    <template #header-extra>
      <span class="text-12px text-gray-500">
        {{ editable ? '可编辑' : '只读' }}
      </span>
    </template>

    <div v-if="loading" class="text-12px text-gray-500">正在加载预检数据...</div>
    <template v-else-if="shell">
      <NDescriptions label-placement="left" :column="2" size="small">
        <NDescriptionsItem label="状态">
          <NAlert :type="statusType" :bordered="false">{{ statusLabel }}</NAlert>
        </NDescriptionsItem>
        <NDescriptionsItem label="模块数量">{{ moduleCountText }}</NDescriptionsItem>
        <NDescriptionsItem label="问题数量">{{ issueCount }}</NDescriptionsItem>
        <NDescriptionsItem label="检查时间">{{ checkedAtText }}</NDescriptionsItem>
      </NDescriptions>

      <NList v-if="issueList.length > 0" bordered class="mt-12px" size="small">
        <NListItem v-for="issue in issueList" :key="issue">
          {{ issue }}
        </NListItem>
      </NList>
      <NEmpty v-else class="mt-12px" description="当前没有预检问题" />
    </template>
    <NEmpty v-else description="暂无预检数据" />
  </NCard>
</template>
