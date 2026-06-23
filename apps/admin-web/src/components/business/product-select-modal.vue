<script setup lang="tsx">
import { computed, h, reactive, ref, watch } from 'vue';
import { NAvatar, NButton, NDataTable, NEmpty, NInput, NSelect, NSpace, NTag } from 'naive-ui';
import { PRODUCT_TYPE_SELECT_OPTIONS } from '@libs/common-constants';
import { fetchGetStoreProductList } from '@/service/api/store/product';
import EntityPickerModalShell from './entity-picker-modal-shell.vue';
import { type ProductPickerSelection, buildProductSelection } from './entity-picker.shared';

defineOptions({ name: 'ProductSelectModal' });

interface Props {
  visible: boolean;
  type?: 'SERVICE' | 'REAL';
  selected?: Partial<ProductPickerSelection> | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'select', row: ProductPickerSelection): void;
}

const emit = defineEmits<Emits>();

const show = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const loading = ref(false);
const tempSelected = ref<ProductPickerSelection | null>(null);

type ProductRow = Api.Store.TenantProduct & {
  globalSkus?: Api.Store.TenantSku[];
};

const searchForm = reactive<{
  name: string;
  type: 'SERVICE' | 'REAL' | null;
}>({
  name: '',
  type: props.type || null,
});

const data = ref<ProductRow[]>([]);
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
});

const typeOptions = PRODUCT_TYPE_SELECT_OPTIONS;

const columns: NaiveUI.TableColumns<ProductRow> = [
  { type: 'expand', renderExpand: (row) => renderSkus(row) },
  {
    title: '商品',
    key: 'name',
    minWidth: 260,
    render: (row) => (
      <div class="flex items-center gap-2">
        {row.mainImages?.[0] && <NAvatar src={row.mainImages[0]} size="small" />}
        <div class="min-w-0 flex-1">
          <div class="truncate">{row.name}</div>
          <div class="truncate text-xs text-gray-400">ID: {row.productId}</div>
        </div>
      </div>
    ),
  },
  {
    title: '类型',
    key: 'type',
    width: 100,
    render: (row) => h(NTag, { type: row.type === 'SERVICE' ? 'success' : 'info' }, { default: () => row.type }),
  },
  {
    title: '价格',
    key: 'price',
    width: 120,
    render: (row) => `¥${row.price ?? row.guidePrice ?? 0}`,
  },
];

function renderSkus(row: ProductRow) {
  const skus = row.skus || row.globalSkus || [];

  if (skus.length === 0) return '暂无 SKU 信息';

  return h(NDataTable, {
    size: 'small',
    columns: [
      { title: 'SKU ID', key: 'skuId', width: 150 },
      {
        title: '规格',
        key: 'specValues',
        render: (sku: any) => {
          const specs = typeof sku.specValues === 'string' ? JSON.parse(sku.specValues || '{}') : sku.specValues;
          return Object.values(specs || {}).join(' / ');
        },
      },
      {
        title: '价格',
        key: 'guidePrice',
        width: 100,
        render: (sku: any) => `¥${sku.guidePrice ?? sku.price ?? 0}`,
      },
      {
        title: '操作',
        key: 'action',
        width: 100,
        render: (sku: any) =>
          h(
            NButton,
            {
              size: 'tiny',
              type: 'primary',
              onClick: () => {
                tempSelected.value = buildProductSelection(row, sku);
              },
            },
            { default: () => '选择规格' },
          ),
      },
    ],
    data: skus,
  });
}

async function fetchData() {
  loading.value = true;

  try {
    const { data: response, error } = await fetchGetStoreProductList({
      pageNum: pagination.page,
      pageSize: pagination.pageSize,
      name: searchForm.name || undefined,
      type: searchForm.type || undefined,
    });

    if (!error && response) {
      data.value = response.rows || [];
      pagination.itemCount = response.total || 0;
    }
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.page = 1;
  fetchData().catch(() => {});
}

function handleResetSearch() {
  searchForm.name = '';
  searchForm.type = props.type || null;
  handleSearch();
}

function handlePageChange(page: number) {
  pagination.page = page;
  fetchData().catch(() => {});
}

function handleSelectRow(row: ProductRow) {
  tempSelected.value = buildProductSelection(row);
}

function handleConfirm() {
  if (!tempSelected.value) return;
  emit('select', tempSelected.value);
  show.value = false;
}

watch(
  () => props.type,
  (newType) => {
    searchForm.type = newType || null;
  },
);

watch(
  () => props.selected,
  (value) => {
    tempSelected.value = value ? buildProductSelection(value) : null;
  },
  { immediate: true },
);

watch(show, (value) => {
  if (value) {
    searchForm.type = props.type || null;
    tempSelected.value = props.selected ? buildProductSelection(props.selected) : null;
    fetchData().catch(() => {});
  }
});
</script>

<template>
  <EntityPickerModalShell
    v-model:visible="show"
    title="选择商品"
    selected-title="已选商品"
    :confirm-disabled="!tempSelected"
    @confirm="handleConfirm"
  >
    <template #search>
      <NSpace>
        <NInput v-model:value="searchForm.name" placeholder="商品名称" clearable @keyup.enter="handleSearch" />
        <NSelect
          v-model:value="searchForm.type"
          clearable
          :options="typeOptions"
          placeholder="商品类型"
          class="w-180px"
        />
        <NButton type="primary" @click="handleSearch">搜索</NButton>
        <NButton @click="handleResetSearch">重置</NButton>
      </NSpace>
    </template>

    <template #table>
      <NDataTable
        remote
        size="small"
        :loading="loading"
        :columns="columns"
        :data="data"
        :pagination="pagination"
        :row-key="(row) => row.productId"
        :row-props="
          (row) => ({
            onClick: () => handleSelectRow(row),
            style:
              row.productId === tempSelected?.productId && !tempSelected?.skuId
                ? 'cursor:pointer;background:rgba(24,160,88,0.08);'
                : 'cursor:pointer;',
          })
        "
        :max-height="430"
        @update:page="handlePageChange"
      />
    </template>

    <template #selected>
      <div v-if="tempSelected" class="flex flex-col gap-3 rounded-12px bg-white p-12px">
        <div class="flex items-center gap-3">
          <NAvatar v-if="tempSelected.mainImages?.[0]" :src="tempSelected.mainImages[0]" size="medium" />
          <NAvatar v-else size="medium">{{ tempSelected.displayName.slice(0, 1) }}</NAvatar>
          <div class="min-w-0">
            <div class="truncate font-medium">{{ tempSelected.displayName }}</div>
            <div class="truncate text-xs text-gray-500">{{ tempSelected.specLabel || tempSelected.productId }}</div>
          </div>
        </div>
        <div class="rounded-8px bg-slate-50 p-10px text-sm text-slate-600">
          <div>商品ID：{{ tempSelected.productId }}</div>
          <div>规格：{{ tempSelected.specLabel || '整商品' }}</div>
          <div>类型：{{ tempSelected.type || '-' }}</div>
          <div>价格：¥{{ tempSelected.price ?? tempSelected.guidePrice ?? 0 }}</div>
        </div>
      </div>
      <NEmpty v-else description="请选择商品" class="h-full flex items-center justify-center" />
    </template>
  </EntityPickerModalShell>
</template>
