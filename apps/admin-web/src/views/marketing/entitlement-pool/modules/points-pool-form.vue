<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NFormItem, NInput, NSpace } from 'naive-ui';

defineOptions({ name: 'PointsPoolForm' });

const props = defineProps<{
  taskId?: string;
  taskName?: string;
}>();

const emit = defineEmits<{
  (e: 'update:taskId', value: string): void;
  (e: 'update:taskName', value: string): void;
  (e: 'pickTask'): void;
}>();

const displayValue = computed(() => props.taskName?.trim() || props.taskId?.trim() || '');

function clearTask() {
  emit('update:taskId', '');
  emit('update:taskName', '');
}
</script>

<template>
  <!-- 积分池配置区：选择积分任务并回填任务标识给权益池草稿。 -->
  <NFormItem label="积分任务">
    <NSpace class="w-full" align="center">
      <NInput :value="displayValue" placeholder="请选择积分任务" readonly class="flex-1" />
      <NButton type="primary" ghost @click="emit('pickTask')">选择任务</NButton>
      <NButton quaternary @click="clearTask">清空</NButton>
    </NSpace>
  </NFormItem>
  <!-- 积分任务标识区：只读展示提交给编译接口的 taskId。 -->
  <NFormItem label="任务ID">
    <NInput :value="taskId || '-'" readonly />
  </NFormItem>
</template>
