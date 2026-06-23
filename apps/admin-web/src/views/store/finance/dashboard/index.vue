<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchGetFinanceDashboard } from '@/service/api/store/finance';
import CardData from './modules/card-data.vue';
import RecentWithdrawals from './modules/recent-withdrawals.vue';
import RevenueTrend from './modules/revenue-trend.vue';

defineOptions({
  name: 'FinanceDashboard',
});

const dashboardData = ref<Api.Finance.Dashboard | null>(null);
const loading = ref(false);

function extractRequestErrorMessage(error: unknown): string {
  if (
    error !== null &&
    typeof error === 'object' &&
    'response' in error &&
    error.response !== null &&
    typeof error.response === 'object' &&
    'data' in error.response
  ) {
    const payload = (error.response as { data?: unknown }).data;
    if (payload !== null && typeof payload === 'object' && 'msg' in payload) {
      const msg = (payload as { msg: unknown }).msg;
      if (typeof msg === 'string') return msg;
    }
  }
  if (error instanceof Error) return error.message;
  return '加载统计数据失败';
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await fetchGetFinanceDashboard();
    dashboardData.value = data ?? null;
  } catch (error: unknown) {
    window.$message?.error(extractRequestErrorMessage(error));
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData().catch(() => undefined);
});
</script>

<template>
  <div class="flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <CardData :data="dashboardData" :loading="loading" @refresh="loadData" />
    <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <RevenueTrend :points="dashboardData?.revenueTrend" :loading="loading" />
      </NGi>
      <NGi>
        <RecentWithdrawals :list="dashboardData?.recentWithdrawals" :loading="loading" />
      </NGi>
    </NGrid>
  </div>
</template>

<style scoped></style>
