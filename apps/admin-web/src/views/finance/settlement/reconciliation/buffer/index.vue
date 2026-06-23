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
  fetchEscalateReconciliationBuffer,
  fetchGetReconciliationBufferDetail,
  fetchGetReconciliationBufferList,
  fetchIgnoreReconciliationBuffer,
  fetchRecheckReconciliationBuffer,
} from '@/service/api/finance-center';
import { useTable, useTableProps } from '@/hooks/common/table';
import { useAppStore } from '@/store/modules/app';
import FinanceSearchCard from '../../../shared/finance-search-card.vue';
import {
  financeBizScopeOptions,
  financeChannelOptions,
  financeReconciliationBufferStatusOptions,
  getFinanceBizScopeLabel,
  getFinanceChannelLabel,
  getFinanceReasonCodeLabel,
  getFinanceReconciliationBufferStatusLabel,
  getFinanceTenantLabel,
} from '../../../shared/finance-display';
import { useFinanceTenantLabels } from '../../../shared/use-finance-tenant-labels';

defineOptions({
  name: 'FinanceSettlementReconciliationBuffer',
});

type BufferAction = 'RECHECK' | 'ESCALATE' | 'IGNORE';

const appStore = useAppStore();
const tableProps = useTableProps();
const { bool: detailVisible, setTrue: openDetailModal, setFalse: closeDetailModal } = useBoolean(false);
const { bool: actionVisible, setTrue: openActionModal, setFalse: closeActionModal } = useBoolean(false);
const { tenantLabelMap, tenantOptions } = useFinanceTenantLabels();

const detailLoading = ref(false);
const submitting = ref(false);
const detailData = ref<Api.FinanceCenter.ReconciliationBuffer | null>(null);
const currentAction = ref<BufferAction>('RECHECK');

const statusTagMap: Record<Api.FinanceCenter.ReconciliationBufferStatus, NaiveUI.ThemeColor> = {
  WAITING: 'warning',
  RECHECKING: 'info',
  MATCHED: 'success',
  EXPIRED: 'error',
  IGNORED: 'default',
};

const actionTextMap: Record<BufferAction, string> = {
  RECHECK: '立即复核',
  ESCALATE: '升级异常',
  IGNORE: '忽略记录',
};

const actionForm = reactive<Api.FinanceCenter.HandleReconciliationBufferPayload>({
  bufferId: '',
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
  apiFn: fetchGetReconciliationBufferList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    bizScope: null,
    channelType: null,
    status: null,
    reasonCode: null,
    tenantId: null,
  },
  columns: () => [
    {
      key: 'tenantId',
      title: '所属租户',
      minWidth: 220,
      render: (row: Api.FinanceCenter.ReconciliationBuffer) =>
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
      render: (row: Api.FinanceCenter.ReconciliationBuffer) => getFinanceBizScopeLabel(row.bizScope),
    },
    {
      key: 'localBizNo',
      title: '本地单号',
      minWidth: 180,
      ellipsis: { tooltip: true },
      render: (row: Api.FinanceCenter.ReconciliationBuffer) => row.localBizNo || '-',
    },
    {
      key: 'channelBizNo',
      title: '渠道单号',
      minWidth: 180,
      ellipsis: { tooltip: true },
      render: (row: Api.FinanceCenter.ReconciliationBuffer) => row.channelBizNo || '-',
    },
    {
      key: 'channelType',
      title: '通道类型',
      align: 'center',
      width: 130,
      render: (row: Api.FinanceCenter.ReconciliationBuffer) => getFinanceChannelLabel(row.channelType),
    },
    {
      key: 'reasonCode',
      title: '待复核原因',
      minWidth: 160,
      render: (row: Api.FinanceCenter.ReconciliationBuffer) => getFinanceReasonCodeLabel(row.reasonCode),
    },
    {
      key: 'status',
      title: '处理状态',
      align: 'center',
      width: 110,
      render: (row: Api.FinanceCenter.ReconciliationBuffer) => (
        <NTag type={statusTagMap[row.status] ?? 'default'}>{getFinanceReconciliationBufferStatusLabel(row.status)}</NTag>
      ),
    },
    {
      key: 'timeRange',
      title: '复核时间窗',
      minWidth: 280,
      render: (row: Api.FinanceCenter.ReconciliationBuffer) => `${row.firstSeenAt} 至 ${row.expireAt}`,
    },
    {
      key: 'retryCount',
      title: '复核次数',
      align: 'center',
      width: 90,
    },
    {
      key: 'operate',
      title: '操作',
      align: 'center',
      width: 240,
      render: (row: Api.FinanceCenter.ReconciliationBuffer) => (
        <NSpace justify="center">
          <NButton text type="primary" onClick={() => handleViewDetail(row.id)}>
            查看
          </NButton>
          <NButton text type="info" onClick={() => handleOpenAction(row, 'RECHECK')}>
            复核
          </NButton>
          <NButton text type="warning" onClick={() => handleOpenAction(row, 'ESCALATE')}>
            升级
          </NButton>
          <NButton text type="default" onClick={() => handleOpenAction(row, 'IGNORE')}>
            忽略
          </NButton>
        </NSpace>
      ),
    },
  ],
});

function handleOpenAction(row: Api.FinanceCenter.ReconciliationBuffer, action: BufferAction) {
  currentAction.value = action;
  actionForm.bufferId = row.id;
  actionForm.remark = '';
  openActionModal();
}

async function handleViewDetail(id: string) {
  detailLoading.value = true;
  openDetailModal();
  try {
    const { data: detail } = await fetchGetReconciliationBufferDetail(id);
    detailData.value = detail ?? null;
  } finally {
    detailLoading.value = false;
  }
}

async function submitAction() {
  submitting.value = true;
  try {
    if (currentAction.value === 'RECHECK') {
      await fetchRecheckReconciliationBuffer(actionForm);
    } else if (currentAction.value === 'ESCALATE') {
      await fetchEscalateReconciliationBuffer(actionForm);
    } else {
      await fetchIgnoreReconciliationBuffer(actionForm);
    }

    window.$message?.success(`${actionTextMap[currentAction.value]}已提交`);
    closeActionModal();
    await getData();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <FinanceSearchCard collapse-name="reconciliation-buffer-search">
      <NForm :model="searchParams" label-placement="left" :label-width="92">
        <NGrid responsive="screen" item-responsive :x-gap="16">
          <NFormItemGi span="24 s:12 m:8 l:6" label="业务范围" path="bizScope">
            <NSelect v-model:value="searchParams.bizScope" clearable placeholder="请选择业务范围" :options="financeBizScopeOptions" />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="通道类型" path="channelType">
            <NSelect v-model:value="searchParams.channelType" clearable placeholder="请选择通道类型" :options="financeChannelOptions" />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="处理状态" path="status">
            <NSelect
              v-model:value="searchParams.status"
              clearable
              placeholder="请选择处理状态"
              :options="financeReconciliationBufferStatusOptions"
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
          <NFormItemGi span="24 s:12 m:8 l:6" label="待复核原因" path="reasonCode">
            <NInput v-model:value="searchParams.reasonCode" placeholder="请输入原因编码" clearable />
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

    <NCard title="待复核记录" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
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
      v-model:show="actionVisible"
      preset="dialog"
      :title="actionTextMap[currentAction]"
      positive-text="提交"
      negative-text="取消"
      @positive-click="submitAction"
    >
      <NForm :model="actionForm" label-placement="left">
        <NFormItem label="备注说明">
          <NInput v-model:value="actionForm.remark" type="textarea" :rows="3" placeholder="请输入本次处理说明" />
        </NFormItem>
      </NForm>
    </NModal>

    <NModal v-model:show="detailVisible" preset="card" title="待复核记录详情" class="w-760px max-w-96%">
      <NSpin :show="detailLoading">
        <template v-if="detailData">
          <NDescriptions bordered label-placement="left" :column="2">
            <NDescriptionsItem label="记录ID">{{ detailData.id }}</NDescriptionsItem>
            <NDescriptionsItem label="处理状态">{{ getFinanceReconciliationBufferStatusLabel(detailData.status) }}</NDescriptionsItem>
            <NDescriptionsItem label="所属租户">
              {{ detailData.tenantId ? getFinanceTenantLabel(detailData.tenantId, tenantLabelMap) : '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="业务范围">{{ getFinanceBizScopeLabel(detailData.bizScope) }}</NDescriptionsItem>
            <NDescriptionsItem label="通道类型">{{ getFinanceChannelLabel(detailData.channelType) }}</NDescriptionsItem>
            <NDescriptionsItem label="复核次数">{{ detailData.retryCount }}</NDescriptionsItem>
            <NDescriptionsItem label="本地单号">{{ detailData.localBizNo || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道单号">{{ detailData.channelBizNo || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="交易流水">{{ detailData.transactionId || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="首次发现">{{ detailData.firstSeenAt }}</NDescriptionsItem>
            <NDescriptionsItem label="下次复核">{{ detailData.nextCheckAt }}</NDescriptionsItem>
            <NDescriptionsItem label="过期时间">{{ detailData.expireAt }}</NDescriptionsItem>
            <NDescriptionsItem label="待复核原因">{{ getFinanceReasonCodeLabel(detailData.reasonCode) }}</NDescriptionsItem>
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
