<script setup lang="tsx">
import { ref } from 'vue';
import { NAvatar, NButton, NCard, NDataTable, NInput, NInputNumber, NPopover, NSpace, useMessage } from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import { fetchGetStockList, fetchUpdateStock } from '@/service/api/store/stock';
import { useDownload } from '@/hooks/business/download';
import { useTable, useTableOperate } from '@/hooks/common/table';
import { $t } from '@/locales';
import BatchStockModal from './modules/batch-stock-modal.vue';

defineOptions({
  name: 'StoreStock',
});

const message = useMessage();
const { getDownload } = useDownload();
const { bool: batchModalVisible, setTrue: openBatchModal } = useBoolean();

function StockUpdatePopover(props: { row: Api.Store.StockSku; type: 'add' | 'reduce'; onSuccess: () => void }) {
  const amount = ref(0);
  const reason = ref('');
  const submitLoading = ref(false);

  async function handleUpdate() {
    if (amount.value <= 0) return;
    submitLoading.value = true;
    try {
      const change = props.type === 'add' ? amount.value : -amount.value;
      await fetchUpdateStock({
        skuId: props.row.id,
        stockChange: change,
        reason: reason.value || undefined,
      });
      message.success($t('page.store_stock.msgUpdated'));
      props.onSuccess();
      amount.value = 0;
      reason.value = '';
    } finally {
      submitLoading.value = false;
    }
  }

  const btnType = props.type === 'add' ? 'primary' : 'warning';
  const btnText = props.type === 'add' ? $t('page.store_stock.btnAdd') : $t('page.store_stock.btnReduce');
  const qtyLabel =
    props.type === 'add' ? $t('page.store_stock.popoverQtyLabelAdd') : $t('page.store_stock.popoverQtyLabelReduce');

  return (
    <NPopover trigger="click" placement="bottom">
      {{
        trigger: () => (
          <NButton size="small" type={btnType} secondary>
            {btnText}
          </NButton>
        ),
        default: () => (
          <NSpace vertical class="min-w-200px">
            <span class="text-12px text-gray">{qtyLabel}</span>
            <NInputNumber v-model:value={amount.value} min={1} class="w-full" />
            <span class="text-12px text-gray">{$t('page.store_stock.popoverReasonLabel')}</span>
            <NInput v-model:value={reason.value} placeholder={$t('page.store_stock.popoverReasonPh')} clearable />
            <NButton type="primary" size="small" block loading={submitLoading.value} onClick={handleUpdate}>
              {$t('common.confirm')}
            </NButton>
          </NSpace>
        ),
      }}
    </NPopover>
  );
}

const { columns, data, getData, loading, mobilePagination, searchParams, resetSearchParams } = useTable({
  apiFn: fetchGetStockList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    productName: null,
  },
  columns: () => [
    {
      type: 'selection',
      align: 'center',
      width: 48,
    },
    {
      key: 'product',
      title: $t('page.store_stock.columnProduct'),
      width: 200,
      render: (row) => {
        const img = row.tenantProd?.product?.mainImages?.[0];
        return (
          <NSpace align="center">
            {img && <NAvatar src={img} size={40} />}
            <span>{row.tenantProd?.product?.name ?? '-'}</span>
          </NSpace>
        );
      },
    },
    {
      key: 'specs',
      title: $t('page.store_stock.columnSpecs'),
      width: 150,
      render: (row) => {
        if (!row.globalSku?.specValues) return '-';
        return Object.values(row.globalSku.specValues).join(' / ');
      },
    },
    {
      key: 'currentStock',
      title: $t('page.store_stock.columnStock'),
      width: 100,
      align: 'center',
      render: (row) => <span class="text-16px font-bold">{row.stock}</span>,
    },
    {
      key: 'operate',
      title: $t('page.store_stock.columnQuickAdjust'),
      align: 'center',
      width: 240,
      render: (row) => (
        <NSpace justify="center">
          <StockUpdatePopover row={row} type="add" onSuccess={getData} />
          <StockUpdatePopover row={row} type="reduce" onSuccess={getData} />
        </NSpace>
      ),
    },
  ],
});

const { checkedRowKeys } = useTableOperate(data, getData);

const selectedRows = () => {
  if (!checkedRowKeys.value.length) return [];
  return data.value.filter((row) => checkedRowKeys.value.includes(row.id));
};

function handleBatchAdjust() {
  const rows = selectedRows();
  if (rows.length === 0) {
    message.warning($t('page.store_stock.msgSelectSku'));
    return;
  }
  openBatchModal();
}

function handleBatchSubmitted() {
  checkedRowKeys.value = [];
  getData();
}

function handleExport() {
  const params: Record<string, string | number | null> = {
    productName: searchParams.productName ?? '',
  };
  const date = new Date().toISOString().slice(0, 10);
  getDownload('/store/stock/export', params, $t('page.store_stock.exportFilename', { date }));
}
</script>

<template>
  <div class="h-full overflow-hidden">
    <NCard :title="$t('page.store_stock.cardTitle')" :bordered="false" class="h-full rounded-8px shadow-sm">
      <div class="h-full flex-col-stretch gap-12px">
        <NSpace justify="space-between" wrap>
          <NSpace wrap>
            <NInput
              v-model:value="searchParams.productName"
              :placeholder="$t('page.store_stock.searchPlaceholder')"
              clearable
              style="width: 200px"
              @keydown.enter="getData"
            />
            <NButton type="primary" @click="getData">{{ $t('page.store_stock.search') }}</NButton>
            <NButton @click="resetSearchParams">{{ $t('page.store_stock.reset') }}</NButton>
            <NButton :disabled="checkedRowKeys.length === 0" @click="handleBatchAdjust">
              {{ $t('page.store_stock.batchAdjust') }}
              <template v-if="checkedRowKeys.length > 0">({{ checkedRowKeys.length }})</template>
            </NButton>
            <NButton @click="handleExport">{{ $t('page.store_stock.export') }}</NButton>
          </NSpace>
        </NSpace>
        <NDataTable
          v-model:checked-row-keys="checkedRowKeys"
          :columns="columns"
          :data="data"
          :loading="loading"
          remote
          :row-key="(row) => row.id"
          :pagination="mobilePagination"
          class="flex-1-hidden"
        />
      </div>
    </NCard>
    <BatchStockModal v-model:visible="batchModalVisible" :rows="selectedRows()" @submitted="handleBatchSubmitted" />
  </div>
</template>

<style scoped></style>
