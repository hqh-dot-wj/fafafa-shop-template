<script setup lang="ts">
import { computed } from 'vue';
import { NInput } from 'naive-ui';
import type { JsonSchemaProperty } from '@/views/marketing/_orchestration/types';

defineOptions({ name: 'SchemaTimeBoxPicker' });

const props = defineProps<{
  schema: JsonSchemaProperty;
  value: unknown;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:value', value: string): void;
}>();

const valueModel = computed({
  get: () => (typeof props.value === 'string' ? props.value : ''),
  set: (value) => emit('update:value', value),
});
</script>

<template>
  <NInput
    v-model:value="valueModel"
    :disabled="disabled"
    :placeholder="schema['ui:placeholder'] ?? '例如 10:00-12:00, 14:00-16:00'"
    clearable
  />
</template>
