<script setup lang="tsx">
import { onMounted, ref } from 'vue';
import {
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NEmpty,
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NSpin,
  NStatistic,
} from 'naive-ui';
import {
  fetchGetPointsBalanceStatistics,
  fetchGetPointsEarnStatistics,
  fetchGetPointsRanking,
  fetchGetPointsUseStatistics,
} from '@/service/api/marketing/points';

defineOptions({
  name: 'PointsStatistics',
});

const loading = ref(false);
const balanceStats = ref<Api.Marketing.PointsBalanceStatistics | null>(null);
const earnStats = ref<Api.Marketing.PointsEarnStatistics | null>(null);
const useStats = ref<Api.Marketing.PointsUseStatistics | null>(null);
const ranking = ref<Api.Marketing.PointsRankingItem[]>([]);
const dateRange = ref<[number, number] | null>(null);

async function loadData() {
  loading.value = true;
  try {
    const [startTime, endTime] = dateRange.value || [];
    const params =
      startTime && endTime
        ? { startTime: new Date(startTime).toISOString(), endTime: new Date(endTime).toISOString() }
        : {};
    const [balanceRes, earnRes, useRes, rankRes] = await Promise.all([
      fetchGetPointsBalanceStatistics(),
      fetchGetPointsEarnStatistics(params),
      fetchGetPointsUseStatistics(params),
      fetchGetPointsRanking({ limit: 10 }),
    ]);
    balanceStats.value = balanceRes.data ?? null;
    earnStats.value = earnRes.data ?? null;
    useStats.value = useRes.data ?? null;
    ranking.value = rankRes.data?.ranking ?? [];
  } catch {
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});

const rankingColumns: NaiveUI.TableColumn<Api.Marketing.PointsRankingItem>[] = [
  { key: 'rank', title: '排名', width: 80, render: (_: any, index: number) => index + 1 },
  { key: 'nickname', title: '昵称', ellipsis: { tooltip: true } },
  { key: 'availablePoints', title: '可用积分', width: 120 },
];
</script>

<template>
  <div class="h-full flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NSpin :show="loading">
      <!-- 查询区：按时间范围读取积分发放和使用统计。 -->
      <NForm inline class="mb-16px" label-placement="left" :label-width="80">
        <NFormItem label="时间范围">
          <NDatePicker v-model:value="dateRange" type="datetimerange" clearable />
        </NFormItem>
        <NButton type="primary" @click="loadData">查询</NButton>
      </NForm>

      <!-- 指标卡片区：展示积分余额、账户、发放和使用聚合。 -->
      <NGrid :cols="4" :x-gap="16" :y-gap="16" class="stats-grid">
        <NGi>
          <NCard title="可用积分合计" size="small" :bordered="false" class="stats-card card-wrapper">
            <NStatistic :value="balanceStats?.availablePoints ?? 0" />
            <div class="stats-card-footer" aria-hidden="true" />
          </NCard>
        </NGi>
        <NGi>
          <NCard title="账户数" size="small" :bordered="false" class="stats-card card-wrapper">
            <NStatistic :value="balanceStats?.totalAccounts ?? 0" />
            <div class="stats-card-footer" aria-hidden="true" />
          </NCard>
        </NGi>
        <NGi>
          <NCard title="发放统计" size="small" :bordered="false" class="stats-card card-wrapper">
            <NStatistic :value="earnStats?.total?.totalPoints ?? 0" />
            <div class="stats-card-footer text-12px text-gray-500">笔数 {{ earnStats?.total?.totalCount ?? 0 }}</div>
          </NCard>
        </NGi>
        <NGi>
          <NCard title="使用统计" size="small" :bordered="false" class="stats-card card-wrapper">
            <NStatistic :value="useStats?.total?.totalPoints ?? 0" />
            <div class="stats-card-footer text-12px text-gray-500">笔数 {{ useStats?.total?.totalCount ?? 0 }}</div>
          </NCard>
        </NGi>
      </NGrid>

      <!-- 排行榜区：展示可用积分前十名，只读呈现账户余额。 -->
      <NCard title="积分排行榜" :bordered="false" size="small" class="mt-16px card-wrapper">
        <NDataTable :columns="rankingColumns" :data="ranking" :row-key="(row: any) => row.memberId" max-height="320" />
        <NEmpty v-if="ranking.length === 0 && !loading" description="暂无排行数据" class="py-8" />
      </NCard>
    </NSpin>
  </div>
</template>

<style scoped>
.stats-grid :deep(.n-gi) {
  display: flex;
  min-height: 0;
}

.stats-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100%;
}

.stats-card :deep(.n-card__content) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.stats-card-footer {
  margin-top: 8px;
  min-height: 1.25rem;
  line-height: 1.25rem;
}

.card-wrapper {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
</style>
