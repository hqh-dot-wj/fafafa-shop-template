<script setup lang="ts">
import { NCard, NGi, NGrid, NStatistic } from 'naive-ui';

defineOptions({ name: 'SceneDefinitionMetricsPanel' });

defineProps<{
  total: number;
  active: number;
  draft: number;
  inactive: number;
}>();
</script>

<template>
  <!-- 场景定义指标区：展示当前筛选场景定义的启用、草稿和停用数量。 -->
  <NCard title="场景定义概览" :bordered="false" size="small" class="card-wrapper">
    <NGrid cols="1 s:2 l:4" responsive="screen" :x-gap="12" :y-gap="12" class="scene-definition-metrics-grid">
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-primary/10 py-10px pl-12px pr-12px">
          <div class="w-4px flex-shrink-0 self-stretch rd-2px bg-primary" />
          <NStatistic label="全部" tabular-nums class="scene-definition-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-primary font-semibold tabular-nums">{{ total }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-success/10 py-10px pl-12px pr-12px">
          <div class="w-4px flex-shrink-0 self-stretch rd-2px bg-success" />
          <NStatistic label="启用" tabular-nums class="scene-definition-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-success font-semibold tabular-nums">{{ active }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-warning/10 py-10px pl-12px pr-12px">
          <div class="w-4px flex-shrink-0 self-stretch rd-2px bg-warning" />
          <NStatistic label="草稿" tabular-nums class="scene-definition-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-warning font-semibold tabular-nums">{{ draft }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-gray-100 py-10px pl-12px pr-12px">
          <div class="w-4px flex-shrink-0 self-stretch rd-2px bg-gray-400" />
          <NStatistic label="停用" tabular-nums class="scene-definition-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-gray-700 font-semibold tabular-nums">{{ inactive }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
    </NGrid>
  </NCard>
</template>

<style scoped>
.scene-definition-metrics-grid :deep(.n-gi) {
  min-width: 0;
}

.scene-definition-metric-stat :deep(.n-statistic__label) {
  font-size: 13px;
}
</style>
