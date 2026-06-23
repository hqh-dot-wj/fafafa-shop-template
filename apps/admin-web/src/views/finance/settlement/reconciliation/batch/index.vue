<script setup lang="tsx">
import { reactive, ref } from 'vue';
import {
  NButton,
  NDatePicker,
  NDescriptions,
  NDescriptionsItem,
  NForm,
  NFormItem,
  NFormItemGi,
  NGrid,
  NModal,
  NSpace,
  NSelect,
  NSpin,
  NTag,
} from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import {
  fetchGetReconciliationBatchDetail,
  fetchGetReconciliationBatchList,
  fetchRerunReconciliationBatch,
  fetchRunReconciliationBatch,
} from '@/service/api/finance-center';
import { useTable, useTableProps } from '@/hooks/common/table';
import { useAppStore } from '@/store/modules/app';
import FinanceSearchCard from '../../../shared/finance-search-card.vue';
import {
  financeBizScopeOptions,
  financeChannelOptions,
  financeReconciliationBatchStatusOptions,
  getFinanceBizScopeLabel,
  getFinanceChannelLabel,
  getFinanceReconciliationBatchStatusLabel,
} from '../../../shared/finance-display';

defineOptions({
  name: 'FinanceSettlementReconciliationBatch',
});

const appStore = useAppStore();
const tableProps = useTableProps();
const { bool: runVisible, setTrue: openRunModal, setFalse: closeRunModal } = useBoolean(false);
const { bool: rerunVisible, setTrue: openRerunModal, setFalse: closeRerunModal } = useBoolean(false);
const { bool: detailVisible, setTrue: openDetailModal, setFalse: closeDetailModal } = useBoolean(false);

const currentBatch = ref<Api.FinanceCenter.ReconciliationBatch | null>(null);
const detailData = ref<Api.FinanceCenter.ReconciliationBatchDetail | null>(null);
const detailLoading = ref(false);
const submitting = ref(false);

const statusTagMap: Record<Api.FinanceCenter.ReconciliationBatchStatus, NaiveUI.ThemeColor> = {
  INIT: 'default',
  RUNNING: 'warning',
  COMPLETED: 'success',
  FAILED: 'error',
};

const runForm = reactive<Api.FinanceCenter.RunReconciliationBatchPayload>({
  batchDate: '',
  bizScope: 'PAYMENT',
  channelType: 'WECHAT_PAY',
  force: true,
});

const rerunForm = reactive<Api.FinanceCenter.RerunReconciliationBatchPayload>({
  clearOldResult: true,
});

const {
  columns,
  columnChecks,
  data,
  loading,
  mobilePagination,
  searchParams,
  getData,
  getDataByPage,
  resetSearchParams,
} = useTable({
  apiFn: fetchGetReconciliationBatchList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    batchDate: null,
    bizScope: null,
    channelType: null,
    status: null,
  },
  columns: () => [
    {
      key: 'batchDate',
      title: '对账日期',
      align: 'center',
      width: 120,
    },
    {
      key: 'bizScope',
      title: '业务范围',
      align: 'center',
      width: 100,
      render: (row: Api.FinanceCenter.ReconciliationBatch) => getFinanceBizScopeLabel(row.bizScope),
    },
    {
      key: 'channelType',
      title: '通道类型',
      align: 'center',
      width: 130,
      render: (row: Api.FinanceCenter.ReconciliationBatch) => getFinanceChannelLabel(row.channelType),
    },
    {
      key: 'status',
      title: '任务状态',
      align: 'center',
      width: 110,
      render: (row: Api.FinanceCenter.ReconciliationBatch) => (
        <NTag type={statusTagMap[row.status] ?? 'default'}>{getFinanceReconciliationBatchStatusLabel(row.status)}</NTag>
      ),
    },
    {
      key: 'summary',
      title: '任务结果',
      minWidth: 280,
      render: (row: Api.FinanceCenter.ReconciliationBatch) =>
        `共 ${row.totalCount} 笔，已匹配 ${row.matchedCount} 笔，异常 ${row.unmatchedCount} 笔，待复核 ${row.bufferedCount} 笔`,
    },
    {
      key: 'finishedAt',
      title: '完成时间',
      align: 'center',
      width: 168,
      render: (row: Api.FinanceCenter.ReconciliationBatch) => row.finishedAt || '-',
    },
    {
      key: 'operate',
      title: '操作',
      align: 'center',
      width: 180,
      render: (row: Api.FinanceCenter.ReconciliationBatch) => (
        <NSpace justify="center">
          <NButton text type="primary" onClick={() => handleViewDetail(row)}>
            查看
          </NButton>
          <NButton text type="warning" onClick={() => handleOpenRerun(row)}>
            重跑
          </NButton>
        </NSpace>
      ),
    },
  ],
});

function handleOpenRun() {
  runForm.batchDate = new Date().toISOString().slice(0, 10);
  runForm.bizScope = 'PAYMENT';
  runForm.channelType = 'WECHAT_PAY';
  runForm.force = true;
  openRunModal();
}

function handleOpenRerun(row: Api.FinanceCenter.ReconciliationBatch) {
  currentBatch.value = row;
  rerunForm.clearOldResult = true;
  openRerunModal();
}

async function handleViewDetail(row: Api.FinanceCenter.ReconciliationBatch) {
  currentBatch.value = row;
  detailLoading.value = true;
  openDetailModal();
  try {
    const { data: detail } = await fetchGetReconciliationBatchDetail(row.id);
    detailData.value = detail ?? null;
  } finally {
    detailLoading.value = false;
  }
}

async function submitRun() {
  submitting.value = true;
  try {
    await fetchRunReconciliationBatch(runForm);
    window.$message?.success('对账任务已发起');
    closeRunModal();
    await getData();
  } finally {
    submitting.value = false;
  }
}

async function submitRerun() {
  if (!currentBatch.value) return;

  submitting.value = true;
  try {
    await fetchRerunReconciliationBatch(currentBatch.value.id, rerunForm);
    window.$message?.success('对账任务已重跑');
    closeRerunModal();
    await getData();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <FinanceSearchCard collapse-name="reconciliation-batch-search">
      <NForm :model="searchParams" label-placement="left" :label-width="92">
        <NGrid responsive="screen" item-responsive :x-gap="16">
          <NFormItemGi span="24 s:12 m:8 l:6" label="对账日期" path="batchDate">
            <NDatePicker
              v-model:formatted-value="searchParams.batchDate"
              type="date"
              value-format="yyyy-MM-dd"
              clearable
              class="w-full"
            />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="业务范围" path="bizScope">
            <NSelect v-model:value="searchParams.bizScope" clearable placeholder="请选择业务范围" :options="financeBizScopeOptions" />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="通道类型" path="channelType">
            <NSelect v-model:value="searchParams.channelType" clearable placeholder="请选择通道类型" :options="financeChannelOptions" />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="任务状态" path="status">
            <NSelect
              v-model:value="searchParams.status"
              clearable
              placeholder="请选择任务状态"
              :options="financeReconciliationBatchStatusOptions"
            />
          </NFormItemGi>
          <NFormItemGi span="24">
            <NSpace class="w-full" justify="end">
              <NButton @click="resetSearchParams">重置</NButton>
              <NButton type="primary" ghost @click="getDataByPage">查询</NButton>
              <NButton type="success" @click="handleOpenRun">发起对账</NButton>
            </NSpace>
          </NFormItemGi>
        </NGrid>
      </NForm>
    </FinanceSearchCard>

    <NCard title="对账任务" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :loading="loading"
          :show-add="false"
          :show-delete="false"
          @refresh="getData"
        />
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        v-bind="tableProps"
        :flex-height="!appStore.isMobile"
        :loading="loading"
        :pagination="mobilePagination"
        :row-key="row => row.id"
        remote
        class="sm:h-full"
      />
    </NCard>

    <NModal v-model:show="runVisible" preset="card" title="发起对账任务" class="w-640px max-w-96%">
      <NForm :model="runForm" label-placement="left" label-width="110">
        <NFormItem label="对账日期">
          <NDatePicker
            v-model:formatted-value="runForm.batchDate"
            type="date"
            value-format="yyyy-MM-dd"
            class="w-full"
          />
        </NFormItem>
        <NFormItem label="业务范围">
          <NSelect v-model:value="runForm.bizScope" :options="financeBizScopeOptions" />
        </NFormItem>
        <NFormItem label="通道类型">
          <NSelect v-model:value="runForm.channelType" :options="financeChannelOptions" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="closeRunModal">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitRun">发起</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal
      v-model:show="rerunVisible"
      preset="dialog"
      title="重跑对账任务"
      positive-text="提交"
      negative-text="取消"
      @positive-click="submitRerun"
    >
      <NForm :model="rerunForm" label-placement="left">
        <NFormItem label="清理旧结果">
          <NTag type="warning">{{ rerunForm.clearOldResult ? '是' : '否' }}</NTag>
        </NFormItem>
      </NForm>
    </NModal>

    <NModal v-model:show="detailVisible" preset="card" title="对账任务详情" class="w-720px max-w-96%">
      <NSpin :show="detailLoading">
        <template v-if="detailData">
          <NDescriptions bordered label-placement="left" :column="2">
            <NDescriptionsItem label="对账日期">{{ detailData.batchDate }}</NDescriptionsItem>
            <NDescriptionsItem label="业务范围">{{ getFinanceBizScopeLabel(detailData.bizScope) }}</NDescriptionsItem>
            <NDescriptionsItem label="通道类型">{{ getFinanceChannelLabel(detailData.channelType) }}</NDescriptionsItem>
            <NDescriptionsItem label="任务状态">{{ getFinanceReconciliationBatchStatusLabel(detailData.status) }}</NDescriptionsItem>
            <NDescriptionsItem label="总笔数">{{ detailData.totalCount }}</NDescriptionsItem>
            <NDescriptionsItem label="已匹配">{{ detailData.matchedCount }}</NDescriptionsItem>
            <NDescriptionsItem label="正式异常">{{ detailData.unmatchedCount }}</NDescriptionsItem>
            <NDescriptionsItem label="待复核">{{ detailData.bufferedCount }}</NDescriptionsItem>
            <NDescriptionsItem label="关联账单批次">{{ detailData.statementBatch?.id || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="账单日期">{{ detailData.statementBatch?.statementDate || '-' }}</NDescriptionsItem>
          </NDescriptions>
        </template>
      </NSpin>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="closeDetailModal">关闭</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
