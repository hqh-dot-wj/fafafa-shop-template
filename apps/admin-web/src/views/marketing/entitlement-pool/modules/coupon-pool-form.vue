<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NFormItem, NInput, NSpace } from 'naive-ui';

defineOptions({ name: 'CouponPoolForm' });

const props = defineProps<{
  templateId?: string;
  templateName?: string;
}>();

const emit = defineEmits<{
  (e: 'update:templateId', value: string): void;
  (e: 'update:templateName', value: string): void;
  (e: 'pickTemplate'): void;
}>();

const displayValue = computed(() => props.templateName?.trim() || props.templateId?.trim() || '');

function clearTemplate() {
  emit('update:templateId', '');
  emit('update:templateName', '');
}
</script>

<template>
  <!-- 券池配置区：选择券模板并回填模板标识给权益池草稿。 -->
  <NFormItem label="券模板">
    <NSpace class="w-full" align="center">
      <NInput :value="displayValue" placeholder="请选择券模板" readonly class="flex-1" />
      <NButton type="primary" ghost @click="emit('pickTemplate')">选择模板</NButton>
      <NButton quaternary @click="clearTemplate">清空</NButton>
    </NSpace>
  </NFormItem>
  <!-- 券模板标识区：只读展示提交给编译接口的 templateId。 -->
  <NFormItem label="模板ID">
    <NInput :value="templateId || '-'" readonly />
  </NFormItem>
</template>
