<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { TreeSelectOption } from 'naive-ui';
import { fetchGetCategoryTree } from '@/service/api/pms/category';

defineOptions({
  name: 'ServiceCategorySelect',
});

const model = defineModel<number[]>('value', { required: true });

const options = ref<TreeSelectOption[]>([]);
const loading = ref(false);

onMounted(loadOptions);

async function loadOptions() {
  loading.value = true;
  try {
    const { data } = await fetchGetCategoryTree();
    options.value = (data ?? []).map(mapCategoryNode);
  } finally {
    loading.value = false;
  }
}

function mapCategoryNode(item: Api.Pms.Category): TreeSelectOption {
  const children = Array.isArray(item.children) ? item.children.map(mapCategoryNode) : undefined;
  return {
    label: item.name,
    key: item.catId,
    children,
  };
}
</script>

<template>
  <NTreeSelect
    v-model:value="model"
    :options="options"
    :loading="loading"
    multiple
    cascade
    checkable
    clearable
    filterable
    placeholder="请选择服务类目"
  />
</template>
