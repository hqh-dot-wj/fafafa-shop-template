<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  NTag,
} from 'naive-ui';
import { COURSE_GROUP_FAILURE_STATUS_FILTER_OPTIONS, getCourseGroupTeamStatusMeta } from '@libs/common-constants';
import {
  type CourseGroupTeamDetail,
  type CourseGroupTeamMember,
  type CourseGroupTeamSummary,
  fetchCloseCourseGroupTeam,
  fetchCourseGroupTeamDetail,
  fetchCourseGroupTeamList,
  fetchCourseGroupTeamMembers,
  fetchResolveCourseGroupMemberFailure,
} from '@/service/api/marketing';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import { $t } from '@/locales';
import CourseGroupFailureMetricsPanel from './modules/course-group-failure-metrics-panel.vue';
import CourseGroupFailureSearch from './modules/course-group-failure-search.vue';
import { createCourseGroupFailureTableColumns } from './modules/course-group-failure-table-columns';
import CourseGroupFailureTableCard from './modules/course-group-failure-table-card.vue';

defineOptions({ name: 'MarketingCourseGroupFailurePage' });

// 拼课失败处理页对应 CourseGroupAdminController 的失败团查询、关闭和成员失败处理。
// 页面只定位异常团队和提交处理原因，退款、订单关闭、佣金冲正等动作由后端服务编排。
const appStore = useAppStore();
const route = useRoute();
const router = useRouter();

const routeTeamId = ref((route.query.teamId as string) || '');
const statusOptions = [...COURSE_GROUP_FAILURE_STATUS_FILTER_OPTIONS];

const searchModel = reactive({
  teamId: '',
  productName: '',
  leaderName: '',
  status: 'FAILED',
});

const detailDrawerVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<CourseGroupTeamDetail | null>(null);
const members = ref<CourseGroupTeamMember[]>([]);
const detailStatusMeta = computed(() => getCourseGroupTeamStatusMeta(detail.value?.teamStatus));

const resolveModalVisible = ref(false);
const resolveSubmitting = ref(false);
const resolveForm = reactive({
  memberRecordId: '',
  reason: '',
});
const selectedMember = ref<CourseGroupTeamMember | null>(null);

let refreshTable: () => Promise<void> = async () => {};
let getTeamRows: () => CourseGroupTeamSummary[] = () => [];

async function openDetail(row: CourseGroupTeamSummary) {
  detailDrawerVisible.value = true;
  detailLoading.value = true;
  try {
    const [detailRes, membersRes] = await Promise.all([
      fetchCourseGroupTeamDetail(row.teamId),
      fetchCourseGroupTeamMembers(row.teamId),
    ]);
    detail.value = detailRes.data;
    members.value = membersRes.data || detailRes.data?.members || [];
  } finally {
    detailLoading.value = false;
  }
}

async function closeTeam(teamId: string) {
  // 关闭失败团后重新拉取列表和抽屉详情，避免继续基于旧状态处理成员。
  await fetchCloseCourseGroupTeam(teamId);
  window.$message?.success('拼课团已关闭');
  await refreshTable();
  if (detail.value?.teamId === teamId) {
    const summary = getTeamRows().find((row) => row.teamId === teamId);
    if (summary) {
      await openDetail(summary);
    }
  }
}

function goTeamDetail(teamId: string) {
  router
    .push({
      name: 'marketing_course-group_team-detail',
      query: { teamId },
    })
    .catch(() => {});
}

const { data, loading, columns, mobilePagination, scrollX, searchParams, updateSearchParams, getData, getDataByPage } =
  useTable({
    apiFn: fetchCourseGroupTeamList,
    apiParams: {
      pageNum: 1,
      pageSize: 20,
      status: 'FAILED',
    },
    columns: () =>
      createCourseGroupFailureTableColumns({
        onOpenDetail: openDetail,
        onCloseTeam: closeTeam,
        onGoTeamDetail: goTeamDetail,
      }),
  });

refreshTable = getData;
getTeamRows = () => data.value;

// 前端团编号、商品和团长筛选只作用于当前页失败团；失败状态仍由后端查询参数控制。
const filteredData = computed(() => {
  const teamKeyword = searchModel.teamId.trim().toLowerCase();
  const productKeyword = searchModel.productName.trim().toLowerCase();
  const leaderKeyword = searchModel.leaderName.trim().toLowerCase();

  return data.value.filter((row) => {
    if (teamKeyword && !row.teamId.toLowerCase().includes(teamKeyword)) return false;
    if (productKeyword && !row.productName.toLowerCase().includes(productKeyword)) return false;
    if (leaderKeyword && !(row.leader?.name ?? '').toLowerCase().includes(leaderKeyword)) return false;
    return true;
  });
});

// 失败团指标只统计当前筛选结果，用于运营分流处理，不代表后端失败队列总量。
const metrics = computed(() => {
  const list = filteredData.value;
  return {
    total: list.length,
    failed: list.filter((row) => row.teamStatus === 'FAILED').length,
    closed: list.filter((row) => row.teamStatus === 'CLOSED').length,
    other: list.filter((row) => row.teamStatus !== 'FAILED' && row.teamStatus !== 'CLOSED').length,
  };
});

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN');
}

const memberColumns: NaiveUI.TableColumn<CourseGroupTeamMember>[] = [
  { key: 'name', title: '成员', minWidth: 120 },
  { key: 'memberId', title: '用户 ID', minWidth: 120 },
  {
    key: 'memberType',
    title: '成员类型',
    width: 100,
    render: (row) => (row.memberType === 'VIRTUAL' ? '虚拟' : '真实'),
  },
  { key: 'role', title: '角色', width: 90, render: (row) => (row.role === 'LEADER' ? '团长' : '团员') },
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
    width: 100,
    render: (row) => {
      if (row.memberType === 'VIRTUAL') return '虚拟补位';
      return row.payStatus === 'PAID' ? '已支付' : '待支付';
    },
  },
  { key: 'joinedAt', title: '加入时间', minWidth: 160, render: (row) => formatDateTime(row.joinedAt) },
  {
    key: 'operate',
    title: '处理',
    width: 120,
    render: (row) => {
      if (row.memberType === 'VIRTUAL') return '-';
      return h(
        NButton,
        { size: 'small', type: 'warning', ghost: true, onClick: () => openResolveModal(row) },
        { default: () => '失败处理' },
      );
    },
  },
];

function resolveMemberRecordId(member: CourseGroupTeamMember) {
  return member.memberRecordId || member.id || member.memberId || '';
}

// 搜索时把失败状态筛选同步给后端，并回到第一页；文本字段继续在当前页过滤。
async function handleSearch() {
  updateSearchParams({
    pageNum: 1,
    pageSize: searchParams.pageSize as number,
    status: searchModel.status || undefined,
  });
  await getDataByPage(1);
}

// 重置时恢复默认 FAILED 状态，避免误把已关闭或其他状态混入默认处理队列。
function resetSearch() {
  searchModel.teamId = '';
  searchModel.productName = '';
  searchModel.leaderName = '';
  searchModel.status = 'FAILED';
  updateSearchParams({
    pageNum: 1,
    pageSize: searchParams.pageSize as number,
    status: 'FAILED',
  });
  getDataByPage(1).catch(() => {});
}

// 打开成员处理弹窗时锁定后端成员记录 ID，提交时不依赖展示用 memberId。
function openResolveModal(member: CourseGroupTeamMember) {
  selectedMember.value = member;
  resolveForm.memberRecordId = resolveMemberRecordId(member);
  resolveForm.reason = '';
  resolveModalVisible.value = true;
}

async function submitResolve() {
  if (!detail.value?.teamId) return;
  if (!resolveForm.memberRecordId.trim()) {
    window.$message?.warning('未识别成员记录，请重新从成员列表发起失败处理');
    return;
  }
  resolveSubmitting.value = true;
  try {
    // 成员失败处理使用后端成员记录 ID，不能用展示 memberId 代替，避免虚拟/真实成员记录错配。
    await fetchResolveCourseGroupMemberFailure(detail.value.teamId, resolveForm.memberRecordId.trim(), {
      reason: resolveForm.reason || undefined,
    });
    window.$message?.success('失败处理提交成功');
    resolveModalVisible.value = false;
    const summary = data.value.find((row) => row.teamId === detail.value?.teamId);
    if (summary) {
      await openDetail(summary);
    }
    await getData();
  } finally {
    resolveSubmitting.value = false;
  }
}

// 从路由带入 teamId 时自动打开对应详情，供团队列表和分佣页跳转后直接处理。
function tryOpenRouteTeam() {
  if (!routeTeamId.value) return;
  const row = filteredData.value.find((item) => item.teamId === routeTeamId.value);
  if (row) {
    openDetail(row).catch(() => {});
  }
}

watch(
  () => route.query.teamId,
  (value) => {
    routeTeamId.value = (value as string) || '';
    tryOpenRouteTeam();
  },
);

onMounted(() => {
  getData()
    .then(() => {
      tryOpenRouteTeam();
    })
    .catch(() => {});
});
</script>

<template>
  <!-- 失败团页主体：编排失败团搜索、状态指标、异常列表、详情抽屉和成员处理弹窗。 -->
  <!-- 文案锚点（供 course-group-copy.spec 校验）：失败团列表、查看详情、关闭拼课、前往团详情 -->
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 搜索区：维护失败团筛选模型，默认聚焦 FAILED 状态的待处理团队。 -->
    <CourseGroupFailureSearch
      :model="searchModel"
      :status-options="statusOptions"
      @search="handleSearch"
      @reset="resetSearch"
    />

    <!-- 指标区：基于当前筛选结果汇总失败、已关闭和其他状态数量。 -->
    <CourseGroupFailureMetricsPanel
      :total="metrics.total"
      :failed="metrics.failed"
      :closed="metrics.closed"
      :other="metrics.other"
    />

    <!-- 表格区：展示筛选后的失败团队，并提供详情、关闭拼课和前往团详情入口。 -->
    <CourseGroupFailureTableCard
      :columns="columns"
      :data="filteredData"
      :loading="loading"
      :pagination="mobilePagination"
      :flex-height="!appStore.isMobile"
      :scroll-x="scrollX"
      @refresh="getData"
    />

    <!-- 详情抽屉：展示失败团基础信息、金额口径和成员异常处理入口。 -->
    <NDrawer v-model:show="detailDrawerVisible" :width="760">
      <NDrawerContent title="失败团处理详情" closable>
        <NCard :bordered="false" size="small" class="card-wrapper">
          <NDescriptions :column="2" size="small" label-placement="left">
            <NDescriptionsItem label="团编号">{{ detail?.teamId || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="状态">
              <NTag :type="detailStatusMeta.tagType">
                {{ detailStatusMeta.label }}
              </NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="商品">{{ detail?.productName || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="门店">{{ detail?.tenantName || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="团长">{{ detail?.leader?.name || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="人数">
              {{ detail?.effectiveMemberCount || detail?.currentMembers || 0 }} / {{ detail?.maxCount || 0 }}（真实
              {{ detail?.realMemberCount || 0 }} / 虚拟 {{ detail?.virtualMemberCount || 0 }}）
            </NDescriptionsItem>
            <NDescriptionsItem label="规则摘要">{{ detail?.ruleSummary || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="收益提示">
              {{ detail?.revenueDescription || detail?.revenueHint || '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="真实支付金额">
              ¥{{ Number(detail?.realPaidAmount || 0).toFixed(2) }}
            </NDescriptionsItem>
            <NDescriptionsItem label="可分佣基数">
              ¥{{ Number(detail?.commissionBaseAmount || 0).toFixed(2) }}
            </NDescriptionsItem>
          </NDescriptions>
        </NCard>

        <NCard title="成员异常处理" :bordered="false" size="small" class="mt-12px card-wrapper">
          <NDataTable :columns="memberColumns" :data="members" :loading="detailLoading" :scroll-x="760">
            <template #empty>
              <div class="py-24px text-14px text-gray-500">{{ $t('datatable.empty') }}</div>
            </template>
          </NDataTable>
        </NCard>
      </NDrawerContent>
    </NDrawer>

    <!-- 成员处理弹窗：提交真实成员失败处理原因，虚拟成员不进入处理流程。 -->
    <NModal v-model:show="resolveModalVisible" preset="card" title="成员失败处理" class="w-520px">
      <NForm :model="resolveForm" label-placement="left" :label-width="110">
        <NFormItem label="成员名称">
          <NInput :value="selectedMember?.name || '-'" readonly />
        </NFormItem>
        <NFormItem label="成员记录 ID">
          <NInput :value="resolveForm.memberRecordId" readonly placeholder="已自动带入，无需手工输入" />
        </NFormItem>
        <NFormItem label="处理原因">
          <NInput v-model:value="resolveForm.reason" type="textarea" :rows="3" placeholder="失败处理备注" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="resolveModalVisible = false">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" :loading="resolveSubmitting" @click="submitResolve">提交处理</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
