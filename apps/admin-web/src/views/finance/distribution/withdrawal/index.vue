<script setup lang="tsx">
import { onMounted, reactive, ref, watch } from 'vue';
import { NAvatar, NButton, NForm, NFormItem, NFormItemGi, NGrid, NInput, NModal, NSpace, NStatistic, NTabPane, NTabs } from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import {
  fetchAuditAdminWithdrawal,
  fetchGetAdminWithdrawalList,
  fetchGetAdminWithdrawalStats,
} from '@/service/api/finance-center';
import { useAppStore } from '@/store/modules/app';
import { useTable, useTableProps } from '@/hooks/common/table';
import FinanceSearchCard from '../../shared/finance-search-card.vue';

defineOptions({
  name: 'FinanceDistributionWithdrawal',
});

const appStore = useAppStore();
const tableProps = useTableProps();
const activeTab = ref<Api.Finance.WithdrawalStatus | 'ALL'>('PENDING');
const stats = ref<Api.FinanceCenter.DistributionWithdrawalStats | null>(null);
const statsLoading = ref(false);

const { bool: auditVisible, setTrue: openAuditModal, setFalse: closeAuditModal } = useBoolean(false);
const currentWithdrawal = ref<Api.FinanceCenter.DistributionWithdrawal | null>(null);
const auditForm = reactive<{ withdrawalId: string; action: 'APPROVE' | 'REJECT'; remark: string }>({
  withdrawalId: '',
  action: 'APPROVE',
  remark: '',
});

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
  apiFn: fetchGetAdminWithdrawalList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    status: 'PENDING',
    keyword: null,
    startTime: null,
    endTime: null,
  },
  columns: () => [
    {
      key: 'memberId',
      title: '申请人',
      minWidth: 180,
      render: (row: Api.FinanceCenter.DistributionWithdrawal) => (
        <div class="flex items-center gap-8px">
          <NAvatar size="small" round src={row.memberAvatar} />
          <div>
            <div>{row.memberName || '未知用户'}</div>
            <div class="text-12px text-gray-500">{row.memberMobile || '-'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      title: '申请金额',
      align: 'center',
      width: 110,
      render: (row: Api.FinanceCenter.DistributionWithdrawal) => `¥${Number(row.amount).toFixed(2)}`,
    },
    {
      key: 'method',
      title: '提现方式',
      align: 'center',
      width: 120,
      render: (row: Api.FinanceCenter.DistributionWithdrawal) =>
        row.method === 'WECHAT_WALLET' ? '微信零钱' : row.method === 'BANK_CARD' ? '银行卡' : row.method,
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      width: 100,
      render: (row: Api.FinanceCenter.DistributionWithdrawal) =>
        row.status === 'PENDING'
          ? '待审核'
          : row.status === 'PROCESSING'
            ? '处理中'
            : row.status === 'APPROVED'
              ? '已到账'
              : row.status === 'REJECTED'
                ? '已驳回'
                : row.status === 'FAILED'
                  ? '打款失败'
                  : row.status,
    },
    {
      key: 'auditRemark',
      title: '审核备注',
      minWidth: 220,
      render: (row: Api.FinanceCenter.DistributionWithdrawal) => row.auditRemark || '-',
    },
    {
      key: 'createTime',
      title: '申请时间',
      align: 'center',
      width: 170,
    },
    {
      key: 'operate',
      title: '操作',
      align: 'center',
      width: 140,
      render: (row: Api.FinanceCenter.DistributionWithdrawal) =>
        row.status !== 'PENDING' ? (
          <span class="text-gray-400">已处理</span>
        ) : (
          <NSpace justify="center">
            <NButton text type="primary" onClick={() => handleOpen(row, 'APPROVE')}>
              通过
            </NButton>
            <NButton text type="error" onClick={() => handleOpen(row, 'REJECT')}>
              驳回
            </NButton>
          </NSpace>
        ),
    },
  ],
});

async function loadStats() {
  statsLoading.value = true;
  try {
    const { data: value } = await fetchGetAdminWithdrawalStats();
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

watch(activeTab, (value) => {
  searchParams.status = value === 'ALL' ? null : value;
  getDataByPage();
});

function handleOpen(row: Api.FinanceCenter.DistributionWithdrawal, action: 'APPROVE' | 'REJECT') {
  currentWithdrawal.value = row;
  auditForm.withdrawalId = row.id;
  auditForm.action = action;
  auditForm.remark = '';
  openAuditModal();
}

async function handleSubmitAudit() {
  await fetchAuditAdminWithdrawal(auditForm);
  window.$message?.success(auditForm.action === 'APPROVE' ? '提现已通过' : '提现已驳回');
  closeAuditModal();
  await getData();
}

onMounted(() => {
  loadStats();
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <FinanceSearchCard collapse-name="finance-distribution-withdrawal-search">
      <NForm :model="searchParams" label-placement="left" :label-width="92">
        <NGrid responsive="screen" item-responsive :x-gap="16">
          <NFormItemGi span="24 s:12 m:8 l:6" label="用户关键词" path="keyword">
            <NInput v-model:value="searchParams.keyword" placeholder="请输入昵称或手机号" clearable />
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
          <NStatistic label="总提现申请" :value="stats?.totalAmount ?? 0" :precision="2">
            <template #prefix>¥</template>
          </NStatistic>
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small">
          <NStatistic label="待审核" :value="stats?.pendingAmount ?? 0" :precision="2">
            <template #prefix>¥</template>
          </NStatistic>
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small">
          <NStatistic label="已到账" :value="stats?.approvedAmount ?? 0" :precision="2">
            <template #prefix>¥</template>
          </NStatistic>
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small">
          <NStatistic label="失败/驳回" :value="(stats?.rejectedAmount ?? 0) + (stats?.failedAmount ?? 0)" :precision="2">
            <template #prefix>¥</template>
          </NStatistic>
        </NCard>
      </NGi>
    </NGrid>

    <NCard title="用户提现" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :loading="loading || statsLoading"
          :show-add="false"
          :show-delete="false"
          @refresh="getData"
        />
      </template>

      <NTabs v-model:value="activeTab" type="line" animated class="mb-12px">
        <NTabPane name="ALL" tab="全部" />
        <NTabPane name="PENDING" tab="待审核" />
        <NTabPane name="PROCESSING" tab="处理中" />
        <NTabPane name="APPROVED" tab="已到账" />
        <NTabPane name="REJECTED" tab="已驳回" />
        <NTabPane name="FAILED" tab="打款失败" />
      </NTabs>

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

    <NModal v-model:show="auditVisible" preset="dialog" title="审核提现" positive-text="提交" negative-text="取消" @positive-click="handleSubmitAudit">
      <div class="py-12px">
        <div class="mb-8px">申请人: {{ currentWithdrawal?.memberName || '未知用户' }}</div>
        <div class="mb-12px">提现金额: ¥{{ Number(currentWithdrawal?.amount || 0).toFixed(2) }}</div>
        <NForm :model="auditForm" label-placement="left">
          <NFormItem label="审核动作">
            <div>{{ auditForm.action === 'APPROVE' ? '通过' : '驳回' }}</div>
          </NFormItem>
          <NFormItem label="审核备注">
            <NInput v-model:value="auditForm.remark" type="textarea" :rows="3" placeholder="输入审核说明" />
          </NFormItem>
        </NForm>
      </div>
    </NModal>
  </div>
</template>
