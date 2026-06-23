<script setup lang="tsx">
import { computed, reactive, ref } from 'vue';
import type { SelectOption } from 'naive-ui';
import {
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  NTag,
} from 'naive-ui';
import {
  type ResolutionIncident,
  type ResolutionIncidentAction,
  type ResolutionIncidentHandlePayload,
  type ResolutionIncidentLevel,
  type ResolutionIncidentSearchParams,
  type ResolutionIncidentStatus,
  type ResolutionIncidentType,
  fetchHandleResolutionIncident,
  fetchResolutionIncidents,
} from '@/service/api/marketing/resolution';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import IncidentSearch from './modules/incident-search.vue';
import IncidentTableCard from './modules/incident-table-card.vue';
import TraceDiagnosticPanel from './modules/trace-diagnostic-panel.vue';

defineOptions({ name: 'ResolutionIncidentPage' });

// 排障工单中心对应 ResolutionIncidentController，面向场景裁决、指标告警和探针缺失排查。
// 工单处理只改变 incident 状态，不重跑裁决、不修复业务数据。
const appStore = useAppStore();

const searchParamsModel = reactive<ResolutionIncidentSearchParams>({
  pageNum: 1,
  pageSize: 20,
  status: null,
  level: null,
  type: null,
  keyword: '',
});

const statusOptions: SelectOption[] = [
  { label: '待处理', value: 'OPEN' },
  { label: '已确认', value: 'ACK' },
  { label: '已解决', value: 'RESOLVED' },
  { label: '已忽略', value: 'IGNORED' },
];

const typeOptions: SelectOption[] = [
  { label: '指标告警', value: 'METRIC_ALERT' },
  { label: '探针缺失', value: 'PROBE_STEP_MISSING' },
];

const levelOptions: SelectOption[] = [
  { label: '低', value: 'LOW' },
  { label: '中', value: 'MEDIUM' },
  { label: '高', value: 'HIGH' },
  { label: '严重', value: 'CRITICAL' },
];

const actionOptions: Record<
  ResolutionIncidentAction,
  { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }
> = {
  ACK: { label: '确认', type: 'info' },
  RESOLVE: { label: '解决', type: 'success' },
  IGNORE: { label: '忽略', type: 'default' },
};

const statusTagMeta: Record<
  ResolutionIncidentStatus,
  { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }
> = {
  OPEN: { label: '待处理', type: 'warning' },
  ACK: { label: '已确认', type: 'info' },
  RESOLVED: { label: '已解决', type: 'success' },
  IGNORED: { label: '已忽略', type: 'default' },
};

const typeTagMeta: Record<
  ResolutionIncidentType,
  { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }
> = {
  METRIC_ALERT: { label: '指标告警', type: 'error' },
  PROBE_STEP_MISSING: { label: '探针缺失', type: 'warning' },
};

const levelTagMeta: Record<
  ResolutionIncidentLevel,
  { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }
> = {
  LOW: { label: '低', type: 'default' },
  MEDIUM: { label: '中', type: 'info' },
  HIGH: { label: '高', type: 'warning' },
  CRITICAL: { label: '严重', type: 'error' },
};

const handleVisible = ref(false);
const handleSubmitting = ref(false);
const currentIncident = ref<ResolutionIncident | null>(null);
const currentAction = ref<ResolutionIncidentAction>('ACK');
const handleRemark = ref('');
const traceDiagnosticTraceId = ref('');
const traceDiagnosticVersion = ref(0);

type IncidentSearchModel = ResolutionIncidentSearchParams & { keyword: string };

function buildIncidentColumns(): NaiveUI.TableColumn<ResolutionIncident>[] {
  return [
    {
      key: 'title',
      title: '工单标题',
      minWidth: 220,
      ellipsis: { tooltip: true },
    },
    {
      key: 'type',
      title: '类型',
      width: 120,
      render: (row) => renderTag(row.type, typeTagMeta),
    },
    {
      key: 'level',
      title: '等级',
      width: 100,
      render: (row) => renderTag(row.level, levelTagMeta),
    },
    {
      key: 'status',
      title: '状态',
      width: 120,
      render: (row) => renderTag(row.status, statusTagMeta),
    },
    { key: 'occurredAt', title: '发生时间', width: 180, ellipsis: { tooltip: true } },
    {
      key: 'traceId',
      title: 'Trace',
      width: 180,
      ellipsis: { tooltip: true },
      render: (row) => row.traceId || '-',
    },
    {
      key: 'latestHandle',
      title: '最近处理',
      minWidth: 240,
      ellipsis: { tooltip: true },
      render: (row) => renderLatestHandle(row),
    },
    {
      key: 'operate',
      title: '操作',
      width: 330,
      fixed: 'right',
      render: (row) => (
        <NSpace wrap size={6}>
          <NButton size="small" type="primary" ghost disabled={!row.traceId} onClick={() => openTraceDiagnostic(row)}>
            诊断
          </NButton>
          <NButton size="small" type="info" ghost onClick={() => openHandle(row, 'ACK')}>
            确认
          </NButton>
          <NButton size="small" type="success" ghost onClick={() => openHandle(row, 'RESOLVE')}>
            解决
          </NButton>
          <NButton size="small" type="default" ghost onClick={() => openHandle(row, 'IGNORE')}>
            忽略
          </NButton>
        </NSpace>
      ),
    },
  ];
}

const incidentColumns = computed<NaiveUI.TableColumn<ResolutionIncident>[]>(() => buildIncidentColumns());

const { data, loading, mobilePagination, scrollX, searchParams, getData, getDataByPage, resetSearchParams } = useTable({
  apiFn: fetchResolutionIncidents,
  apiParams: searchParamsModel,
  columns: () => buildIncidentColumns(),
});

const incidentSearchModel = computed(() => searchParams as IncidentSearchModel);

function renderTag<T extends string>(
  value: T,
  meta: Record<string, { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }>,
) {
  const current = meta[value] ?? { label: value, type: 'default' };
  return (
    <NTag type={current.type} size="small" bordered={false}>
      {current.label}
    </NTag>
  );
}

function renderLatestHandle(row: ResolutionIncident) {
  if (!row.latestHandle) {
    return '未处理';
  }
  const { action, operator, handledAt, remark } = row.latestHandle;
  return (
    <div class="flex-col gap-4px">
      <div class="text-13px text-gray-700">
        {actionOptions[action].label} / {operator}
      </div>
      <div class="text-12px text-gray-500">{handledAt}</div>
      {remark ? <div class="text-12px text-gray-500">备注：{remark}</div> : null}
    </div>
  );
}

function openHandle(row: ResolutionIncident, action: ResolutionIncidentAction) {
  currentIncident.value = row;
  currentAction.value = action;
  handleRemark.value = row.latestHandle?.remark ?? '';
  handleVisible.value = true;
}

function openTraceDiagnostic(row: ResolutionIncident) {
  // Trace 诊断是只读采样聚合，必须从工单 traceId 进入，避免人工输入错误 trace 后误判。
  const currentTraceId = row.traceId?.trim();
  if (!currentTraceId) {
    window.$message?.warning('当前工单没有 Trace ID');
    return;
  }

  traceDiagnosticTraceId.value = currentTraceId;
  traceDiagnosticVersion.value += 1;
}

function closeHandleModal() {
  handleVisible.value = false;
  currentIncident.value = null;
  handleRemark.value = '';
}

async function submitHandle() {
  if (!currentIncident.value) {
    return;
  }

  handleSubmitting.value = true;
  try {
    // 处理动作仅提交 ACK/RESOLVE/IGNORE 和备注，实际状态流转由后端写审计。
    const payload: ResolutionIncidentHandlePayload = {
      action: currentAction.value,
    };
    const remark = handleRemark.value.trim();
    if (remark) {
      payload.remark = remark;
    }
    await fetchHandleResolutionIncident(currentIncident.value.id, payload);
    window.$message?.success('工单已处理');
    closeHandleModal();
    await getData();
  } finally {
    handleSubmitting.value = false;
  }
}

function handleReset() {
  resetSearchParams();
  getDataByPage(1);
}

function handleSearch() {
  getDataByPage(1);
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 页面摘要区：说明排障工单的租户视角和处理动作边界。 -->
    <NCard :bordered="false" size="small" class="card-wrapper">
      <div class="flex items-start justify-between gap-12px lt-sm:flex-col">
        <div class="flex-col gap-6px">
          <h2 class="text-18px font-semibold">排障工单中心</h2>
          <p class="text-13px text-gray-500">支持工单筛选、Trace 诊断，以及确认、解决、忽略三种处理动作。</p>
        </div>
        <NSpace>
          <NTag type="info" size="small" :bordered="false">当前列表为租户视角</NTag>
        </NSpace>
      </div>
    </NCard>

    <!-- Trace 诊断区：从工单 traceId 进入只读采样聚合。 -->
    <TraceDiagnosticPanel :selected-trace-id="traceDiagnosticTraceId" :selected-version="traceDiagnosticVersion" />

    <!-- 搜索区：按状态、类型、等级和关键词筛选工单。 -->
    <IncidentSearch
      :model="incidentSearchModel"
      :status-options="statusOptions"
      :type-options="typeOptions"
      :level-options="levelOptions"
      @search="handleSearch"
      @reset="handleReset"
    />

    <!-- 工单表格区：展示排障工单并提供诊断、确认、解决和忽略入口。 -->
    <IncidentTableCard
      :columns="incidentColumns"
      :data="data"
      :loading="loading"
      :pagination="mobilePagination"
      :flex-height="!appStore.isMobile"
      :scroll-x="scrollX"
      @refresh="getData"
    />

    <!-- 工单处理弹窗：提交处理动作和备注，状态流转由后端写审计。 -->
    <NModal v-model:show="handleVisible" preset="card" title="处理排障工单" class="w-720px">
      <div v-if="currentIncident" class="flex-col gap-16px">
        <NDescriptions label-placement="left" bordered size="small" :column="2">
          <NDescriptionsItem label="工单标题">
            {{ currentIncident.title }}
          </NDescriptionsItem>
          <NDescriptionsItem label="工单类型">
            {{ typeTagMeta[currentIncident.type].label }}
          </NDescriptionsItem>
          <NDescriptionsItem label="工单等级">
            {{ levelTagMeta[currentIncident.level].label }}
          </NDescriptionsItem>
          <NDescriptionsItem label="当前状态">
            {{ statusTagMeta[currentIncident.status].label }}
          </NDescriptionsItem>
          <NDescriptionsItem label="当前动作">
            {{ actionOptions[currentAction].label }}
          </NDescriptionsItem>
          <NDescriptionsItem label="发生时间">
            {{ currentIncident.occurredAt }}
          </NDescriptionsItem>
        </NDescriptions>
        <NForm :model="{ remark: handleRemark }" label-placement="left" :label-width="90">
          <NFormItem label="备注">
            <NInput
              v-model:value="handleRemark"
              type="textarea"
              placeholder="选填，最多 500 字"
              :maxlength="500"
              show-count
            />
          </NFormItem>
        </NForm>
        <div class="flex justify-end gap-12px">
          <NButton @click="closeHandleModal">取消</NButton>
          <NButton type="primary" :loading="handleSubmitting" @click="submitHandle">确认处理</NButton>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped></style>
