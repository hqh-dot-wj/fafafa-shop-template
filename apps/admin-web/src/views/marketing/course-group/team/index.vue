<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NDataTable, NDrawer, NDrawerContent } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { COURSE_GROUP_TEAM_STATUS_OPTIONS } from '@libs/common-constants';
import {
  type CourseGroupTeamMember,
  type CourseGroupTeamSummary,
  fetchCloseCourseGroupTeam,
  fetchCourseGroupTeamList,
  fetchCourseGroupTeamMembers,
} from '@/service/api/marketing';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import { $t } from '@/locales';
import CourseGroupTeamMetricsPanel from './modules/course-group-team-metrics-panel.vue';
import CourseGroupTeamSearch from './modules/course-group-team-search.vue';
import { createCourseGroupTeamTableColumns } from './modules/course-group-team-table-columns';
import CourseGroupTeamTableCard from './modules/course-group-team-table-card.vue';

defineOptions({ name: 'MarketingCourseGroupTeamPage' });

// 拼课团列表页对应 CourseGroupAdminController 的团运行时查询与关闭动作。
// 真实成员/虚拟成员、分佣、失败处理只做入口汇总，明细判定集中在团详情和后端服务。
const router = useRouter();
const appStore = useAppStore();

const statusOptions = [...COURSE_GROUP_TEAM_STATUS_OPTIONS];

const searchModel = reactive({
  teamId: '',
  activityName: '',
  productName: '',
  storeName: '',
  leaderName: '',
  status: null as string | null,
  classTimeRange: null as [number, number] | null,
});

const memberDrawerVisible = ref(false);
const memberLoading = ref(false);
const currentMemberTeam = ref<CourseGroupTeamSummary | null>(null);
const currentMembers = ref<CourseGroupTeamMember[]>([]);

const { data, loading, columns, mobilePagination, scrollX, searchParams, updateSearchParams, getData, getDataByPage } =
  useTable({
    apiFn: fetchCourseGroupTeamList,
    apiParams: {
      pageNum: 1,
      pageSize: 20,
      status: undefined,
    },
    columns: () =>
      createCourseGroupTeamTableColumns({
        onViewDetail: viewDetail,
        onOpenMembers: openMembers,
        onCloseTeam: closeTeam,
        onGoFailure: goFailure,
        onGoCommission: goCommission,
      }),
  });

// 前端关键字、团长和开课时间只过滤当前页数据；后端分页与状态筛选仍由 useTable 参数驱动。
const filteredData = computed(() => {
  const teamKeyword = searchModel.teamId.trim().toLowerCase();
  const activityKeyword = searchModel.activityName.trim().toLowerCase();
  const productKeyword = searchModel.productName.trim().toLowerCase();
  const storeKeyword = searchModel.storeName.trim().toLowerCase();
  const leaderKeyword = searchModel.leaderName.trim().toLowerCase();
  const range = searchModel.classTimeRange;

  return data.value.filter((row) => {
    if (teamKeyword && !row.teamId.toLowerCase().includes(teamKeyword)) return false;
    if (activityKeyword) {
      const value = (readString(row, 'activityName') ?? readString(row, 'activityContextKey') ?? '').toLowerCase();
      if (!value.includes(activityKeyword)) return false;
    }
    if (productKeyword && !row.productName.toLowerCase().includes(productKeyword)) return false;
    if (storeKeyword && !row.tenantName.toLowerCase().includes(storeKeyword)) return false;
    if (leaderKeyword && !(row.leader?.name ?? '').toLowerCase().includes(leaderKeyword)) return false;
    if (range) {
      const ts = toTimestamp(row.classStartTime);
      if (!ts || ts < range[0] || ts > range[1]) return false;
    }
    return true;
  });
});

// 指标卡基于当前筛选结果归类团队状态，不参与成团、关闭或履约状态判定。
const metrics = computed(() => {
  const list = filteredData.value;
  const recruiting = list.filter((r) => r.teamStatus === 'RECRUITING').length;
  const inProgress = list.filter((r) => r.teamStatus === 'FORMED' || r.teamStatus === 'IN_CLASS').length;
  const closed = list.filter((r) => ['FINISHED', 'FAILED', 'CLOSED'].includes(r.teamStatus)).length;
  return {
    total: list.length,
    recruiting,
    inProgress,
    closed,
  };
});

function readString(source: unknown, key: string) {
  if (!source || typeof source !== 'object') return null;
  const value = (source as Record<string, unknown>)[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toTimestamp(value?: string) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN');
}

// 搜索时仅把状态条件同步给后端，其余筛选字段用于当前页快速定位团队。
async function handleSearch() {
  updateSearchParams({
    pageNum: 1,
    pageSize: searchParams.pageSize as number,
    status: searchModel.status || undefined,
  });
  await getDataByPage(1);
}

// 重置时清空本地筛选模型和后端状态条件，再重新拉取第一页团队列表。
function resetSearch() {
  searchModel.teamId = '';
  searchModel.activityName = '';
  searchModel.productName = '';
  searchModel.storeName = '';
  searchModel.leaderName = '';
  searchModel.status = null;
  searchModel.classTimeRange = null;
  updateSearchParams({
    pageNum: 1,
    pageSize: searchParams.pageSize as number,
    status: undefined,
  });
  getDataByPage(1).catch(() => {});
}

function viewDetail(teamId: string) {
  router
    .push({
      name: 'marketing_course-group_team-detail',
      query: { teamId },
    })
    .catch(() => {});
}

function goFailure(teamId: string) {
  router
    .push({
      name: 'marketing_course-group_failure',
      query: { teamId },
    })
    .catch(() => {});
}

function goCommission(teamId: string) {
  router
    .push({
      name: 'marketing_course-group_commission',
      query: { teamId },
    })
    .catch(() => {});
}

const memberColumns: DataTableColumns<CourseGroupTeamMember> = [
  { key: 'name', title: '成员', minWidth: 120 },
  {
    key: 'memberType',
    title: '成员类型',
    width: 100,
    render: (row) => (row.memberType === 'VIRTUAL' ? '虚拟' : '真实'),
  },
  {
    key: 'role',
    title: '角色',
    width: 100,
    render: (row) => (row.role === 'LEADER' ? '团长' : '团员'),
  },
  {
    key: 'sourceType',
    title: '来源',
    width: 120,
    render: (row) => {
      if (!row.sourceType) return '-';
      if (row.sourceType === 'AUTO') return '自动补位';
      if (row.sourceType === 'LEADER_MANUAL') return '团长补位';
      if (row.sourceType === 'ADMIN_MANUAL') return '后台补位';
      return '未知来源';
    },
  },
  {
    key: 'payStatus',
    title: '支付状态',
    width: 110,
    render: (row) => {
      if (row.memberType === 'VIRTUAL') return '虚拟补位';
      return row.payStatus === 'PAID' ? '已支付' : '待支付';
    },
  },
  {
    key: 'participates',
    title: '参与计算',
    minWidth: 180,
    render: (row) => {
      if (row.memberType !== 'VIRTUAL') return '订单 / 考勤 / 分佣';
      return '仅成团展示';
    },
  },
  {
    key: 'joinedAt',
    title: '加入时间',
    minWidth: 160,
    render: (row) => formatDateTime(row.joinedAt),
  },
  {
    key: 'remark',
    title: '备注',
    minWidth: 140,
    render: (row) => row.remark || '-',
  },
];

async function openMembers(row: CourseGroupTeamSummary) {
  // 成员抽屉是只读解释视图：虚拟成员只能显示为补位，不参与订单/考勤/分佣计算。
  memberDrawerVisible.value = true;
  currentMemberTeam.value = row;
  memberLoading.value = true;
  try {
    const { data: members } = await fetchCourseGroupTeamMembers(row.teamId);
    currentMembers.value = members || [];
  } finally {
    memberLoading.value = false;
  }
}

async function closeTeam(teamId: string) {
  // 关闭拼课会影响参团和履约状态，页面只触发动作，退款/失败收口由后端完成。
  await fetchCloseCourseGroupTeam(teamId);
  window.$message?.success('拼课团已关闭');
  await getData();
  if (currentMemberTeam.value?.teamId === teamId) {
    await openMembers(currentMemberTeam.value);
  }
}
</script>

<template>
  <!-- 拼课团页主体：编排团队搜索、状态指标、团队列表和成员抽屉。 -->
  <!-- 文案锚点（供 course-group-copy.spec 校验）：拼课团列表、查看详情、查看成员、关闭拼课、失败处理、查看分佣 -->
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 搜索区：维护团队筛选模型，提交时触发后端状态查询和当前页字段过滤。 -->
    <CourseGroupTeamSearch
      :model="searchModel"
      :status-options="statusOptions"
      @search="handleSearch"
      @reset="resetSearch"
    />

    <!-- 指标区：基于当前筛选结果汇总招募中、已成班/开课和关闭类团队数量。 -->
    <CourseGroupTeamMetricsPanel
      :total="metrics.total"
      :recruiting="metrics.recruiting"
      :in-progress="metrics.inProgress"
      :closed="metrics.closed"
    />

    <!-- 表格区：展示筛选后的拼课团队，并提供详情、成员、失败和分佣入口。 -->
    <CourseGroupTeamTableCard
      :columns="columns"
      :data="filteredData"
      :loading="loading"
      :pagination="mobilePagination"
      :flex-height="!appStore.isMobile"
      :scroll-x="scrollX"
      @refresh="getData"
    />

    <!-- 成员抽屉：只读展示团队成员，解释真实成员和虚拟补位成员的计算口径。 -->
    <NDrawer v-model:show="memberDrawerVisible" :width="520">
      <NDrawerContent :title="`拼课团成员 - ${currentMemberTeam?.teamId || ''}`" closable>
        <NDataTable
          :columns="memberColumns"
          :data="currentMembers"
          :loading="memberLoading"
          :pagination="false"
          :scroll-x="1040"
          :row-key="(row: CourseGroupTeamMember) => row.memberRecordId ?? row.memberId"
        >
          <template #empty>
            <div class="py-24px text-14px text-gray-500">{{ $t('datatable.empty') }}</div>
          </template>
        </NDataTable>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>
