<script setup lang="tsx">
import { NButton, NForm, NFormItemGi, NGrid, NInput, NSelect, NSpace, NTag } from 'naive-ui';
import { fetchGetSettlementPaymentList } from '@/service/api/finance-center';
import { useAppStore } from '@/store/modules/app';
import { useTable, useTableProps } from '@/hooks/common/table';
import FinanceSearchCard from '../../shared/finance-search-card.vue';
import {
  financePaymentStatusOptions,
  getFinanceChannelLabel,
  getFinancePaymentStatusLabel,
  getFinanceTenantLabel,
} from '../../shared/finance-display';
import { useFinanceTenantLabels } from '../../shared/use-finance-tenant-labels';

defineOptions({
  name: 'FinanceSettlementPayment',
});

const appStore = useAppStore();
const tableProps = useTableProps();
const { tenantLabelMap, tenantOptions } = useFinanceTenantLabels();

const statusTagMap: Record<Api.FinanceCenter.PaymentRecordStatus, NaiveUI.ThemeColor> = {
  PENDING: 'warning',
  SUCCESS: 'success',
  FAILED: 'error',
  REFUNDED: 'default',
  CLOSED: 'default',
};

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
  apiFn: fetchGetSettlementPaymentList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    tenantId: null,
    orderSn: null,
    transactionId: null,
    status: null,
  },
  columns: () => [
    {
      key: 'orderSn',
      title: '订单号',
      minWidth: 180,
      ellipsis: { tooltip: true },
    },
    {
      key: 'tenantId',
      title: '所属租户',
      minWidth: 220,
      render: (row: Api.FinanceCenter.PaymentRecord) => (
        <div class="leading-5">
          <div>{getFinanceTenantLabel(row.tenantId, tenantLabelMap.value)}</div>
          <div class="text-12px text-gray-500">{row.tenantId}</div>
        </div>
      ),
    },
    {
      key: 'channelType',
      title: '支付通道',
      align: 'center',
      width: 130,
      render: (row: Api.FinanceCenter.PaymentRecord) => getFinanceChannelLabel(row.channelType),
    },
    {
      key: 'transactionId',
      title: '渠道流水号',
      minWidth: 220,
      ellipsis: { tooltip: true },
      render: (row: Api.FinanceCenter.PaymentRecord) => row.transactionId || '-',
    },
    {
      key: 'payAmount',
      title: '收款金额',
      align: 'center',
      width: 120,
      render: (row: Api.FinanceCenter.PaymentRecord) => `¥${Number(row.payAmount).toFixed(2)}`,
    },
    {
      key: 'status',
      title: '支付状态',
      align: 'center',
      width: 110,
      render: (row: Api.FinanceCenter.PaymentRecord) => (
        <NTag type={statusTagMap[row.status] ?? 'default'}>{getFinancePaymentStatusLabel(row.status)}</NTag>
      ),
    },
    {
      key: 'payTime',
      title: '支付时间',
      align: 'center',
      width: 168,
      render: (row: Api.FinanceCenter.PaymentRecord) => row.payTime || '-',
    },
    {
      key: 'createTime',
      title: '记录时间',
      align: 'center',
      width: 168,
    },
  ],
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <FinanceSearchCard collapse-name="settlement-payment-search">
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
          <NFormItemGi span="24 s:12 m:8 l:6" label="渠道流水号" path="transactionId">
            <NInput v-model:value="searchParams.transactionId" placeholder="请输入渠道流水号" clearable />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="支付状态" path="status">
            <NSelect v-model:value="searchParams.status" clearable placeholder="请选择支付状态" :options="financePaymentStatusOptions" />
          </NFormItemGi>
          <NFormItemGi span="24" class="pt-4px">
            <NSpace class="w-full" justify="end">
              <NButton @click="resetSearchParams">重置</NButton>
              <NButton type="primary" ghost @click="getDataByPage">查询</NButton>
            </NSpace>
          </NFormItemGi>
        </NGrid>
      </NForm>
    </FinanceSearchCard>

    <NCard title="收款记录" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
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
  </div>
</template>
