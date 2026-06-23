<script setup lang="ts">
import { computed } from 'vue';
import { NDatePicker } from 'naive-ui';
import type { JsonSchemaProperty } from '@/views/marketing/_orchestration/types';

defineOptions({ name: 'SchemaTimeRangePicker' });

const props = defineProps<{
  schema: JsonSchemaProperty;
  value: unknown;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:value', value: string[] | null): void;
}>();

const valueModel = computed({
  get: () => {
    if (!Array.isArray(props.value) || props.value.length !== 2) return null;
    const start = new Date(String(props.value[0])).getTime();
    const end = new Date(String(props.value[1])).getTime();
    return Number.isNaN(start) || Number.isNaN(end) ? null : ([start, end] as [number, number]);
  },
  set: (value) => emit('update:value', value ? value.map((item) => new Date(item).toISOString()) : null),
});
</script>

<template>
  <NDatePicker
    v-model:value="valueModel"
    type="datetimerange"
    class="w-full"
    :disabled="disabled"
    :start-placeholder="schema['ui:placeholder'] ?? '开始时间'"
    end-placeholder="结束时间"
    clearable
  />
</template>
