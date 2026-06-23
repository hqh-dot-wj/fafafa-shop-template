<script setup lang="tsx">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NInput, NModal, NRadio, NRadioGroup, NSpace, NSwitch, NTag } from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import {
  fetchBatchRefund,
  fetchBatchTransitionOrderStatus,
  fetchBatchUpdateOrderRemark,
  fetchBatchVerify,
  fetchGetOrderList,
} from '@/service/api/store/order';
import { reportActionError } from '@/service/request/error-monitoring';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { useDownload } from '@/hooks/business/download';
import { useTable, useTableOperate, useTableProps } from '@/hooks/common/table';
import BatchOperationResultModal from '@/components/custom/batch-operation-result-modal.vue';
import { $t } from '@/locales';
import { getRoutePath } from '@/router/elegant/transform';
import ButtonIcon from '@/components/custom/button-icon.vue';
import OrderSearch from './modules/order-search.vue';
import { buildOrderExportQueryParams } from './order-export-query';

defineOptions({
  name: 'OrderList',
});

const router = useRouter();
const appStore = useAppStore();
const { hasAuth } = useAuth();
const tableProps = useTableProps();
const { getDownload } = useDownload();

const { bool: batchVerifyVisible, setTrue: openBatchVerify, setFalse: closeBatchVerify } = useBoolean(false);
const { bool: batchRefundVisible, setTrue: openBatchRefund, setFalse: closeBatchRefund } = useBoolean(false);
const {
  bool: batchRemarkModalVisible,
  setTrue: openBatchRemarkModal,
  setFalse: closeBatchRemarkModal,
} = useBoolean(false);
const { bool: batchStatusVisible, setTrue: openBatchStatusModal, setFalse: closeBatchStatusModal } = useBoolean(false);
const batchRemark = ref('');
const batchLoading = ref(false);
const remarkFormContent = ref('');
const remarkAppend = ref(true);
const batchResultVisible = ref(false);
const batchResultTitle = ref('');
const batchResultPayload = ref<Api.Order.BatchOperationResult | null>(null);
const batchStatusTarget = ref<'SHIP' | 'COMPLETE_RECEIPT'>('SHIP');

function openBatchResultModal(title: string, payload: Api.Order.BatchOperationResult) {
  batchResultTitle.value = title;
  batchResultPayload.value = payload;
  batchResultVisible.value = true;
}

const orderStatusRecord = computed<Record<string, { label: string; type: NaiveUI.ThemeColor }>>(() => ({
  PENDING_PAY: { label: $t('page.store_order_detail.orderStatus.PENDING_PAY'), type: 'warning' },
  PAID: { label: $t('page.store_order_detail.orderStatus.PAID'), type: 'info' },
  SHIPPED: { label: $t('page.store_order_detail.orderStatus.SHIPPED'), type: 'primary' },
  COMPLETED: { label: $t('page.store_order_detail.orderStatus.COMPLETED'), type: 'success' },
  CANCELLED: { label: $t('page.store_order_detail.orderStatus.CANCELLED'), type: 'default' },
  REFUNDED: { label: $t('page.store_order_detail.orderStatus.REFUNDED'), type: 'error' },
}));

const orderTypeRecord = computed<Record<string, string>>(() => ({
  PRODUCT: $t('page.store_order_list.orderType.PRODUCT'),
  SERVICE: $t('page.store_order_list.orderType.SERVICE'),
}));

const {
  columns,
  columnChecks,
  data,
  getData,
  getDataByPage,
  loading,
  mobilePagination,
  scrollX,
  searchParams,
  resetSearchParams,
} = useTable({
  apiFn: fetchGetOrderList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    orderSn: null,
    receiverPhone: null,
    status: null,
    orderType: null,
    'params.beginTime': null,
    'params.endTime': null,
  },
  columns: () => [
    {
      type: 'selection',
      align: 'center',
      width: 48,
    },
    {
      key: 'index',
      title: $t('common.index'),
      align: 'center',
      width: 64,
    },
    {
      key: 'orderSn',
      title: $t('page.store_order_list.columnOrderSn'),
      align: 'center',
      minWidth: 180,
    },
    {
      key: 'orderType',
      title: $t('page.store_order_list.columnOrderType'),
      align: 'center',
      minWidth: 100,
      render: (row) => orderTypeRecord.value[row.orderType] || row.orderType,
    },
    {
      key: 'receiverName',
      title: $t('page.store_order_list.columnReceiverName'),
      align: 'center',
      minWidth: 100,
    },
    {
      key: 'payAmount',
      title: $t('page.store_order_list.columnPayAmount'),
      align: 'center',
      minWidth: 100,
      render: (row) => `¥${row.payAmount}`,
    },
    {
      key: 'status',
      title: $t('page.store_order_list.columnStatus'),
      align: 'center',
      minWidth: 100,
      render: (row) => {
        const status = orderStatusRecord.value[row.status];
        return status ? <NTag type={status.type}>{status.label}</NTag> : row.status;
      },
    },
    {
      key: 'productImg',
      title: $t('page.store_order_list.columnProductImg'),
      align: 'center',
      width: 80,
      render: (row) => (
        <div class="h-40px w-40px flex-center overflow-hidden rounded-4px bg-gray-100">
          {row.productImg ? (
            <img src={row.productImg} class="h-full w-full object-cover" />
          ) : (
            <span>{$t('page.store_order_list.noImage')}</span>
          )}
        </div>
      ),
    },
    {
      key: 'receiverPhone',
      title: $t('page.store_order_list.columnReceiverPhone'),
      align: 'center',
      minWidth: 120,
    },
    {
      key: 'commissionAmount',
      title: $t('page.store_order_list.columnCommissionAmount'),
      align: 'center',
      minWidth: 100,
      render: (row) => {
        const amount = Number(row.commissionAmount || 0);
        if (amount === 0) {
          return <span class="text-gray">-¥0.00</span>;
        }
        return <span class="text-error font-medium">-¥{amount.toFixed(2)}</span>;
      },
    },
    {
      key: 'remainingAmount',
      title: $t('page.store_order_list.columnRemainingAmount'),
      align: 'center',
      minWidth: 100,
      render: (row) => {
        const amount = Number(row.remainingAmount || row.payAmount || 0);
        return <span class="text-success font-medium">¥{amount.toFixed(2)}</span>;
      },
    },
    {
      key: 'receiverAddress',
      title: $t('page.store_order_list.columnReceiverAddress'),
      align: 'center',
      minWidth: 200,
      ellipsis: {
        tooltip: true,
      },
    },
    {
      key: 'tenantName',
      title: $t('page.store_order_list.columnTenantName'),
      align: 'center',
      minWidth: 120,
    },
    {
      key: 'createTime',
      title: $t('page.store_order_list.columnCreateTime'),
      align: 'center',
      minWidth: 160,
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 200,
      fixed: 'right',
      render: (row) => {
        return (
          <div class="flex-center flex-wrap gap-4px">
            {hasAuth('store:order:query') && (
              <ButtonIcon
                text
                type="primary"
                icon="material-symbols:visibility-outline"
                tooltipContent={$t('page.store_order_list.tooltipViewDetail')}
                onClick={() => handleViewDetail(row.id)}
              />
            )}
            {hasAuth('store:order:query') && (
              <ButtonIcon
                text
                type="primary"
                icon="material-symbols:policy-outline"
                tooltipContent={$t('page.store_order_list.tooltipActivityAudit')}
                onClick={() =>
                  router.push({ path: getRoutePath('store_order_activity-audit'), query: { orderId: row.id } })
                }
              />
            )}
            {hasAuth('finance:commission:list') && (
              <ButtonIcon
                text
                type="primary"
                icon="material-symbols:account-balance-wallet-outline"
                tooltipContent={$t('page.store_order_list.tooltipCommissionAudit')}
                onClick={() =>
                  router.push({
                    path: getRoutePath('store_finance_commission-audit'),
                    query: { orderId: row.id },
                  })
                }
              />
            )}
          </div>
        );
      },
    },
  ],
});

const { checkedRowKeys } = useTableOperate(data, getData);

const selectedOrderIds = () => {
  if (!checkedRowKeys.value.length) return [];
  return data.value.filter((row) => checkedRowKeys.value.includes(row.id)).map((r) => r.id);
};

function handleViewDetail(orderId: string) {
  router.push({ path: getRoutePath('store_order_detail'), query: { id: orderId } });
}

function handleExport() {
  const params = buildOrderExportQueryParams(searchParams);
  const date = new Date().toISOString().slice(0, 10);
  getDownload('/store/order/export', params, $t('page.store_order_list.exportFilename', { date }));
}

function handleBatchVerify() {
  const ids = selectedOrderIds();
  if (ids.length === 0) {
    window.$message?.warning($t('page.store_order_list.msgSelectVerify'));
    return;
  }
  batchRemark.value = '';
  openBatchVerify();
}

async function submitBatchVerify() {
  const ids = selectedOrderIds();
  if (ids.length === 0) return;
  batchLoading.value = true;
  try {
    const { data: batchRes } = await fetchBatchVerify({ orderIds: ids, remark: batchRemark.value || undefined });
    if (!batchRes) return;
    window.$message?.success(
      $t('page.store_order_list.batchVerifyDone', { ok: batchRes.successCount, fail: batchRes.failCount }),
    );
    closeBatchVerify();
    checkedRowKeys.value = [];
    getData();
    if (batchRes.failCount > 0) {
      openBatchResultModal($t('page.store_order_list.batchVerifyResultTitle'), batchRes);
    }
  } catch (error) {
    reportActionError(error, {
      module: 'store-order',
      operationCode: 'order.batchVerify',
      stepCode: 'order.batchVerify.submit',
      stepName: '提交批量核销',
      metadata: { orderIds: ids },
    });
  } finally {
    batchLoading.value = false;
  }
}

function handleBatchRefund() {
  const ids = selectedOrderIds();
  if (ids.length === 0) {
    window.$message?.warning($t('page.store_order_list.msgSelectRefund'));
    return;
  }
  batchRemark.value = '';
  openBatchRefund();
}

async function submitBatchRefund() {
  const ids = selectedOrderIds();
  if (ids.length === 0) return;
  batchLoading.value = true;
  try {
    const { data: batchRes } = await fetchBatchRefund({ orderIds: ids, remark: batchRemark.value || undefined });
    if (!batchRes) return;
    window.$message?.success(
      $t('page.store_order_list.batchRefundDone', { ok: batchRes.successCount, fail: batchRes.failCount }),
    );
    closeBatchRefund();
    checkedRowKeys.value = [];
    getData();
    if (batchRes.failCount > 0) {
      openBatchResultModal($t('page.store_order_list.batchRefundResultTitle'), batchRes);
    }
  } catch (error) {
    reportActionError(error, {
      module: 'store-order',
      operationCode: 'order.batchRefund',
      stepCode: 'order.batchRefund.submit',
      stepName: '提交批量退款',
      metadata: { orderIds: ids },
    });
  } finally {
    batchLoading.value = false;
  }
}

function handleBatchStatusTransition() {
  const ids = selectedOrderIds();
  if (ids.length === 0) {
    window.$message?.warning($t('page.store_order_list.msgSelectOrders'));
    return;
  }
  batchStatusTarget.value = 'SHIP';
  batchRemark.value = '';
  openBatchStatusModal();
}

async function submitBatchStatusTransition() {
  const ids = selectedOrderIds();
  if (ids.length === 0) return;
  const target = batchStatusTarget.value;
  batchLoading.value = true;
  try {
    const { data: batchRes } = await fetchBatchTransitionOrderStatus({
      orderIds: ids,
      target,
      remark: batchRemark.value.trim() || undefined,
    });
    if (!batchRes) return;
    const doneMsg =
      target === 'SHIP'
        ? $t('page.store_order_list.batchShipDone', { ok: batchRes.successCount, fail: batchRes.failCount })
        : $t('page.store_order_list.batchReceiveDone', { ok: batchRes.successCount, fail: batchRes.failCount });
    window.$message?.success(doneMsg);
    closeBatchStatusModal();
    checkedRowKeys.value = [];
    getData();
    if (batchRes.failCount > 0) {
      openBatchResultModal(
        target === 'SHIP'
          ? $t('page.store_order_list.batchShipResultTitle')
          : $t('page.store_order_list.batchReceiveResultTitle'),
        batchRes,
      );
    }
  } catch (error) {
    reportActionError(error, {
      module: 'store-order',
      operationCode: 'order.batchStatusTransition',
      stepCode: 'order.batchStatusTransition.submit',
      stepName: '提交批量状态流转',
      metadata: { orderIds: ids, target },
    });
  } finally {
    batchLoading.value = false;
  }
}

function handleBatchRemark() {
  const ids = selectedOrderIds();
  if (ids.length === 0) {
    window.$message?.warning($t('page.store_order_list.msgSelectRemark'));
    return;
  }
  remarkFormContent.value = '';
  remarkAppend.value = true;
  openBatchRemarkModal();
}

async function submitBatchRemark() {
  const ids = selectedOrderIds();
  if (ids.length === 0) return false;
  const text = remarkFormContent.value.trim();
  if (!text) {
    window.$message?.warning($t('page.store_order_list.msgRemarkRequired'));
    return false;
  }
  batchLoading.value = true;
  try {
    const { data: batchRes } = await fetchBatchUpdateOrderRemark({
      orderIds: ids,
      remark: text,
      append: remarkAppend.value,
    });
    if (!batchRes) return false;
    window.$message?.success(
      $t('page.store_order_list.batchRemarkDone', { ok: batchRes.successCount, fail: batchRes.failCount }),
    );
    closeBatchRemarkModal();
    checkedRowKeys.value = [];
    getData();
    if (batchRes.failCount > 0) {
      openBatchResultModal($t('page.store_order_list.batchRemarkResultTitle'), batchRes);
    }
    return true;
  } catch (error) {
    reportActionError(error, {
      module: 'store-order',
      operationCode: 'order.batchRemark',
      stepCode: 'order.batchRemark.submit',
      stepName: '提交批量备注',
      metadata: { orderIds: ids },
    });
    return false;
  } finally {
    batchLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <OrderSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <NCard
      :title="$t('page.store_order_list.cardTitle')"
      :bordered="false"
      size="small"
      class="card-wrapper sm:flex-1-hidden"
    >
      <template #header-extra>
        <NSpace>
          <NButton v-if="hasAuth('store:order:export')" @click="handleExport">{{
            $t('page.store_order_list.export')
          }}</NButton>
          <NButton
            v-if="hasAuth('store:order:verify')"
            :disabled="selectedOrderIds().length === 0"
            @click="handleBatchVerify"
          >
            {{ $t('page.store_order_list.batchVerify') }}
            <template v-if="selectedOrderIds().length">({{ selectedOrderIds().length }})</template>
          </NButton>
          <NButton
            v-if="hasAuth('store:order:refund')"
            :disabled="selectedOrderIds().length === 0"
            type="error"
            @click="handleBatchRefund"
          >
            {{ $t('page.store_order_list.batchRefund') }}
            <template v-if="selectedOrderIds().length">({{ selectedOrderIds().length }})</template>
          </NButton>
          <NButton
            v-if="hasAuth('store:order:list')"
            :disabled="selectedOrderIds().length === 0"
            secondary
            @click="handleBatchStatusTransition"
          >
            {{ $t('page.store_order_list.batchShipReceive') }}
            <template v-if="selectedOrderIds().length">({{ selectedOrderIds().length }})</template>
          </NButton>
          <NButton
            v-if="hasAuth('store:order:list')"
            :disabled="selectedOrderIds().length === 0"
            secondary
            @click="handleBatchRemark"
          >
            {{ $t('page.store_order_list.batchRemark') }}
            <template v-if="selectedOrderIds().length">({{ selectedOrderIds().length }})</template>
          </NButton>
          <TableHeaderOperation
            v-model:columns="columnChecks"
            :loading="loading"
            :show-add="false"
            :show-delete="false"
            @refresh="getData"
          />
        </NSpace>
      </template>
      <NDataTable
        v-model:checked-row-keys="checkedRowKeys"
        :columns="columns"
        :data="data"
        v-bind="tableProps"
        :flex-height="!appStore.isMobile"
        :scroll-x="scrollX"
        :loading="loading"
        remote
        :row-key="(row) => row.id"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
    </NCard>

    <NModal
      v-model:show="batchVerifyVisible"
      :title="$t('page.store_order_list.modalBatchVerifyTitle')"
      preset="dialog"
      :positive-text="$t('page.store_order_list.modalBatchVerifyConfirm')"
      :loading="batchLoading"
      @positive-click="submitBatchVerify"
    >
      <NInput
        v-model:value="batchRemark"
        type="textarea"
        :placeholder="$t('page.store_order_list.modalBatchVerifyRemarkPh')"
        :rows="3"
        class="mt-12px"
      />
    </NModal>

    <NModal
      v-model:show="batchStatusVisible"
      :title="$t('page.store_order_list.modalBatchStatusTitle')"
      preset="dialog"
      :positive-text="$t('page.store_order_list.modalBatchStatusConfirm')"
      :loading="batchLoading"
      @positive-click="submitBatchStatusTransition"
    >
      <p class="text-14px text-gray-600">{{ $t('page.store_order_list.modalBatchStatusHint') }}</p>
      <NRadioGroup v-model:value="batchStatusTarget" class="radio-group-col mt-12px">
        <NRadio value="SHIP">{{ $t('page.store_order_list.modalBatchStatusRadioShip') }}</NRadio>
        <NRadio value="COMPLETE_RECEIPT">{{ $t('page.store_order_list.modalBatchStatusRadioComplete') }}</NRadio>
      </NRadioGroup>
      <NInput
        v-model:value="batchRemark"
        type="textarea"
        :placeholder="$t('page.store_order_list.modalBatchStatusRemarkPh')"
        :rows="3"
        class="mt-12px"
      />
    </NModal>

    <NModal
      v-model:show="batchRefundVisible"
      :title="$t('page.store_order_list.modalBatchRefundTitle')"
      preset="dialog"
      :positive-text="$t('page.store_order_list.modalBatchRefundConfirm')"
      :loading="batchLoading"
      @positive-click="submitBatchRefund"
    >
      <NInput
        v-model:value="batchRemark"
        type="textarea"
        :placeholder="$t('page.store_order_list.modalBatchRefundRemarkPh')"
        :rows="3"
        class="mt-12px"
      />
    </NModal>

    <NModal
      v-model:show="batchRemarkModalVisible"
      :title="$t('page.store_order_list.modalBatchRemarkTitle')"
      preset="dialog"
      :positive-text="$t('page.store_order_list.modalBatchRemarkConfirm')"
      :loading="batchLoading"
      @positive-click="submitBatchRemark"
    >
      <NInput
        v-model:value="remarkFormContent"
        type="textarea"
        :placeholder="$t('page.store_order_list.modalBatchRemarkPh')"
        :rows="4"
        maxlength="500"
        show-count
        class="mt-12px"
      />
      <div class="mt-16px flex items-center gap-12px text-14px">
        <span class="text-gray-600">{{ $t('page.store_order_list.remarkAppendLabel') }}</span>
        <NSwitch v-model:value="remarkAppend" />
      </div>
    </NModal>

    <BatchOperationResultModal
      v-model:show="batchResultVisible"
      :title="batchResultTitle"
      :id-column-title="$t('page.store_order_list.batchResultIdColumn')"
      :result="batchResultPayload"
    />
  </div>
</template>

<style scoped>
.text-success {
  color: #18a058;
  font-weight: 500;
}
.text-error {
  color: #d03050;
  font-weight: 500;
}
.text-gray {
  color: #999;
}
.font-medium {
  font-weight: 500;
}
</style>
