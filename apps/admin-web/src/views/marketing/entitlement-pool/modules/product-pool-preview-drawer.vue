<script setup lang="tsx">
import { computed } from 'vue';
import { NDrawer, NDrawerContent, NTag } from 'naive-ui';

defineOptions({ name: 'ProductPoolPreviewDrawer' });

interface ProductPreviewRow {
  productId?: string;
  productName?: string;
  tagLabel?: string;
  activityPrice?: number | string;
  originalPrice?: number | string;
  status?: string;
  sourceType?: string;
}

const props = withDefaults(
  defineProps<{
    visible: boolean;
    rows: ProductPreviewRow[];
    total: number;
    loading?: boolean;
  }>(),
  {
    loading: false,
  },
);

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
}>();

const show = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const columns: NaiveUI.TableColumn<ProductPreviewRow>[] = [
  {
    key: 'productName',
    title: '商品',
    minWidth: 200,
    render: (row) => (
      <div class="flex-col gap-4px">
        <span class="font-medium">{row.productName || '-'}</span>
        <span class="text-xs text-gray-500 font-mono">{row.productId || '-'}</span>
      </div>
    ),
  },
  {
    key: 'sourceType',
    title: '来源',
    width: 100,
    render: (row) => row.sourceType || '-',
  },
  {
    key: 'tagLabel',
    title: '标签',
    width: 110,
    render: (row) => row.tagLabel || '-',
  },
  {
    key: 'activityPrice',
    title: '活动价',
    width: 120,
    render: (row) => formatPrice(row.activityPrice),
  },
  {
    key: 'originalPrice',
    title: '原价',
    width: 120,
    render: (row) => formatPrice(row.originalPrice),
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: (row) => {
      const active = row.status === 'ON_SHELF' || row.status === 'ACTIVE';
      return <NTag type={active ? 'success' : 'default'}>{row.status || '-'}</NTag>;
    },
  },
];

function formatPrice(value: number | string | undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `¥${numeric.toFixed(2)}`;
}
</script>

<template>
  <!-- 商品池预览抽屉：展示编译接口返回的商品候选和价格摘要。 -->
  <NDrawer v-model:show="show" :width="960">
    <NDrawerContent :title="`商品池预览（${total}）`" closable>
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        :row-key="(row) => `${row.productId || ''}-${row.productName || ''}-${row.sourceType || ''}`"
        :max-height="560"
      />
    </NDrawerContent>
  </NDrawer>
</template>
