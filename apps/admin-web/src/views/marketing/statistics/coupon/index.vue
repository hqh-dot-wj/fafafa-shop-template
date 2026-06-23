<script setup lang="tsx">
import { onMounted, ref } from 'vue';
import { NButton, NCard, NEmpty, NGi, NGrid, NSpin, NStatistic } from 'naive-ui';
import { fetchGetCouponStatistics } from '@/service/api/marketing/coupon';
import { useEcharts } from '@/hooks/common/echarts';

defineOptions({
  name: 'CouponStatistics',
});

// 优惠券统计页对应 CouponManagementController 的统计接口，只读展示发放、核销、过期和优惠金额。
// 这些数值用于运营观测，不参与库存、核销率或财务金额的前端计算落账。
const loading = ref(false);
const stats = ref<Api.Marketing.CouponStatistics | null>(null);

const { domRef, updateOptions } = useEcharts(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'cross' },
  },
  legend: {
    data: ['发放', '核销'],
    top: '0',
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: '15%',
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: [] as string[],
  },
  yAxis: { type: 'value' },
  series: [
    {
      color: '#8e9dff',
      name: '发放',
      type: 'line',
      smooth: true,
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0.25, color: '#8e9dff' },
            { offset: 1, color: 'rgba(142,157,255,0.1)' },
          ],
        },
      },
      data: [] as number[],
    },
    {
      color: '#26deca',
      name: '核销',
      type: 'line',
      smooth: true,
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0.25, color: '#26deca' },
            { offset: 1, color: 'rgba(38,222,202,0.1)' },
          ],
        },
      },
      data: [] as number[],
    },
  ],
}));

async function loadData() {
  loading.value = true;
  try {
    // 趋势图完全以后端返回 trend 为准，避免前端从模板/用户券列表自行聚合造成口径不一致。
    const { data } = await fetchGetCouponStatistics();
    stats.value = data;
    if (data?.trend?.length) {
      updateOptions((opts) => {
        opts.xAxis.data = data.trend.map((t) => t.date.slice(5));
        opts.series[0].data = data.trend.map((t) => t.distributed);
        opts.series[1].data = data.trend.map((t) => t.used);
        return opts;
      });
    }
  } catch {
  } finally {
    loading.value = false;
  }
}

function formatRate(val: number | undefined): string {
  if (val === null || val === undefined) return '0.00';
  return (val * 100).toFixed(2);
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="h-full flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NSpin :show="loading">
      <!-- 指标卡片区：展示优惠券发放、核销、过期、核销率和优惠金额。 -->
      <NGrid :cols="5" :x-gap="16" :y-gap="16">
        <NGi>
          <NCard title="累计发放" size="small" :bordered="false" class="card-wrapper">
            <NStatistic :value="stats?.totalDistributed ?? 0" />
          </NCard>
        </NGi>
        <NGi>
          <NCard title="已核销" size="small" :bordered="false" class="card-wrapper">
            <NStatistic :value="stats?.totalUsed ?? 0" />
          </NCard>
        </NGi>
        <NGi>
          <NCard title="已过期" size="small" :bordered="false" class="card-wrapper">
            <NStatistic :value="stats?.totalExpired ?? 0" />
          </NCard>
        </NGi>
        <NGi>
          <NCard title="整体核销率" size="small" :bordered="false" class="card-wrapper">
            <NStatistic :value="formatRate(stats?.useRate)" suffix="%" />
          </NCard>
        </NGi>
        <NGi>
          <NCard title="优惠金额" size="small" :bordered="false" class="card-wrapper">
            <NStatistic :value="stats?.totalDiscountAmount ?? 0" prefix="¥" />
          </NCard>
        </NGi>
      </NGrid>

      <!-- 趋势图区：展示近 7 日发放和使用趋势，数据口径以后端统计接口为准。 -->
      <NCard title="近7日发放/使用趋势" :bordered="false" size="small" class="mt-16px card-wrapper">
        <template #header-extra>
          <NButton size="small" quaternary @click="loadData">刷新</NButton>
        </template>
        <div ref="domRef" class="h-360px overflow-hidden" />
        <NEmpty v-if="!stats?.trend?.length && !loading" description="暂无趋势数据" class="h-360px flex-center" />
      </NCard>
    </NSpin>
  </div>
</template>

<style scoped>
.card-wrapper {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
</style>
