<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpace,
  NTag,
} from 'naive-ui';
import { getCourseGroupTeamStatusMeta } from '@libs/common-constants';
import {
  type CourseGroupTeamAttendanceRow,
  type CourseGroupTeamCourseSummary,
  type CourseGroupTeamDetail,
  type CourseGroupTeamMember,
  type CourseGroupTeamScheduleRow,
  type CourseGroupTeamSummary,
  type CourseGroupVirtualFillAudit,
  fetchAddCourseGroupVirtualFill,
  fetchCloseCourseGroupTeam,
  fetchCourseGroupTeamAttendances,
  fetchCourseGroupTeamCourseSummary,
  fetchCourseGroupTeamDetail,
  fetchCourseGroupTeamList,
  fetchCourseGroupTeamMembers,
  fetchCourseGroupTeamSchedules,
  fetchFinishCourseGroupTeamClass,
  fetchMarkCourseGroupTeamAttendance,
  fetchRemoveCourseGroupVirtualFill,
  fetchResolveCourseGroupMemberFailure,
  fetchStartCourseGroupTeamClass,
} from '@/service/api/marketing';

defineOptions({ name: 'MarketingCourseGroupTeamDetailPage' });

// 拼课团详情页是后台运行时处置入口，对应 CourseGroupAdminController 的详情、成员、课程履约和状态动作。
// 人工补位、失败处理、考勤、开课/结课/关闭都会触达订单、履约、分佣边界，前端只提交操作意图。
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const courseRuntimeLoading = ref(false);
const teamId = ref((route.query.teamId as string) || '');
const detail = ref<CourseGroupTeamDetail | null>(null);
const members = ref<CourseGroupTeamMember[]>([]);
const courseSummary = ref<CourseGroupTeamCourseSummary | null>(null);
const schedules = ref<CourseGroupTeamScheduleRow[]>([]);
const attendances = ref<CourseGroupTeamAttendanceRow[]>([]);
const teamPickerVisible = ref(false);
const teamPickerLoading = ref(false);
const teamPickerStatus = ref('');
const teamPickerRows = ref<CourseGroupTeamSummary[]>([]);
const selectedTeamId = ref('');

const teamPickerStatusOptions: NaiveUI.SelectOption[] = [
  { label: '全部状态', value: '' },
  { label: '招募中', value: 'RECRUITING' },
  { label: '已成团', value: 'FORMED' },
  { label: '进行中', value: 'IN_CLASS' },
  { label: '已结课', value: 'FINISHED' },
  { label: '失败', value: 'FAILED' },
  { label: '已关闭', value: 'CLOSED' },
];

const failureModalVisible = ref(false);
const failureSubmitting = ref(false);
const selectedMember = ref<CourseGroupTeamMember | null>(null);
const failureForm = reactive({
  memberRecordId: '',
  reason: '',
});

const virtualFillModalVisible = ref(false);
const virtualFillSubmitting = ref(false);
const virtualFillForm = reactive({
  count: 1,
  reason: '',
});
const removingVirtualMemberId = ref('');
const attendanceModalVisible = ref(false);
const attendanceSubmitting = ref(false);
const attendanceForm = reactive({
  memberId: '',
  date: '',
  remark: '',
});

const statusMeta = computed(() => getCourseGroupTeamStatusMeta(detail.value?.teamStatus));

const formationMetrics = computed(() => ({
  // 成团口径区分真实人数与虚拟补位；只有 effectiveMemberCount 用于展示成团进度。
  effectiveMemberCount: detail.value?.effectiveMemberCount ?? detail.value?.currentMembers ?? 0,
  realMemberCount: detail.value?.realMemberCount ?? 0,
  virtualMemberCount: detail.value?.virtualMemberCount ?? 0,
  realPaidMemberCount: detail.value?.realPaidMemberCount ?? detail.value?.paidMembers ?? 0,
  remainingSlots: detail.value?.remainingSlots ?? 0,
  formedByVirtual: detail.value?.formedByVirtual ?? false,
}));

const financeMetrics = computed(() => ({
  // 财务指标只展示后端聚合值，前端不以成员数或价格反推佣金。
  realPaidAmount: detail.value?.realPaidAmount ?? 0,
  commissionBaseAmount: detail.value?.commissionBaseAmount ?? 0,
  commissionAmount: detail.value?.commissionAmount ?? 0,
  financeEvidenceReady: detail.value?.financeEvidenceReady ?? false,
}));

const canAdminManualFill = computed(() => {
  const current = detail.value;
  if (!current) return false;
  return current.enableVirtualFill && current.allowAdminManualFill && current.teamStatus === 'RECRUITING';
});

const virtualFillAudits = computed(() => detail.value?.virtualFillAudits ?? []);

const courseSummaryMetrics = computed(() => ({
  extensionReady: Boolean(courseSummary.value?.extensionReady),
  totalLessons: readCourseSummaryNumber('totalLessons'),
  completedLessons: readCourseSummaryNumber('completedLessons'),
  pendingLessons: readCourseSummaryNumber('pendingLessons'),
  scheduleCount: readCourseSummaryNumber('scheduleCount'),
  completedScheduleCount: readCourseSummaryNumber('completedScheduleCount'),
  cancelledScheduleCount: readCourseSummaryNumber('cancelledScheduleCount'),
  teacherBoundScheduleCount: readCourseSummaryNumber('teacherBoundScheduleCount'),
  classroomBoundScheduleCount: readCourseSummaryNumber('classroomBoundScheduleCount'),
  capacityBoundScheduleCount: readCourseSummaryNumber('capacityBoundScheduleCount'),
  attendanceMarkedMemberCount: readCourseSummaryNumber('attendanceMarkedMemberCount'),
}));

const attendanceMemberOptions = computed<NaiveUI.SelectOption[]>(() =>
  members.value
    .filter((member) => member.memberType !== 'VIRTUAL' && member.participatesInAttendance !== false)
    .map((member) => ({
      label: member.mobile ? `${member.name} (${member.mobile})` : member.name,
      value: member.memberId,
    })),
);

const scheduleDateOptions = computed<NaiveUI.SelectOption[]>(() =>
  schedules.value
    .filter((schedule) => schedule.status !== 'CANCELLED')
    .map((schedule) => ({
      label: `${formatDate(schedule.date)} ${schedule.startTime}-${schedule.endTime}`,
      value: schedule.date,
    })),
);

const teamPickerColumns: NaiveUI.TableColumn<CourseGroupTeamSummary>[] = [
  {
    key: 'teamId',
    title: '拼课团 ID',
    minWidth: 170,
    render: (row) => h('span', { class: 'font-mono text-xs' }, row.teamId),
  },
  {
    key: 'productName',
    title: '商品名称',
    minWidth: 220,
    render: (row) => row.productName || '-',
  },
  {
    key: 'tenantName',
    title: '门店',
    minWidth: 170,
    render: (row) => (row.tenantName ? `${row.tenantName} (${row.tenantId})` : row.tenantId),
  },
  {
    key: 'teamStatus',
    title: '状态',
    width: 110,
    render: (row) => {
      const meta = getCourseGroupTeamStatusMeta(row.teamStatus);
      return h(NTag, { type: meta.tagType, size: 'small' }, { default: () => meta.label });
    },
  },
  {
    key: 'effectiveMemberCount',
    title: '有效人数',
    width: 90,
    align: 'center',
    render: (row) => row.effectiveMemberCount ?? row.currentMembers,
  },
  {
    key: 'virtualMemberCount',
    title: '虚拟人数',
    width: 90,
    align: 'center',
    render: (row) => row.virtualMemberCount ?? 0,
  },
];

const memberColumns: NaiveUI.TableColumn<CourseGroupTeamMember>[] = [
  {
    key: 'name',
    title: '成员名称',
    minWidth: 120,
  },
  {
    key: 'memberType',
    title: '成员类型',
    width: 100,
    render: (row) => (row.memberType === 'VIRTUAL' ? '虚拟' : '真实'),
  },
  {
    key: 'role',
    title: '角色',
    width: 90,
    render: (row) => (row.role === 'LEADER' ? '团长' : '团员'),
  },
  {
    key: 'sourceType',
    title: '来源',
    width: 120,
    render: (row) => formatFillSource(row.sourceType),
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
    minWidth: 170,
    render: (row) => formatDateTime(row.joinedAt),
  },
  {
    key: 'paidAt',
    title: '支付时间',
    minWidth: 170,
    render: (row) => formatDateTime(row.paidAt),
  },
  {
    key: 'remark',
    title: '备注',
    minWidth: 120,
    render: (row) => row.remark || '-',
  },
  {
    key: 'operate',
    title: '操作',
    width: 180,
    render: (row) => {
      if (row.memberType === 'VIRTUAL' && row.virtualMemberId) {
        return h(
          NButton,
          {
            size: 'small',
            type: 'warning',
            ghost: true,
            loading: removingVirtualMemberId.value === row.virtualMemberId,
            disabled: detail.value?.teamStatus !== 'RECRUITING',
            onClick: () => removeVirtualFill(row.virtualMemberId!),
          },
          { default: () => '撤销补位' },
        );
      }
      return h(
        NButton,
        { size: 'small', type: 'warning', ghost: true, onClick: () => openFailureModal(row) },
        { default: () => '失败处理' },
      );
    },
  },
];

const auditColumns: NaiveUI.TableColumn<CourseGroupVirtualFillAudit>[] = [
  {
    key: 'createdAt',
    title: '操作时间',
    minWidth: 170,
    render: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'opType',
    title: '动作',
    width: 100,
    render: (row) => (row.opType === 'ADD' ? '新增补位' : '撤销补位'),
  },
  {
    key: 'displayName',
    title: '成员',
    minWidth: 140,
    render: (row) => row.displayName || row.virtualMemberId,
  },
  {
    key: 'sourceType',
    title: '来源',
    width: 120,
    render: (row) => formatFillSource(row.sourceType),
  },
  {
    key: 'createdById',
    title: '操作人',
    minWidth: 130,
  },
  {
    key: 'reason',
    title: '原因',
    minWidth: 180,
    render: (row) => row.reason || '-',
  },
];

const scheduleColumns: NaiveUI.TableColumn<CourseGroupTeamScheduleRow>[] = [
  {
    key: 'date',
    title: '上课日期',
    minWidth: 140,
    render: (row) => formatDate(row.date),
  },
  {
    key: 'time',
    title: '上课时间',
    minWidth: 150,
    render: (row) => `${row.startTime} - ${row.endTime}`,
  },
  {
    key: 'lessons',
    title: '课时数',
    width: 90,
    align: 'center',
  },
  {
    key: 'teacher',
    title: '老师',
    minWidth: 140,
    render: (row) => row.teacherName || row.teacherId || '-',
  },
  {
    key: 'classroom',
    title: '教室',
    minWidth: 140,
    render: (row) => row.classroomName || row.classroomId || '-',
  },
  {
    key: 'location',
    title: '履约地点',
    minWidth: 160,
    render: (row) => row.location || detail.value?.classAddress || '-',
  },
  {
    key: 'capacity',
    title: '容量',
    width: 120,
    align: 'center',
    render: (row) => `${row.serviceCapacity ?? '-'} / ${row.capacity ?? '-'}`,
  },
  {
    key: 'status',
    title: '排课状态',
    width: 120,
    render: (row) => {
      const meta = getScheduleStatusMeta(row.status);
      return h(NTag, { type: meta.type, size: 'small' }, { default: () => meta.label });
    },
  },
  {
    key: 'remark',
    title: '备注',
    minWidth: 160,
    render: (row) => row.remark || '-',
  },
];

const attendanceColumns: NaiveUI.TableColumn<CourseGroupTeamAttendanceRow>[] = [
  {
    key: 'memberName',
    title: '学员',
    minWidth: 140,
    render: (row) => (row.memberMobile ? `${row.memberName} (${row.memberMobile})` : row.memberName),
  },
  {
    key: 'date',
    title: '考勤日期',
    minWidth: 140,
    render: (row) => formatDate(row.date),
  },
  {
    key: 'attended',
    title: '到课状态',
    width: 120,
    render: (row) =>
      h(
        NTag,
        { type: row.attended ? 'success' : 'warning', size: 'small' },
        { default: () => (row.attended ? '已到课' : '未到课') },
      ),
  },
  {
    key: 'remark',
    title: '备注',
    minWidth: 160,
    render: (row) => row.remark || '-',
  },
];

async function loadDetail() {
  if (!teamId.value) return;
  loading.value = true;
  try {
    // 详情和成员并行加载，随后再加载课程履约，避免履约接口失败阻断团基础信息。
    const [detailRes, memberRes] = await Promise.all([
      fetchCourseGroupTeamDetail(teamId.value),
      fetchCourseGroupTeamMembers(teamId.value),
    ]);
    detail.value = detailRes.data;
    members.value = memberRes.data || detailRes.data?.members || [];
    await loadCourseRuntime();
  } finally {
    loading.value = false;
  }
}

async function loadCourseRuntime() {
  if (!teamId.value) return;
  courseRuntimeLoading.value = true;
  try {
    const [summaryRes, scheduleRes, attendanceRes] = await Promise.all([
      fetchCourseGroupTeamCourseSummary(teamId.value),
      fetchCourseGroupTeamSchedules(teamId.value),
      fetchCourseGroupTeamAttendances(teamId.value),
    ]);
    courseSummary.value = summaryRes.data;
    schedules.value = scheduleRes.data || [];
    attendances.value = attendanceRes.data || [];
  } finally {
    courseRuntimeLoading.value = false;
  }
}

async function loadTeamPickerData() {
  teamPickerLoading.value = true;
  try {
    const res = await fetchCourseGroupTeamList({
      pageNum: 1,
      pageSize: 50,
      status: teamPickerStatus.value || undefined,
    });
    teamPickerRows.value = res.data?.rows || [];
    if (teamId.value) {
      selectedTeamId.value = teamId.value;
    }
  } finally {
    teamPickerLoading.value = false;
  }
}

function openTeamPicker() {
  teamPickerVisible.value = true;
  loadTeamPickerData();
}

function handleTeamPickerReset() {
  teamPickerStatus.value = '';
  loadTeamPickerData();
}

function handleSelectTeam(row: CourseGroupTeamSummary) {
  selectedTeamId.value = row.teamId;
}

async function confirmSelectTeam() {
  if (!selectedTeamId.value) {
    window.$message?.warning('请先选择拼课团');
    return;
  }
  teamId.value = selectedTeamId.value;
  teamPickerVisible.value = false;
  await router.replace({
    query: {
      ...route.query,
      teamId: selectedTeamId.value,
    },
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN');
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('zh-CN');
}

function formatAmount(value: number | undefined) {
  return `¥${Number(value ?? 0).toFixed(2)}`;
}

function formatFillSource(sourceType?: string) {
  if (!sourceType) return '-';
  if (sourceType === 'AUTO') return '自动补位';
  if (sourceType === 'LEADER_MANUAL') return '团长补位';
  if (sourceType === 'ADMIN_MANUAL') return '后台补位';
  return '未知来源';
}

function readCourseSummaryNumber(key: keyof CourseGroupTeamCourseSummary) {
  const value = courseSummary.value?.[key];
  return typeof value === 'number' ? value : 0;
}

function getScheduleStatusMeta(status?: string) {
  if (status === 'SCHEDULED') return { label: '已排课', type: 'info' as const };
  if (status === 'COMPLETED') return { label: '已完成', type: 'success' as const };
  if (status === 'CANCELLED') return { label: '已取消', type: 'warning' as const };
  return { label: '未知状态', type: 'default' as const };
}

function getCourseExtensionStatusText(status?: string) {
  if (status === 'ACTIVE') return '进行中';
  if (status === 'COMPLETED') return '已完成';
  if (status === 'CANCELLED') return '已取消';
  return courseSummary.value?.extensionReady ? '未知状态' : '未生成';
}

function openFailureModal(member: CourseGroupTeamMember) {
  selectedMember.value = member;
  failureForm.memberRecordId = resolveMemberRecordId(member);
  failureForm.reason = '';
  failureModalVisible.value = true;
}

function resolveMemberRecordId(member: CourseGroupTeamMember) {
  return member.memberRecordId || member.id || member.memberId || '';
}

async function submitFailureResolution() {
  if (!teamId.value) return;
  if (!failureForm.memberRecordId.trim()) {
    window.$message?.warning('未识别成员记录，请重新从成员列表发起失败处理');
    return;
  }
  failureSubmitting.value = true;
  try {
    await fetchResolveCourseGroupMemberFailure(teamId.value, failureForm.memberRecordId.trim(), {
      reason: failureForm.reason || undefined,
    });
    window.$message?.success('成员失败处理已提交');
    failureModalVisible.value = false;
    await loadDetail();
  } finally {
    failureSubmitting.value = false;
  }
}

function openVirtualFillModal() {
  virtualFillForm.count = 1;
  virtualFillForm.reason = '';
  virtualFillModalVisible.value = true;
}

async function submitVirtualFill() {
  if (!teamId.value) return;
  virtualFillSubmitting.value = true;
  try {
    // 人工补位只允许提交数量和原因，虚拟成员身份、审计、成团影响由后端生成。
    await fetchAddCourseGroupVirtualFill(teamId.value, {
      count: Number(virtualFillForm.count || 1),
      reason: virtualFillForm.reason || undefined,
    });
    window.$message?.success('虚拟补位已提交');
    virtualFillModalVisible.value = false;
    await loadDetail();
  } finally {
    virtualFillSubmitting.value = false;
  }
}

async function removeVirtualFill(virtualMemberId: string) {
  if (!teamId.value) return;
  removingVirtualMemberId.value = virtualMemberId;
  try {
    await fetchRemoveCourseGroupVirtualFill(teamId.value, virtualMemberId);
    window.$message?.success('已撤销虚拟补位');
    await loadDetail();
  } finally {
    removingVirtualMemberId.value = '';
  }
}

function openAttendanceModal() {
  if (attendanceMemberOptions.value.length === 0) {
    window.$message?.warning('暂无可标记到课的真实成员');
    return;
  }
  if (scheduleDateOptions.value.length === 0) {
    window.$message?.warning('暂无可标记到课的排课');
    return;
  }
  attendanceForm.memberId = String(attendanceMemberOptions.value[0]?.value || '');
  attendanceForm.date = String(scheduleDateOptions.value[0]?.value || '');
  attendanceForm.remark = '';
  attendanceModalVisible.value = true;
}

async function submitAttendance() {
  if (!teamId.value) return;
  if (!attendanceForm.memberId || !attendanceForm.date) {
    window.$message?.warning('请选择学员和考勤日期');
    return;
  }
  attendanceSubmitting.value = true;
  try {
    // 到课标记只允许真实成员，候选项已过滤虚拟成员，后端仍需再次校验。
    await fetchMarkCourseGroupTeamAttendance(teamId.value, {
      memberId: attendanceForm.memberId,
      date: attendanceForm.date,
      remark: attendanceForm.remark || undefined,
    });
    window.$message?.success('已标记到课');
    attendanceModalVisible.value = false;
    await loadCourseRuntime();
  } finally {
    attendanceSubmitting.value = false;
  }
}

async function startClass() {
  if (!teamId.value) return;
  await fetchStartCourseGroupTeamClass(teamId.value);
  window.$message?.success('已执行开始上课');
  await loadDetail();
}

async function finishClass() {
  if (!teamId.value) return;
  await fetchFinishCourseGroupTeamClass(teamId.value);
  window.$message?.success('已执行结课');
  await loadDetail();
}

async function closeTeam() {
  if (!teamId.value) return;
  await fetchCloseCourseGroupTeam(teamId.value);
  window.$message?.success('已关闭拼课团');
  await loadDetail();
}

function goFailurePage() {
  router.push({
    name: 'marketing_course-group_failure',
    query: {
      teamId: teamId.value,
    },
  });
}

watch(
  () => route.query.teamId,
  (value) => {
    teamId.value = (value as string) || '';
    if (teamId.value) {
      loadDetail();
    }
  },
);

onMounted(() => {
  if (teamId.value) {
    loadDetail();
  }
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px">
    <NCard :bordered="false" size="small">
      <NSpace justify="space-between" align="center">
        <div class="flex items-center gap-10px">
          <div class="text-18px font-semibold">拼课团详情</div>
          <NTag :type="statusMeta.tagType">{{ statusMeta.label }}</NTag>
          <NTag v-if="detail?.formedByVirtual" type="warning">虚拟促成成团</NTag>
          <NTag v-if="detail && !detail.financeEvidenceReady" type="error">财务证据待补齐</NTag>
        </div>
        <NSpace>
          <NInput :value="teamId" placeholder="请选择拼课团" readonly class="w-260px" />
          <NButton type="primary" ghost @click="openTeamPicker">选择拼课团</NButton>
          <NButton :loading="loading" @click="loadDetail">刷新</NButton>
          <NButton type="primary" ghost :disabled="!canAdminManualFill" @click="openVirtualFillModal">
            人工补位
          </NButton>
          <NButton type="primary" ghost @click="startClass">开始上课</NButton>
          <NButton type="info" ghost @click="finishClass">结束上课</NButton>
          <NButton type="warning" ghost @click="closeTeam">关闭拼课</NButton>
          <NButton quaternary @click="goFailurePage">前往失败处理</NButton>
        </NSpace>
      </NSpace>
    </NCard>

    <NGrid :cols="24" :x-gap="16" :y-gap="16">
      <NGridItem :span="12">
        <NCard title="团头部信息" :bordered="false" size="small">
          <NDescriptions label-placement="left" :column="2" size="small">
            <NDescriptionsItem label="团编号">{{ detail?.teamId || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="活动上下文">{{ detail?.activityContextKey || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="商品名称">{{ detail?.productName || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="门店">{{ detail?.tenantName || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="团长">{{ detail?.leader?.name || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="团长手机号">{{ detail?.leader?.mobile || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="上课地址">{{ detail?.classAddress || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="开课时间">{{ formatDateTime(detail?.classStartTime) }}</NDescriptionsItem>
            <NDescriptionsItem label="结束时间">{{ formatDateTime(detail?.classEndTime) }}</NDescriptionsItem>
            <NDescriptionsItem label="状态说明">{{ statusMeta.label }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGridItem>
      <NGridItem :span="6">
        <NCard title="成团口径" :bordered="false" size="small">
          <div class="grid grid-cols-1 gap-12px">
            <div>
              <div class="text-12px text-gray-500">有效人数</div>
              <div class="mt-8px text-20px text-primary font-semibold">{{ formationMetrics.effectiveMemberCount }}</div>
            </div>
            <div>
              <div class="text-12px text-gray-500">真实人数 / 虚拟人数</div>
              <div class="mt-8px text-18px font-semibold">
                {{ formationMetrics.realMemberCount }} / {{ formationMetrics.virtualMemberCount }}
              </div>
            </div>
            <div>
              <div class="text-12px text-gray-500">真实已付费人数</div>
              <div class="mt-8px text-18px text-success font-semibold">{{ formationMetrics.realPaidMemberCount }}</div>
            </div>
            <div>
              <div class="text-12px text-gray-500">剩余真实名额</div>
              <div class="mt-8px text-18px text-warning font-semibold">{{ formationMetrics.remainingSlots }}</div>
            </div>
          </div>
        </NCard>
      </NGridItem>
      <NGridItem :span="6">
        <NCard title="交易口径" :bordered="false" size="small">
          <div class="grid grid-cols-1 gap-12px">
            <div>
              <div class="text-12px text-gray-500">真实支付金额</div>
              <div class="mt-8px text-20px text-primary font-semibold">
                {{ formatAmount(financeMetrics.realPaidAmount) }}
              </div>
            </div>
            <div>
              <div class="text-12px text-gray-500">可分佣基数</div>
              <div class="mt-8px text-18px text-success font-semibold">
                {{ formatAmount(financeMetrics.commissionBaseAmount) }}
              </div>
            </div>
            <div>
              <div class="text-12px text-gray-500">真实佣金记录</div>
              <div class="mt-8px text-18px text-warning font-semibold">
                {{ formatAmount(financeMetrics.commissionAmount) }}
              </div>
            </div>
            <div>
              <div class="text-12px text-gray-500">财务证据</div>
              <div class="mt-8px text-18px font-semibold">
                {{ financeMetrics.financeEvidenceReady ? '已闭合' : '待补齐' }}
              </div>
            </div>
          </div>
        </NCard>
      </NGridItem>
    </NGrid>

    <!-- 课程总览展示真实履约进度，虚拟补位不进入课程履约。 -->
    <NCard title="课程履约总览" :bordered="false" size="small" :loading="courseRuntimeLoading">
      <NGrid :cols="24" :x-gap="16" :y-gap="16">
        <NGridItem :span="6">
          <div class="text-12px text-gray-500">课程扩展</div>
          <div class="mt-8px text-18px font-semibold">
            {{ courseSummaryMetrics.extensionReady ? '已生成' : '未生成' }}
          </div>
        </NGridItem>
        <NGridItem :span="6">
          <div class="text-12px text-gray-500">课程状态</div>
          <div class="mt-8px text-18px font-semibold">
            {{ getCourseExtensionStatusText(courseSummary?.extensionStatus) }}
          </div>
        </NGridItem>
        <NGridItem :span="6">
          <div class="text-12px text-gray-500">总课时 / 已完成 / 待完成</div>
          <div class="mt-8px text-18px text-primary font-semibold">
            {{ courseSummaryMetrics.totalLessons }} / {{ courseSummaryMetrics.completedLessons }} /
            {{ courseSummaryMetrics.pendingLessons }}
          </div>
        </NGridItem>
        <NGridItem :span="6">
          <div class="text-12px text-gray-500">排课总数 / 已完成 / 已取消</div>
          <div class="mt-8px text-18px text-success font-semibold">
            {{ courseSummaryMetrics.scheduleCount }} / {{ courseSummaryMetrics.completedScheduleCount }} /
            {{ courseSummaryMetrics.cancelledScheduleCount }}
          </div>
        </NGridItem>
        <NGridItem :span="6">
          <div class="text-12px text-gray-500">已点到学员数</div>
          <div class="mt-8px text-18px text-warning font-semibold">
            {{ courseSummaryMetrics.attendanceMarkedMemberCount }}
          </div>
        </NGridItem>
        <NGridItem :span="6">
          <div class="text-12px text-gray-500">老师绑定排课</div>
          <div class="mt-8px text-18px text-primary font-semibold">
            {{ courseSummaryMetrics.teacherBoundScheduleCount }} / {{ courseSummaryMetrics.scheduleCount }}
          </div>
        </NGridItem>
        <NGridItem :span="6">
          <div class="text-12px text-gray-500">教室绑定排课</div>
          <div class="mt-8px text-18px text-primary font-semibold">
            {{ courseSummaryMetrics.classroomBoundScheduleCount }} / {{ courseSummaryMetrics.scheduleCount }}
          </div>
        </NGridItem>
        <NGridItem :span="6">
          <div class="text-12px text-gray-500">容量绑定排课</div>
          <div class="mt-8px text-18px text-primary font-semibold">
            {{ courseSummaryMetrics.capacityBoundScheduleCount }} / {{ courseSummaryMetrics.scheduleCount }}
          </div>
        </NGridItem>
        <NGridItem :span="6">
          <div class="text-12px text-gray-500">履约地址</div>
          <div class="mt-8px text-14px font-medium">
            {{ courseSummary?.classAddress || detail?.classAddress || '-' }}
          </div>
        </NGridItem>
        <NGridItem :span="6">
          <div class="text-12px text-gray-500">履约开始时间</div>
          <div class="mt-8px text-14px font-medium">
            {{ formatDateTime(courseSummary?.classStartTime || detail?.classStartTime) }}
          </div>
        </NGridItem>
        <NGridItem :span="6">
          <div class="text-12px text-gray-500">履约结束时间</div>
          <div class="mt-8px text-14px font-medium">
            {{ formatDateTime(courseSummary?.classEndTime || detail?.classEndTime) }}
          </div>
        </NGridItem>
      </NGrid>
      <div v-if="!courseSummaryMetrics.extensionReady" class="mt-12px text-12px text-warning">
        当前团尚未生成课程扩展，成团收口完成后才会出现排课与考勤数据。
      </div>
    </NCard>

    <!-- 排课列表只展示团长扩展下的团队课程计划。 -->
    <NCard title="排课列表" :bordered="false" size="small">
      <template #header-extra>
        <NButton size="small" :loading="courseRuntimeLoading" @click="loadCourseRuntime">刷新履约</NButton>
      </template>
      <NDataTable
        :columns="scheduleColumns"
        :data="schedules"
        :loading="courseRuntimeLoading"
        :pagination="false"
        :scroll-x="1240"
      />
    </NCard>

    <!-- 考勤列表只展示真实成员的到课记录。 -->
    <NCard title="考勤列表" :bordered="false" size="small">
      <template #header-extra>
        <NButton size="small" type="primary" ghost @click="openAttendanceModal">标记到课</NButton>
      </template>
      <NDataTable
        :columns="attendanceColumns"
        :data="attendances"
        :loading="courseRuntimeLoading"
        :pagination="false"
        :scroll-x="820"
      />
    </NCard>

    <NCard title="成员列表 / 参与口径" :bordered="false" size="small">
      <NDataTable :columns="memberColumns" :data="members" :loading="loading" :scroll-x="1480" />
    </NCard>

    <NCard title="补位审计" :bordered="false" size="small">
      <NDataTable :columns="auditColumns" :data="virtualFillAudits" :pagination="false" :scroll-x="980" />
    </NCard>

    <NModal v-model:show="attendanceModalVisible" preset="card" title="标记到课" class="w-520px">
      <NForm :model="attendanceForm" label-placement="left" :label-width="110">
        <NFormItem label="学员">
          <NSelect
            v-model:value="attendanceForm.memberId"
            :options="attendanceMemberOptions"
            placeholder="请选择真实学员"
          />
        </NFormItem>
        <NFormItem label="考勤日期">
          <NSelect v-model:value="attendanceForm.date" :options="scheduleDateOptions" placeholder="请选择排课日期" />
        </NFormItem>
        <NFormItem label="备注">
          <NInput v-model:value="attendanceForm.remark" type="textarea" :rows="3" placeholder="如：准时到课" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="attendanceModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="attendanceSubmitting" @click="submitAttendance">提交到课</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="failureModalVisible" preset="card" title="成员失败处理" class="w-520px">
      <NForm :model="failureForm" label-placement="left" :label-width="110">
        <NFormItem label="成员名称">
          <NInput :value="selectedMember?.name || '-'" readonly />
        </NFormItem>
        <NFormItem label="成员记录 ID">
          <NInput :value="failureForm.memberRecordId" readonly placeholder="已自动带入，无需手工输入" />
        </NFormItem>
        <NFormItem label="处理原因">
          <NInput
            v-model:value="failureForm.reason"
            type="textarea"
            :rows="3"
            placeholder="如：超时未支付、联系不到学员"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="failureModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="failureSubmitting" @click="submitFailureResolution">提交处理</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="virtualFillModalVisible" preset="card" title="后台人工补位" class="w-520px">
      <NForm :model="virtualFillForm" label-placement="left" :label-width="110">
        <NFormItem label="补位数量">
          <NInputNumber v-model:value="virtualFillForm.count" :min="1" :max="10" class="w-full" />
        </NFormItem>
        <NFormItem label="操作原因">
          <NInput
            v-model:value="virtualFillForm.reason"
            type="textarea"
            :rows="3"
            placeholder="如：距离截止时间较近，后台补足最低成团人数"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="virtualFillModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="virtualFillSubmitting" @click="submitVirtualFill">提交补位</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="teamPickerVisible" preset="card" title="选择拼课团" class="w-1100px">
      <div class="mb-12px flex items-center justify-between gap-12px">
        <NSpace>
          <NSelect
            v-model:value="teamPickerStatus"
            :options="teamPickerStatusOptions"
            placeholder="按状态筛选"
            class="w-180px"
          />
          <NButton type="primary" :loading="teamPickerLoading" @click="loadTeamPickerData">查询</NButton>
          <NButton @click="handleTeamPickerReset">重置</NButton>
        </NSpace>
        <div class="text-12px text-gray-500">仅展示最近 50 条拼课团，请按状态快速筛选。</div>
      </div>

      <NDataTable
        :loading="teamPickerLoading"
        :columns="teamPickerColumns"
        :data="teamPickerRows"
        :row-key="(row) => row.teamId"
        :row-props="
          (row) => ({
            onClick: () => handleSelectTeam(row),
            style:
              row.teamId === selectedTeamId ? 'cursor:pointer;background:rgba(24,160,88,0.08);' : 'cursor:pointer;',
          })
        "
        :scroll-x="980"
        :max-height="460"
      />

      <template #footer>
        <div class="flex items-center justify-between">
          <div class="text-12px text-gray-500">
            已选：
            <span class="text-[#111827] font-medium">{{ selectedTeamId || '未选择' }}</span>
          </div>
          <NSpace>
            <NButton @click="teamPickerVisible = false">取消</NButton>
            <NButton type="primary" @click="confirmSelectTeam">确认选择</NButton>
          </NSpace>
        </div>
      </template>
    </NModal>
  </div>
</template>
