<script setup lang="ts">
import { NCard, NGi, NGrid, NStatistic } from 'naive-ui';

defineOptions({ name: 'ActivityMetricsPanel' });

defineProps<{
  loading?: boolean;
  total: number;
  draft?: number;
  published: number;
  paused: number;
  archived: number;
}>();
</script>

<template>
  <!-- 活动指标区：展示当前筛选条件下活动状态数量。 -->
  <NCard title="活动数据概览" :bordered="false" size="small" class="card-wrapper" :loading="loading">
    <NGrid cols="1 s:2 l:5" responsive="screen" :x-gap="12" :y-gap="12" class="activity-metrics-grid">
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-primary/10 py-10px pl-12px pr-12px">
          <div class="w-4px flex-shrink-0 self-stretch rd-2px bg-primary" />
          <NStatistic label="全部活动" tabular-nums class="activity-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-primary font-semibold tabular-nums">{{ total }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-error/10 py-10px pl-12px pr-12px">
          <div class="w-4px flex-shrink-0 self-stretch rd-2px bg-error" />
          <NStatistic label="草稿" tabular-nums class="activity-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-error font-semibold tabular-nums">{{ draft ?? 0 }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-success/10 py-10px pl-12px pr-12px">
          <div class="w-4px flex-shrink-0 self-stretch rd-2px bg-success" />
          <NStatistic label="已发布" tabular-nums class="activity-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-success font-semibold tabular-nums">{{ published }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-warning/10 py-10px pl-12px pr-12px">
          <div class="w-4px flex-shrink-0 self-stretch rd-2px bg-warning" />
          <NStatistic label="已暂停" tabular-nums class="activity-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-warning font-semibold tabular-nums">{{ paused }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-gray-100 py-10px pl-12px pr-12px">
          <div class="w-4px flex-shrink-0 self-stretch rd-2px bg-gray-400" />
          <NStatistic label="已归档" tabular-nums class="activity-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-gray-700 font-semibold tabular-nums">{{ archived }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
    </NGrid>
  </NCard>
</template>

<style scoped>
.activity-metrics-grid :deep(.n-gi) {
  min-width: 0;
}

.activity-metric-stat :deep(.n-statistic__label) {
  font-size: 13px;
}
</style>
