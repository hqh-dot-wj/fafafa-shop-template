<script setup lang="ts">
import { watch } from 'vue';
import { useEcharts } from '@/hooks/common/echarts';

interface Props {
  points?: Api.Finance.Dashboard['revenueTrend'];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  points: undefined,
  loading: false,
});

const { domRef, updateOptions } = useEcharts(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
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
    axisLabel: { rotate: 35, fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    axisLabel: { formatter: (v: number) => `¥${v}` },
  },
  series: [
    {
      name: '实收',
      type: 'line',
      smooth: true,
      data: [] as number[],
      areaStyle: { opacity: 0.12 },
      itemStyle: { color: '#18a058' },
    },
  ],
}));

watch(
  () => props.points,
  (val) => {
    if (!val?.length) return;
    updateOptions((opts) => {
      opts.xAxis.data = val.map((p) => p.date.slice(5));
      opts.series[0].data = val.map((p) => p.amount);
    });
  },
  { immediate: true },
);
</script>

<template>
  <NCard title="近 30 日实收趋势" :bordered="false" size="small" class="h-full card-wrapper">
    <NSpin :show="loading">
      <div ref="domRef" class="h-300px w-full"></div>
    </NSpin>
  </NCard>
</template>

<style scoped>
.card-wrapper {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
</style>
