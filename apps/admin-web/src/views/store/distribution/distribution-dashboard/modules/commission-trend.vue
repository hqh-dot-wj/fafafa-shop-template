<script setup lang="ts">
import { computed, watch } from 'vue';
import { useEcharts } from '@/hooks/common/echarts';
import { $t } from '@/locales';

interface Props {
  trendData?: Array<{ date: string; amount: number }>;
  loading?: boolean;
}

const props = defineProps<Props>();

const seriesName = computed(() => $t('page.store_distribution.commissionTrend.seriesName'));

const { domRef, updateOptions } = useEcharts(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'shadow',
    },
  },
  grid: {
    left: 48,
    right: 24,
    bottom: 28,
    top: 24,
  },
  xAxis: {
    type: 'category',
    data: [] as string[],
    axisTick: { alignWithLabel: true },
  },
  yAxis: {
    type: 'value',
  },
  series: [
    {
      name: seriesName.value,
      type: 'line',
      smooth: true,
      data: [] as number[],
      areaStyle: {
        opacity: 0.1,
      },
      itemStyle: {
        color: '#7367F0',
      },
    },
  ],
}));

watch(
  [() => props.trendData, seriesName],
  () => {
    const val = props.trendData;
    if (val) {
      updateOptions((opts) => {
        opts.series[0].name = seriesName.value;
        opts.xAxis.data = val.map((item) => item.date);
        opts.series[0].data = val.map((item) => item.amount);
        return opts;
      });
    }
  },
  { immediate: true },
);
</script>

<template>
  <NCard
    :title="$t('page.store_distribution.commissionTrend.title')"
    :bordered="false"
    size="small"
    class="h-full card-wrapper"
    :loading="loading"
  >
    <div ref="domRef" class="h-320px w-full"></div>
  </NCard>
</template>

<style scoped>
.card-wrapper {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
</style>
