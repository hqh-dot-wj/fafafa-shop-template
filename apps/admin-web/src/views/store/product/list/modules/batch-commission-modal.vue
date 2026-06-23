<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NDrawer, NDrawerContent, NInputNumber, NTable, NTag, useMessage } from 'naive-ui';
import BatchOperationResultModal from '@/components/custom/batch-operation-result-modal.vue';
import {
  fetchBatchUpsertStoreProductSkuPriceCommission,
  fetchBatchValidateStoreProductSkuPriceCommission
} from '@/service/api/store/product';

defineOptions({
  name: 'BatchCommissionModal'
});

interface SkuRow extends Api.Store.TenantSku {
  _productName: string;
}

interface Props {
  visible: boolean;
  products: Api.Store.TenantProduct[];
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'submitted'): void }>();

const message = useMessage();
const loading = ref(false);
const batchResultVisible = ref(false);
const batchResultPayload = ref<Api.Store.BatchOperationResult | null>(null);

const visible = computed({
  get: () => props.visible,
  set: v => emit('update:visible', v)
});

const skuRows = ref<SkuRow[]>([]);

watch(
  () => [props.visible, props.products] as const,
  ([show, products]) => {
    if (!show || !products?.length) return;

    const rows: SkuRow[] = [];
    for (const prod of products) {
      for (const sku of prod.skus || []) {
        rows.push({
          ...JSON.parse(JSON.stringify(sku)),
          _productName: prod.customTitle || prod.name
        });
      }
    }
    skuRows.value = rows;
  },
  { immediate: true }
);

function specsToString(specs: unknown): string {
  if (!specs) return '默认';
  if (typeof specs === 'object') return Object.values(specs as Record<string, string>).join(' / ');
  return String(specs);
}

function buildItems() {
  return skuRows.value.map(row => ({
    tenantSkuId: row.id,
    price: row.price,
    stock: row.stock,
    distRate: row.distRate,
    distMode: row.distMode,
    pointsRatio: row.pointsRatio,
    isPromotionProduct: row.isPromotionProduct
  }));
}

async function handleSubmit() {
  const items = buildItems();
  if (!items.length) {
    message.warning('暂无可修改 SKU');
    return;
  }

  loading.value = true;
  try {
    const validateRes = await fetchBatchValidateStoreProductSkuPriceCommission({ items });
    if (validateRes.failCount > 0) {
      message.warning(`预校验失败：通过 ${validateRes.successCount} 条，失败 ${validateRes.failCount} 条`);
      batchResultPayload.value = validateRes;
      batchResultVisible.value = true;
      return;
    }

    const upsertRes = await fetchBatchUpsertStoreProductSkuPriceCommission({ items });
    message.success(`批量改分佣完成：成功 ${upsertRes.successCount} 条，失败 ${upsertRes.failCount} 条`);
    visible.value = false;
    emit('submitted');
    if (upsertRes.failCount > 0) {
      batchResultPayload.value = upsertRes;
      batchResultVisible.value = true;
    }
  } catch {
    // error handled by request
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <NDrawer v-model:show="visible" :width="700" display-directive="show">
    <NDrawerContent title="批量改分佣" native-scrollbar>
      <div class="flex flex-col gap-4">
        <div class="text-sm text-gray-500">
          已选 {{ products.length }} 个商品，共 {{ skuRows.length }} 个 SKU。仅草稿/驳回商品允许批量改分佣。
        </div>
        <NTable :bordered="false" :single-line="false" size="small">
          <thead>
            <tr>
              <th>商品</th>
              <th>规格</th>
              <th>分佣模式</th>
              <th>分佣值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in skuRows" :key="row.id">
              <td>{{ row._productName }}</td>
              <td>{{ specsToString(row.specValues) }}</td>
              <td>
                <NTag size="small">{{ row.distMode }}</NTag>
              </td>
              <td>
                <NInputNumber v-model:value="row.distRate" :min="0" :precision="4" size="small" style="width: 130px" />
              </td>
            </tr>
          </tbody>
        </NTable>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="visible = false">取消</NButton>
          <NButton type="primary" :loading="loading" @click="handleSubmit">保存</NButton>
        </div>
      </template>
    </NDrawerContent>
  </NDrawer>

  <BatchOperationResultModal
    v-model:show="batchResultVisible"
    title="批量改分佣结果"
    id-column-title="SKU ID"
    :result="batchResultPayload"
  />
</template>
