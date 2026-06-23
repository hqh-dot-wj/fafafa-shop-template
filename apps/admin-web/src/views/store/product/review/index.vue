<script setup lang="tsx">
import { computed, ref } from 'vue';
import { NButton, NCard, NDataTable, NModal, NPopover, NSpace, NTag, useMessage } from 'naive-ui';
import { fetchBatchApproveStoreProductAudit, fetchGetStoreProductReviewList } from '@/service/api/store/product';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { useTable, useTableOperate } from '@/hooks/common/table';
import { handleCopy } from '@/utils/copy';
import { createOperationId } from '@/utils/operation-id';
import { $t } from '@/locales';
import TableHeaderOperation from '@/components/advanced/table-header-operation.vue';
import ProductSearch from '../list/modules/product-search.vue';
import ReviewOperateModal from './modules/review-operate-modal.vue';

defineOptions({
  name: 'StoreProductReview',
});

type TenantProductRow = Api.Store.TenantProduct & { index: number };
type BatchOperationDetailItem = Api.Store.BatchOperationResult['details'][number];

const appStore = useAppStore();
const message = useMessage();
const { hasAuth } = useAuth();
const hasAuditPermission = computed(() => hasAuth('store:product:audit'));

const reviewModalVisible = ref(false);
const currentRow = ref<Api.Store.TenantProduct | null>(null);
const batchApproving = ref(false);
const batchFailVisible = ref(false);
const batchFailRows = ref<Array<{ id: string; name: string; reason: string }>>([]);

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
  apiFn: fetchGetStoreProductReviewList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    name: null,
    type: null,
    status: null,
    auditStatus: 'PENDING',
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
      title: '商品信息',
      align: 'left',
      minWidth: 220,
      render: (row) => (
        <div class="flex items-center gap-2">
          <img src={row.albumPics?.split(',')[0]} class="h-12 w-12 border rounded object-cover" />
          <div class="flex flex-col">
            <span class="font-bold">{row.customTitle || row.name}</span>
            {row.customTitle && <span class="text-xs text-gray-400">原: {row.name}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'submittedAt',
      title: '提交时间',
      align: 'center',
      width: 170,
      render: (row) => row.submittedAt || '-',
    },
    {
      key: 'auditStatus',
      title: '审核状态',
      align: 'center',
      width: 110,
      render: (row) => {
        const map: Record<string, { label: string; type: NaiveUI.ThemeColor }> = {
          PENDING: { label: '待审核', type: 'warning' },
          APPROVED: { label: '已通过', type: 'success' },
          REJECTED: { label: '已驳回', type: 'error' },
        };
        const item = map[row.auditStatus] || { label: row.auditStatus, type: 'default' };
        return <NTag type={item.type}>{item.label}</NTag>;
      },
    },
    {
      key: 'auditReason',
      title: '审核意见',
      align: 'left',
      minWidth: 220,
      render: (row) => {
        const reason = row.auditReason?.trim();
        if (!reason) return '-';

        const preview = reason.length > 16 ? `${reason.slice(0, 16)}...` : reason;

        return (
          <NPopover trigger="hover" width={360}>
            {{
              trigger: () => <span class="cursor-pointer text-primary">{preview}</span>,
              default: () => (
                <div class="max-w-360px">
                  <div class="mb-8px whitespace-pre-wrap break-all text-13px">{reason}</div>
                  <NButton
                    size="tiny"
                    ghost
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCopyReason(reason);
                    }}
                  >
                    复制
                  </NButton>
                </div>
              ),
            }}
          </NPopover>
        );
      },
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 160,
      render: (row) =>
        row.auditStatus === 'PENDING' && hasAuditPermission.value ? (
          <NButton size="small" type="primary" ghost onClick={() => openReviewModal(row)}>
            审核
          </NButton>
        ) : (
          <span class="text-gray-400">-</span>
        ),
    },
  ],
});

const { checkedRowKeys } = useTableOperate<TenantProductRow>(data, getData);
const selectedIds = computed(() => checkedRowKeys.value as string[]);
const batchFailColumns: NaiveUI.DataTableColumns<{ id: string; name: string; reason: string }> = [
  {
    key: 'name',
    title: '商品',
    width: 220,
    ellipsis: { tooltip: true },
  },
  {
    key: 'reason',
    title: '失败原因',
    minWidth: 260,
    ellipsis: { tooltip: true },
  },
];

async function handleCopyReason(reason: string) {
  const value = reason.trim();
  if (!value) {
    message.warning('审核意见为空，无法复制');
    return;
  }

  try {
    await handleCopy(value);
  } catch {
    message.error('复制失败，请重试');
  }
}

function openReviewModal(row: Api.Store.TenantProduct) {
  currentRow.value = row;
  reviewModalVisible.value = true;
}

async function handleBatchApprove() {
  if (!selectedIds.value.length) {
    message.warning('请先选择待审核商品');
    return;
  }

  const idNameMap = new Map(
    data.value.map((item) => [item.id, item.customTitle?.trim() || item.name?.trim() || item.id] as const),
  );

  batchApproving.value = true;
  const { data: batchResult } = await fetchBatchApproveStoreProductAudit({
    items: selectedIds.value,
    operationId: createOperationId(),
  });
  batchApproving.value = false;
  checkedRowKeys.value = [];

  if (!batchResult) {
    getData();
    return;
  }

  const successCount = batchResult.successCount;
  const failCount = batchResult.failCount;
  if (failCount > 0) {
    const failedItems = batchResult.details.filter((item: BatchOperationDetailItem) => !item.success);
    const preview = failedItems
      .slice(0, 3)
      .map((item: BatchOperationDetailItem) => idNameMap.get(item.id) || item.id)
      .join('、');
    const suffix = failCount > 3 ? ' 等' : '';
    message.warning(`批量审核完成：通过 ${successCount} 条，失败 ${failCount} 条（${preview}${suffix}）`);

    batchFailRows.value = failedItems.map((item: BatchOperationDetailItem) => ({
      id: item.id,
      name: idNameMap.get(item.id) || item.id,
      reason: item.error || '未知错误',
    }));
    batchFailVisible.value = true;
  } else {
    message.success(`批量审核完成：通过 ${successCount} 条`);
  }

  getData();
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <ProductSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <NCard
      :title="$t('route.store_product_review')"
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
            <NButton
              v-if="hasAuditPermission"
              size="small"
              type="primary"
              ghost
              :loading="batchApproving"
              :disabled="selectedIds.length === 0"
              @click="handleBatchApprove"
            >
              批量通过
            </NButton>
          </template>
        </TableHeaderOperation>
      </template>

      <div class="flex flex-col gap-12px sm:min-h-0 sm:flex-1">
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

    <ReviewOperateModal v-model:show="reviewModalVisible" :row-data="currentRow" @submitted="getData" />

    <NModal v-model:show="batchFailVisible" preset="card" title="批量通过失败明细" class="w-760px">
      <NDataTable
        size="small"
        :data="batchFailRows"
        :columns="batchFailColumns"
        :pagination="false"
        :row-key="(row) => row.id"
      />
      <template #footer>
        <NSpace justify="end">
          <NButton @click="batchFailVisible = false">关闭</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
