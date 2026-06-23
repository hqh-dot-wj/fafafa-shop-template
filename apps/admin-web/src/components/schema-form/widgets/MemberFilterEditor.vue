<script setup lang="ts">
import { computed } from 'vue';
import { NSelect } from 'naive-ui';
import type { JsonSchemaProperty } from '@/views/marketing/_orchestration/types';

defineOptions({ name: 'SchemaMemberFilterEditor' });

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

const options = [
  { label: '新客', value: 'NEWCOMER' },
  { label: '会员', value: 'MEMBER' },
  { label: '分销员', value: 'DISTRIBUTOR' },
  { label: '高活跃用户', value: 'HIGH_ACTIVE' },
];
</script>

<template>
  <NSelect
    v-model:value="valueModel"
    multiple
    :options="options"
    :disabled="disabled"
    :placeholder="schema['ui:placeholder'] ?? '选择目标人群'"
  />
</template>
