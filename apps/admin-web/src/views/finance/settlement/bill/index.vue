<script setup lang="tsx">
import { reactive, ref } from 'vue';
import {
  NButton,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NFormItemGi,
  NGrid,
  NInput,
  NModal,
  NSpace,
  NSelect,
  NSpin,
  NSwitch,
  NTag,
} from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import {
  fetchAuditSettlementBill,
  fetchExecuteSettlementBill,
  fetchGetSettlementBillDetail,
  fetchGetSettlementBillList,
} from '@/service/api/finance-center';
import { useAppStore } from '@/store/modules/app';
import { useTable, useTableProps } from '@/hooks/common/table';
import FinanceSearchCard from '../../shared/finance-search-card.vue';
import {
  financeChannelOptions,
  financeSettlementBillStatusOptions,
  getFinanceChannelLabel,
  getFinancePaymentStatusLabel,
  getFinanceReceiverTypeLabel,
  getFinanceSettlementBillStatusLabel,
  getFinanceSettlementExecutionStatusLabel,
  getFinanceTenantLabel,
} from '../../shared/finance-display';
import { useFinanceTenantLabels } from '../../shared/use-finance-tenant-labels';

defineOptions({
  name: 'FinanceSettlementBill',
});

const appStore = useAppStore();
const tableProps = useTableProps();
const { bool: detailVisible, setTrue: openDetailDrawer, setFalse: closeDetailDrawer } = useBoolean(false);
const { bool: auditVisible, setTrue: openAuditModal, setFalse: closeAuditModal } = useBoolean(false);
const { bool: executeVisible, setTrue: openExecuteModal, setFalse: closeExecuteModal } = useBoolean(false);
const { tenantLabelMap, tenantOptions } = useFinanceTenantLabels();

const currentBill = ref<Api.FinanceCenter.SettlementBill | null>(null);
const currentDetail = ref<Api.FinanceCenter.SettlementBillDetail | null>(null);
const detailLoading = ref(false);
const submitting = ref(false);

const billStatusTagMap: Record<Api.FinanceCenter.SettlementBillStatus, NaiveUI.ThemeColor> = {
  INIT: 'default',
  PENDING_REVIEW: 'warning',
  REJECTED: 'error',
  APPROVED: 'info',
  EXECUTING: 'warning',
  SUCCESS: 'success',
  FAILED: 'error',
  RECONCILING: 'warning',
  CLOSED: 'default',
};

const executionStatusTagMap: Record<Api.FinanceCenter.SettlementExecutionStatus, NaiveUI.ThemeColor> = {
  PENDING: 'default',
  PROCESSING: 'warning',
  SUCCESS: 'success',
  FAILED: 'error',
  CLOSED: 'default',
};

const auditForm = reactive<Api.FinanceCenter.AuditSettlementBillPayload>({
  billId: '',
  action: 'APPROVE',
  remark: '',
});

const executeForm = reactive<Api.FinanceCenter.ExecuteSettlementBillPayload>({
  billId: '',
  channelType: 'OFFLINE_TRANSFER',
  externalNo: '',
  markAsSuccess: false,
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
  apiFn: fetchGetSettlementBillList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    tenantId: null,
    billNo: null,
    orderSn: null,
    status: null,
    channelType: null,
  },
  columns: () => [
    {
      key: 'billNo',
      title: '结算单号',
      minWidth: 180,
      ellipsis: { tooltip: true },
    },
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
      render: (row: Api.FinanceCenter.SettlementBill) => (
        <div class="leading-5">
          <div>{getFinanceTenantLabel(row.tenantId, tenantLabelMap.value)}</div>
          <div class="text-12px text-gray-500">{row.tenantId}</div>
        </div>
      ),
    },
    {
      key: 'totalAmount',
      title: '订单实收',
      align: 'center',
      width: 110,
      render: (row: Api.FinanceCenter.SettlementBill) => `¥${Number(row.totalAmount).toFixed(2)}`,
    },
    {
      key: 'storeAmount',
      title: '门店应收',
      align: 'center',
      width: 110,
      render: (row: Api.FinanceCenter.SettlementBill) => `¥${Number(row.storeAmount).toFixed(2)}`,
    },
    {
      key: 'commissionAmount',
      title: '佣金合计',
      align: 'center',
      width: 110,
      render: (row: Api.FinanceCenter.SettlementBill) => `¥${Number(row.commissionAmount).toFixed(2)}`,
    },
    {
      key: 'channelType',
      title: '结算方式',
      align: 'center',
      width: 130,
      render: (row: Api.FinanceCenter.SettlementBill) => getFinanceChannelLabel(row.channelType),
    },
    {
      key: 'status',
      title: '当前状态',
      align: 'center',
      width: 110,
      render: (row: Api.FinanceCenter.SettlementBill) => (
        <NTag type={billStatusTagMap[row.status] ?? 'default'}>{getFinanceSettlementBillStatusLabel(row.status)}</NTag>
      ),
    },
    {
      key: 'latestExecutionStatus',
      title: '最近执行',
      align: 'center',
      width: 120,
      render: (row: Api.FinanceCenter.SettlementBill) =>
        row.latestExecutionStatus ? getFinanceSettlementExecutionStatusLabel(row.latestExecutionStatus) : '-',
    },
    {
      key: 'operate',
      title: '操作',
      align: 'center',
      width: 210,
      render: (row: Api.FinanceCenter.SettlementBill) => (
        <NSpace justify="center">
          <NButton text type="primary" onClick={() => handleViewDetail(row)}>
            查看
          </NButton>
          {(row.status === 'PENDING_REVIEW' || row.status === 'REJECTED') && (
            <NButton text type="warning" onClick={() => handleOpenAudit(row)}>
              审核
            </NButton>
          )}
          {(row.status === 'APPROVED' || row.status === 'FAILED') && (
            <NButton text type="success" onClick={() => handleOpenExecute(row)}>
              执行
            </NButton>
          )}
        </NSpace>
      ),
    },
  ],
});

async function handleViewDetail(row: Api.FinanceCenter.SettlementBill) {
  currentBill.value = row;
  detailLoading.value = true;
  openDetailDrawer();
  try {
    const { data: detail } = await fetchGetSettlementBillDetail(row.id);
    currentDetail.value = detail ?? null;
  } finally {
    detailLoading.value = false;
  }
}

function handleOpenAudit(row: Api.FinanceCenter.SettlementBill) {
  currentBill.value = row;
  auditForm.billId = row.id;
  auditForm.action = 'APPROVE';
  auditForm.remark = '';
  openAuditModal();
}

function handleOpenExecute(row: Api.FinanceCenter.SettlementBill) {
  currentBill.value = row;
  executeForm.billId = row.id;
  executeForm.channelType = row.channelType;
  executeForm.externalNo = '';
  executeForm.markAsSuccess = row.channelType === 'BANK_TRANSFER' || row.channelType === 'OFFLINE_TRANSFER';
  executeForm.remark = '';
  openExecuteModal();
}

async function submitAudit() {
  submitting.value = true;
  try {
    await fetchAuditSettlementBill(auditForm);
    window.$message?.success(auditForm.action === 'APPROVE' ? '审核通过' : '审核已驳回');
    closeAuditModal();
    await getData();
  } finally {
    submitting.value = false;
  }
}

async function submitExecute() {
  submitting.value = true;
  try {
    await fetchExecuteSettlementBill(executeForm);
    window.$message?.success('结算执行请求已提交');
    closeExecuteModal();
    await getData();
    if (currentBill.value) {
      await handleViewDetail(currentBill.value);
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <FinanceSearchCard collapse-name="settlement-bill-search">
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
          <NFormItemGi span="24 s:12 m:8 l:6" label="结算单号" path="billNo">
            <NInput v-model:value="searchParams.billNo" placeholder="请输入结算单号" clearable />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="订单号" path="orderSn">
            <NInput v-model:value="searchParams.orderSn" placeholder="请输入订单号" clearable />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="当前状态" path="status">
            <NSelect v-model:value="searchParams.status" clearable placeholder="请选择状态" :options="financeSettlementBillStatusOptions" />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="结算方式" path="channelType">
            <NSelect v-model:value="searchParams.channelType" clearable placeholder="请选择结算方式" :options="financeChannelOptions" />
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

    <NCard title="结算清单" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
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

    <NDrawer v-model:show="detailVisible" :width="980" placement="right">
      <NDrawerContent title="结算清单详情" closable @close="closeDetailDrawer">
        <NSpin :show="detailLoading">
          <template v-if="currentDetail">
            <NDescriptions bordered label-placement="left" :column="2">
              <NDescriptionsItem label="结算单号">{{ currentDetail.billNo }}</NDescriptionsItem>
              <NDescriptionsItem label="当前状态">{{ getFinanceSettlementBillStatusLabel(currentDetail.status) }}</NDescriptionsItem>
              <NDescriptionsItem label="订单号">{{ currentDetail.order.orderSn }}</NDescriptionsItem>
              <NDescriptionsItem label="所属租户">
                {{ getFinanceTenantLabel(currentDetail.tenantId, tenantLabelMap) }}
                <span class="ml-8px text-12px text-gray-500">{{ currentDetail.tenantId }}</span>
              </NDescriptionsItem>
              <NDescriptionsItem label="订单实收">¥{{ currentDetail.totalAmount.toFixed(2) }}</NDescriptionsItem>
              <NDescriptionsItem label="门店应收">¥{{ currentDetail.storeAmount.toFixed(2) }}</NDescriptionsItem>
              <NDescriptionsItem label="佣金合计">¥{{ currentDetail.commissionAmount.toFixed(2) }}</NDescriptionsItem>
              <NDescriptionsItem label="跨店金额">¥{{ currentDetail.crossTenantAmount.toFixed(2) }}</NDescriptionsItem>
            </NDescriptions>

            <NDivider title-placement="left">收款记录</NDivider>
            <NDescriptions bordered :column="2" label-placement="left">
              <NDescriptionsItem label="支付通道">
                {{ getFinanceChannelLabel(currentDetail.payRecord?.channelType) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="支付状态">
                {{ getFinancePaymentStatusLabel(currentDetail.payRecord?.status) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="交易流水">{{ currentDetail.payRecord?.transactionId || '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="支付时间">{{ currentDetail.payRecord?.payTime || '-' }}</NDescriptionsItem>
            </NDescriptions>

            <NDivider title-placement="left">结算明细</NDivider>
            <NDataTable
              :columns="[
                {
                  key: 'receiverType',
                  title: '接收方类型',
                  width: 120,
                  render: (row: Api.FinanceCenter.SettlementBillItem) => getFinanceReceiverTypeLabel(row.receiverType)
                },
                {
                  key: 'receiverName',
                  title: '接收方名称',
                  minWidth: 180,
                  render: (row: Api.FinanceCenter.SettlementBillItem) => row.receiverName || row.receiverId
                },
                {
                  key: 'channelType',
                  title: '结算方式',
                  width: 130,
                  render: (row: Api.FinanceCenter.SettlementBillItem) => getFinanceChannelLabel(row.channelType)
                },
                {
                  key: 'amount',
                  title: '金额',
                  width: 100,
                  render: (row: Api.FinanceCenter.SettlementBillItem) => `¥${Number(row.amount).toFixed(2)}`
                },
                { key: 'reason', title: '说明', minWidth: 200, ellipsis: { tooltip: true } }
              ]"
              :data="currentDetail.items"
              :pagination="false"
              size="small"
            />

            <NDivider title-placement="left">审核记录</NDivider>
            <NDataTable
              :columns="[
                {
                  key: 'action',
                  title: '审核动作',
                  width: 110,
                  render: (row: Api.FinanceCenter.SettlementBillAuditLog) => (row.action === 'APPROVE' ? '审核通过' : '审核驳回')
                },
                { key: 'auditBy', title: '审核人', width: 140 },
                { key: 'remark', title: '备注', minWidth: 200, ellipsis: { tooltip: true } },
                { key: 'createTime', title: '时间', width: 170 }
              ]"
              :data="currentDetail.audits"
              :pagination="false"
              size="small"
            />

            <NDivider title-placement="left">执行记录</NDivider>
            <div
              v-for="execution in currentDetail.executions"
              :key="execution.id"
              class="mb-16px rounded-8px border border-gray-200 p-12px"
            >
              <div class="mb-8px flex items-center justify-between">
                <strong>{{ execution.executeNo }}</strong>
                <NTag :type="executionStatusTagMap[execution.status] ?? 'default'">
                  {{ getFinanceSettlementExecutionStatusLabel(execution.status) }}
                </NTag>
              </div>
              <div class="mb-8px text-13px text-gray-500">
                方式：{{ getFinanceChannelLabel(execution.channelType) }} / 外部流水：{{ execution.externalNo || '-' }}
              </div>
              <NDataTable
                :columns="[
                  { key: 'stage', title: '阶段', width: 120 },
                  { key: 'message', title: '说明', minWidth: 240, ellipsis: { tooltip: true } },
                  { key: 'createTime', title: '时间', width: 170 }
                ]"
                :data="execution.logs"
                :pagination="false"
                size="small"
              />
            </div>
          </template>
        </NSpin>
      </NDrawerContent>
    </NDrawer>

    <NModal
      v-model:show="auditVisible"
      preset="dialog"
      title="审核结算清单"
      positive-text="提交"
      negative-text="取消"
      @positive-click="submitAudit"
    >
      <NForm :model="auditForm" label-placement="left">
        <NFormItem label="审核结果">
          <NSelect
            v-model:value="auditForm.action"
            :options="[
              { label: '审核通过', value: 'APPROVE' },
              { label: '审核驳回', value: 'REJECT' }
            ]"
          />
        </NFormItem>
        <NFormItem label="审核备注">
          <NInput v-model:value="auditForm.remark" type="textarea" :rows="3" placeholder="请输入审核说明" />
        </NFormItem>
      </NForm>
    </NModal>

    <NModal
      v-model:show="executeVisible"
      preset="dialog"
      title="执行结算"
      positive-text="提交"
      negative-text="取消"
      @positive-click="submitExecute"
    >
      <NForm :model="executeForm" label-placement="left">
        <NFormItem label="结算方式">
          <NSelect v-model:value="executeForm.channelType" :options="financeChannelOptions" />
        </NFormItem>
        <NFormItem label="外部流水号">
          <NInput v-model:value="executeForm.externalNo" placeholder="请输入微信流水号或银行回单号" />
        </NFormItem>
        <NFormItem label="直接记为成功">
          <NSwitch v-model:value="executeForm.markAsSuccess" />
        </NFormItem>
        <NFormItem label="执行备注">
          <NInput v-model:value="executeForm.remark" type="textarea" :rows="3" placeholder="请输入执行说明" />
        </NFormItem>
      </NForm>
    </NModal>
  </div>
</template>
