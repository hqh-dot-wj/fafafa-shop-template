<script setup lang="tsx">
import { onMounted, reactive, ref } from 'vue';
import { NButton, NForm, NFormItem, NFormItemGi, NGrid, NInput, NInputNumber, NModal, NSpace, NTag, useMessage } from 'naive-ui';
import {
  fetchFreezeAdminWallet,
  fetchGetAdminWalletList,
  fetchGetAdminWalletStats,
  fetchUnfreezeAdminWallet
} from '@/service/api/finance-center';
import { useAppStore } from '@/store/modules/app';
import { useTable, useTableProps } from '@/hooks/common/table';
import FinanceSearchCard from '../../shared/finance-search-card.vue';
import { financeAdminWalletStatusOptions } from '../../shared/finance-display';

defineOptions({
  name: 'FinanceInternalWallet'
});

const message = useMessage();
const appStore = useAppStore();
const tableProps = useTableProps();

const stats = ref<Api.FinanceCenter.WalletStats | null>(null);
const statsLoading = ref(false);
const freezeVisible = ref(false);
const freezeSubmitting = ref(false);
const freezeForm = reactive({
  walletId: '',
  memberName: '',
  reason: ''
});

const statusTagMap: Record<Api.FinanceCenter.WalletStatus, NaiveUI.ThemeColor> = {
  NORMAL: 'success',
  FROZEN: 'warning',
  DISABLED: 'error'
};

const walletStatusLabelMap: Record<Api.FinanceCenter.WalletStatus, string> = {
  NORMAL: '正常',
  FROZEN: '冻结中',
  DISABLED: '已停用'
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
  resetSearchParams
} = useTable({
  apiFn: fetchGetAdminWalletList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    status: null,
    keyword: null,
    minBalance: null,
    maxBalance: null
  },
  columns: () => [
    {
      key: 'memberName',
      title: '用户',
      minWidth: 160,
      render: (row: Api.FinanceCenter.WalletRecord) => `${row.memberName}${row.memberMobile ? ` / ${row.memberMobile}` : ''}`
    },
    {
      key: 'balance',
      title: '可用余额',
      align: 'center',
      width: 120,
      render: (row: Api.FinanceCenter.WalletRecord) => `¥${row.balance.toFixed(2)}`
    },
    {
      key: 'frozen',
      title: '冻结金额',
      align: 'center',
      width: 120,
      render: (row: Api.FinanceCenter.WalletRecord) => `¥${row.frozen.toFixed(2)}`
    },
    {
      key: 'totalIncome',
      title: '累计收入',
      align: 'center',
      width: 120,
      render: (row: Api.FinanceCenter.WalletRecord) => `¥${row.totalIncome.toFixed(2)}`
    },
    {
      key: 'pendingRecovery',
      title: '待回收',
      align: 'center',
      width: 120,
      render: (row: Api.FinanceCenter.WalletRecord) => `¥${row.pendingRecovery.toFixed(2)}`
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      width: 100,
      render: (row: Api.FinanceCenter.WalletRecord) => (
        <NTag type={statusTagMap[row.status] ?? 'default'}>{walletStatusLabelMap[row.status] ?? row.status}</NTag>
      )
    },
    {
      key: 'frozenReason',
      title: '冻结原因',
      minWidth: 180,
      render: (row: Api.FinanceCenter.WalletRecord) => row.frozenReason || '-'
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      align: 'center',
      width: 170
    },
    {
      key: 'actions',
      title: '操作',
      align: 'center',
      width: 170,
      render: (row: Api.FinanceCenter.WalletRecord) => (
        <NSpace justify="center">
          {row.status === 'FROZEN' ? (
            <NButton size="small" type="primary" ghost onClick={() => handleUnfreeze(row)}>
              解冻
            </NButton>
          ) : (
            <NButton size="small" type="warning" ghost onClick={() => openFreezeModal(row)}>
              冻结
            </NButton>
          )}
        </NSpace>
      )
    }
  ]
});

async function loadStats() {
  statsLoading.value = true;
  try {
    const { data: value } = await fetchGetAdminWalletStats();
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

function openFreezeModal(row: Api.FinanceCenter.WalletRecord) {
  freezeForm.walletId = row.id;
  freezeForm.memberName = row.memberName;
  freezeForm.reason = '';
  freezeVisible.value = true;
}

async function submitFreeze() {
  if (!freezeForm.walletId || !freezeForm.reason.trim()) {
    message.warning('请输入冻结原因');
    return;
  }

  freezeSubmitting.value = true;
  try {
    await fetchFreezeAdminWallet({
      walletId: freezeForm.walletId,
      reason: freezeForm.reason.trim()
    });
    message.success('钱包已冻结');
    freezeVisible.value = false;
    await getData();
  } finally {
    freezeSubmitting.value = false;
  }
}

async function handleUnfreeze(row: Api.FinanceCenter.WalletRecord) {
  await fetchUnfreezeAdminWallet(row.id);
  message.success('钱包已解冻');
  await getData();
}

onMounted(() => {
  loadStats();
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <FinanceSearchCard collapse-name="finance-internal-wallet-search">
      <NForm :model="searchParams" label-placement="left" :label-width="92">
        <NGrid responsive="screen" item-responsive :x-gap="16">
          <NFormItemGi span="24 s:12 m:8 l:6" label="用户关键词" path="keyword">
            <NInput v-model:value="searchParams.keyword" placeholder="请输入昵称或手机号" clearable />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="钱包状态" path="status">
            <NSelect v-model:value="searchParams.status" :options="financeAdminWalletStatusOptions" clearable placeholder="请选择状态" />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="最小余额" path="minBalance">
            <NInputNumber v-model:value="searchParams.minBalance" :min="0" placeholder="请输入最小余额" class="w-full" />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="最大余额" path="maxBalance">
            <NInputNumber v-model:value="searchParams.maxBalance" :min="0" placeholder="请输入最大余额" class="w-full" />
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
          <NStatistic label="钱包总数" :value="stats?.totalWallets ?? 0" />
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small">
          <NStatistic label="可用余额" :value="stats?.totalBalance ?? 0" :precision="2">
            <template #prefix>¥</template>
          </NStatistic>
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small">
          <NStatistic label="冻结金额" :value="stats?.totalFrozen ?? 0" :precision="2">
            <template #prefix>¥</template>
          </NStatistic>
        </NCard>
      </NGi>
      <NGi>
        <NCard :bordered="false" size="small">
          <NStatistic label="异常钱包" :value="stats?.pendingRecoveryWallets ?? 0" />
        </NCard>
      </NGi>
    </NGrid>

    <NCard title="钱包管理" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
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
        :row-key="row => row.id"
        remote
        class="sm:h-full"
      />
    </NCard>

    <NModal v-model:show="freezeVisible" preset="card" title="冻结钱包" class="w-520px">
      <NForm label-placement="left" label-width="80">
        <NFormItem label="用户">{{ freezeForm.memberName || '-' }}</NFormItem>
        <NFormItem label="冻结原因" required>
          <NInput v-model:value="freezeForm.reason" type="textarea" placeholder="输入冻结原因" :rows="4" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="freezeVisible = false">取消</NButton>
          <NButton type="warning" :loading="freezeSubmitting" @click="submitFreeze">确认冻结</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
