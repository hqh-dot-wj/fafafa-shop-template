<script setup lang="tsx">
import { ref } from 'vue';
import {
  NButton,
  NDescriptions,
  NDescriptionsItem,
  NForm,
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
  fetchExportReconciliationResults,
  fetchGetReconciliationResultDetail,
  fetchGetReconciliationResultList,
} from '@/service/api/finance-center';
import { useAppStore } from '@/store/modules/app';
import { useTable, useTableProps } from '@/hooks/common/table';
import { formatPrice } from '@/utils/money';
import FinanceSearchCard from '../../../shared/finance-search-card.vue';
import {
  financeBizScopeOptions,
  financeChannelOptions,
  financeReconciliationResultStatusOptions,
  getFinanceBizScopeLabel,
  getFinanceChannelLabel,
  getFinanceReasonCodeLabel,
  getFinanceReconciliationResultStatusLabel,
  getFinanceTenantLabel,
} from '../../../shared/finance-display';
import { useFinanceTenantLabels } from '../../../shared/use-finance-tenant-labels';

defineOptions({
  name: 'FinanceSettlementReconciliationResult',
});

const appStore = useAppStore();
const tableProps = useTableProps();
const { bool: detailVisible, setTrue: openDetailModal, setFalse: closeDetailModal } = useBoolean(false);
const { tenantLabelMap, tenantOptions } = useFinanceTenantLabels();

const detailLoading = ref(false);
const exportLoading = ref(false);
const detailData = ref<Api.FinanceCenter.ReconciliationResult | null>(null);

const statusTagMap: Record<Api.FinanceCenter.ReconciliationResultStatus, NaiveUI.ThemeColor> = {
  MATCHED: 'success',
  UNMATCHED: 'error',
  BUFFERED: 'warning',
  IGNORED: 'default',
};

function formatBreakdownAmount(value?: number | string | null) {
  return value === null || value === undefined ? '-' : `¥${formatPrice(Number(value))}`;
}

function formatRefundBreakdown(breakdown?: Api.FinanceCenter.RefundAmountBreakdown | null) {
  if (!breakdown) return '-';

  return `用户退款 ${formatBreakdownAmount(breakdown.payerRefundAmount)} / 结算退款 ${formatBreakdownAmount(
    breakdown.settlementRefundAmount,
  )} / 手续费 ${formatBreakdownAmount(breakdown.refundFeeAmount)} / 优惠退款 ${formatBreakdownAmount(
    breakdown.discountRefundAmount,
  )} / 净额 ${formatBreakdownAmount(breakdown.netAmount)}`;
}

function renderAmountCheck(row: Api.FinanceCenter.ReconciliationResult) {
  if (row.bizScope === 'REFUND' && (row.localAmountBreakdown || row.channelAmountBreakdown)) {
    return (
      <div class="text-left leading-5">
        <div>
          本地 {formatBreakdownAmount(row.localAmountBreakdown?.payerRefundAmount)} / 渠道{' '}
          {formatBreakdownAmount(row.channelAmountBreakdown?.payerRefundAmount)}
        </div>
        <div class="text-12px text-gray-500">
          手续费 {formatBreakdownAmount(row.localAmountBreakdown?.refundFeeAmount)} /{' '}
          {formatBreakdownAmount(row.channelAmountBreakdown?.refundFeeAmount)}，净额{' '}
          {formatBreakdownAmount(row.localAmountBreakdown?.netAmount)} /{' '}
          {formatBreakdownAmount(row.channelAmountBreakdown?.netAmount)}
        </div>
      </div>
    );
  }

  return `${row.localAmount === null || row.localAmount === undefined ? '本地 -' : `本地 ¥${formatPrice(row.localAmount)}`} / ${
    row.channelAmount === null || row.channelAmount === undefined ? '渠道 -' : `渠道 ¥${formatPrice(row.channelAmount)}`
  }`;
}

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
  apiFn: fetchGetReconciliationResultList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    batchId: null,
    bizScope: null,
    channelType: null,
    status: null,
    reasonCode: null,
    tenantId: null,
    localBizNo: null,
    channelBizNo: null,
  },
  columns: () => [
    {
      key: 'tenantId',
      title: '所属租户',
      minWidth: 220,
      render: (row: Api.FinanceCenter.ReconciliationResult) =>
        row.tenantId ? (
          <div class="leading-5">
            <div>{getFinanceTenantLabel(row.tenantId, tenantLabelMap.value)}</div>
            <div class="text-12px text-gray-500">{row.tenantId}</div>
          </div>
        ) : (
          '-'
        ),
    },
    {
      key: 'bizScope',
      title: '业务范围',
      align: 'center',
      width: 100,
      render: (row: Api.FinanceCenter.ReconciliationResult) => getFinanceBizScopeLabel(row.bizScope),
    },
    {
      key: 'localBizNo',
      title: '本地单号',
      minWidth: 180,
      ellipsis: { tooltip: true },
      render: (row: Api.FinanceCenter.ReconciliationResult) => row.localBizNo || '-',
    },
    {
      key: 'channelBizNo',
      title: '渠道单号',
      minWidth: 180,
      ellipsis: { tooltip: true },
      render: (row: Api.FinanceCenter.ReconciliationResult) => row.channelBizNo || '-',
    },
    {
      key: 'channelType',
      title: '支付/结算通道',
      align: 'center',
      width: 130,
      render: (row: Api.FinanceCenter.ReconciliationResult) => getFinanceChannelLabel(row.channelType),
    },
    {
      key: 'amount',
      title: '金额核对',
      minWidth: 220,
      render: renderAmountCheck,
    },
    {
      key: 'status',
      title: '核对结果',
      align: 'center',
      width: 110,
      render: (row: Api.FinanceCenter.ReconciliationResult) => (
        <NTag type={statusTagMap[row.status] ?? 'default'}>
          {getFinanceReconciliationResultStatusLabel(row.status)}
        </NTag>
      ),
    },
    {
      key: 'reasonCode',
      title: '结果说明',
      minWidth: 160,
      render: (row: Api.FinanceCenter.ReconciliationResult) => getFinanceReasonCodeLabel(row.reasonCode),
    },
    {
      key: 'matchedAt',
      title: '核对时间',
      align: 'center',
      width: 168,
      render: (row: Api.FinanceCenter.ReconciliationResult) => row.matchedAt || '-',
    },
    {
      key: 'operate',
      title: '操作',
      align: 'center',
      width: 100,
      render: (row: Api.FinanceCenter.ReconciliationResult) => (
        <NButton text type="primary" onClick={() => handleViewDetail(row.id)}>
          查看
        </NButton>
      ),
    },
  ],
});

async function handleViewDetail(id: string) {
  detailLoading.value = true;
  openDetailModal();
  try {
    const { data: detail } = await fetchGetReconciliationResultDetail(id);
    detailData.value = detail ?? null;
  } finally {
    detailLoading.value = false;
  }
}

async function handleExport() {
  exportLoading.value = true;
  try {
    const { data: rows } = await fetchExportReconciliationResults(searchParams);
    const blob = new Blob([JSON.stringify(rows ?? [], null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance-reconcile-result-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    window.$message?.success('核对结果已导出');
  } finally {
    exportLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <FinanceSearchCard collapse-name="reconciliation-result-search">
      <NForm :model="searchParams" label-placement="left" :label-width="92">
        <NGrid responsive="screen" item-responsive :x-gap="16">
          <NFormItemGi span="24 s:12 m:8 l:6" label="对账批次ID" path="batchId">
            <NInput v-model:value="searchParams.batchId" placeholder="请输入批次ID" clearable />
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
          <NFormItemGi span="24 s:12 m:8 l:6" label="核对结果" path="status">
            <NSelect
              v-model:value="searchParams.status"
              clearable
              placeholder="请选择核对结果"
              :options="financeReconciliationResultStatusOptions"
            />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="所属租户" path="tenantId">
            <NSelect
              v-model:value="searchParams.tenantId"
              clearable
              filterable
              placeholder="请选择租户"
              :options="tenantOptions"
            />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="本地单号" path="localBizNo">
            <NInput v-model:value="searchParams.localBizNo" placeholder="请输入本地单号" clearable />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="渠道单号" path="channelBizNo">
            <NInput v-model:value="searchParams.channelBizNo" placeholder="请输入渠道单号" clearable />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="结果说明" path="reasonCode">
            <NInput v-model:value="searchParams.reasonCode" placeholder="请输入结果说明编码" clearable />
          </NFormItemGi>
          <NFormItemGi span="24">
            <NSpace class="w-full" justify="end">
              <NButton @click="resetSearchParams">重置</NButton>
              <NButton type="primary" ghost @click="getDataByPage">查询</NButton>
              <NButton type="success" :loading="exportLoading" @click="handleExport">导出</NButton>
            </NSpace>
          </NFormItemGi>
        </NGrid>
      </NForm>
    </FinanceSearchCard>

    <NCard title="核对结果" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
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

    <NModal v-model:show="detailVisible" preset="card" title="核对结果详情" class="max-w-96% w-760px">
      <NSpin :show="detailLoading">
        <template v-if="detailData">
          <NDescriptions bordered label-placement="left" :column="2">
            <NDescriptionsItem label="结果ID">{{ detailData.id }}</NDescriptionsItem>
            <NDescriptionsItem label="核对结果">{{
              getFinanceReconciliationResultStatusLabel(detailData.status)
            }}</NDescriptionsItem>
            <NDescriptionsItem label="所属租户">
              {{ detailData.tenantId ? getFinanceTenantLabel(detailData.tenantId, tenantLabelMap) : '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="业务范围">{{ getFinanceBizScopeLabel(detailData.bizScope) }}</NDescriptionsItem>
            <NDescriptionsItem label="本地单号">{{ detailData.localBizNo || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道单号">{{ detailData.channelBizNo || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="交易流水">{{ detailData.transactionId || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="通道类型">{{ getFinanceChannelLabel(detailData.channelType) }}</NDescriptionsItem>
            <NDescriptionsItem label="本地金额">
              {{ detailData.localAmount == null ? '-' : `¥${formatPrice(detailData.localAmount)}` }}
            </NDescriptionsItem>
            <NDescriptionsItem label="渠道金额">
              {{ detailData.channelAmount == null ? '-' : `¥${formatPrice(detailData.channelAmount)}` }}
            </NDescriptionsItem>
            <NDescriptionsItem label="差异金额">
              {{ detailData.diffAmount == null ? '-' : `¥${formatPrice(detailData.diffAmount)}` }}
            </NDescriptionsItem>
            <NDescriptionsItem label="本地退款口径" :span="2">
              {{ formatRefundBreakdown(detailData.localAmountBreakdown) }}
            </NDescriptionsItem>
            <NDescriptionsItem label="渠道退款口径" :span="2">
              {{ formatRefundBreakdown(detailData.channelAmountBreakdown) }}
            </NDescriptionsItem>
            <NDescriptionsItem label="异常单ID">{{ detailData.issueId || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="缓冲记录ID">{{ detailData.bufferId || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="结果说明">{{
              getFinanceReasonCodeLabel(detailData.reasonCode)
            }}</NDescriptionsItem>
            <NDescriptionsItem label="补充说明" :span="2">{{ detailData.reasonText || '-' }}</NDescriptionsItem>
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
