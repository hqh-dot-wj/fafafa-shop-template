<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NDataTable } from 'naive-ui';
import type { ActivityDashboardTrend } from '@/service/api/marketing';

defineOptions({ name: 'ActivityDashboardPanel' });

defineProps<{
  loading: boolean;
  trend: ActivityDashboardTrend[];
}>();

const columns = computed<NaiveUI.TableColumn<ActivityDashboardTrend>[]>(() => [
  {
    key: 'date',
    title: '日期',
    align: 'center',
    width: 140,
  },
  {
    key: 'total',
    title: '活动总数',
    align: 'center',
    width: 100,
  },
  {
    key: 'draft',
    title: '草稿',
    align: 'center',
    width: 90,
  },
  {
    key: 'published',
    title: '已发布',
    align: 'center',
    width: 90,
  },
  {
    key: 'paused',
    title: '已暂停',
    align: 'center',
    width: 90,
  },
  {
    key: 'archived',
    title: '已归档',
    align: 'center',
    width: 90,
  },
]);
</script>

<template>
  <!-- 活动趋势区：按日期展示后端聚合的状态分布，不在前端重新计算指标。 -->
  <NCard title="活动趋势" :bordered="false" size="small" class="card-wrapper" :loading="loading">
    <NDataTable :columns="columns" :data="trend" :pagination="false" :scroll-x="600" :row-key="(row) => row.date">
      <template #empty>
        <div class="py-24px text-center text-13px text-gray-500">当前筛选条件下暂无趋势数据</div>
      </template>
    </NDataTable>
  </NCard>
</template>
