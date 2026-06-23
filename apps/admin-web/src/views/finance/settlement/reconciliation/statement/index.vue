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
  NInput,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NTag,
} from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import {
  fetchGetStatementBatchDetail,
  fetchGetStatementBatchList,
  fetchImportStatementBatch,
  fetchReparseStatementBatch,
} from '@/service/api/finance-center';
import { useAppStore } from '@/store/modules/app';
import { useTable, useTableProps } from '@/hooks/common/table';
import FinanceSearchCard from '../../../shared/finance-search-card.vue';
import {
  financeBizScopeOptions,
  financeChannelOptions,
  financeStatementBatchStatusOptions,
  financeStatementSourceTypeOptions,
  getFinanceBizScopeLabel,
  getFinanceChannelLabel,
  getFinanceStatementBatchStatusLabel,
  getFinanceStatementSourceTypeLabel,
} from '../../../shared/finance-display';

defineOptions({
  name: 'FinanceSettlementReconciliationStatement',
});

const appStore = useAppStore();
const tableProps = useTableProps();
const { bool: importVisible, setTrue: openImportModal, setFalse: closeImportModal } = useBoolean(false);
const { bool: detailVisible, setTrue: openDetailModal, setFalse: closeDetailModal } = useBoolean(false);
const { bool: reparseVisible, setTrue: openReparseModal, setFalse: closeReparseModal } = useBoolean(false);

const detailLoading = ref(false);
const submitting = ref(false);
const currentBatch = ref<Api.FinanceCenter.StatementBatch | null>(null);
const detailData = ref<Api.FinanceCenter.StatementBatchDetail | null>(null);

const statusTagMap: Record<Api.FinanceCenter.StatementBatchStatus, NaiveUI.ThemeColor> = {
  INIT: 'warning',
  NORMALIZED: 'success',
  FAILED: 'error',
};

const importForm = reactive<Api.FinanceCenter.ImportStatementPayload>({
  statementDate: '',
  bizScope: 'PAYMENT',
  channelType: 'WECHAT_PAY',
  sourceType: 'GENERATED',
  fileName: '',
  remark: '',
});

const reparseForm = reactive<Api.FinanceCenter.ReparseStatementBatchPayload>({
  force: true,
  remark: '',
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
  apiFn: fetchGetStatementBatchList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    statementDate: null,
    bizScope: null,
    channelType: null,
    status: null,
  },
  columns: () => [
    {
      key: 'statementDate',
      title: '账单日期',
      align: 'center',
      width: 120,
    },
    {
      key: 'bizScope',
      title: '业务范围',
      align: 'center',
      width: 100,
      render: (row: Api.FinanceCenter.StatementBatch) => getFinanceBizScopeLabel(row.bizScope),
    },
    {
      key: 'channelType',
      title: '通道类型',
      align: 'center',
      width: 130,
      render: (row: Api.FinanceCenter.StatementBatch) => getFinanceChannelLabel(row.channelType),
    },
    {
      key: 'sourceType',
      title: '账单来源',
      align: 'center',
      width: 120,
      render: (row: Api.FinanceCenter.StatementBatch) => getFinanceStatementSourceTypeLabel(row.sourceType),
    },
    {
      key: 'importedCount',
      title: '成功行数',
      align: 'center',
      width: 100,
    },
    {
      key: 'failedCount',
      title: '失败行数',
      align: 'center',
      width: 100,
    },
    {
      key: 'status',
      title: '处理状态',
      align: 'center',
      width: 110,
      render: (row: Api.FinanceCenter.StatementBatch) => (
        <NTag type={statusTagMap[row.status] ?? 'default'}>{getFinanceStatementBatchStatusLabel(row.status)}</NTag>
      ),
    },
    {
      key: 'operate',
      title: '操作',
      align: 'center',
      width: 180,
      render: (row: Api.FinanceCenter.StatementBatch) => (
        <NSpace justify="center">
          <NButton text type="primary" onClick={() => handleViewDetail(row)}>
            查看
          </NButton>
          <NButton text type="warning" onClick={() => handleOpenReparse(row)}>
            重解析
          </NButton>
        </NSpace>
      ),
    },
  ],
});

async function handleViewDetail(row: Api.FinanceCenter.StatementBatch) {
  currentBatch.value = row;
  detailLoading.value = true;
  openDetailModal();
  try {
    const { data: detail } = await fetchGetStatementBatchDetail(row.id);
    detailData.value = detail ?? null;
  } finally {
    detailLoading.value = false;
  }
}

function handleOpenImport() {
  importForm.statementDate = new Date().toISOString().slice(0, 10);
  importForm.bizScope = 'PAYMENT';
  importForm.channelType = 'WECHAT_PAY';
  importForm.sourceType = 'GENERATED';
  importForm.fileName = '';
  importForm.remark = '';
  openImportModal();
}

function handleOpenReparse(row: Api.FinanceCenter.StatementBatch) {
  currentBatch.value = row;
  reparseForm.force = true;
  reparseForm.remark = '';
  openReparseModal();
}

async function submitImport() {
  submitting.value = true;
  try {
    await fetchImportStatementBatch(importForm);
    window.$message?.success('渠道账单已导入');
    closeImportModal();
    await getData();
  } finally {
    submitting.value = false;
  }
}

async function submitReparse() {
  if (!currentBatch.value) return;

  submitting.value = true;
  try {
    await fetchReparseStatementBatch(currentBatch.value.id, reparseForm);
    window.$message?.success('账单批次已重新解析');
    closeReparseModal();
    await getData();
  } finally {
    submitting.value = false;
  }
}

function formatStatementAmount(value?: number | null) {
  return value === null || value === undefined ? '-' : `¥${Number(value).toFixed(2)}`;
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <FinanceSearchCard collapse-name="reconciliation-statement-search">
      <NForm :model="searchParams" label-placement="left" :label-width="92">
        <NGrid responsive="screen" item-responsive :x-gap="16">
          <NFormItemGi span="24 s:12 m:8 l:6" label="账单日期" path="statementDate">
            <NDatePicker
              v-model:formatted-value="searchParams.statementDate"
              type="date"
              value-format="yyyy-MM-dd"
              clearable
              class="w-full"
            />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="业务范围" path="bizScope">
            <NSelect
              v-model:value="searchParams.bizScope"
              clearable
              placeholder="请选择业务范围"
              :options="financeBizScopeOptions"
            />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="通道类型" path="channelType">
            <NSelect
              v-model:value="searchParams.channelType"
              clearable
              placeholder="请选择通道类型"
              :options="financeChannelOptions"
            />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="处理状态" path="status">
            <NSelect
              v-model:value="searchParams.status"
              clearable
              placeholder="请选择处理状态"
              :options="financeStatementBatchStatusOptions"
            />
          </NFormItemGi>
          <NFormItemGi span="24">
            <NSpace class="w-full" justify="end">
              <NButton @click="resetSearchParams">重置</NButton>
              <NButton type="primary" ghost @click="getDataByPage">查询</NButton>
              <NButton type="success" @click="handleOpenImport">导入账单</NButton>
            </NSpace>
          </NFormItemGi>
        </NGrid>
      </NForm>
    </FinanceSearchCard>

    <NCard title="渠道账单" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
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
        :row-key="(row) => row.id"
        remote
        class="sm:h-full"
      />
    </NCard>

    <NModal v-model:show="importVisible" preset="card" title="导入渠道账单" class="max-w-96% w-640px">
      <NForm :model="importForm" label-placement="left" label-width="110">
        <NFormItem label="账单日期">
          <NDatePicker
            v-model:formatted-value="importForm.statementDate"
            type="date"
            value-format="yyyy-MM-dd"
            class="w-full"
          />
        </NFormItem>
        <NFormItem label="业务范围">
          <NSelect v-model:value="importForm.bizScope" :options="financeBizScopeOptions" />
        </NFormItem>
        <NFormItem label="通道类型">
          <NSelect v-model:value="importForm.channelType" :options="financeChannelOptions" />
        </NFormItem>
        <NFormItem label="账单来源">
          <NSelect v-model:value="importForm.sourceType" :options="financeStatementSourceTypeOptions" />
        </NFormItem>
        <NFormItem label="文件名">
          <NInput v-model:value="importForm.fileName" placeholder="请输入账单文件名" />
        </NFormItem>
        <NFormItem label="备注说明">
          <NInput v-model:value="importForm.remark" type="textarea" :rows="3" placeholder="请输入导入说明" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="closeImportModal">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitImport">导入</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal
      v-model:show="reparseVisible"
      preset="dialog"
      title="重新解析账单"
      positive-text="提交"
      negative-text="取消"
      @positive-click="submitReparse"
    >
      <NForm :model="reparseForm" label-placement="left">
        <NFormItem label="备注说明">
          <NInput v-model:value="reparseForm.remark" type="textarea" :rows="3" placeholder="请输入重解析原因" />
        </NFormItem>
      </NForm>
    </NModal>

    <NModal v-model:show="detailVisible" preset="card" title="账单批次详情" class="max-w-96% w-960px">
      <NSpin :show="detailLoading">
        <template v-if="detailData">
          <NDescriptions bordered label-placement="left" :column="2" class="mb-16px">
            <NDescriptionsItem label="账单日期">{{ detailData.statementDate }}</NDescriptionsItem>
            <NDescriptionsItem label="业务范围">{{ getFinanceBizScopeLabel(detailData.bizScope) }}</NDescriptionsItem>
            <NDescriptionsItem label="通道类型">{{ getFinanceChannelLabel(detailData.channelType) }}</NDescriptionsItem>
            <NDescriptionsItem label="处理状态">{{
              getFinanceStatementBatchStatusLabel(detailData.status)
            }}</NDescriptionsItem>
            <NDescriptionsItem label="成功行数">{{ detailData.importedCount }}</NDescriptionsItem>
            <NDescriptionsItem label="失败行数">{{ detailData.failedCount }}</NDescriptionsItem>
          </NDescriptions>
          <NDataTable
            :columns="[
              { key: 'outBizNo', title: '本地单号', minWidth: 180, ellipsis: { tooltip: true } },
              { key: 'transactionId', title: '交易流水号', minWidth: 180, ellipsis: { tooltip: true } },
              { key: 'externalNo', title: '渠道单号', minWidth: 180, ellipsis: { tooltip: true } },
              {
                key: 'amount',
                title: '金额',
                width: 100,
                render: (row) => formatStatementAmount(row.amount),
              },
              {
                key: 'payerRefundAmount',
                title: '用户退款',
                width: 110,
                render: (row) => formatStatementAmount(row.payerRefundAmount),
              },
              {
                key: 'settlementRefundAmount',
                title: '结算退款',
                width: 110,
                render: (row) => formatStatementAmount(row.settlementRefundAmount),
              },
              {
                key: 'refundFeeAmount',
                title: '手续费',
                width: 100,
                render: (row) => formatStatementAmount(row.refundFeeAmount),
              },
              {
                key: 'discountRefundAmount',
                title: '优惠退款',
                width: 110,
                render: (row) => formatStatementAmount(row.discountRefundAmount),
              },
              {
                key: 'netAmount',
                title: '净额',
                width: 100,
                render: (row) => formatStatementAmount(row.netAmount),
              },
              {
                key: 'status',
                title: '状态',
                width: 120,
                render: (row) => row.status || '-',
              },
              { key: 'tradeTime', title: '交易时间', width: 170 },
            ]"
            :data="detailData.lines"
            :pagination="false"
            size="small"
          />
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
