<script setup lang="ts">
import WorkerDetailContent from '../../shared/worker-detail-content.vue';

defineOptions({
  name: 'WorkerDetailDrawer',
});

defineProps<{
  data: Api.Store.WorkerProfile | null;
}>();

const visible = defineModel<boolean>('visible', { required: true });
</script>

<template>
  <NDrawer v-model:show="visible" display-directive="show" :width="720">
    <NDrawerContent title="工作者详情" closable>
      <WorkerDetailContent :data="data" mode="profile" />
    </NDrawerContent>
  </NDrawer>
</template>
