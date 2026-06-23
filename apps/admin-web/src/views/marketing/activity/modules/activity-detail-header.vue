<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NCard, NInput, NSpace, NTag } from 'naive-ui';
import { $t } from '@/locales';

interface StatusMeta {
  label: string;
  type: 'default' | 'success' | 'warning' | 'error' | 'info';
}

const props = defineProps<{
  activityName: string;
  activityStatus: StatusMeta;
  activityId: string;
  loading: boolean;
  saving: boolean;
}>();

const emit = defineEmits<{
  'update:activityId': [value: string];
  pick: [];
  load: [];
  save: [];
  precheck: [];
  publish: [];
  pause: [];
}>();

const activityIdModel = computed({
  get: () => props.activityId,
  set: (value) => emit('update:activityId', value),
});
</script>

<template>
  <!-- 活动详情头部区：展示当前活动身份、状态和详情页主操作入口。 -->
  <NCard :bordered="false" size="small">
    <NSpace align="center" justify="space-between">
      <div class="flex items-center gap-12px">
        <div class="text-18px font-semibold">{{ activityName || '活动详情' }}</div>
        <NTag :type="activityStatus.type">{{ activityStatus.label }}</NTag>
      </div>
      <NSpace>
        <NInput v-model:value="activityIdModel" placeholder="请选择活动" class="w-240px" readonly />
        <NButton ghost @click="emit('pick')">选择活动</NButton>
        <NButton :loading="loading" @click="emit('load')">加载活动</NButton>
        <NButton type="primary" ghost :loading="saving" @click="emit('save')">{{ $t('common.save') }}</NButton>
        <NButton type="info" ghost @click="emit('precheck')">预检</NButton>
        <NButton type="success" ghost @click="emit('publish')">发布</NButton>
        <NButton type="warning" ghost @click="emit('pause')">暂停</NButton>
      </NSpace>
    </NSpace>
  </NCard>
</template>
