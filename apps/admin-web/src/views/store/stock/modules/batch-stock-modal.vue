<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NDrawer, NDrawerContent, NInput, NInputNumber, NTable, useMessage } from 'naive-ui';
import { fetchBatchUpdateStock } from '@/service/api/store/stock';
import BatchOperationResultModal from '@/components/custom/batch-operation-result-modal.vue';
import { $t } from '@/locales';

defineOptions({
  name: 'BatchStockModal',
});

interface BatchRow extends Api.Store.StockSku {
  draftStockChange: number;
  draftReason: string;
}

interface Props {
  visible: boolean;
  rows: Api.Store.StockSku[];
}

const props = defineProps<Props>();

const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'submitted'): void }>();

const message = useMessage();
const loading = ref(false);
const batchResultVisible = ref(false);
const batchResultPayload = ref<Api.Store.BatchOperationResult | null>(null);

const visible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
});

const batchRows = ref<BatchRow[]>([]);

watch(
  () => [props.visible, props.rows] as const,
  ([isVisible, rows]) => {
    if (isVisible && rows?.length) {
      batchRows.value = rows.map((r) => ({
        ...JSON.parse(JSON.stringify(r)),
        draftStockChange: 0,
        draftReason: '',
      }));
    }
  },
  { immediate: true },
);

function specsToString(specs: unknown): string {
  if (!specs) return '-';
  if (typeof specs === 'object') return Object.values(specs as Record<string, string>).join(' / ');
  return String(specs);
}

async function handleSubmit() {
  const items = batchRows.value
    .filter((r) => r.draftStockChange !== 0)
    .map((r) => ({
      skuId: r.id,
      stockChange: r.draftStockChange,
      reason: r.draftReason || undefined,
    }));

  if (items.length === 0) {
    message.warning($t('page.store_stock.batch.msgNeedChange'));
    return;
  }

  loading.value = true;
  try {
    const { data: batchResult } = await fetchBatchUpdateStock({ items });
    if (!batchResult) return;
    message.success(
      $t('page.store_stock.batch.msgDone', {
        ok: String(batchResult.successCount),
        fail: String(batchResult.failCount),
      }),
    );
    visible.value = false;
    emit('submitted');
    if (batchResult.failCount > 0) {
      batchResultPayload.value = batchResult;
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
    <NDrawerContent :title="$t('page.store_stock.batch.title')" native-scrollbar>
      <div class="flex flex-col gap-4">
        <div class="text-sm text-gray-500">
          {{ $t('page.store_stock.batch.hint', { count: String(rows.length) }) }}
        </div>
        <NTable :bordered="false" :single-line="false" size="small">
          <thead>
            <tr>
              <th>{{ $t('page.store_stock.batch.thProduct') }}</th>
              <th>{{ $t('page.store_stock.batch.thSpec') }}</th>
              <th>{{ $t('page.store_stock.batch.thCurrent') }}</th>
              <th>{{ $t('page.store_stock.batch.thChange') }}</th>
              <th>{{ $t('page.store_stock.batch.thReason') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in batchRows" :key="row.id">
              <td>{{ row.tenantProd?.product?.name ?? '-' }}</td>
              <td>{{ specsToString(row.globalSku?.specValues) }}</td>
              <td>{{ row.stock }}</td>
              <td>
                <NInputNumber
                  v-model:value="row.draftStockChange"
                  :min="-9999"
                  :max="9999"
                  :precision="0"
                  size="small"
                  :placeholder="$t('page.store_stock.batch.changePlaceholder')"
                  class="w-[120px]"
                />
              </td>
              <td>
                <NInput
                  v-model:value="row.draftReason"
                  size="small"
                  :placeholder="$t('page.store_stock.batch.reasonOptional')"
                  clearable
                  class="w-[140px]"
                />
              </td>
            </tr>
          </tbody>
        </NTable>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="visible = false">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" :loading="loading" @click="handleSubmit">{{ $t('common.save') }}</NButton>
        </div>
      </template>
    </NDrawerContent>
  </NDrawer>
  <BatchOperationResultModal
    v-model:show="batchResultVisible"
    :title="$t('page.store_stock.batch.resultTitle')"
    :id-column-title="$t('page.store_stock.batch.resultIdColumn')"
    :result="batchResultPayload"
  />
</template>
