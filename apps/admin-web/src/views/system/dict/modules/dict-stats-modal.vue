<script setup lang="ts">
import { ref, watch } from 'vue';
import { fetchGetDictStats } from '@/service/api/system';

defineOptions({
  name: 'DictStatsModal',
});

const visible = defineModel<boolean>('visible', { default: false });

const loading = ref(false);
const stats = ref<Api.System.DictStatsSummary | null>(null);

const columns: NaiveUI.DataTableColumns<Api.System.DictStats> = [
  { key: 'dictType', title: '字典类型', minWidth: 180 },
  { key: 'dictName', title: '字典名称', minWidth: 120 },
  { key: 'dataCount', title: '数据条数', width: 100, align: 'center' },
  { key: 'cacheStatus', title: '缓存状态', width: 100, align: 'center' },
];

async function loadStats() {
  loading.value = true;
  try {
    const { data } = await fetchGetDictStats();
    stats.value = data;
  } catch {
    // 错误消息已在请求工具中显示
  } finally {
    loading.value = false;
  }
}

watch(
  () => visible.value,
  (show) => {
    if (show) {
      loadStats();
    }
  },
);
</script>

<template>
  <NModal v-model:show="visible" preset="card" title="字典统计" class="w-980px">
    <NSpin :show="loading">
      <NGrid :cols="3" :x-gap="12" class="mb-12px">
        <NGridItem>
          <NStatistic label="字典类型总数" :value="stats?.totalTypeCount ?? 0" />
        </NGridItem>
        <NGridItem>
          <NStatistic label="字典数据总数" :value="stats?.totalDataCount ?? 0" />
        </NGridItem>
        <NGridItem>
          <NStatistic label="已缓存字典数" :value="stats?.cachedTypeCount ?? 0" />
        </NGridItem>
      </NGrid>
      <NDataTable
        :columns="columns"
        :data="stats?.details ?? []"
        size="small"
        :max-height="420"
        :bordered="false"
      />
    </NSpin>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="visible = false">关闭</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped></style>
