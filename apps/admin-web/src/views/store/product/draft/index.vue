<script setup lang="tsx">
import { computed, ref } from 'vue';
import { NButton, NCard, NDataTable, NPopconfirm, NSpace, NTabPane, NTabs, NTag, useMessage } from 'naive-ui';
import {
  fetchBatchSubmitStoreProductAudit,
  fetchGetStoreProductDraftList,
  fetchRemoveProduct,
  fetchSubmitStoreProductAudit,
} from '@/service/api/store/product';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { useTable, useTableOperate } from '@/hooks/common/table';
import { createOperationId } from '@/utils/operation-id';
import TableHeaderOperation from '@/components/advanced/table-header-operation.vue';
import { $t } from '@/locales';
import ProductOperateDrawer from '../list/modules/product-operate-drawer.vue';
import BatchPriceModal from '../list/modules/batch-price-modal.vue';
import BatchCommissionModal from '../list/modules/batch-commission-modal.vue';
import DraftSearch from './modules/draft-search.vue';

defineOptions({
  name: 'StoreProductDraft',
});

type TenantProductRow = Api.Store.TenantProduct & { index: number };

const appStore = useAppStore();
const message = useMessage();
const { hasAuth } = useAuth();
const activeTab = ref<'DRAFT' | 'REJECTED'>('DRAFT');
const batchSubmitting = ref(false);
const batchPriceVisible = ref(false);
const batchCommissionVisible = ref(false);

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
  apiFn: fetchGetStoreProductDraftList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    name: null,
    type: null,
    status: null,
    auditStatus: 'DRAFT',
  },
  columns: () => [
    { type: 'selection', align: 'center', width: 48 },
    {
      key: 'index',
      title: $t('common.index'),
      align: 'center',
      width: 64,
      render: (row: TenantProductRow) => row.index,
    },
    {
      key: 'name',
      title: $t('page.store_product_draft.columnProductInfo'),
      align: 'left',
      minWidth: 220,
      render: (row) => (
        <div class="flex items-center gap-2">
          <img src={row.albumPics?.split(',')[0]} class="h-12 w-12 border rounded object-cover" />
          <div class="flex flex-col">
            <span class="font-bold">{row.customTitle || row.name}</span>
            {row.customTitle && (
              <span class="text-xs text-gray-400">
                {$t('page.store_product_draft.originalTitlePrefix')} {row.name}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'auditStatus',
      title: $t('page.store_product_draft.columnAuditStatus'),
      align: 'center',
      width: 110,
      render: (row) => {
        const map: Record<string, { label: string; type: NaiveUI.ThemeColor }> = {
          DRAFT: { label: $t('page.store_product_draft.auditDraft'), type: 'default' },
          REJECTED: { label: $t('page.store_product_draft.auditRejected'), type: 'error' },
        };
        const item = map[row.auditStatus] || { label: row.auditStatus, type: 'default' };
        return <NTag type={item.type}>{item.label}</NTag>;
      },
    },
    {
      key: 'auditReason',
      title: $t('page.store_product_draft.columnRejectReason'),
      align: 'left',
      minWidth: 220,
      ellipsis: { tooltip: true },
      render: (row) => row.auditReason || $t('page.store_product_draft.dash'),
    },
    {
      key: 'submittedAt',
      title: $t('page.store_product_draft.columnSubmittedAt'),
      align: 'center',
      width: 180,
      render: (row) => row.submittedAt || $t('page.store_product_draft.dash'),
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 220,
      render: (row) => (
        <NSpace justify="center">
          <NButton size="small" ghost onClick={() => handleContinueEdit(row)}>
            {$t('page.store_product_draft.continueEdit')}
          </NButton>
          {hasAuth('store:product:update') && (
            <>
              <NPopconfirm onPositiveClick={() => handleSubmitAudit(row.id)}>
                {{
                  default: () => $t('page.store_product_draft.popSubmitAudit'),
                  trigger: () => (
                    <NButton size="small" type="warning" ghost>
                      {$t('page.store_product_draft.submitAudit')}
                    </NButton>
                  ),
                }}
              </NPopconfirm>
              <NPopconfirm onPositiveClick={() => handleRemove(row.id)}>
                {{
                  default: () => $t('page.store_product_draft.popRemoveDraft'),
                  trigger: () => (
                    <NButton size="small" type="error" ghost>
                      {$t('page.store_product_draft.removeDraft')}
                    </NButton>
                  ),
                }}
              </NPopconfirm>
            </>
          )}
        </NSpace>
      ),
    },
  ],
});

const { drawerVisible, operateType, editingData, edit, checkedRowKeys } = useTableOperate<TenantProductRow>(
  data,
  getData,
);

const selectedIds = computed(() => checkedRowKeys.value as string[]);
const selectedProducts = computed(() => {
  if (!checkedRowKeys.value.length) return [];
  return data.value.filter((row) => checkedRowKeys.value.includes(row.id));
});
const hasSelectedWithSkus = computed(() => selectedProducts.value.some((product) => product.skus?.length));

async function handleSubmitAudit(id: string) {
  await fetchSubmitStoreProductAudit(id, { operationId: createOperationId() });
  message.success($t('page.store_product_draft.msgSubmitQueued'));
  getData();
}

async function handleBatchSubmitAudit() {
  if (!selectedIds.value.length) {
    message.warning($t('page.store_product_draft.msgSelectDrafts'));
    return;
  }

  batchSubmitting.value = true;
  let ok = 0;
  let fail = 0;
  try {
    const { data: batchRes } = await fetchBatchSubmitStoreProductAudit({
      items: selectedIds.value,
      operationId: createOperationId(),
    });
    ok = batchRes?.successCount || 0;
    fail = batchRes?.failCount || 0;
  } finally {
    batchSubmitting.value = false;
  }
  checkedRowKeys.value = [];
  message.success($t('page.store_product_draft.msgBatchSubmitDone', { ok, fail }));
  getData();
}

async function handleRemove(id: string) {
  await fetchRemoveProduct({ id });
  message.success($t('page.store_product_draft.msgRemoved'));
  getData();
}

function handleContinueEdit(row: TenantProductRow) {
  edit(row);
}

function openBatchPrice() {
  batchPriceVisible.value = true;
}

function openBatchCommission() {
  batchCommissionVisible.value = true;
}

function handleBatchSkuSubmitted() {
  checkedRowKeys.value = [];
  getData();
}

function handleResetSearchParams() {
  resetSearchParams();
  searchParams.auditStatus = activeTab.value;
}

function handleTabChange(value: string) {
  const next = value as 'DRAFT' | 'REJECTED';
  activeTab.value = next;
  searchParams.auditStatus = next;
  searchParams.pageNum = 1;
  checkedRowKeys.value = [];
  getData();
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <DraftSearch v-model:model="searchParams" @reset="handleResetSearchParams" @search="getDataByPage" />
    <NCard
      :title="$t('route.store_product_draft')"
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
        >
          <template #after>
            <template v-if="hasAuth('store:product:update')">
              <NButton size="small" ghost type="primary" :disabled="!hasSelectedWithSkus" @click="openBatchPrice">
                批量调价
              </NButton>
              <NButton size="small" ghost type="primary" :disabled="!hasSelectedWithSkus" @click="openBatchCommission">
                批量改分佣
              </NButton>
              <NButton
                size="small"
                type="warning"
                ghost
                :loading="batchSubmitting"
                :disabled="selectedIds.length === 0"
                @click="handleBatchSubmitAudit"
              >
                {{ $t('page.store_product_draft.batchSubmitAudit') }}
              </NButton>
            </template>
          </template>
        </TableHeaderOperation>
      </template>

      <div class="flex flex-col gap-12px sm:min-h-0 sm:flex-1">
        <NTabs :value="activeTab" type="segment" @update:value="handleTabChange">
          <NTabPane name="DRAFT" :tab="$t('page.store_product_draft.tabDraft')" />
          <NTabPane name="REJECTED" :tab="$t('page.store_product_draft.tabRejected')" />
        </NTabs>
        <NDataTable
          v-model:checked-row-keys="checkedRowKeys"
          remote
          striped
          size="small"
          :data="data"
          :columns="columns"
          :flex-height="!appStore.isMobile"
          :loading="loading"
          :pagination="mobilePagination"
          :row-key="(row: TenantProductRow) => row.id"
          :scroll-x="scrollX"
          class="sm:h-full"
        />
      </div>
    </NCard>

    <ProductOperateDrawer
      v-model:visible="drawerVisible"
      :operate-type="operateType"
      :row-data="editingData"
      @submitted="getData"
    />
    <BatchPriceModal
      v-model:visible="batchPriceVisible"
      :products="selectedProducts"
      @submitted="handleBatchSkuSubmitted"
    />
    <BatchCommissionModal
      v-model:visible="batchCommissionVisible"
      :products="selectedProducts"
      @submitted="handleBatchSkuSubmitted"
    />
  </div>
</template>
