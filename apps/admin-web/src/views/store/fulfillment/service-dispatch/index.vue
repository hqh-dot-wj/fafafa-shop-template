<script setup lang="tsx">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { NModal, NTag } from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import { fetchAssignServiceFulfillment, fetchGetServiceDispatchList } from '@/service/api/store/fulfillment';
import { useAuth } from '@/hooks/business/auth';
import { useTable, useTableProps } from '@/hooks/common/table';
import { $t } from '@/locales';
import { getRoutePath } from '@/router/elegant/transform';
import ButtonIcon from '@/components/custom/button-icon.vue';
import DispatchWorkerPicker from '../modules/dispatch-worker-picker.vue';

defineOptions({
  name: 'FulfillmentServiceDispatch',
});

const router = useRouter();
const { hasAuth } = useAuth();

const { bool: reassignModalVisible, setTrue: openReassignModal, setFalse: closeReassignModal } = useBoolean(false);
const currentOrderId = ref('');
const newWorkerId = ref<number | null>(null);
const reassignLoading = ref(false);

const tableProps = useTableProps();
const { columns, columnChecks, data, getData, loading, mobilePagination, scrollX } = useTable({
  apiFn: fetchGetServiceDispatchList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    orderSn: null,
    receiverPhone: null,
  },
  columns: () => [
    {
      key: 'index',
      title: $t('common.index'),
      align: 'center',
      width: 64,
    },
    {
      key: 'orderSn',
      title: $t('page.store_order_dispatch.colOrderSn'),
      align: 'center',
      minWidth: 180,
    },
    {
      key: 'receiverName',
      title: $t('page.store_order_dispatch.colReceiverName'),
      align: 'center',
      minWidth: 100,
    },
    {
      key: 'receiverPhone',
      title: $t('page.store_order_dispatch.colReceiverPhone'),
      align: 'center',
      minWidth: 120,
    },
    {
      key: 'payAmount',
      title: $t('page.store_order_dispatch.colPayAmount'),
      align: 'center',
      minWidth: 100,
      render: (row) => `¥${row.payAmount}`,
    },
    {
      key: 'status',
      title: $t('page.store_order_dispatch.colStatus'),
      align: 'center',
      minWidth: 100,
      render: () => <NTag type="info">{$t('page.store_order_dispatch.statusPendingDispatch')}</NTag>,
    },
    {
      key: 'createTime',
      title: $t('page.store_order_dispatch.colCreateTime'),
      align: 'center',
      minWidth: 160,
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 160,
      render: (row) => (
        <div class="flex-center gap-8px">
          {hasAuth('store:order:query') && (
            <ButtonIcon
              text
              type="primary"
              icon="material-symbols:visibility-outline"
              tooltipContent={$t('page.store_order_dispatch.tooltipViewDetail')}
              onClick={() => handleViewDetail(row.id)}
            />
          )}
          {hasAuth('store:order:dispatch') && (
            <ButtonIcon
              text
              type="primary"
              icon="material-symbols:person-add-outline"
              tooltipContent={$t('page.store_order_dispatch.tooltipDispatch')}
              onClick={() => handleReassign(row.id)}
            />
          )}
        </div>
      ),
    },
  ],
});

function handleViewDetail(orderId: string) {
  router.push({ path: getRoutePath('store_order_detail'), query: { id: orderId } });
}

function handleReassign(orderId: string) {
  currentOrderId.value = orderId;
  newWorkerId.value = null;
  openReassignModal();
}

async function submitReassign() {
  if (
    !currentOrderId.value ||
    newWorkerId.value === null ||
    newWorkerId.value === undefined ||
    newWorkerId.value <= 0
  ) {
    window.$message?.warning($t('page.store_order_dispatch.msgWorkerRequired'));
    return;
  }
  reassignLoading.value = true;
  try {
    await fetchAssignServiceFulfillment({
      orderId: currentOrderId.value,
      workerId: newWorkerId.value,
    });
    window.$message?.success($t('page.store_order_dispatch.msgDispatchOk'));
    closeReassignModal();
    getData();
  } catch {
    throw new Error('dispatch failed');
  } finally {
    reassignLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 服务履约待派单列表，旧订单派单入口会跳转到本页。 -->
    <NCard
      :title="$t('page.store_order_dispatch.cardTitle')"
      :bordered="false"
      size="small"
      class="card-wrapper sm:flex-1-hidden"
    >
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
        :scroll-x="scrollX"
        :loading="loading"
        remote
        :row-key="(row) => row.id"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
    </NCard>

    <NModal
      v-model:show="reassignModalVisible"
      :title="$t('page.store_order_dispatch.modalTitle')"
      preset="dialog"
      :positive-text="$t('page.store_order_dispatch.modalConfirm')"
      :loading="reassignLoading"
      @positive-click="submitReassign"
    >
      <p class="mb-8px text-14px text-gray-600">{{ $t('page.store_order_dispatch.modalHint') }}</p>
      <DispatchWorkerPicker v-model:worker-id="newWorkerId" :active="reassignModalVisible" />
    </NModal>
  </div>
</template>
