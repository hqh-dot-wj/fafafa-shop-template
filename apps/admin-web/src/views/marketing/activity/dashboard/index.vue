<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NCard, NDatePicker, NForm, NFormItem, NSelect, NSpace } from 'naive-ui';
import type { SelectOption } from 'naive-ui';
import { type ActivityDashboardData, type ActivityStatus, fetchActivityDashboard } from '@/service/api/marketing';
import ActivityMetricsPanel from '../modules/activity-metrics-panel.vue';
import { ACTIVITY_TYPE_LABEL } from '../modules/activity-table-columns';
import ActivityDashboardPanel from './modules/activity-dashboard-panel.vue';

defineOptions({ name: 'MarketingActivityDashboardPage' });

// 活动驾驶舱对应 ActivityController 的统计视图，只读汇总时间窗内活动状态和趋势。
// 看板数值用于运营复盘，不作为发布、归档或预算判断的前端事实源。
const router = useRouter();

const searchModel = reactive({
  timeRange: [Date.now() - 29 * 24 * 60 * 60 * 1000, Date.now()] as [number, number] | null,
  type: null as string | null,
  status: null as ActivityStatus | null,
});

const loading = ref(false);
const dashboardData = ref<ActivityDashboardData | null>(null);

const summary = computed(() => {
  return (
    dashboardData.value?.summary ?? {
      total: 0,
      draft: 0,
      published: 0,
      paused: 0,
      archived: 0,
    }
  );
});

const activityTypeOptions: SelectOption[] = [
  'NEWCOMER_EXCLUSIVE',
  'FIRST_ORDER',
  'FULL_REDUCTION',
  'MEMBER_DAY',
  'GROUP_BUY',
  'FLASH_SALE',
  'COURSE_GROUP',
  'COURSE_GROUP_BUY',
  'MEMBER_UPGRADE',
  'PROMOTION_PRICE',
  'BIRTHDAY',
].map((value) => ({ value, label: ACTIVITY_TYPE_LABEL[value] ?? value }));

const statusOptions: SelectOption[] = [
  { label: '草稿', value: 'DRAFT' },
  { label: '已发布', value: 'PUBLISHED' },
  { label: '已暂停', value: 'PAUSED' },
  { label: '已归档', value: 'ARCHIVED' },
];

async function loadDashboard() {
  loading.value = true;
  try {
    // 时间范围转换为 ISO 后交给后端按统一时区口径聚合，前端不做二次聚合。
    const response = await fetchActivityDashboard({
      rangeStart: searchModel.timeRange ? new Date(searchModel.timeRange[0]).toISOString() : undefined,
      rangeEnd: searchModel.timeRange ? new Date(searchModel.timeRange[1]).toISOString() : undefined,
      type: searchModel.type ?? undefined,
      status: searchModel.status ?? undefined,
    });
    dashboardData.value = response.data ?? null;
  } finally {
    loading.value = false;
  }
}

function resetSearch() {
  searchModel.timeRange = [Date.now() - 29 * 24 * 60 * 60 * 1000, Date.now()];
  searchModel.type = null;
  searchModel.status = null;
  loadDashboard();
}

function goList() {
  router.push({ name: 'marketing_activity_list' });
}

function goCalendar() {
  router.push({ name: 'marketing_activity_calendar' });
}

onMounted(() => {
  loadDashboard();
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 页面导航区：说明驾驶舱视角并提供活动中心视图切换。 -->
    <NCard :bordered="false" size="small" class="card-wrapper">
      <div class="flex items-start justify-between gap-12px lt-sm:flex-col">
        <div class="flex-col gap-6px">
          <h2 class="text-18px font-semibold">活动驾驶舱</h2>
          <p class="text-13px text-gray-500">按时间窗汇总活动总量与状态趋势，适合运营复盘和节奏把控。</p>
        </div>
        <NSpace>
          <NButton ghost @click="goList">列表</NButton>
          <NButton ghost @click="goCalendar">日历</NButton>
          <NButton type="primary">驾驶舱</NButton>
        </NSpace>
      </div>
    </NCard>

    <!-- 筛选区：按时间窗、类型和状态读取统计数据。 -->
    <NCard :bordered="false" size="small" class="card-wrapper">
      <NForm inline label-placement="left" class="flex flex-wrap gap-y-12px">
        <NFormItem label="统计时间">
          <NDatePicker v-model:value="searchModel.timeRange" type="datetimerange" clearable class="w-320px" />
        </NFormItem>
        <NFormItem label="活动类型">
          <NSelect v-model:value="searchModel.type" clearable :options="activityTypeOptions" class="w-180px" />
        </NFormItem>
        <NFormItem label="活动状态">
          <NSelect v-model:value="searchModel.status" clearable :options="statusOptions" class="w-160px" />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton @click="resetSearch">{{ $t('common.reset') }}</NButton>
            <NButton type="primary" @click="loadDashboard">{{ $t('common.search') }}</NButton>
          </NSpace>
        </NFormItem>
      </NForm>
    </NCard>

    <!-- 指标摘要区：展示后端聚合后的活动状态数量。 -->
    <ActivityMetricsPanel
      :loading="loading"
      :total="summary.total"
      :draft="summary.draft"
      :published="summary.published"
      :paused="summary.paused"
      :archived="summary.archived"
    />

    <!-- 趋势表格区：展示统计周期内的每日活动状态变化。 -->
    <ActivityDashboardPanel :loading="loading" :trend="dashboardData?.trend ?? []" />
  </div>
</template>
