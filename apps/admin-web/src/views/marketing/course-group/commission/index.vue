<script setup lang="ts">
import { computed, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { COURSE_GROUP_TEAM_STATUS_OPTIONS } from '@libs/common-constants';
import { fetchCourseGroupTeamList } from '@/service/api/marketing';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import { sumMoney } from '@/utils/money';
import CourseGroupCommissionMetricsPanel from './modules/course-group-commission-metrics-panel.vue';
import CourseGroupCommissionSearch from './modules/course-group-commission-search.vue';
import { createCourseGroupCommissionTableColumns } from './modules/course-group-commission-table-columns';
import CourseGroupCommissionTableCard from './modules/course-group-commission-table-card.vue';

defineOptions({ name: 'MarketingCourseGroupCommissionPage' });

// 拼课分佣页复用团列表接口，只展示后端已聚合的真实支付金额、可分佣基数和佣金记录。
// 前端使用 sumMoney 做页面合计，不参与分佣计算或结算落账。
const router = useRouter();
const appStore = useAppStore();

const statusOptions = [...COURSE_GROUP_TEAM_STATUS_OPTIONS];

const searchModel = reactive({
  keyword: '',
  tenantName: '',
  status: null as string | null,
});

const { data, loading, columns, mobilePagination, scrollX, searchParams, updateSearchParams, getData, getDataByPage } =
  useTable({
    apiFn: fetchCourseGroupTeamList,
    apiParams: {
      pageNum: 1,
      pageSize: 20,
      status: undefined,
    },
    columns: () =>
      createCourseGroupCommissionTableColumns({
        onGoTeamDetail: (teamId) => {
          router
            .push({
              name: 'marketing_course-group_team-detail',
              query: { teamId },
            })
            .catch(() => {});
        },
        onGoFailure: (teamId) => {
          router
            .push({
              name: 'marketing_course-group_failure',
              query: { teamId },
            })
            .catch(() => {});
        },
      }),
  });

// 前端关键字和门店筛选只作用于当前页数据；后端分页与状态筛选仍由 useTable 参数驱动。
const filteredData = computed(() => {
  const keyword = searchModel.keyword.trim().toLowerCase();
  const tenantName = searchModel.tenantName.trim().toLowerCase();
  return data.value.filter((row) => {
    if (keyword) {
      const target = `${row.teamId} ${row.productName} ${row.activityContextKey}`.toLowerCase();
      if (!target.includes(keyword)) return false;
    }
    if (tenantName && !row.tenantName.toLowerCase().includes(tenantName)) return false;
    return true;
  });
});

const metrics = computed(() => {
  // 金额合计必须走 money 工具，避免 Number 浮点误差污染运营看板。
  const list = filteredData.value;
  const realPaidMembers = list.reduce((sum, row) => sum + Number(row.realPaidMemberCount || row.paidMembers || 0), 0);
  const realPaidAmount = sumMoney(list.map((row) => row.realPaidAmount));
  const commissionBaseAmount = sumMoney(list.map((row) => row.commissionBaseAmount));
  const commissionAmount = sumMoney(list.map((row) => row.commissionAmount));
  return {
    teamCount: list.length,
    realPaidMembers,
    realPaidAmount: realPaidAmount.format(),
    commissionBaseAmount: commissionBaseAmount.format(),
    commissionAmount: commissionAmount.format(),
  };
});

// 搜索时把状态条件同步给后端并回到第一页，关键词和门店继续在当前页结果内过滤。
async function handleSearch() {
  updateSearchParams({
    pageNum: 1,
    pageSize: searchParams.pageSize as number,
    status: searchModel.status || undefined,
  });
  await getDataByPage(1);
}

// 重置时同时清空本地筛选模型和后端状态条件，再重新拉取第一页列表。
function resetSearch() {
  searchModel.keyword = '';
  searchModel.tenantName = '';
  searchModel.status = null;
  updateSearchParams({
    pageNum: 1,
    pageSize: searchParams.pageSize as number,
    status: undefined,
  });
  getDataByPage(1).catch(() => {});
}
</script>

<template>
  <!-- 拼课分佣页主体：编排搜索、指标汇总和分佣明细表格。 -->
  <!-- 文案锚点（供 course-group-copy.spec 校验）：拼课分佣列表、团编号、门店、重置、搜索、查看详情、失败处理 -->
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 搜索区：维护本页筛选模型，提交时触发后端状态查询和本地关键字过滤。 -->
    <CourseGroupCommissionSearch
      :model="searchModel"
      :status-options="statusOptions"
      @search="handleSearch"
      @reset="resetSearch"
    />

    <!-- 指标区：基于当前筛选结果汇总真实支付人数、支付金额、可分佣基数和佣金记录。 -->
    <CourseGroupCommissionMetricsPanel
      :team-count="metrics.teamCount"
      :real-paid-members="metrics.realPaidMembers"
      :real-paid-amount="metrics.realPaidAmount"
      :commission-base-amount="metrics.commissionBaseAmount"
      :commission-amount="metrics.commissionAmount"
    />

    <!-- 表格区：展示筛选后的团队分佣明细，刷新时重新请求团列表接口。 -->
    <CourseGroupCommissionTableCard
      :columns="columns"
      :data="filteredData"
      :loading="loading"
      :pagination="mobilePagination"
      :flex-height="!appStore.isMobile"
      :scroll-x="scrollX"
      @refresh="getData"
    />
  </div>
</template>
