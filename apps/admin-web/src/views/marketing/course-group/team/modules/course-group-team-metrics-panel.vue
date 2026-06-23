<script setup lang="ts">
import { NCard, NGi, NGrid, NStatistic } from 'naive-ui';

defineOptions({ name: 'CourseGroupTeamMetricsPanel' });

defineProps<{
  total: number;
  recruiting: number;
  inProgress: number;
  closed: number;
}>();
</script>

<template>
  <!-- 拼课团指标区：展示团队总数、招募中、进行中和关闭类状态。 -->
  <NCard title="拼课团数据概览" :bordered="false" size="small" class="card-wrapper">
    <NGrid cols="1 s:2 l:4" responsive="screen" :x-gap="12" :y-gap="12" class="course-group-team-metrics-grid">
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-primary/10 py-10px pl-12px pr-12px">
          <div class="w-4px flex-shrink-0 self-stretch rd-2px bg-primary" />
          <NStatistic label="全部团队" tabular-nums class="course-group-team-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-primary font-semibold tabular-nums">{{ total }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-warning/10 py-10px pl-12px pr-12px">
          <div class="w-4px flex-shrink-0 self-stretch rd-2px bg-warning" />
          <NStatistic label="招募中" tabular-nums class="course-group-team-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-warning font-semibold tabular-nums">{{ recruiting }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-success/10 py-10px pl-12px pr-12px">
          <div class="w-4px flex-shrink-0 self-stretch rd-2px bg-success" />
          <NStatistic label="已成班/开课" tabular-nums class="course-group-team-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-success font-semibold tabular-nums">{{ inProgress }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-gray-100 py-10px pl-12px pr-12px">
          <div class="w-4px flex-shrink-0 self-stretch rd-2px bg-gray-400" />
          <NStatistic label="已结束/失败/关闭" tabular-nums class="course-group-team-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-gray-700 font-semibold tabular-nums">{{ closed }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
    </NGrid>
  </NCard>
</template>

<style scoped>
.course-group-team-metrics-grid :deep(.n-gi) {
  min-width: 0;
}

.course-group-team-metric-stat :deep(.n-statistic__label) {
  font-size: 13px;
}
</style>
