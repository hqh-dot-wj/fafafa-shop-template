<script setup lang="ts">
import { computed } from 'vue';
import { NSelect } from 'naive-ui';
import type { JsonSchemaProperty } from '@/views/marketing/_orchestration/types';

defineOptions({ name: 'SchemaActivityPoolPicker' });

const props = defineProps<{
  schema: JsonSchemaProperty;
  value: unknown;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:value', value: string[]): void;
}>();

const valueModel = computed({
  get: () => (Array.isArray(props.value) ? props.value.map((item) => String(item)) : []),
  set: (value) => emit('update:value', value),
});
</script>

<template>
  <NSelect
    v-model:value="valueModel"
    multiple
    filterable
    tag
    :disabled="disabled"
    :options="[]"
    :placeholder="schema['ui:placeholder'] ?? '输入活动池编码后回车'"
  />
</template>
