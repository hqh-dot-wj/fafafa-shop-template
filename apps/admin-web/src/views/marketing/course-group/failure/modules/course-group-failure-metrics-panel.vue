<script setup lang="ts">
import { NCard, NGi, NGrid, NStatistic } from 'naive-ui';

defineOptions({ name: 'CourseGroupFailureMetricsPanel' });

defineProps<{
  total: number;
  failed: number;
  closed: number;
  other: number;
}>();
</script>

<template>
  <!-- 失败团指标区：展示当前失败团列表的状态数量概览。 -->
  <NCard title="失败团数据概览" :bordered="false" size="small" class="card-wrapper">
    <NGrid cols="1 s:2 l:4" responsive="screen" :x-gap="12" :y-gap="12" class="course-group-failure-metrics-grid">
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-primary/10 py-10px pl-12px pr-12px">
          <div class="h-auto w-4px flex-shrink-0 self-stretch rd-2px bg-primary" />
          <NStatistic label="当前列表" tabular-nums class="course-group-failure-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-primary font-semibold tabular-nums">{{ total }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-error/10 py-10px pl-12px pr-12px">
          <div class="h-auto w-4px flex-shrink-0 self-stretch rd-2px bg-error" />
          <NStatistic label="失败" tabular-nums class="course-group-failure-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-error font-semibold tabular-nums">{{ failed }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-gray-100 py-10px pl-12px pr-12px">
          <div class="h-auto w-4px flex-shrink-0 self-stretch rd-2px bg-gray-400" />
          <NStatistic label="已关闭" tabular-nums class="course-group-failure-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-gray-700 font-semibold tabular-nums">{{ closed }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-warning/10 py-10px pl-12px pr-12px">
          <div class="h-auto w-4px flex-shrink-0 self-stretch rd-2px bg-warning" />
          <NStatistic label="其他状态" tabular-nums class="course-group-failure-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-warning font-semibold tabular-nums">{{ other }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
    </NGrid>
  </NCard>
</template>

<style scoped>
.course-group-failure-metrics-grid :deep(.n-gi) {
  min-width: 0;
}

.course-group-failure-metric-stat :deep(.n-statistic__label) {
  font-size: 13px;
}
</style>
