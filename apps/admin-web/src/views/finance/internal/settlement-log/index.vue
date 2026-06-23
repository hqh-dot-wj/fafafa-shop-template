<script setup lang="tsx">
import { onMounted, ref } from 'vue';
import { NButton, NForm, NFormItemGi, NGrid, NSpace, NTag } from 'naive-ui';
import { fetchGetSettlementLogList, fetchGetSettlementOverview } from '@/service/api/finance-center';
import { useAppStore } from '@/store/modules/app';
import { useTable, useTableProps } from '@/hooks/common/table';
import FinanceSearchCard from '../../shared/finance-search-card.vue';
import { financeSettlementLogTriggerOptions } from '../../shared/finance-display';

defineOptions({
  name: 'FinanceInternalSettlementLog'
});

const appStore = useAppStore();
const tableProps = useTableProps();
const overview = ref<Api.FinanceCenter.SettlementOverview | null>(null);
const overviewLoading = ref(false);

const errorOptions = [
  { label: '有异常', value: true },
  { label: '无异常', value: false }
] satisfies CommonType.Option<boolean>[];

const {
  columns,
  columnChecks,
  data,
  loading,
  mobilePagination,
  searchParams,
  getData: originGetData,
  getDataByPage: originGetDataByPage,
  resetSearchParams
} = useTable({
  apiFn: fetchGetSettlementLogList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    triggerType: null,
    hasError: null,
    startTime: null,
    endTime: null
  },
  columns: () => [
    {
      key: 'batchId',
      title: '批次号',
      minWidth: 180
    },
    {
      key: 'triggerType',
      title: '触发方式',
      align: 'center',
      width: 110,
      render: (row: Api.FinanceCenter.SettlementLog) => row.triggerTypeName
    },
    {
      key: 'settledCount',
      title: '成功单数',
      align: 'center',
      width: 100
    },
    {
      key: 'failedCount',
      title: '失败单数',
      align: 'center',
      width: 100
    },
    {
      key: 'totalAmount',
      title: '处理金额',
      align: 'center',
      width: 120,
      render: (row: Api.FinanceCenter.SettlementLog) => `¥${row.totalAmount.toFixed(2)}`
    },
    {
      key: 'durationMs',
      title: '耗时',
      align: 'center',
      width: 100,
      render: (row: Api.FinanceCenter.SettlementLog) => `${row.durationMs} ms`
    },
    {
      key: 'hasError',
      title: '异常',
      align: 'center',
      width: 90,
      render: (row: Api.FinanceCenter.SettlementLog) => (
        <NTag type={row.hasError ? 'error' : 'success'}>{row.hasError ? '有异常' : '正常'}</NTag>
      )
    },
    {
      key: 'createTime',
      title: '创建时间',
      align: 'center',
      width: 170
    }
  ]
});

async function loadOverview() {
  overviewLoading.value = true;
  try {
    const { data: value } = await fetchGetSettlementOverview();
    overview.value = value ?? null;
  } finally {
    overviewLoading.value = false;
  }
}

async function getData() {
  await Promise.all([originGetData(), loadOverview()]);
}

async function getDataByPage() {
  await Promise.all([originGetDataByPage(), loadOverview()]);
}

onMounted(() => {
  loadOverview();
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <FinanceSearchCard collapse-name="finance-internal-settlement-log-search">
      <NForm :model="searchParams" label-placement="left" :label-width="92">
        <NGrid responsive="screen" item-responsive :x-gap="16">
          <NFormItemGi span="24 s:12 m:8 l:6" label="触发方式" path="triggerType">
            <NSelect v-model:value="searchParams.triggerType" :options="financeSettlementLogTriggerOptions" clearable placeholder="请选择触发方式" />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="异常状态" path="hasError">
            <NSelect v-model:value="searchParams.hasError" :options="errorOptions" clearable placeholder="请选择异常状态" />
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
          <NStatistic label="结算批次" :value="overview?.totalBatches ?? 0" />
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small">
          <NStatistic label="处理总金额" :value="overview?.totalAmount ?? 0" :precision="2">
            <template #prefix>¥</template>
          </NStatistic>
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small">
          <NStatistic label="异常批次" :value="overview?.errorBatches ?? 0" />
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small">
          <NStatistic label="成功率" :value="overview?.successRate ?? 0" :precision="2">
            <template #suffix>%</template>
          </NStatistic>
        </NCard>
      </NGi>
    </NGrid>

    <NCard title="结算日志" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :loading="loading || overviewLoading"
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
        :loading="loading || overviewLoading"
        :pagination="mobilePagination"
        :row-key="row => row.id"
        remote
        class="sm:h-full"
      />
    </NCard>
  </div>
</template>
