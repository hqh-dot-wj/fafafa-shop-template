<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  NButton,
  NCard,
  NDatePicker,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
} from 'naive-ui';
import type { SelectOption } from 'naive-ui';
import {
  type ActivityDashboardData,
  type ActivityListParams,
  type ActivityStatus,
  type MarketingActivity,
  type SaveActivityPayload,
  type UpdateActivityPayload,
  fetchActivityDashboard,
  fetchActivityList,
  fetchArchiveActivity,
  fetchCreateActivity,
  fetchPauseActivity,
  fetchPublishActivity,
  fetchUpdateActivity,
} from '@/service/api/marketing';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import { $t } from '@/locales';
import ActivityMetricsPanel from '../modules/activity-metrics-panel.vue';
import ActivitySearch from '../modules/activity-search.vue';
import ActivityTableCard from '../modules/activity-table-card.vue';
import { ACTIVITY_TYPE_LABEL, createActivityTableColumns } from '../modules/activity-table-columns';

defineOptions({ name: 'MarketingActivityListPage' });

// 活动中心页对应 ActivityController / CampaignShellController 的后台活动聚合入口。
// 本页负责列表、复制、发布/暂停/归档和基础规则编辑，复杂触发器、权益和拼课运行时仍由后端解释。
interface ActivityFormModel {
  name: string;
  type: string;
  description: string;
  startTime: number | null;
  endTime: number | null;
  failurePolicy: string;
  commissionEnabled: boolean;
  commissionRate: number;
  leaderMode: string;
  allowQualifiedUserOpen: boolean;
  allowStaffProxyOpen: boolean;
  ownerUserId: string;
}

type BooleanSelectValue = 'true' | 'false';

const router = useRouter();
const appStore = useAppStore();

const searchModel = reactive({
  keyword: '',
  type: null as string | null,
  status: null as ActivityStatus | null,
  ownerUserId: '',
  timeRange: null as [number, number] | null,
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

const booleanOptions: SelectOption[] = [
  { label: '开启', value: 'true' },
  { label: '关闭', value: 'false' },
];

const modalVisible = ref(false);
const submitting = ref(false);
const dashboardLoading = ref(false);
const dashboardData = ref<ActivityDashboardData | null>(null);
const editingActivityId = ref<string | null>(null);
const editingRawRules = ref<Record<string, unknown>>({});
const editingRawRewards = ref<Record<string, unknown>>({});
const editingRawTrigger = ref<Record<string, unknown>>({});
const drawerTitle = computed(() => (editingActivityId.value ? `${$t('common.edit')}活动` : `${$t('common.add')}活动`));

const dashboardSummary = computed(() => {
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

const formModel = reactive<ActivityFormModel>({
  name: '',
  type: 'COURSE_GROUP',
  description: '',
  startTime: null,
  endTime: null,
  failurePolicy: 'REFUND',
  commissionEnabled: false,
  commissionRate: 0,
  leaderMode: 'QUALIFIED_ONLY',
  allowQualifiedUserOpen: true,
  allowStaffProxyOpen: false,
  ownerUserId: '',
});

const commissionEnabledValue = computed<BooleanSelectValue>({
  get: () => encodeBooleanSelect(formModel.commissionEnabled),
  set: (value) => {
    formModel.commissionEnabled = decodeBooleanSelect(value);
  },
});

const allowQualifiedUserOpenValue = computed<BooleanSelectValue>({
  get: () => encodeBooleanSelect(formModel.allowQualifiedUserOpen),
  set: (value) => {
    formModel.allowQualifiedUserOpen = decodeBooleanSelect(value);
  },
});

const allowStaffProxyOpenValue = computed<BooleanSelectValue>({
  get: () => encodeBooleanSelect(formModel.allowStaffProxyOpen),
  set: (value) => {
    formModel.allowStaffProxyOpen = decodeBooleanSelect(value);
  },
});

const ownerUserIdValue = computed<CommonType.IdType | null>({
  get: () => {
    const rawValue = formModel.ownerUserId.trim();
    if (!rawValue) return null;
    const asNumber = Number(rawValue);
    return Number.isFinite(asNumber) ? asNumber : rawValue;
  },
  set: (value) => {
    formModel.ownerUserId = value === null || value === undefined ? '' : String(value);
  },
});

const { data, loading, columns, mobilePagination, scrollX, searchParams, updateSearchParams, getData, getDataByPage } =
  useTable({
    apiFn: fetchActivityList,
    apiParams: {
      pageNum: 1,
      pageSize: 20,
      keyword: undefined,
      type: undefined,
      status: undefined,
      ownerUserId: undefined,
      startTimeFrom: undefined,
      startTimeTo: undefined,
      isEnabled: undefined,
    },
    columns: () =>
      createActivityTableColumns({
        onViewDetail: viewDetail,
        onOpenEdit: openEdit,
        onDuplicate: (activity) => {
          runAsyncTask(() => duplicateActivity(activity));
        },
        onChangeStatus: (activityId, action) => {
          runAsyncTask(() => changeStatus(activityId, action));
        },
      }),
  });

function toRecord(source: unknown): Record<string, unknown> {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return source as Record<string, unknown>;
}

function readArray(source: unknown, key: string): unknown[] {
  const record = toRecord(source);
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function readString(source: unknown, key: string): string | null {
  const record = toRecord(source);
  const value = record[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readBoolean(source: unknown, key: string): boolean {
  const record = toRecord(source);
  const value = record[key];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return normalized === 'true' || normalized === '1';
  }
  return false;
}

function toTimestamp(value?: string) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function encodeBooleanSelect(value: boolean): BooleanSelectValue {
  return value ? 'true' : 'false';
}

function decodeBooleanSelect(value: string | number | null | undefined): boolean {
  return value === 'true';
}

function buildBaseQuery() {
  const keyword = searchModel.keyword.trim();
  const ownerUserId = searchModel.ownerUserId.trim();
  const [startTimeFrom, startTimeTo] = searchModel.timeRange
    ? [new Date(searchModel.timeRange[0]).toISOString(), new Date(searchModel.timeRange[1]).toISOString()]
    : [undefined, undefined];

  return {
    keyword: keyword || undefined,
    type: searchModel.type ?? undefined,
    status: searchModel.status ?? undefined,
    ownerUserId: ownerUserId || undefined,
    startTimeFrom,
    startTimeTo,
  };
}

function buildListQuery(pageNum: number) {
  return {
    pageNum,
    pageSize: Number(searchParams.pageSize || 20),
    ...buildBaseQuery(),
  } satisfies ActivityListParams;
}

async function loadDashboard() {
  dashboardLoading.value = true;
  try {
    const response = await fetchActivityDashboard(buildBaseQuery());
    dashboardData.value = response.data ?? null;
  } finally {
    dashboardLoading.value = false;
  }
}

async function handleSearch() {
  updateSearchParams(buildListQuery(1));
  await Promise.all([getDataByPage(1), loadDashboard()]);
}

function resetSearch() {
  searchModel.keyword = '';
  searchModel.type = null;
  searchModel.status = null;
  searchModel.ownerUserId = '';
  searchModel.timeRange = null;
  updateSearchParams(buildListQuery(1));
  runAsyncTask(async () => {
    await Promise.all([getDataByPage(1), loadDashboard()]);
  });
}

function viewDetail(activityId: string) {
  runAsyncTask(() =>
    router.push({
      name: 'marketing_activity_detail',
      query: {
        activityId,
      },
    }),
  );
}

function goCalendar() {
  runAsyncTask(() => router.push({ name: 'marketing_activity_calendar' }));
}

function goDashboard() {
  runAsyncTask(() => router.push({ name: 'marketing_activity_dashboard' }));
}

function runAsyncTask(task: () => Promise<unknown>) {
  task().catch(() => undefined);
}

function refreshCenter() {
  runAsyncTask(async () => {
    await Promise.all([getData(), loadDashboard()]);
  });
}

function openCreate() {
  editingActivityId.value = null;
  editingRawRules.value = {};
  editingRawRewards.value = {};
  editingRawTrigger.value = {};
  Object.assign(formModel, {
    name: '',
    type: 'COURSE_GROUP',
    description: '',
    startTime: null,
    endTime: null,
    failurePolicy: 'REFUND',
    commissionEnabled: false,
    commissionRate: 0,
    leaderMode: 'QUALIFIED_ONLY',
    allowQualifiedUserOpen: true,
    allowStaffProxyOpen: false,
    ownerUserId: '',
  });
  modalVisible.value = true;
}

function openEdit(row: MarketingActivity) {
  editingActivityId.value = row.id;
  editingRawRules.value = toRecord(row.rules);
  editingRawRewards.value = toRecord(row.rewards);
  editingRawTrigger.value = toRecord(row.triggerCondition);
  Object.assign(formModel, {
    name: row.name,
    type: row.type,
    description: row.description ?? '',
    startTime: toTimestamp(row.startTime),
    endTime: toTimestamp(row.endTime),
    failurePolicy: readString(row.rules, 'failurePolicy') ?? 'REFUND',
    commissionEnabled: readBoolean(row.rules, 'commissionEnabled'),
    commissionRate: Number(toRecord(row.rules).commissionRate ?? 0) || 0,
    leaderMode: readString(row.rules, 'leaderMode') ?? 'QUALIFIED_ONLY',
    allowQualifiedUserOpen: readBoolean(row.rules, 'allowQualifiedUserOpen'),
    allowStaffProxyOpen: readBoolean(row.rules, 'allowStaffProxyOpen'),
    ownerUserId: readString(row.triggerCondition, 'ownerUserId') ?? '',
  });
  modalVisible.value = true;
}

function buildActivityPayloadBase(): Omit<SaveActivityPayload, 'type'> {
  // 编辑时保留后端返回的 rules/rewards/triggerCondition 未知字段，只覆盖当前抽屉负责的基础项。
  const triggerCondition = {
    ...editingRawTrigger.value,
    ownerUserId: formModel.ownerUserId || undefined,
  };
  const rules = {
    ...editingRawRules.value,
    failurePolicy: formModel.failurePolicy,
    commissionEnabled: formModel.commissionEnabled,
    commissionRate: formModel.commissionRate,
    leaderMode: formModel.leaderMode,
    allowQualifiedUserOpen: formModel.allowQualifiedUserOpen,
    allowStaffProxyOpen: formModel.allowStaffProxyOpen,
  };
  const rewards = {
    ...editingRawRewards.value,
    commissionEnabled: formModel.commissionEnabled,
    commissionRate: formModel.commissionRate,
  };

  return {
    name: formModel.name,
    description: formModel.description || undefined,
    startTime: formModel.startTime ? new Date(formModel.startTime).toISOString() : undefined,
    endTime: formModel.endTime ? new Date(formModel.endTime).toISOString() : undefined,
    triggerCondition,
    rules,
    rewards,
    priority: 0,
    isEnabled: undefined,
  };
}

function buildCreateActivityPayload(): SaveActivityPayload {
  return {
    ...buildActivityPayloadBase(),
    type: formModel.type,
    isEnabled: false,
  };
}

function buildUpdateActivityPayload(): UpdateActivityPayload {
  return buildActivityPayloadBase();
}

async function saveActivity() {
  if (!formModel.name.trim()) {
    window.$message?.warning('请输入活动名称');
    return;
  }
  if (!formModel.type.trim()) {
    window.$message?.warning('请选择活动类型');
    return;
  }

  submitting.value = true;

  try {
    if (editingActivityId.value) {
      await fetchUpdateActivity(editingActivityId.value, buildUpdateActivityPayload());
      window.$message?.success('活动已更新');
    } else {
      await fetchCreateActivity(buildCreateActivityPayload());
      window.$message?.success('活动已创建');
    }

    modalVisible.value = false;
    await Promise.all([getData(), loadDashboard()]);
  } finally {
    submitting.value = false;
  }
}

async function changeStatus(activityId: string, action: 'publish' | 'pause' | 'archive') {
  // 状态动作会影响 C 端出数和活动资格，前端只发动作，发布前置校验由后端执行。
  if (action === 'publish') {
    await fetchPublishActivity(activityId);
    window.$message?.success('活动已发布');
  } else if (action === 'pause') {
    await fetchPauseActivity(activityId);
    window.$message?.success('活动已暂停');
  } else {
    await fetchArchiveActivity(activityId);
    window.$message?.success('活动已归档');
  }

  await Promise.all([getData(), loadDashboard()]);
}

async function duplicateActivity(row: MarketingActivity) {
  // 复制活动默认保持未启用，防止运营复制后立即进入 C 端出数。
  const payload: SaveActivityPayload = {
    type: row.type,
    name: `${row.name}-副本`,
    description: row.description,
    startTime: row.startTime,
    endTime: row.endTime,
    triggerCondition: toRecord(row.triggerCondition),
    rules: {
      ...toRecord(row.rules),
      activityItems: readArray(row.rules, 'activityItems'),
    },
    rewards: toRecord(row.rewards),
    priority: row.priority ?? 0,
    isEnabled: false,
  };

  await fetchCreateActivity(payload);
  window.$message?.success('活动已复制');
  await Promise.all([getData(), loadDashboard()]);
}

onMounted(() => {
  runAsyncTask(loadDashboard);
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 页面导航区：说明活动中心职责并提供列表、日历、驾驶舱切换。 -->
    <NCard :bordered="false" size="small" class="card-wrapper">
      <div class="flex items-start justify-between gap-12px lt-sm:flex-col">
        <div class="flex-col gap-6px">
          <h2 class="text-18px font-semibold">活动中心</h2>
          <p class="text-13px text-gray-500">
            列表页负责活动检索和状态动作；日历页看排期与冲突；驾驶舱看整体运行概览。
          </p>
        </div>
        <NSpace>
          <NButton type="primary">列表</NButton>
          <NButton ghost @click="goCalendar">日历</NButton>
          <NButton ghost @click="goDashboard">驾驶舱</NButton>
        </NSpace>
      </div>
    </NCard>

    <!-- 搜索区：筛选活动列表和驾驶舱指标，查询条件不写回活动数据。 -->
    <ActivitySearch
      :model="searchModel"
      :activity-type-options="activityTypeOptions"
      :status-options="statusOptions"
      @search="handleSearch"
      @reset="resetSearch"
    />

    <!-- 指标摘要区：展示当前筛选条件下的活动状态聚合。 -->
    <ActivityMetricsPanel
      :loading="dashboardLoading"
      :total="dashboardSummary.total"
      :draft="dashboardSummary.draft"
      :published="dashboardSummary.published"
      :paused="dashboardSummary.paused"
      :archived="dashboardSummary.archived"
    />

    <!-- 活动表格区：承载创建、刷新和状态动作入口。 -->
    <ActivityTableCard
      :columns="columns"
      :data="data"
      :loading="loading"
      :pagination="mobilePagination"
      :flex-height="!appStore.isMobile"
      :scroll-x="scrollX"
      @create="openCreate"
      @refresh="refreshCenter"
    />

    <!-- 活动编辑抽屉：只编辑基础信息和兼容规则字段，复杂运行规则交给后端解释。 -->
    <NDrawer v-model:show="modalVisible" :width="520">
      <NDrawerContent :title="drawerTitle" closable>
        <NForm :model="formModel" label-placement="left" :label-width="120">
          <NFormItem label="活动名称">
            <NInput v-model:value="formModel.name" placeholder="请输入活动名称" />
          </NFormItem>
          <NFormItem label="活动类型">
            <NSelect
              v-model:value="formModel.type"
              :options="activityTypeOptions"
              :disabled="Boolean(editingActivityId)"
            />
          </NFormItem>
          <NFormItem label="活动描述">
            <NInput v-model:value="formModel.description" type="textarea" :rows="2" />
          </NFormItem>
          <NFormItem label="开始时间">
            <NDatePicker v-model:value="formModel.startTime" type="datetime" clearable class="w-full" />
          </NFormItem>
          <NFormItem label="结束时间">
            <NDatePicker v-model:value="formModel.endTime" type="datetime" clearable class="w-full" />
          </NFormItem>
          <NFormItem label="失败策略">
            <NSelect
              v-model:value="formModel.failurePolicy"
              :options="[
                { label: '退款', value: 'REFUND' },
                { label: '转移', value: 'TRANSFER' },
                { label: '手动', value: 'MANUAL' },
              ]"
            />
          </NFormItem>
          <NFormItem label="分佣">
            <NSelect v-model:value="commissionEnabledValue" :options="booleanOptions" />
          </NFormItem>
          <NFormItem label="分佣比例">
            <NInputNumber v-model:value="formModel.commissionRate" :min="0" :max="1" :step="0.01" class="w-full" />
          </NFormItem>
          <NFormItem label="团长模式">
            <NSelect
              v-model:value="formModel.leaderMode"
              :options="[
                { label: '仅已达标团长', value: 'QUALIFIED_ONLY' },
                { label: '员工优先', value: 'STAFF_PRIORITY' },
              ]"
            />
          </NFormItem>
          <NFormItem label="允许用户开团">
            <NSelect v-model:value="allowQualifiedUserOpenValue" :options="booleanOptions" />
          </NFormItem>
          <NFormItem label="允许员工代开">
            <NSelect v-model:value="allowStaffProxyOpenValue" :options="booleanOptions" />
          </NFormItem>
          <NFormItem label="负责人账号">
            <UserSelect v-model:value="ownerUserIdValue" clearable filterable placeholder="请选择负责人（可选）" />
          </NFormItem>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="modalVisible = false">{{ $t('common.cancel') }}</NButton>
            <NButton type="primary" :loading="submitting" @click="saveActivity">{{ $t('common.save') }}</NButton>
          </NSpace>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>
