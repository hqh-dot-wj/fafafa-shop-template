<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NSelect } from 'naive-ui';
import { fetchGetTenantList } from '@/service/api/system/tenant';
import { useAuthStore } from '@/store/modules/auth';
import type { JsonSchemaProperty } from '@/views/marketing/_orchestration/types';

defineOptions({ name: 'SchemaStorePicker' });

const props = defineProps<{
  schema: JsonSchemaProperty;
  value: unknown;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:value', value: string[]): void;
}>();

const authStore = useAuthStore();
const currentTenantId = computed(() => authStore.userInfo.user?.tenantId ?? '');

const loading = ref(false);
const options = ref<Array<{ label: string; value: string }>>([]);

const valueModel = computed({
  get: () => (Array.isArray(props.value) ? props.value.map((item) => String(item)) : []),
  set: (value) => emit('update:value', value),
});

watch(
  currentTenantId,
  (tenantId) => {
    if (!tenantId) return;
    if (!valueModel.value.length) {
      emit('update:value', [tenantId]);
    }
  },
  { immediate: true },
);

onMounted(async () => {
  loading.value = true;
  try {
    const { data } = await fetchGetTenantList({
      pageNum: 1,
      pageSize: 200,
    } as Api.System.TenantSearchParams);
    const rows = data?.rows ?? [];
    options.value = rows.map((row) => ({
      label: row.companyName ? `${row.companyName}（${row.tenantId}）` : String(row.tenantId),
      value: String(row.tenantId),
    }));
    if (currentTenantId.value && !options.value.some((option) => option.value === currentTenantId.value)) {
      options.value.unshift({
        label: `当前租户（${currentTenantId.value}）`,
        value: currentTenantId.value,
      });
    }
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
    :placeholder="schema['ui:placeholder'] ?? '选择适用租户'"
  />
</template>
