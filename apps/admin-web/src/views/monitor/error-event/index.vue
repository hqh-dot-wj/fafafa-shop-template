<script setup lang="tsx">
import { ref } from 'vue';
import {
  NButton,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NTag,
  NText,
  NTimeline,
  NTimelineItem,
} from 'naive-ui';
import { ERROR_EVENT_APP_SELECT_OPTIONS, ERROR_EVENT_LEVEL_SELECT_OPTIONS } from '@libs/common-constants';
import { fetchGetErrorEventList, fetchGetErrorEventSteps } from '@/service/api/monitor/error-event';
import { reportActionError } from '@/service/request/error-monitoring';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { useTable } from '@/hooks/common/table';
import ButtonIcon from '@/components/custom/button-icon.vue';

defineOptions({
  name: 'ErrorEventList',
});

const appStore = useAppStore();
const { hasAuth } = useAuth();

const selectedEvent = ref<Api.Monitor.ErrorEvent | null>(null);
const detailVisible = ref(false);
const stepsVisible = ref(false);
const stepsLoading = ref(false);
const steps = ref<Api.Monitor.StepEvent[]>([]);

const {
  columns,
  columnChecks,
  data,
  getData,
  getDataByPage,
  loading,
  mobilePagination,
  scrollX,
  searchParams,
  resetSearchParams,
} = useTable({
  apiFn: fetchGetErrorEventList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    app: null,
    level: null,
    traceId: null,
    requestId: null,
    errorId: null,
    operationCode: null,
    stepCode: null,
    errorCode: null,
    tenantId: null,
  },
  columns: () => [
    {
      key: 'level',
      title: '级别',
      align: 'center',
      width: 90,
      render: (row) => <NTag type={row.level === 'warn' ? 'warning' : 'error'}>{row.level}</NTag>,
    },
    {
      key: 'app',
      title: '应用',
      align: 'center',
      minWidth: 120,
    },
    {
      key: 'safeMessage',
      title: '错误提示',
      align: 'left',
      minWidth: 220,
      ellipsis: { tooltip: true },
    },
    {
      key: 'operationCode',
      title: '业务动作',
      align: 'left',
      minWidth: 180,
      ellipsis: { tooltip: true },
    },
    {
      key: 'stepCode',
      title: '失败步骤',
      align: 'left',
      minWidth: 220,
      ellipsis: { tooltip: true },
    },
    {
      key: 'errorId',
      title: '错误ID',
      align: 'left',
      minWidth: 240,
      ellipsis: { tooltip: true },
    },
    {
      key: 'traceId',
      title: 'Trace ID',
      align: 'left',
      minWidth: 240,
      ellipsis: { tooltip: true },
    },
    {
      key: 'tenantId',
      title: '租户',
      align: 'center',
      width: 100,
    },
    {
      key: 'createTime',
      title: '发生时间',
      align: 'center',
      minWidth: 170,
    },
    {
      key: 'operate',
      title: '操作',
      align: 'center',
      fixed: 'right',
      width: 150,
      render: (row) => (
        <div class="flex-center gap-8px">
          <ButtonIcon
            text
            type="primary"
            icon="material-symbols:visibility-outline"
            tooltipContent="详情"
            onClick={() => openDetail(row)}
          />
          {hasAuth('monitor:error-event:query') && (
            <ButtonIcon
              text
              type="primary"
              icon="material-symbols:timeline-outline"
              tooltipContent="步骤"
              onClick={() => openSteps(row)}
            />
          )}
          <ButtonIcon
            text
            icon="material-symbols:content-copy-outline"
            tooltipContent="复制错误ID"
            onClick={() => copyText(row.errorId)}
          />
        </div>
      ),
    },
  ],
});

function openDetail(row: Api.Monitor.ErrorEvent) {
  selectedEvent.value = row;
  detailVisible.value = true;
}

async function openSteps(row: Api.Monitor.ErrorEvent) {
  selectedEvent.value = row;
  stepsVisible.value = true;
  stepsLoading.value = true;
  try {
    const { data: stepData } = await fetchGetErrorEventSteps(row.errorId);
    steps.value = stepData?.rows ?? [];
  } catch (error) {
    reportActionError(error, {
      module: 'monitor-error-event',
      operationCode: 'errorEvent.steps',
      stepCode: 'errorEvent.steps.load',
      stepName: '加载错误关联步骤',
      metadata: { errorId: row.errorId },
    });
  } finally {
    stepsLoading.value = false;
  }
}

async function copyText(text?: string) {
  if (!text) return;
  await navigator.clipboard?.writeText(text);
  window.$message?.success('已复制');
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NForm
      :model="searchParams"
      label-placement="left"
      :show-feedback="false"
      class="grid grid-cols-1 gap-12px md:grid-cols-4"
    >
      <NFormItem label="应用">
        <NSelect v-model:value="searchParams.app" clearable :options="ERROR_EVENT_APP_SELECT_OPTIONS" />
      </NFormItem>
      <NFormItem label="级别">
        <NSelect v-model:value="searchParams.level" clearable :options="ERROR_EVENT_LEVEL_SELECT_OPTIONS" />
      </NFormItem>
      <NFormItem label="Trace ID">
        <NInput v-model:value="searchParams.traceId" clearable />
      </NFormItem>
      <NFormItem label="错误ID">
        <NInput v-model:value="searchParams.errorId" clearable />
      </NFormItem>
      <NFormItem label="业务动作">
        <NInput v-model:value="searchParams.operationCode" clearable />
      </NFormItem>
      <NFormItem label="步骤编码">
        <NInput v-model:value="searchParams.stepCode" clearable />
      </NFormItem>
      <NFormItem label="错误码">
        <NInput v-model:value="searchParams.errorCode" clearable />
      </NFormItem>
      <NFormItem label="租户">
        <NInput v-model:value="searchParams.tenantId" clearable />
      </NFormItem>
    </NForm>

    <NCard title="错误事件" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :loading="loading"
          :show-add="false"
          :show-delete="false"
          :show-export="false"
          @refresh="getData"
        >
          <template #prefix>
            <NButton size="small" type="primary" ghost @click="() => getDataByPage()">查询</NButton>
            <NButton size="small" @click="resetSearchParams">重置</NButton>
          </template>
        </TableHeaderOperation>
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        size="small"
        :flex-height="!appStore.isMobile"
        :scroll-x="scrollX"
        :loading="loading"
        remote
        :row-key="(row) => row.id"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
    </NCard>

    <NDrawer v-model:show="detailVisible" :width="appStore.isMobile ? '100%' : 720">
      <NDrawerContent title="错误详情">
        <NDescriptions v-if="selectedEvent" :column="1" bordered size="small">
          <NDescriptionsItem label="错误ID">{{ selectedEvent.errorId }}</NDescriptionsItem>
          <NDescriptionsItem label="Trace ID">{{ selectedEvent.traceId || '-' }}</NDescriptionsItem>
          <NDescriptionsItem label="请求ID">{{ selectedEvent.requestId || '-' }}</NDescriptionsItem>
          <NDescriptionsItem label="应用">{{ selectedEvent.app }}</NDescriptionsItem>
          <NDescriptionsItem label="业务动作">{{ selectedEvent.operationCode || '-' }}</NDescriptionsItem>
          <NDescriptionsItem label="失败步骤">{{ selectedEvent.stepCode || '-' }}</NDescriptionsItem>
          <NDescriptionsItem label="步骤名称">{{ selectedEvent.stepName || '-' }}</NDescriptionsItem>
          <NDescriptionsItem label="安全提示">{{ selectedEvent.safeMessage }}</NDescriptionsItem>
          <NDescriptionsItem label="技术信息">
            <NText depth="3">{{ selectedEvent.technicalMessage || '-' }}</NText>
          </NDescriptionsItem>
          <NDescriptionsItem label="堆栈">
            <pre class="max-h-260px overflow-auto whitespace-pre-wrap text-12px">{{ selectedEvent.stack || '-' }}</pre>
          </NDescriptionsItem>
        </NDescriptions>
      </NDrawerContent>
    </NDrawer>

    <NDrawer v-model:show="stepsVisible" :width="appStore.isMobile ? '100%' : 680">
      <NDrawerContent title="步骤链路">
        <NTimeline v-if="steps.length">
          <NTimelineItem
            v-for="step in steps"
            :key="step.id"
            :type="step.status === 'FAILED' ? 'error' : 'success'"
            :title="`${step.stepName}（${step.status}）`"
            :time="step.createTime"
          >
            <div class="text-12px leading-20px">
              <div>步骤：{{ step.stepCode }}</div>
              <div>动作：{{ step.operationCode }}</div>
              <div>耗时：{{ step.durationMs ?? '-' }} ms</div>
              <div v-if="step.message">消息：{{ step.message }}</div>
            </div>
          </NTimelineItem>
        </NTimeline>
        <NText v-else depth="3">{{ stepsLoading ? '加载中' : '暂无步骤事件' }}</NText>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>
