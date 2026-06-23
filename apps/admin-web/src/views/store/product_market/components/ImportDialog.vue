<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue';
import {
  NAlert,
  NButton,
  NDataTable,
  NForm,
  NFormItem,
  NImage,
  NInputNumber,
  NModal,
  NTag,
  useMessage,
} from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchGetMarketProductDetail, fetchImportProduct } from '@/service/api/store/product';
import { Money } from '@/utils/money';
import { $t } from '@/locales';
import {
  calculateSkuDistributionCommission,
  canEditSkuDistributionRate,
  getSkuDistributionModeMeta,
  getSkuDistributionRatePrecision,
  getSkuDistributionRateSuffix,
} from '../../product/shared/sku-distribution-display';

interface Props {
  show: boolean;
  product: Api.Store.MarketProduct | null;
}

/** 选品详情接口中的总部 SKU 行（字段以运行时为准） */
interface MarketDetailGlobalSku {
  skuId: string;
  guidePrice: number | string | null;
  guideRate: number | string | null;
  distMode: string;
  specValues?: Record<string, string> | string | null;
  costPrice?: number | string | null;
}

interface ImportSkuRow {
  globalSkuId: string;
  originalSku: MarketDetailGlobalSku;
  price: number;
  stock: number;
  distRate: number;
  distMode: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'update:show', v: boolean): void; (e: 'success'): void }>();

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val),
});

const loading = ref(false);
const message = useMessage();

const formModel = reactive<Omit<Api.Store.ProductImportParams, 'productId'>>({
  overrideRadius: null,
  skus: [],
});

watch(
  () => props.product,
  async (newVal) => {
    if (newVal) {
      formModel.overrideRadius = newVal.serviceRadius || null;
      formModel.skus = [];

      try {
        loading.value = true;
        const { data, error } = await fetchGetMarketProductDetail(newVal.productId);
        if (!error && data?.globalSkus) {
          formModel.skus = data.globalSkus.map((sku: MarketDetailGlobalSku) => ({
            globalSkuId: sku.skuId,
            originalSku: sku,
            price: Number(sku.guidePrice),
            stock: 0,
            distRate: Number(sku.guideRate),
            distMode: sku.distMode,
          })) as ImportSkuRow[];
          if (data.serviceRadius) {
            formModel.overrideRadius = data.serviceRadius;
          }
        }
      } finally {
        loading.value = false;
      }
    }
  },
  { immediate: true },
);

const columns = computed<DataTableColumns<ImportSkuRow>>(() => [
  {
    title: $t('page.store_product_market.importDialog.colSpec'),
    key: 'spec',
    width: 160,
    render(row: ImportSkuRow) {
      const specs = row.originalSku?.specValues;
      if (!specs) return $t('page.store_product_market.importDialog.defaultSpec');
      if (typeof specs === 'object') {
        return Object.values(specs).join(' / ');
      }
      return String(specs);
    },
  },
  {
    title: $t('page.store_product_market.importDialog.colCost'),
    key: 'costPrice',
    width: 96,
    render: (row: ImportSkuRow) => `¥${row.originalSku?.costPrice}`,
  },
  {
    title: $t('page.store_product_market.importDialog.colPrice'),
    key: 'price',
    width: 120,
    render(row: ImportSkuRow) {
      return h(NInputNumber, {
        value: row.price,
        onUpdateValue(v) {
          row.price = v || 0;
        },
        min: 0,
        precision: 2,
        size: 'small',
        showButton: false,
        style: { width: '104px' },
      });
    },
  },
  {
    title: $t('page.store_product_market.importDialog.colStock'),
    key: 'stock',
    width: 120,
    render(row: ImportSkuRow) {
      return h(NInputNumber, {
        value: row.stock,
        onUpdateValue(v) {
          row.stock = v || 0;
        },
        min: 0,
        precision: 0,
        size: 'small',
        style: { width: '104px' },
      });
    },
  },
  {
    title: $t('page.store_product_market.importDialog.colDistRate'),
    key: 'distConfig',
    width: 240,
    render(row: ImportSkuRow) {
      const modeMeta = getSkuDistributionModeMeta(row.distMode);
      return h('div', { class: 'sku-commission-cell' }, [
        h(
          NTag,
          { size: 'small', type: modeMeta.tagType, class: 'sku-commission-mode' },
          { default: () => modeMeta.label },
        ),
        h(NInputNumber, {
          value: row.distRate,
          onUpdateValue(v) {
            row.distRate = v || 0;
          },
          disabled: !canEditSkuDistributionRate(row.distMode),
          min: 0,
          step: 0.01,
          precision: getSkuDistributionRatePrecision(row.distMode),
          size: 'small',
          showButton: false,
          class: 'sku-commission-input',
          suffix: () => getSkuDistributionRateSuffix(row.distMode),
        }),
      ]);
    },
  },
  {
    title: $t('page.store_product_market.importDialog.colProfit'),
    key: 'profit',
    width: 120,
    render(row: ImportSkuRow) {
      const profit = calculateProfit(row);
      const isLoss = profit.isNegative();
      return h('span', { class: isLoss ? 'text-red font-bold' : 'text-green font-bold' }, profit.format());
    },
  },
]);

function calculateProfit(row: ImportSkuRow) {
  const cost = new Money(row.originalSku?.costPrice);
  const price = new Money(row.price);
  const commission = calculateSkuDistributionCommission(row.price, row.distRate, row.distMode);
  return price.sub(cost).sub(commission);
}

async function handleConfirm() {
  if (!props.product) return;

  const lossSkus = formModel.skus.filter((sku: ImportSkuRow) => calculateProfit(sku).isNegative());
  if (lossSkus.length > 0) {
    message.error($t('page.store_product_market.importDialog.msgLoss'));
    return;
  }

  loading.value = true;
  try {
    const payload: Api.Store.ProductImportParams = {
      productId: props.product.productId,
      overrideRadius: formModel.overrideRadius ?? undefined,
      skus: formModel.skus.map((row: ImportSkuRow) => ({
        globalSkuId: row.globalSkuId,
        price: row.price,
        stock: row.stock,
        distRate: row.distRate,
        distMode: row.distMode,
      })),
    };

    await fetchImportProduct(payload);
    message.success($t('page.store_product_market.importDialog.msgSuccess'));
    emit('success');
    close();
  } catch {
    // error handled by request
  } finally {
    loading.value = false;
  }
}

function close() {
  visible.value = false;
}

function feedbackRadiusText(product: Api.Store.MarketProduct) {
  const radius =
    typeof product.serviceRadius === 'number'
      ? `${product.serviceRadius}${$t('page.store_product_market.importDialog.suffixMeter')}`
      : $t('page.store_product_market.importDialog.radiusNotSet');
  return $t('page.store_product_market.importDialog.feedbackRadius', { radius });
}
</script>

<template>
  <NModal
    v-model:show="visible"
    preset="dialog"
    :title="$t('page.store_product_market.importDialog.modalTitle')"
    class="import-dialog-modal"
  >
    <div v-if="product" class="flex flex-col gap-4 py-4">
      <div class="product-summary flex items-center gap-4 rounded bg-gray-50 p-4 dark:bg-gray-800">
        <NImage
          :src="product.albumPics?.split(',')[0]"
          class="h-16 w-16 border rounded object-cover"
          fallback-src="https://via.placeholder.com/100"
          preview-disabled
        />
        <div class="min-w-0 flex flex-col">
          <span class="break-words text-lg font-bold leading-6">{{ product.name }}</span>
          <span class="text-sm text-gray-500">
            {{ $t('page.store_product_market.importDialog.typeLabel') }}
            <NTag :type="product.type === 'REAL' ? 'info' : 'success'" size="small">
              {{
                product.type === 'REAL'
                  ? $t('page.store_product_market.importDialog.typeReal')
                  : $t('page.store_product_market.importDialog.typeService')
              }}
            </NTag>
          </span>
        </div>
      </div>

      <NForm label-placement="left" label-width="120">
        <NFormItem
          v-if="product.type === 'SERVICE'"
          :label="$t('page.store_product_market.importDialog.serviceRadiusLabel')"
        >
          <NInputNumber
            v-model:value="formModel.overrideRadius"
            :min="0"
            :placeholder="$t('page.store_product_market.importDialog.serviceRadiusPlaceholder')"
          >
            <template #suffix>{{ $t('page.store_product_market.importDialog.suffixMeter') }}</template>
          </NInputNumber>
          <template #feedback>{{ feedbackRadiusText(product) }}</template>
        </NFormItem>

        <div class="mt-4">
          <div class="mb-2 flex items-center justify-between">
            <span class="font-bold">{{ $t('page.store_product_market.importDialog.specConfigTitle') }}</span>
            <NAlert type="info" size="small" :bordered="false">
              {{
                product.type === 'SERVICE'
                  ? $t('page.store_product_market.importDialog.stockHintService')
                  : $t('page.store_product_market.importDialog.stockHintReal')
              }}
            </NAlert>
          </div>

          <NDataTable
            class="sku-config-table"
            :columns="columns"
            :data="formModel.skus"
            :row-key="(row) => row.globalSkuId"
            size="small"
            :pagination="false"
            :single-line="false"
            :scroll-x="860"
          />
        </div>
      </NForm>
    </div>

    <template #action>
      <NButton @click="close">{{ $t('common.cancel') }}</NButton>
      <NButton type="primary" :loading="loading" @click="handleConfirm">
        {{ $t('page.store_product_market.importDialog.confirmImport') }}
      </NButton>
    </template>
  </NModal>
</template>

<style scoped>
:global(.import-dialog-modal) {
  width: min(1000px, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
}

.sku-config-table :deep(.n-data-table-td) {
  vertical-align: top;
}

.sku-commission-cell {
  display: grid;
  grid-template-columns: 86px 1fr;
  align-items: center;
  gap: 8px;
  min-width: 200px;
}

.sku-commission-mode {
  justify-content: center;
}

.sku-commission-input {
  width: 112px;
}

@media (max-width: 640px) {
  .product-summary {
    align-items: flex-start;
  }

  .sku-commission-cell {
    grid-template-columns: 1fr;
  }
}
</style>
