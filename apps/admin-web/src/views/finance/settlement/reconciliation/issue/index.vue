<script setup lang="tsx">
import { reactive, ref } from 'vue';
import {
  NButton,
  NDescriptions,
  NDescriptionsItem,
  NForm,
  NFormItem,
  NFormItemGi,
  NGrid,
  NInput,
  NModal,
  NSpace,
  NSelect,
  NSpin,
  NTag,
} from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import {
  fetchGetReconciliationIssueDetail,
  fetchGetReconciliationIssueList,
  fetchHandleReconciliationIssue,
} from '@/service/api/finance-center';
import { useTable, useTableProps } from '@/hooks/common/table';
import { useAppStore } from '@/store/modules/app';
import FinanceSearchCard from '../../../shared/finance-search-card.vue';
import {
  financeReconciliationIssueHandleActionOptions,
  financeReconciliationIssueStatusOptions,
  getFinanceBizScopeLabel,
  getFinanceChannelLabel,
  getFinanceIssueTypeLabel,
  getFinanceReconciliationIssueStatusLabel,
  getFinanceSettlementBillStatusLabel,
  getFinanceSettlementExecutionStatusLabel,
  getFinanceTenantLabel,
} from '../../../shared/finance-display';
import { useFinanceTenantLabels } from '../../../shared/use-finance-tenant-labels';

defineOptions({
  name: 'FinanceSettlementReconciliationIssue',
});

const appStore = useAppStore();
const tableProps = useTableProps();
const { bool: handleVisible, setTrue: openHandleModal, setFalse: closeHandleModal } = useBoolean(false);
const { bool: detailVisible, setTrue: openDetailModal, setFalse: closeDetailModal } = useBoolean(false);
const { tenantLabelMap, tenantOptions } = useFinanceTenantLabels();

const detailData = ref<Api.FinanceCenter.ReconciliationIssueDetail | null>(null);
const detailLoading = ref(false);
const submitting = ref(false);

const statusTagMap: Record<Api.FinanceCenter.ReconciliationStatus, NaiveUI.ThemeColor> = {
  WAITING: 'warning',
  MATCHED: 'success',
  UNMATCHED: 'error',
  HANDLED: 'default',
};

const handleForm = reactive<Api.FinanceCenter.HandleReconciliationIssuePayload>({
  issueId: '',
  action: 'MARK_SUCCESS',
  externalNo: '',
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
  apiFn: fetchGetReconciliationIssueList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    tenantId: null,
    status: null,
    issueType: null,
    billNo: null,
    orderSn: null,
  },
  columns: () => [
    {
      key: 'tenantId',
      title: '所属租户',
      minWidth: 220,
      render: (row: Api.FinanceCenter.ReconciliationIssue) => (
        <div class="leading-5">
          <div>{getFinanceTenantLabel(row.tenantId, tenantLabelMap.value)}</div>
          <div class="text-12px text-gray-500">{row.tenantId}</div>
        </div>
      ),
    },
    {
      key: 'orderSn',
      title: '订单号',
      minWidth: 180,
      ellipsis: { tooltip: true },
      render: (row: Api.FinanceCenter.ReconciliationIssue) => row.orderSn || '-',
    },
    {
      key: 'billNo',
      title: '结算单号',
      minWidth: 180,
      ellipsis: { tooltip: true },
      render: (row: Api.FinanceCenter.ReconciliationIssue) => row.billNo || row.localBizNo || '-',
    },
    {
      key: 'issueType',
      title: '异常类型',
      align: 'center',
      width: 140,
      render: (row: Api.FinanceCenter.ReconciliationIssue) => getFinanceIssueTypeLabel(row.issueType),
    },
    {
      key: 'channelType',
      title: '结算方式',
      align: 'center',
      width: 130,
      render: (row: Api.FinanceCenter.ReconciliationIssue) => getFinanceChannelLabel(row.channelType),
    },
    {
      key: 'status',
      title: '处理状态',
      align: 'center',
      width: 110,
      render: (row: Api.FinanceCenter.ReconciliationIssue) => (
        <NTag type={statusTagMap[row.status] ?? 'default'}>{getFinanceReconciliationIssueStatusLabel(row.status)}</NTag>
      ),
    },
    {
      key: 'issueReason',
      title: '异常说明',
      minWidth: 240,
      ellipsis: { tooltip: true },
      render: (row: Api.FinanceCenter.ReconciliationIssue) => row.issueReason || '-',
    },
    {
      key: 'handledRemark',
      title: '处理备注',
      minWidth: 220,
      ellipsis: { tooltip: true },
      render: (row: Api.FinanceCenter.ReconciliationIssue) => row.handledRemark || '-',
    },
    {
      key: 'createTime',
      title: '发现时间',
      align: 'center',
      width: 168,
    },
    {
      key: 'operate',
      title: '操作',
      align: 'center',
      width: 180,
      render: (row: Api.FinanceCenter.ReconciliationIssue) => (
        <NSpace justify="center">
          <NButton text type="primary" onClick={() => handleViewDetail(row)}>
            查看
          </NButton>
          {row.status === 'MATCHED' || row.status === 'HANDLED' ? (
            <span class="text-gray-400">已完成</span>
          ) : (
            <NButton text type="warning" onClick={() => handleOpen(row)}>
              处理
            </NButton>
          )}
        </NSpace>
      ),
    },
  ],
});

function handleOpen(row: Api.FinanceCenter.ReconciliationIssue) {
  handleForm.issueId = row.id;
  handleForm.action = 'MARK_SUCCESS';
  handleForm.externalNo = row.externalNo || '';
  handleForm.remark = row.issueReason || '';
  openHandleModal();
}

async function handleViewDetail(row: Api.FinanceCenter.ReconciliationIssue) {
  detailLoading.value = true;
  openDetailModal();
  try {
    const { data: detail } = await fetchGetReconciliationIssueDetail(row.id);
    detailData.value = detail ?? null;
  } finally {
    detailLoading.value = false;
  }
}

async function handleSubmit() {
  submitting.value = true;
  try {
    await fetchHandleReconciliationIssue(handleForm);
    window.$message?.success('异常账单已处理');
    closeHandleModal();
    await getData();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <FinanceSearchCard collapse-name="reconciliation-issue-search">
      <NForm :model="searchParams" label-placement="left" :label-width="92">
        <NGrid responsive="screen" item-responsive :x-gap="16">
          <NFormItemGi span="24 s:12 m:8 l:6" label="所属租户" path="tenantId">
            <NSelect
              v-model:value="searchParams.tenantId"
              clearable
              filterable
              placeholder="请选择租户"
              :options="tenantOptions"
            />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="订单号" path="orderSn">
            <NInput v-model:value="searchParams.orderSn" placeholder="请输入订单号" clearable />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="结算单号" path="billNo">
            <NInput v-model:value="searchParams.billNo" placeholder="请输入结算单号" clearable />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="处理状态" path="status">
            <NSelect
              v-model:value="searchParams.status"
              clearable
              placeholder="请选择处理状态"
              :options="financeReconciliationIssueStatusOptions"
            />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="异常类型" path="issueType">
            <NInput v-model:value="searchParams.issueType" placeholder="请输入异常类型编码" clearable />
          </NFormItemGi>
          <NFormItemGi span="24">
            <NSpace class="w-full" justify="end">
              <NButton @click="resetSearchParams">重置</NButton>
              <NButton type="primary" ghost @click="getDataByPage">查询</NButton>
            </NSpace>
          </NFormItemGi>
        </NGrid>
      </NForm>
    </FinanceSearchCard>

    <NCard title="异常账单" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
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

    <NModal
      v-model:show="handleVisible"
      preset="dialog"
      title="处理异常账单"
      positive-text="提交"
      negative-text="取消"
      @positive-click="handleSubmit"
    >
      <NForm :model="handleForm" label-placement="left">
        <NFormItem label="处理动作">
          <NSelect v-model:value="handleForm.action" :options="financeReconciliationIssueHandleActionOptions" />
        </NFormItem>
        <NFormItem label="外部流水号">
          <NInput v-model:value="handleForm.externalNo" placeholder="如已拿到回单，可在这里回填" />
        </NFormItem>
        <NFormItem label="处理备注">
          <NInput v-model:value="handleForm.remark" type="textarea" :rows="3" placeholder="请输入处理说明" />
        </NFormItem>
      </NForm>
    </NModal>

    <NModal v-model:show="detailVisible" preset="card" title="异常账单详情" class="w-760px max-w-96%">
      <NSpin :show="detailLoading">
        <template v-if="detailData">
          <NDescriptions bordered label-placement="left" :column="2">
            <NDescriptionsItem label="异常ID">{{ detailData.id }}</NDescriptionsItem>
            <NDescriptionsItem label="处理状态">{{ getFinanceReconciliationIssueStatusLabel(detailData.status) }}</NDescriptionsItem>
            <NDescriptionsItem label="所属租户">
              {{ getFinanceTenantLabel(detailData.tenantId, tenantLabelMap) }}
            </NDescriptionsItem>
            <NDescriptionsItem label="业务范围">{{ getFinanceBizScopeLabel(detailData.bizScope) }}</NDescriptionsItem>
            <NDescriptionsItem label="订单号">{{ detailData.orderSn || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="结算单号">{{ detailData.billNo || detailData.localBizNo || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="执行单号">{{ detailData.executeNo || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道单号">{{ detailData.channelBizNo || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="交易流水">{{ detailData.transactionId || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="结算方式">{{ getFinanceChannelLabel(detailData.channelType) }}</NDescriptionsItem>
            <NDescriptionsItem label="结算单状态">
              {{ detailData.billStatus ? getFinanceSettlementBillStatusLabel(detailData.billStatus) : '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="执行状态">
              {{ detailData.executionStatus ? getFinanceSettlementExecutionStatusLabel(detailData.executionStatus) : '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="异常类型">{{ getFinanceIssueTypeLabel(detailData.issueType) }}</NDescriptionsItem>
            <NDescriptionsItem label="差异金额">
              {{ detailData.diffAmount == null ? '-' : `¥${Number(detailData.diffAmount).toFixed(2)}` }}
            </NDescriptionsItem>
            <NDescriptionsItem label="处理人">{{ detailData.handledBy || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="处理时间">{{ detailData.handledTime || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="异常说明" :span="2">{{ detailData.issueReason || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="处理备注" :span="2">{{ detailData.handledRemark || '-' }}</NDescriptionsItem>
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
