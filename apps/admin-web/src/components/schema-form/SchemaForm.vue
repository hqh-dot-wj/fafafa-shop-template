<script setup lang="ts">
import { computed } from 'vue';
import { NForm } from 'naive-ui';
import type { FormRules } from 'naive-ui';
import type { JsonSchemaObject } from '@/views/marketing/_orchestration/types';
import SchemaField from './SchemaField.vue';

defineOptions({ name: 'SchemaForm' });

const props = defineProps<{
  schema: JsonSchemaObject;
  modelValue: Record<string, unknown>;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, unknown>): void;
}>();

const requiredFields = computed(() => new Set(props.schema.required ?? []));
const propertiesMap = computed(() => props.schema.properties ?? {});

const formRules = computed<FormRules>(() => {
  const rules: FormRules = {};
  for (const key of requiredFields.value) {
    rules[key] = [
      { required: true, message: `请填写${propertiesMap.value[key]?.title ?? key}`, trigger: ['blur', 'change'] },
    ];
  }
  return rules;
});

function updateField(key: string, value: unknown) {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: value,
  });
}
</script>

<template>
  <NForm :model="modelValue" :rules="formRules" label-placement="top" size="small">
    <SchemaField
      v-for="(fieldSchema, key) in propertiesMap"
      :key="key"
      :field-key="String(key)"
      :schema="fieldSchema"
      :value="modelValue[String(key)]"
      :required="requiredFields.has(String(key))"
      :disabled="disabled"
      @update:value="(value) => updateField(String(key), value)"
    />
  </NForm>
</template>
