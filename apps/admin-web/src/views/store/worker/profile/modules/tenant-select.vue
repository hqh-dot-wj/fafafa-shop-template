<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { SelectOption } from 'naive-ui';
import { fetchGetTenantList } from '@/service/api/system/tenant';
import { useAuthStore } from '@/store/modules/auth';

defineOptions({
  name: 'TenantSelect',
});

const model = defineModel<string | undefined>('value', { required: true });

const authStore = useAuthStore();
const tenantOptions = ref<SelectOption[]>([]);
const loading = ref(false);

const currentTenantId = computed(() => String(authStore.userInfo.user?.tenantId || ''));
const isSuperTenant = computed(() => currentTenantId.value === '000000');

onMounted(() => {
  if (isSuperTenant.value) {
    loadTenants();
  } else {
    model.value = currentTenantId.value;
  }
});

async function loadTenants(keyword?: string) {
  loading.value = true;
  try {
    const { data } = await fetchGetTenantList({
      pageNum: 1,
      pageSize: 100,
      companyName: keyword || null,
    });
    tenantOptions.value = (data?.rows ?? [])
      .filter((item) => String(item.tenantId) !== '000000')
      .map((item) => ({
        label: `${item.companyName}（${item.tenantId}）`,
        value: String(item.tenantId),
      }));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <NSelect
    v-if="isSuperTenant"
    v-model:value="model"
    :options="tenantOptions"
    :loading="loading"
    filterable
    remote
    clearable
    placeholder="请选择所属租户"
    @search="loadTenants"
  />
  <NInput v-else :value="currentTenantId" readonly />
</template>
