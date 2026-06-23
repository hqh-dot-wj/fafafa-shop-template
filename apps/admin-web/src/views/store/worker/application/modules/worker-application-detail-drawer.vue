<script setup lang="ts">
import WorkerDetailContent from '../../shared/worker-detail-content.vue';

defineOptions({
  name: 'WorkerApplicationDetailDrawer',
});

defineProps<{
  data: Api.Store.WorkerApplication | null;
}>();

const emit = defineEmits<{
  approve: [];
  reject: [];
}>();

const visible = defineModel<boolean>('visible', { required: true });
</script>

<template>
  <NDrawer v-model:show="visible" display-directive="show" :width="720">
    <NDrawerContent title="申请详情" closable>
      <WorkerDetailContent :data="data" mode="application" />
      <template #footer>
        <NSpace v-if="data?.applicationStatus === 'PENDING'" justify="end">
          <NButton type="error" ghost @click="emit('reject')">拒绝</NButton>
          <NButton type="primary" @click="emit('approve')">审核通过</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
