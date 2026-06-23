<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import {
  NButton,
  NCard,
  NEmpty,
  NGrid,
  NGridItem,
  NInput,
  NPagination,
  NSelect,
  NSpin,
  NTabPane,
  NTabs,
  NTree,
  useMessage,
} from 'naive-ui';
import type { SelectOption } from 'naive-ui';
import { fetchGetCategoryTree } from '@/service/api/pms/category';
import {
  fetchBatchImportProducts,
  fetchDownloadStoreProductImportTemplate,
  fetchGetMarketProductDetail,
  fetchGetProductMarketList,
  fetchGetStoreProductTemplateVersions,
} from '@/service/api/store/product';
import BatchOperationResultModal from '@/components/custom/batch-operation-result-modal.vue';
import { $t } from '@/locales';
import ExcelImportDialog from './components/ExcelImportDialog.vue';
import ImportDialog from './components/ImportDialog.vue';
import ProductMarketCard from './components/ProductMarketCard.vue';

defineOptions({ name: 'ProductSelectionCenter' });

const message = useMessage();
const selectedIds = ref<Set<string>>(new Set());
const batchImportLoading = ref(false);
const batchResultVisible = ref(false);
const batchResultPayload = ref<Api.Store.BatchOperationResult | null>(null);
const excelDialogVisible = ref(false);
const templateVersionLoading = ref(false);
const selectedTemplateVersionId = ref('');
const templateVersionOptions = ref<SelectOption[]>([]);

const loading = ref(false);
const data = ref<Api.Store.MarketProduct[]>([]);
const total = ref(0);

const searchParams = reactive<Api.Store.MarketSearchParams>({
  pageNum: 1,
  pageSize: 20,
  name: null,
  categoryId: null,
  type: null,
});

async function getData() {
  loading.value = true;
  try {
    const params = { ...searchParams };
    if (params.type === ('' as typeof params.type)) {
      params.type = null;
    }

    const { data: listData, error } = await fetchGetProductMarketList(params);
    if (!error && listData) {
      data.value = listData.rows;
      total.value = listData.total;
    }
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  searchParams.pageNum = 1;
  getData();
}

function handleTypeChange(val: string) {
  searchParams.type = (val || null) as Api.Store.MarketSearchParams['type'];
  searchParams.pageNum = 1;
  getData();
}

function handlePageSizeChange(val: number) {
  searchParams.pageSize = val;
  searchParams.pageNum = 1;
  getData();
}

const treeLoading = ref(false);
const treeData = ref<Api.Pms.Category[]>([]);
const categoryName = ref('');

async function getCategoryTree() {
  treeLoading.value = true;
  try {
    const { data: categoryChildren } = await fetchGetCategoryTree();
    treeData.value = [
      { catId: 0, name: $t('page.store_product_market.index.rootCategoryName'), children: categoryChildren || [] },
    ] as Api.Pms.Category[];
  } finally {
    treeLoading.value = false;
  }
}

async function loadTemplateVersions(categoryId: number | null) {
  if (!categoryId) {
    templateVersionOptions.value = [];
    selectedTemplateVersionId.value = '';
    return;
  }

  templateVersionLoading.value = true;
  try {
    const { data: versionRows } = await fetchGetStoreProductTemplateVersions(categoryId);
    const options = (versionRows || []).map((item) => ({
      label: `${item.templateCode} v${item.version}${item.isLatest ? $t('page.store_product_market.index.templateLatestBadge') : ''}`,
      value: item.versionId,
    }));
    templateVersionOptions.value = [
      { label: $t('page.store_product_market.index.templateDefaultLatest'), value: '' },
      ...options,
    ] as SelectOption[];
    if (!templateVersionOptions.value.some((item) => item.value === selectedTemplateVersionId.value)) {
      selectedTemplateVersionId.value = '';
    }
  } finally {
    templateVersionLoading.value = false;
  }
}

function handleSelectCategory(keys: Array<string | number>) {
  const key = keys[0];
  searchParams.categoryId = !key || key === 0 ? null : Number(key);
  loadTemplateVersions(searchParams.categoryId);
  searchParams.pageNum = 1;
  getData();
}

const showImportDialog = ref(false);
const currentProduct = ref<Api.Store.MarketProduct | null>(null);

function openImportDialog(product: Api.Store.MarketProduct) {
  currentProduct.value = product;
  showImportDialog.value = true;
}

function handleImportSuccess() {
  getData();
}

async function handleDownloadTemplate() {
  if (!searchParams.categoryId) {
    message.warning($t('page.store_product_market.index.msgSelectCategoryForTemplate'));
    return;
  }
  const { data: blobData } = await fetchDownloadStoreProductImportTemplate({
    categoryId: Number(searchParams.categoryId),
    templateVersionId: selectedTemplateVersionId.value || undefined,
  });
  if (!blobData) return;

  const blob = blobData as Blob;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = $t('page.store_product_market.index.downloadFilename', {
    categoryId: String(searchParams.categoryId),
  });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function mapImportJobToBatchResult(job: Api.Store.ImportExcelJobResult): Api.Store.BatchOperationResult {
  return {
    successCount: job.successCount,
    failCount: job.failCount,
    details: job.details.map((item) => ({
      id: $t('page.store_product_market.index.importRowId', { rowNo: String(item.rowNo), sku: item.skuCode }),
      success: item.success,
      error: item.reason,
    })),
  };
}

async function handleExcelImported(job: Api.Store.ImportExcelJobResult) {
  getData();
  if (job.failCount > 0) {
    batchResultPayload.value = mapImportJobToBatchResult(job);
    batchResultVisible.value = true;
  }
}

function toggleSelect(productId: string, checked: boolean) {
  if (checked) {
    selectedIds.value.add(productId);
  } else {
    selectedIds.value.delete(productId);
  }
  selectedIds.value = new Set(selectedIds.value);
}

function isSelected(productId: string) {
  return selectedIds.value.has(productId);
}

async function handleBatchImport() {
  const ids = Array.from(selectedIds.value);
  if (ids.length === 0) {
    message.warning($t('page.store_product_market.index.msgSelectProducts'));
    return;
  }

  batchImportLoading.value = true;
  try {
    const details = await Promise.all(ids.map((id) => fetchGetMarketProductDetail(id).then((r) => r.data)));

    const items = details
      .filter((d): d is NonNullable<typeof d> => Boolean(d?.globalSkus?.length))
      .map((d) => ({
        productId: d.productId,
        overrideRadius: d.serviceRadius ?? undefined,
        categoryId: searchParams.categoryId ?? undefined,
        templateVersionId: selectedTemplateVersionId.value || undefined,
        skus: d.globalSkus!.map((s: { skuId: string; guidePrice: unknown; guideRate?: unknown; distMode: string }) => ({
          globalSkuId: s.skuId,
          price: Number(s.guidePrice),
          stock: 0,
          distRate: Number(s.guideRate ?? 0),
          distMode: s.distMode,
        })),
      }));

    if (items.length === 0) {
      message.warning($t('page.store_product_market.index.msgNoSkus'));
      return;
    }

    const { data: batchData } = await fetchBatchImportProducts({ items });
    if (!batchData) return;
    message.success(
      $t('page.store_product_market.index.batchImportDone', {
        ok: String(batchData.successCount),
        fail: String(batchData.failCount),
      }),
    );
    selectedIds.value = new Set();
    getData();
    if (batchData.failCount > 0) {
      batchResultPayload.value = batchData;
      batchResultVisible.value = true;
    }
  } catch {
    // error handled by request
  } finally {
    batchImportLoading.value = false;
  }
}

onMounted(() => {
  getCategoryTree();
  getData();
});
</script>

<template>
  <div class="h-full flex gap-4 overflow-hidden p-4">
    <NCard
      class="h-full w-64 flex-shrink-0"
      :title="$t('page.store_product_market.index.categoryCardTitle')"
      content-style="padding: 0; display: flex; flex-direction: column; height: 100%;"
    >
      <div class="p-2">
        <NInput
          v-model:value="categoryName"
          :placeholder="$t('page.store_product_market.index.searchCategoryPlaceholder')"
          clearable
          size="small"
        />
      </div>
      <div class="flex-1 overflow-auto">
        <NSpin :show="treeLoading">
          <NTree
            block-node
            :data="treeData"
            key-field="catId"
            label-field="name"
            :pattern="categoryName"
            selectable
            default-expand-all
            @update:selected-keys="handleSelectCategory"
          >
            <template #empty>
              <NEmpty :description="$t('page.store_product_market.index.emptyTree')" class="pt-8" />
            </template>
          </NTree>
        </NSpin>
      </div>
    </NCard>

    <div class="h-full flex flex-col flex-1 gap-4 overflow-hidden">
      <NCard size="small">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <NTabs type="segment" :value="searchParams.type ?? ''" class="w-64" @update:value="handleTypeChange">
            <NTabPane name="" :tab="$t('page.store_product_market.index.tabAll')" />
            <NTabPane name="REAL" :tab="$t('page.store_product_market.index.tabReal')" />
            <NTabPane name="SERVICE" :tab="$t('page.store_product_market.index.tabService')" />
          </NTabs>

          <div class="flex items-center gap-2">
            <NButton type="default" ghost @click="handleDownloadTemplate">
              {{ $t('page.store_product_market.index.downloadTemplate') }}
            </NButton>
            <NButton type="default" ghost @click="excelDialogVisible = true">
              {{ $t('page.store_product_market.index.batchExcel') }}
            </NButton>
            <NSelect
              v-model:value="selectedTemplateVersionId"
              :loading="templateVersionLoading"
              :disabled="!searchParams.categoryId"
              :options="templateVersionOptions"
              :placeholder="$t('page.store_product_market.index.templateVersionPlaceholder')"
              clearable
              style="width: 220px"
            />
            <NButton
              type="primary"
              :loading="batchImportLoading"
              :disabled="selectedIds.size === 0"
              @click="handleBatchImport"
            >
              {{ $t('page.store_product_market.index.batchImport') }} ({{ selectedIds.size }})
            </NButton>
            <NInput
              v-model:value="searchParams.name"
              :placeholder="$t('page.store_product_market.index.searchNamePlaceholder')"
              clearable
              @keyup.enter="handleSearch"
            >
              <template #prefix>
                <div class="i-icon-park-outline:search" />
              </template>
            </NInput>
            <NButton type="primary" ghost @click="handleSearch">{{ $t('page.store_product_market.index.search') }}</NButton>
          </div>
        </div>
      </NCard>

      <div class="flex-1 overflow-y-auto">
        <NSpin :show="loading" class="min-h-full">
          <template v-if="data.length > 0">
            <NGrid :x-gap="16" :y-gap="16" cols="1 s:2 m:3 l:4 xl:5" responsive="screen">
              <NGridItem v-for="item in data" :key="item.productId">
                <ProductMarketCard
                  :product="item"
                  :selectable="true"
                  :selected="isSelected(item.productId)"
                  @import="openImportDialog"
                  @update:selected="(v: boolean) => toggleSelect(item.productId, v)"
                />
              </NGridItem>
            </NGrid>

            <div class="mt-4 flex justify-end">
              <NPagination
                v-model:page="searchParams.pageNum"
                v-model:page-size="searchParams.pageSize"
                :item-count="total"
                :page-sizes="[10, 20, 50]"
                show-size-picker
                @update:page="getData"
                @update:page-size="handlePageSizeChange"
              />
            </div>
          </template>
          <NEmpty v-else :description="$t('page.store_product_market.index.emptyProducts')" class="h-full flex items-center justify-center" />
        </NSpin>
      </div>
    </div>

    <ImportDialog v-model:show="showImportDialog" :product="currentProduct" @success="handleImportSuccess" />
    <ExcelImportDialog
      v-model:show="excelDialogVisible"
      :category-id="searchParams.categoryId"
      :template-version-id="selectedTemplateVersionId"
      @success="handleExcelImported"
    />
    <BatchOperationResultModal
      v-model:show="batchResultVisible"
      :title="$t('page.store_product_market.index.batchResultTitle')"
      :id-column-title="$t('page.store_product_market.index.batchResultIdColumn')"
      :result="batchResultPayload"
    />
  </div>
</template>

<style scoped>
/* Custom scrollbar style if needed */
</style>
