<script setup lang="ts">
import { computed } from 'vue';
import { NAlert, NButton, NDescriptions, NDescriptionsItem, NEmpty, NModal, NSpace, NTag } from 'naive-ui';

defineOptions({ name: 'ScenePrecheckReportModal' });

const props = defineProps<{
  show: boolean;
  result: Api.Marketing.ScenePublishPrecheckResult | null;
  precheckingSceneCode: string | null;
  publishingSceneCode: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'recheck', sceneCode: string): void;
  (e: 'publish', sceneCode: string): void;
}>();

const issueRows = computed(() => {
  const result = props.result;
  if (!result) {
    return [];
  }
  if (Array.isArray(result.issueDetails) && result.issueDetails.length > 0) {
    return result.issueDetails;
  }
  return result.issues.map(
    (message): Api.Marketing.ScenePublishPrecheckIssue => ({
      code: 'POLICY_MISSING',
      level: 'ERROR',
      target: 'unknown',
      message,
    }),
  );
});

const checkedAtText = computed(() => {
  const checkedAt = props.result?.checkedAt;
  if (!checkedAt) return '-';
  const date = new Date(checkedAt);
  if (Number.isNaN(date.getTime())) return checkedAt;
  return date.toLocaleString('zh-CN', { hour12: false });
});
</script>

<template>
  <!-- 发布预检报告弹窗：汇总后端预检结果和阻断问题。 -->
  <NModal
    :show="show"
    preset="card"
    title="发布预检报告"
    class="w-760px"
    @update:show="(value) => emit('update:show', value)"
  >
    <NSpace vertical :size="12">
      <!-- 预检结论区：说明当前场景是否满足发布条件。 -->
      <NAlert
        :type="result?.pass ? 'success' : 'error'"
        :title="result?.pass ? '预检通过' : '预检未通过'"
        :bordered="false"
      >
        <template v-if="result?.pass"> 当前场景已满足发布条件，可以继续发布。 </template>
        <template v-else> 发现 {{ issueRows.length }} 个阻断问题，请修复后重新预检。 </template>
      </NAlert>

      <!-- 预检摘要区：展示场景编码、模块数量和检查时间。 -->
      <NDescriptions label-placement="left" bordered :column="2">
        <NDescriptionsItem label="场景编码">{{ result?.sceneCode || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="模块数量">{{ result?.moduleCount ?? '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="预检时间" :span="2">{{ checkedAtText }}</NDescriptionsItem>
      </NDescriptions>

      <!-- 阻断问题区：列出后端返回的阻断级别、代码和定位信息。 -->
      <NEmpty v-if="issueRows.length === 0" description="暂无阻断问题" />
      <div v-else class="max-h-320px overflow-auto border border-gray-200 rounded-8px p-12px">
        <div
          v-for="(issue, index) in issueRows"
          :key="`${issue.code}-${issue.target}-${index}`"
          class="mb-8px rounded-6px bg-#fff5f5 p-10px last:mb-0"
        >
          <div class="mb-4px flex items-center gap-8px">
            <NTag type="error" size="small">{{ issue.level }}</NTag>
            <span class="text-12px text-gray-500 font-mono">{{ issue.code }}</span>
          </div>
          <div class="text-14px text-gray-800">{{ issue.message }}</div>
          <div class="mt-2px text-12px text-gray-500">定位：{{ issue.target }}</div>
        </div>
      </div>
    </NSpace>

    <template #footer>
      <!-- 操作区：允许重新预检，只有通过时才展示发布入口。 -->
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">关闭</NButton>
        <NButton
          v-if="result"
          type="info"
          ghost
          :loading="precheckingSceneCode === result.sceneCode"
          @click="emit('recheck', result.sceneCode)"
        >
          重新预检
        </NButton>
        <NButton
          v-if="result?.pass"
          type="primary"
          :loading="publishingSceneCode === result.sceneCode"
          @click="emit('publish', result.sceneCode)"
        >
          立即发布
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>
