import { computed, onMounted, ref } from 'vue';
import type { SelectOption } from 'naive-ui';
import { fetchTenantList } from '@/service/api/auth';
import { buildTenantLabelMap } from './finance-display';

export function useFinanceTenantLabels() {
  const tenantLabelMap = ref<Record<string, string>>({});
  const tenantOptions = ref<SelectOption[]>([]);

  async function loadTenantLabels() {
    const { data, error } = await fetchTenantList();

    if (error || !data?.voList) return;

    tenantLabelMap.value = buildTenantLabelMap(data.voList);
    tenantOptions.value = data.voList.map(item => ({
      label: item.companyName || item.tenantId,
      value: item.tenantId,
    }));
  }

  onMounted(() => {
    loadTenantLabels().catch(() => {});
  });

  return {
    tenantLabelMap: computed(() => tenantLabelMap.value),
    tenantOptions: computed(() => tenantOptions.value),
    loadTenantLabels,
  };
}
