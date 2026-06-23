<script setup lang="ts">
import { NCard, NGi, NGrid, NStatistic } from 'naive-ui';

defineOptions({ name: 'CourseGroupCommissionMetricsPanel' });

defineProps<{
  teamCount: number;
  realPaidMembers: number;
  realPaidAmount: string;
  commissionBaseAmount: string;
  commissionAmount: string;
}>();
</script>

<template>
  <!-- 分佣指标区：展示当前列表团数、支付人数、支付金额、分佣基数和佣金记录。 -->
  <NCard title="分佣数据概览" :bordered="false" size="small" class="card-wrapper">
    <NGrid cols="1 s:2 l:5" responsive="screen" :x-gap="12" :y-gap="12" class="course-group-commission-metrics-grid">
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-primary/10 py-10px pl-12px pr-12px">
          <div class="h-auto w-4px flex-shrink-0 self-stretch rd-2px bg-primary" />
          <NStatistic label="当前列表团数" tabular-nums class="course-group-commission-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-primary font-semibold tabular-nums">{{ teamCount }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-success/10 py-10px pl-12px pr-12px">
          <div class="h-auto w-4px flex-shrink-0 self-stretch rd-2px bg-success" />
          <NStatistic label="真实已付人数" tabular-nums class="course-group-commission-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-success font-semibold tabular-nums">{{ realPaidMembers }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-info/10 py-10px pl-12px pr-12px">
          <div class="h-auto w-4px flex-shrink-0 self-stretch rd-2px bg-info" />
          <NStatistic label="真实支付金额(¥)" tabular-nums class="course-group-commission-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-info font-semibold tabular-nums">{{ realPaidAmount }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-warning/10 py-10px pl-12px pr-12px">
          <div class="h-auto w-4px flex-shrink-0 self-stretch rd-2px bg-warning" />
          <NStatistic label="可分佣基数(¥)" tabular-nums class="course-group-commission-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-warning font-semibold tabular-nums">
                {{ commissionBaseAmount }}
              </span>
            </template>
          </NStatistic>
        </div>
      </NGi>
      <NGi>
        <div class="min-w-0 flex items-stretch gap-10px rd-8px bg-error/10 py-10px pl-12px pr-12px">
          <div class="h-auto w-4px flex-shrink-0 self-stretch rd-2px bg-error" />
          <NStatistic label="真实佣金记录(¥)" tabular-nums class="course-group-commission-metric-stat min-w-0 flex-1">
            <template #default>
              <span class="text-22px text-error font-semibold tabular-nums">{{ commissionAmount }}</span>
            </template>
          </NStatistic>
        </div>
      </NGi>
    </NGrid>
  </NCard>
</template>

<style scoped>
.course-group-commission-metrics-grid :deep(.n-gi) {
  min-width: 0;
}

.course-group-commission-metric-stat :deep(.n-statistic__label) {
  font-size: 13px;
}
</style>
