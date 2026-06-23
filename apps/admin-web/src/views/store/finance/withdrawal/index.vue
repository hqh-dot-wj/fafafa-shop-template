<script setup lang="tsx">
import { ref, watch } from 'vue';
import { NAvatar, NButton, NForm, NFormItem, NInput, NModal, NSpace, NTabPane, NTabs } from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import { fetchAuditWithdrawal, fetchGetWithdrawalList } from '@/service/api/store/finance';
import { useAppStore } from '@/store/modules/app';
import { useTable, useTableProps } from '@/hooks/common/table';
import AuditStatusTag from '@/components/custom/audit-status-tag.vue';
import TableHeaderOperation from '@/components/advanced/table-header-operation.vue';
import { $t } from '@/locales';
import WithdrawalSearch from './modules/withdrawal-search.vue';

defineOptions({
  name: 'FinanceWithdrawal',
});

const appStore = useAppStore();
const tableProps = useTableProps();

const activeTab = ref<string>('PENDING');

const { bool: auditModalVisible, setTrue: openAuditModal, setFalse: closeAuditModal } = useBoolean(false);
const currentWithdrawal = ref<Api.Finance.WithdrawalRecord | null>(null);
const auditAction = ref<'APPROVE' | 'REJECT'>('APPROVE');
const auditRemark = ref('');

const {
  columns,
  columnChecks,
  data,
  getData,
  getDataByPage,
  loading,
  mobilePagination,
  searchParams,
  resetSearchParams,
  scrollX,
} = useTable({
  apiFn: fetchGetWithdrawalList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    status: 'PENDING',
    keyword: null,
  },
  columns: () => [
    {
      key: 'memberId',
      title: '申请人',
      align: 'center',
      minWidth: 160,
      render: (row: Api.Finance.WithdrawalRecord) => (
        <div class="flex items-center justify-center gap-2">
          <NAvatar
            round
            size="small"
            src={row.memberAvatar}
            fallbackSrc={`https://api.dicebear.com/7.x/avataaars/svg?seed=${row.memberName || 'user'}`}
          />
          <div class="flex flex-col items-start">
            <span>{row.memberName || '未知用户'}</span>
            <span class="text-xs text-gray-500">{row.memberMobile}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      title: '提现金额',
      align: 'center',
      minWidth: 100,
      render: (row: Api.Finance.WithdrawalRecord) => <span class="text-error font-bold">¥{row.amount}</span>,
    },
    {
      key: 'method',
      title: '提现方式',
      align: 'center',
      minWidth: 100,
      render: (row: Api.Finance.WithdrawalRecord) => (row.method === 'WECHAT_WALLET' ? '微信钱包' : '银行卡'),
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      minWidth: 100,
      render: (row: Api.Finance.WithdrawalRecord) => <AuditStatusTag status={row.status} />,
    },
    {
      key: 'createTime',
      title: '申请时间',
      align: 'center',
      minWidth: 160,
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 180,
      render: (row: Api.Finance.WithdrawalRecord) => {
        if (row.status !== 'PENDING') {
          return <span class="text-gray-400">已处理</span>;
        }
        return (
          <NSpace justify="center">
            <NButton type="primary" ghost size="small" onClick={() => handleAudit(row, 'APPROVE')}>
              通过
            </NButton>
            <NButton type="error" ghost size="small" onClick={() => handleAudit(row, 'REJECT')}>
              驳回
            </NButton>
          </NSpace>
        );
      },
    },
  ],
});

watch(activeTab, (val: string) => {
  searchParams.status = val as Api.Finance.WithdrawalStatus;
  getDataByPage();
});

function handleAudit(row: Api.Finance.WithdrawalRecord, action: 'APPROVE' | 'REJECT') {
  currentWithdrawal.value = row;
  auditAction.value = action;
  auditRemark.value = '';
  openAuditModal();
}

function applicantDisplayName(): string {
  const w = currentWithdrawal.value;
  if (!w) return '';
  return w.memberName || w.member?.nickname || '未知用户';
}

function handleWithdrawalReset() {
  resetSearchParams();
  activeTab.value = 'PENDING';
}

async function submitAudit() {
  if (!currentWithdrawal.value) return;

  try {
    await fetchAuditWithdrawal({
      withdrawalId: currentWithdrawal.value.id,
      action: auditAction.value,
      remark: auditRemark.value,
    });
    window.$message?.success(auditAction.value === 'APPROVE' ? '已通过' : '已驳回');
    closeAuditModal();
    getData();
  } catch {
    // error handled in request
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <WithdrawalSearch v-model:model="searchParams" @reset="handleWithdrawalReset" @search="getDataByPage" />

    <NCard :title="$t('route.store_finance_withdrawal')" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :loading="loading"
          :show-add="false"
          :show-delete="false"
          @refresh="getData"
        />
      </template>

      <NTabs v-model:value="activeTab" type="line" animated class="mb-12px">
        <NTabPane name="PENDING" tab="待审核" />
        <NTabPane name="PROCESSING" tab="处理中" />
        <NTabPane name="APPROVED" tab="已通过" />
        <NTabPane name="REJECTED" tab="已驳回" />
        <NTabPane name="FAILED" tab="打款失败" />
      </NTabs>

      <NDataTable
        :columns="columns"
        :data="data"
        v-bind="tableProps"
        :flex-height="!appStore.isMobile"
        :scroll-x="scrollX"
        :loading="loading"
        remote
        :row-key="(row: Api.Finance.WithdrawalRecord) => row.id"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
    </NCard>

    <NModal
      v-model:show="auditModalVisible"
      preset="dialog"
      :title="auditAction === 'APPROVE' ? '确认通过' : '确认驳回'"
      positive-text="确认"
      negative-text="取消"
      @positive-click="submitAudit"
    >
      <div class="py-16px">
        <p class="mb-8px">
          申请人:
          <strong>{{ applicantDisplayName() }}</strong>
        </p>
        <p class="mb-16px">
          提现金额:
          <strong class="text-error">¥{{ currentWithdrawal?.amount }}</strong>
        </p>
        <NForm>
          <NFormItem label="审核备注" path="remark">
            <NInput
              v-model:value="auditRemark"
              type="textarea"
              :placeholder="auditAction === 'APPROVE' ? '可选，备注信息' : '请输入驳回原因'"
              :rows="3"
            />
          </NFormItem>
        </NForm>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.text-error {
  color: #d03050;
}
</style>
