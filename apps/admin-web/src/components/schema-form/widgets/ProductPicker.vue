<script setup lang="ts">
import { computed, ref } from 'vue';
import { NButton, NSpace, NTag } from 'naive-ui';
import ProductSelectModal from '@/components/business/product-select-modal.vue';
import type { ProductPickerSelection } from '@/components/business/entity-picker.shared';
import type { JsonSchemaProperty } from '@/views/marketing/_orchestration/types';

defineOptions({ name: 'SchemaProductPicker' });

const props = defineProps<{
  schema: JsonSchemaProperty;
  value: unknown;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:value', value: ProductPickerSelection[]): void;
}>();

const visible = ref(false);

const selected = computed<ProductPickerSelection[]>(() =>
  Array.isArray(props.value) ? (props.value as ProductPickerSelection[]) : [],
);

function handleSelect(row: ProductPickerSelection) {
  const exists = selected.value.some((item) => item.productId === row.productId && item.skuId === row.skuId);
  if (!exists) {
    emit('update:value', [...selected.value, row]);
  }
}

function removeProduct(index: number) {
  emit(
    'update:value',
    selected.value.filter((_, current) => current !== index),
  );
}
</script>

<template>
  <div class="w-full">
    <NSpace vertical size="small">
      <NSpace v-if="selected.length" size="small">
        <NTag
          v-for="(item, index) in selected"
          :key="`${item.productId}-${item.skuId || index}`"
          closable
          @close="removeProduct(index)"
        >
          {{ item.displayName || item.name || item.productId }}
        </NTag>
      </NSpace>
      <NButton size="small" :disabled="disabled" @click="visible = true">
        {{ schema.title ? `选择${schema.title}` : '选择商品' }}
      </NButton>
    </NSpace>
    <ProductSelectModal v-model:visible="visible" @select="handleSelect" />
  </div>
</template>
