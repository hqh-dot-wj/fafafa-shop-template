<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NCard, NDatePicker, NForm, NFormItem, NInput, NSelect, NSpace } from 'naive-ui';
import type { SelectOption } from 'naive-ui';
import { type ActivityCalendarData, type ActivityStatus, fetchActivityCalendar } from '@/service/api/marketing';
import { ACTIVITY_TYPE_LABEL } from '../modules/activity-table-columns';
import ActivityCalendarPanel from './modules/activity-calendar-panel.vue';

defineOptions({ name: 'MarketingActivityCalendarPage' });

// 活动日历对应 ActivityController 的排期视图，只读展示活动时间窗和冲突。
// 冲突提示不自动阻断发布，发布前仍需活动详情或后端预检确认。
const router = useRouter();

const searchModel = reactive({
  month: Date.now() as number | null,
  keyword: '',
  type: null as string | null,
  status: null as ActivityStatus | null,
});

const loading = ref(false);
const calendarData = ref<ActivityCalendarData | null>(null);

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

function formatMonthValue(value: number | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

async function loadCalendar() {
  loading.value = true;
  try {
    // 月份参数统一格式化为 YYYY-MM，避免 DatePicker 时间戳受本地时区影响查询跨月。
    const response = await fetchActivityCalendar({
      month: formatMonthValue(searchModel.month),
      keyword: searchModel.keyword.trim() || undefined,
      type: searchModel.type ?? undefined,
      status: searchModel.status ?? undefined,
    });
    calendarData.value = response.data ?? null;
  } finally {
    loading.value = false;
  }
}

function resetSearch() {
  searchModel.month = Date.now();
  searchModel.keyword = '';
  searchModel.type = null;
  searchModel.status = null;
  loadCalendar();
}

function goList() {
  router.push({ name: 'marketing_activity_list' });
}

function goDashboard() {
  router.push({ name: 'marketing_activity_dashboard' });
}

function viewDetail(activityId: string) {
  router.push({
    name: 'marketing_activity_detail',
    query: { activityId },
  });
}

onMounted(() => {
  loadCalendar();
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-y-auto">
    <!-- 页面导航区：说明日历视角并提供列表、日历、驾驶舱切换入口。 -->
    <NCard :bordered="false" size="small" class="card-wrapper">
      <div class="flex items-start justify-between gap-12px lt-sm:flex-col">
        <div class="flex-col gap-6px">
          <h2 class="text-18px font-semibold">活动日历</h2>
          <p class="text-13px text-gray-500">按月查看活动排期，快速识别同日重叠和需要协调的活动。</p>
        </div>
        <NSpace>
          <NButton ghost @click="goList">列表</NButton>
          <NButton type="primary">日历</NButton>
          <NButton ghost @click="goDashboard">驾驶舱</NButton>
        </NSpace>
      </div>
    </NCard>

    <!-- 筛选区：按月份、活动类型和状态读取排期，不改变活动状态。 -->
    <NCard :bordered="false" size="small" class="card-wrapper">
      <NForm inline label-placement="left" class="flex flex-wrap gap-y-12px">
        <NFormItem label="月份">
          <NDatePicker v-model:value="searchModel.month" type="month" clearable class="w-180px" />
        </NFormItem>
        <NFormItem label="关键词">
          <NInput
            v-model:value="searchModel.keyword"
            clearable
            placeholder="活动名称 / 租户 / 活动ID"
            class="w-220px"
          />
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
            <NButton type="primary" @click="loadCalendar">{{ $t('common.search') }}</NButton>
          </NSpace>
        </NFormItem>
      </NForm>
    </NCard>

    <!-- 日历排期区：展示后端返回的活动日期和冲突摘要。 -->
    <ActivityCalendarPanel
      :loading="loading"
      :month="calendarData?.month ?? formatMonthValue(searchModel.month) ?? ''"
      :days="calendarData?.days ?? []"
      :conflicts="calendarData?.conflicts ?? []"
      @view-detail="viewDetail"
    />
  </div>
</template>
