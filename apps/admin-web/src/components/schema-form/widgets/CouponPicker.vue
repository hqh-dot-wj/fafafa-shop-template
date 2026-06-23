<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NSelect } from 'naive-ui';
import { fetchGetCouponTemplateList } from '@/service/api/marketing/coupon';
import type { JsonSchemaProperty } from '@/views/marketing/_orchestration/types';

defineOptions({ name: 'SchemaCouponPicker' });

const props = defineProps<{
  schema: JsonSchemaProperty;
  value: unknown;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:value', value: string[]): void;
}>();

const loading = ref(false);
const options = ref<Array<{ label: string; value: string }>>([]);

const valueModel = computed({
  get: () => (Array.isArray(props.value) ? props.value.map((item) => String(item)) : []),
  set: (value) => emit('update:value', value),
});

onMounted(async () => {
  loading.value = true;
  try {
    const { data } = await fetchGetCouponTemplateList({
      pageNum: 1,
      pageSize: 200,
      status: 'ACTIVE',
    } as Api.Marketing.CouponTemplateSearchParams);
    const rows = data?.rows ?? [];
    options.value = rows.map((row) => ({
      label: row.name ? `${row.name}（${row.id}）` : row.id,
      value: row.id,
    }));
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <NSelect
    v-model:value="valueModel"
    multiple
    filterable
    :loading="loading"
    :disabled="disabled"
    :options="options"
    :placeholder="schema['ui:placeholder'] ?? '选择优惠券模板'"
  />
</template>
