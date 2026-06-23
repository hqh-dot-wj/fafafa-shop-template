<script setup lang="ts">
import { computed } from 'vue';
import { NDatePicker, NDynamicTags, NFormItem, NInput, NInputNumber, NSelect, NSwitch } from 'naive-ui';
import type { JsonSchemaProperty } from '@/views/marketing/_orchestration/types';
import { getRegisteredWidget } from './widget-registry';

defineOptions({ name: 'SchemaField' });

const props = defineProps<{
  fieldKey: string;
  schema: JsonSchemaProperty;
  value: unknown;
  required?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:value', value: unknown): void;
}>();

const label = computed(() => props.schema.title ?? props.fieldKey);
const fieldType = computed(() => {
  const type = props.schema.type;
  return Array.isArray(type) ? type[0] : type;
});
const widgetComponent = computed(() => getRegisteredWidget(props.schema['ui:widget']));
const options = computed(() =>
  (props.schema.enum ?? []).map((value, index) => ({
    label: String(props.schema.enumNames?.[index] ?? value),
    value: typeof value === 'boolean' ? String(value) : value,
  })),
);

const stringValue = computed({
  get: () => (typeof props.value === 'string' ? props.value : ''),
  set: (value) => emit('update:value', value),
});

const numberValue = computed({
  get: () => (typeof props.value === 'number' ? props.value : null),
  set: (value) => emit('update:value', value),
});

const booleanValue = computed({
  get: () => Boolean(props.value),
  set: (value) => emit('update:value', value),
});

const tagsValue = computed({
  get: () => (Array.isArray(props.value) ? props.value.map((item) => String(item)) : []),
  set: (value) => emit('update:value', value),
});

const selectValue = computed({
  get: () => (typeof props.value === 'boolean' ? String(props.value) : (props.value as string | number | null)),
  set: (value) => emit('update:value', value),
});

const datePickerValue = computed({
  get: () => {
    if (typeof props.value !== 'string' || !props.value) return null;
    const timestamp = new Date(props.value).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  },
  set: (value) => emit('update:value', value ? new Date(value).toISOString() : null),
});

const jsonText = computed({
  get: () => JSON.stringify(props.value ?? {}, null, 2),
  set: (value) => {
    try {
      emit('update:value', JSON.parse(value || '{}'));
    } catch {
      emit('update:value', value);
    }
  },
});

const isDateField = computed(
  () =>
    props.schema['ui:widget'] === 'datetime' || props.schema.format === 'date-time' || props.schema.format === 'date',
);

function handleWidgetUpdate(value: unknown) {
  emit('update:value', value);
}
</script>

<template>
  <NFormItem :label="label" :path="fieldKey" :required="required" :feedback="schema.description">
    <component
      :is="widgetComponent"
      v-if="widgetComponent"
      :schema="schema"
      :value="value"
      :disabled="disabled"
      @update:value="handleWidgetUpdate"
    />
    <NSelect
      v-else-if="options.length"
      v-model:value="selectValue"
      :options="options"
      :disabled="disabled"
      :placeholder="schema['ui:placeholder'] ?? `请选择${label}`"
      clearable
    />
    <NDatePicker
      v-else-if="isDateField"
      v-model:value="datePickerValue"
      class="w-full"
      :type="schema.format === 'date' || schema['ui:widget'] === 'date' ? 'date' : 'datetime'"
      :disabled="disabled"
      clearable
    />
    <NInputNumber
      v-else-if="fieldType === 'number' || fieldType === 'integer'"
      v-model:value="numberValue"
      class="w-full"
      :min="schema.minimum"
      :max="schema.maximum"
      :disabled="disabled"
      :placeholder="schema['ui:placeholder'] ?? `请输入${label}`"
    />
    <NSwitch v-else-if="fieldType === 'boolean'" v-model:value="booleanValue" :disabled="disabled" />
    <NDynamicTags v-else-if="fieldType === 'array'" v-model:value="tagsValue" :disabled="disabled" />
    <NInput
      v-else-if="fieldType === 'object'"
      v-model:value="jsonText"
      type="textarea"
      :autosize="{ minRows: 3, maxRows: 8 }"
      :disabled="disabled"
    />
    <NInput
      v-else
      v-model:value="stringValue"
      :disabled="disabled"
      :placeholder="schema['ui:placeholder'] ?? `请输入${label}`"
      clearable
    />
  </NFormItem>
</template>
