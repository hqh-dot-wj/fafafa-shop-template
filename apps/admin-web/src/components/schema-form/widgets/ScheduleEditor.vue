<script setup lang="ts">
import { computed } from 'vue';
import { NInput } from 'naive-ui';
import type { JsonSchemaProperty } from '@/views/marketing/_orchestration/types';

defineOptions({ name: 'SchemaScheduleEditor' });

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
    type="textarea"
    :autosize="{ minRows: 3, maxRows: 6 }"
    :disabled="disabled"
    :placeholder="schema['ui:placeholder'] ?? '填写排期、地址、截止时间等运营说明'"
  />
</template>
