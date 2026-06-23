<script setup lang="tsx">
import { h, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NAvatar, NButton, NCard, NDataTable, NEllipsis, NEmpty, NInput, NSpin, NSwitch, NTag, NTree } from 'naive-ui';
import type { TreeOption } from 'naive-ui';
import { useLoading } from '@sa/hooks';
import {
  fetchBatchDeleteGlobalProduct,
  fetchDeleteGlobalProduct,
  fetchGetGlobalProductList,
  fetchUpdateGlobalProductStatus,
} from '@/service/api/pms/product';
import { fetchTenantList } from '@/service/api/auth';
import { fetchGetCategoryTree } from '@/service/api/pms/category';
import { useAppStore } from '@/store/modules/app';
import { useTable, useTableOperate, useTableProps } from '@/hooks/common/table';
import { $t } from '@/locales';
import { getRoutePath } from '@/router/elegant/transform';
import GlobalProductSearch from './modules/global-product-search.vue';

defineOptions({
  name: 'GlobalProductList',
});

const appStore = useAppStore();
const { loading: siderLoading, startLoading: startSiderLoading, endLoading: endSiderLoading } = useLoading();

const tableProps = useTableProps();
const tenantLabelMap = ref<Record<string, string>>({});
const categoryLabelMap = ref<Record<number, string>>({});

function fillCategoryLabelMap(categories: Api.Pms.Category[], map: Record<number, string>) {
  categories.forEach((category) => {
    map[category.catId] = category.name;
    if (category.children?.length) {
      fillCategoryLabelMap(category.children as Api.Pms.Category[], map);
    }
  });
}

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
  apiFn: fetchGetGlobalProductList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    name: null,
    categoryId: null,
    type: null,
    creatorTenantId: null,
    publishStatus: null,
    buildStatus: null,
  } as Api.Pms.ProductSearchParams,
  columns: () => [
    {
      type: 'expand',
      key: 'expand',
      renderExpand: (row) => {
        return h('div', { class: 'p-4 bg-gray-50 dark:bg-gray-800' }, [
          h('h4', { class: 'mb-2 font-bold' }, 'SKU 列表'),
          h(NDataTable, {
            data: row.globalSkus || [],
            columns: [
              { title: 'SKU 规格', key: 'specValues', render: (sku: any) => JSON.stringify(sku.specValues) },
              { title: '指导价', key: 'guidePrice' },
              { title: '成本价', key: 'costPrice' },
              {
                title: '分佣范围 (Min - 建议 - Max)',
                key: 'guideRate',
                render: (sku: any) => {
                  if (sku.distMode === 'NONE') return '不分销';
                  const unit = sku.distMode === 'RATIO' ? '%' : '元';
                  return `${sku.minDistRate}${unit} - ${sku.guideRate}${unit} - ${sku.maxDistRate}${unit}`;
                },
              },
            ],
            pagination: false,
            bordered: false,
            size: 'small',
          } as any),
        ]);
      },
    },
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
      key: 'name',
      title: '商品名称',
      align: 'left',
      minWidth: 200,
      render: (row) => {
        return (
          <div class="min-w-0 flex items-center gap-2">
            <NAvatar
              src={row.albumPics ? row.albumPics.split(',')[0] : ''}
              class="shrink-0 bg-primary"
              fallback-src="https://via.placeholder.com/40"
            />
            <div class="min-w-0 flex flex-col flex-1">
              <NEllipsis>{row.displayName || row.name}</NEllipsis>
              {row.defaultSkuLabel ? <span class="text-xs text-gray-500">默认规格：{row.defaultSkuLabel}</span> : null}
            </div>
          </div>
        );
      },
    },
    {
      key: 'categoryId',
      title: '分类名称',
      align: 'center',
      minWidth: 160,
      render: (row) => {
        const categoryId = row.categoryId as number | undefined | null;
        if (categoryId === null || categoryId === undefined) {
          return '-';
        }
        return categoryLabelMap.value[categoryId] || '未知分类';
      },
    },
    {
      key: 'creatorTenantId',
      title: '创建租户',
      align: 'center',
      minWidth: 160,
      render: (row) => {
        const tenantId = row.creatorTenantId as string | undefined;
        if (!tenantId) {
          return <NTag type="default">未知</NTag>;
        }
        const label = tenantLabelMap.value[tenantId];
        return (
          <NTag type="info" title={label || tenantId}>
            {label || tenantId}
          </NTag>
        );
      },
    },
    {
      key: 'buildStatus',
      title: '构建状态',
      align: 'center',
      width: 120,
      render: (row) => {
        const isDraft = row.buildStatus === 'DRAFT';
        return isDraft ? (
          <NTag type="warning">草稿 · 第{row.lastEditStep || 1}步</NTag>
        ) : (
          <NTag type="success">已完成</NTag>
        );
      },
    },
    {
      key: 'publishStatus',
      title: '发布状态',
      align: 'center',
      width: 120,
      render: (row) => {
        const publishStatus = row.publishStatus as Api.Pms.PublishStatus;
        const isDraft = row.buildStatus === 'DRAFT';
        return (
          <NSwitch
            value={publishStatus === 'ON_SHELF'}
            disabled={isDraft}
            onUpdateValue={async (value) => {
              const newStatus: Api.Pms.PublishStatus = value ? 'ON_SHELF' : 'OFF_SHELF';
              await fetchUpdateGlobalProductStatus(row.productId, newStatus);
              getData();
            }}
          >
            {{
              checked: () => '上架',
              unchecked: () => '下架',
            }}
          </NSwitch>
        );
      },
    },
    {
      key: 'createTime',
      title: $t('page.common.createTime'),
      align: 'center',
      width: 160,
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 150,
      render: (row) => (
        <div class="flex-center gap-8px">
          <NButton size="small" type="primary" ghost onClick={() => editProduct(row.productId)}>
            {$t('common.edit')}
          </NButton>
          <NButton size="small" type="error" ghost onClick={() => handleDelete(row.productId)}>
            {$t('common.delete')}
          </NButton>
        </div>
      ),
    },
  ],
});

const router = useRouter();

const { checkedRowKeys, onBatchDeleted, onDeleted } = useTableOperate(data, getData);

// Override handleAdd to navigate to create page
function handleAdd() {
  router.push({ path: getRoutePath('pms_global-product-create') });
}

function editProduct(id: string) {
  router.push({ path: getRoutePath('pms_global-product-create'), query: { id } });
}

async function handleBatchDelete() {
  try {
    // If backend only supports single delete, we might need to loop, but here assuming batch works or implemented separately
    await fetchBatchDeleteGlobalProduct(checkedRowKeys.value as string[]);
    await onBatchDeleted();
  } catch {
    // error handled by request interceptor
  }
}

async function handleDelete(productId: string) {
  try {
    await fetchDeleteGlobalProduct(productId);
    await onDeleted();
  } catch {
    // error handled by request interceptor
  }
}

// Category Tree Logic
const categoryName = ref<string>('');
const treeData = ref<Api.Pms.Category[]>([]);
const expandedKeys = ref<number[]>([]);
const selectedKeys = ref<number[]>([]);

async function getCategoryTree() {
  startSiderLoading();
  try {
    const { data: categoryData } = await fetchGetCategoryTree();
    treeData.value = [
      {
        catId: 0,
        name: '全部商品',
        children: categoryData || [],
      },
    ] as any;
    const nextCategoryLabelMap: Record<number, string> = {};
    fillCategoryLabelMap((categoryData || []) as Api.Pms.Category[], nextCategoryLabelMap);
    categoryLabelMap.value = nextCategoryLabelMap;
    // Expands all keys? Or just root. Let's just expand root/0
    if (expandedKeys.value.length === 0) {
      expandedKeys.value = [0];
    }
    // Select root by default
    if (selectedKeys.value.length === 0) {
      selectedKeys.value = [0];
    }
  } catch (error) {
    console.error(error);
  } finally {
    endSiderLoading();
  }
}

async function initTenantMap() {
  const { data: tenantListData, error } = await fetchTenantList();
  if (error || !tenantListData?.voList) {
    return;
  }
  tenantLabelMap.value = tenantListData.voList.reduce<Record<string, string>>((acc, item) => {
    acc[item.tenantId] = `${item.companyName} (${item.tenantId})`;
    return acc;
  }, {});
}

function handleSelectCategory(keys: number[], option: Array<TreeOption | null>) {
  const selectedNode = option[0];
  if (selectedNode) {
    selectedKeys.value = keys;
    // If root (0) is selected, filter by null/undefined to show all?
    // Or if backend supports 0 as 'all'.
    // Usually clear param if 0.
    const catId = selectedNode.catId as number;
    searchParams.categoryId = catId === 0 ? null : catId;
    getDataByPage();
  }
}

onMounted(() => {
  getCategoryTree().catch(() => undefined);
  initTenantMap().catch(() => undefined);
});
</script>

<template>
  <div class="h-full overflow-hidden">
    <TableSiderLayout :sider-title="$t('page.pms.category.title')">
      <template #sider>
        <NInput v-model:value="categoryName" placeholder="搜索分类" clearable />
        <NSpin :show="siderLoading" class="tree-spin">
          <NTree
            v-model:expanded-keys="expandedKeys"
            v-model:selected-keys="selectedKeys"
            block-node
            :data="treeData as any"
            key-field="catId"
            label-field="name"
            :pattern="categoryName"
            :show-irrelevant-nodes="false"
            class="h-full"
            selectable
            @update:selected-keys="handleSelectCategory"
          >
            <template #empty>
              <NEmpty description="暂无分类" class="h-full justify-center" />
            </template>
          </NTree>
        </NSpin>
      </template>

      <div class="h-full min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
        <GlobalProductSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
        <NCard title="标准商品库" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
          <template #header-extra>
            <TableHeaderOperation
              v-model:columns="columnChecks"
              :disabled-delete="checkedRowKeys.length === 0"
              :loading="loading"
              :show-add="true"
              :show-delete="true"
              @add="handleAdd"
              @delete="handleBatchDelete"
              @refresh="getData"
            />
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
            :row-key="(row) => row.productId"
            :pagination="mobilePagination"
            class="sm:h-full"
          />
        </NCard>
      </div>
    </TableSiderLayout>
  </div>
</template>

<style scoped>
.tree-spin {
  height: calc(100vh - 228px - var(--calc-footer-height, 0px)) !important;
}
:deep(.n-spin-content) {
  height: 100%;
}
</style>
