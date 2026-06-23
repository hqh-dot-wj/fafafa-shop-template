<script setup lang="tsx">
import { onMounted, ref } from 'vue';
import { NButton, NForm, NFormItemGi, NGrid, NInput, NInputNumber, NSpace, NTag } from 'naive-ui';
import { fetchGetAdminCommissionList, fetchGetAdminCommissionStats } from '@/service/api/finance-center';
import { useAppStore } from '@/store/modules/app';
import { useTable, useTableProps } from '@/hooks/common/table';
import FinanceSearchCard from '../../shared/finance-search-card.vue';

defineOptions({
  name: 'FinanceDistributionCommission',
});

const appStore = useAppStore();
const tableProps = useTableProps();

const stats = ref<Api.FinanceCenter.DistributionCommissionStats | null>(null);
const statsLoading = ref(false);

const statusTagMap: Record<Api.Finance.CommissionStatus, NaiveUI.ThemeColor> = {
  FROZEN: 'warning',
  SETTLED: 'success',
  CANCELLED: 'error',
};

const {
  columns,
  columnChecks,
  data,
  loading,
  mobilePagination,
  searchParams,
  getData: originGetData,
  getDataByPage: originGetDataByPage,
  resetSearchParams,
} = useTable({
  apiFn: fetchGetAdminCommissionList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    orderSn: null,
    beneficiaryId: null,
    keyword: null,
    status: null,
    level: null,
    orderId: null,
    startTime: null,
    endTime: null,
  },
  columns: () => [
    {
      key: 'orderSn',
      title: '订单号',
      minWidth: 180,
    },
    {
      key: 'beneficiaryName',
      title: '受益人',
      minWidth: 140,
      render: (row: Api.FinanceCenter.DistributionCommission) =>
        `${row.beneficiaryName}${row.beneficiaryMobile ? ` / ${row.beneficiaryMobile}` : ''}`,
    },
    {
      key: 'levelName',
      title: '层级',
      align: 'center',
      width: 100,
    },
    {
      key: 'amount',
      title: '佣金金额',
      align: 'center',
      width: 120,
      render: (row: Api.FinanceCenter.DistributionCommission) => `¥${row.amount.toFixed(2)}`,
    },
    {
      key: 'rateSnapshot',
      title: '比例快照',
      align: 'center',
      width: 100,
      render: (row: Api.FinanceCenter.DistributionCommission) => `${row.rateSnapshot}%`,
    },
    {
      key: 'isCrossTenant',
      title: '跨店',
      align: 'center',
      width: 90,
      render: (row: Api.FinanceCenter.DistributionCommission) => (
        <NTag type={row.isCrossTenant ? 'warning' : 'default'}>{row.isCrossTenant ? '是' : '否'}</NTag>
      ),
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      width: 110,
      render: (row: Api.FinanceCenter.DistributionCommission) => (
        <NTag type={statusTagMap[row.status] ?? 'default'}>{row.statusName}</NTag>
      ),
    },
    {
      key: 'planSettleTime',
      title: '计划结算',
      align: 'center',
      width: 170,
      render: (row: Api.FinanceCenter.DistributionCommission) => row.planSettleTime || '-',
    },
    {
      key: 'createTime',
      title: '创建时间',
      align: 'center',
      width: 170,
    },
  ],
});

async function loadStats() {
  statsLoading.value = true;
  try {
    const { data: value } = await fetchGetAdminCommissionStats();
    stats.value = value ?? null;
  } finally {
    statsLoading.value = false;
  }
}

async function getData() {
  await Promise.all([originGetData(), loadStats()]);
}

async function getDataByPage() {
  await Promise.all([originGetDataByPage(), loadStats()]);
}

onMounted(() => {
  loadStats();
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <FinanceSearchCard collapse-name="finance-distribution-commission-search">
      <NForm :model="searchParams" label-placement="left" :label-width="92">
        <NGrid responsive="screen" item-responsive :x-gap="16">
          <NFormItemGi span="24 s:12 m:8 l:6" label="订单号" path="orderSn">
            <NInput v-model:value="searchParams.orderSn" placeholder="请输入订单号" clearable />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="用户关键词" path="keyword">
            <NInput v-model:value="searchParams.keyword" placeholder="请输入昵称或手机号" clearable />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="受益人ID" path="beneficiaryId">
            <NInput v-model:value="searchParams.beneficiaryId" placeholder="请输入会员ID" clearable />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="佣金层级" path="level">
            <NInputNumber v-model:value="searchParams.level" :min="1" :max="2" placeholder="1 或 2" class="w-full" />
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

    <NGrid cols="1 s:2 l:4" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard :bordered="false" size="small">
          <NStatistic label="总佣金" :value="stats?.totalAmount ?? 0" :precision="2">
            <template #prefix>¥</template>
          </NStatistic>
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small">
          <NStatistic label="冻结佣金" :value="stats?.frozenAmount ?? 0" :precision="2">
            <template #prefix>¥</template>
          </NStatistic>
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small">
          <NStatistic label="已结佣金" :value="stats?.settledAmount ?? 0" :precision="2">
            <template #prefix>¥</template>
          </NStatistic>
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small">
          <NStatistic label="跨店佣金" :value="(stats?.level1Amount ?? 0) + (stats?.level2Amount ?? 0)" :precision="2">
            <template #prefix>¥</template>
          </NStatistic>
        </NCard>
      </NGi>
    </NGrid>

    <NCard title="佣金明细" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :loading="loading || statsLoading"
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
        :loading="loading || statsLoading"
        :pagination="mobilePagination"
        :row-key="(row) => row.id"
        remote
        class="sm:h-full"
      />
    </NCard>
  </div>
</template>
