<script setup lang="tsx">
import { computed, h, reactive, watch } from 'vue';
import {
  NAlert,
  NButton,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSpace,
  NSwitch,
  NTag,
  useMessage,
} from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchUpdateStoreProductBase, fetchUpdateStoreProductPrice } from '@/service/api/store/product';
import { useNaiveForm } from '@/hooks/common/form';
import { Money } from '@/utils/money';
import {
  calculateSkuDistributionCommission,
  canEditSkuDistributionRate,
  getSkuDistributionModeMeta,
  getSkuDistributionRatePrecision,
  getSkuDistributionRateSuffix,
} from '../../shared/sku-distribution-display';

defineOptions({
  name: 'ProductOperateDrawer',
});

interface Props {
  /** the type of operation */
  operateType: NaiveUI.TableOperateType;
  /** the edit row data */
  rowData?: Api.Store.TenantProduct | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false,
});

const { formRef, validate, restoreValidation } = useNaiveForm();
const message = useMessage();

const model = reactive<Api.Store.TenantProduct>(createDefaultModel());
const drawerTitle = computed(() => {
  if (props.operateType !== 'edit') return '查看商品';
  return model.auditStatus === 'APPROVED' ? '经营配置' : '草稿配置';
});

function createDefaultModel(): Api.Store.TenantProduct {
  return {
    id: '',
    productId: '',
    name: '',
    albumPics: '',
    type: 'REAL',
    status: 'OFF_SHELF',
    auditStatus: 'DRAFT',
    auditReason: undefined,
    submittedAt: undefined,
    isHot: false,
    price: 0,
    customTitle: '',
    overrideRadius: undefined,
    pointsRatio: 0,
    isPromotionProduct: false,
    skus: [],
  };
}

function handleInitModel() {
  Object.assign(model, createDefaultModel());

  if (props.operateType === 'edit' && props.rowData) {
    Object.assign(model, JSON.parse(JSON.stringify(props.rowData)));
  }
}

function canEnableShelf(): boolean {
  return model.auditStatus === 'APPROVED';
}

watch(visible, () => {
  if (visible.value) {
    handleInitModel();
    restoreValidation();
  }
});

function calculateProfit(row: Api.Store.TenantSku) {
  const cost = new Money(row.costPrice);
  const price = new Money(row.price);
  const commission = calculateSkuDistributionCommission(row.price, row.distRate, row.distMode);
  return price.sub(cost).sub(commission);
}

async function handleSaveSku(row: Api.Store.TenantSku) {
  const profit = calculateProfit(row);
  if (profit.isNegative()) {
    message.error(`SKU [${specsToString(row.specValues)}] 存在亏本风险，请调整！`);
    return;
  }

  try {
    await fetchUpdateStoreProductPrice({
      tenantSkuId: row.id,
      price: row.price,
      stock: row.stock,
      distRate: row.distRate,
      distMode: row.distMode,
      pointsRatio: model.pointsRatio,
      isPromotionProduct: model.isPromotionProduct,
    });
    message.success('SKU 配置更新成功');
  } catch {
    // error handled by request
  }
}

function specsToString(specs: any) {
  if (!specs) return '默认';
  if (typeof specs === 'object') return Object.values(specs).join(' / ');
  return String(specs);
}

const columns: DataTableColumns<Api.Store.TenantSku> = [
  {
    title: '规格项',
    key: 'specValues',
    width: 160,
    render: (row: Api.Store.TenantSku) => specsToString(row.specValues),
  },
  {
    title: '总部成本',
    key: 'costPrice',
    width: 96,
    render: (row: Api.Store.TenantSku) => `¥${row.costPrice}`,
  },
  {
    title: '售价',
    key: 'price',
    width: 120,
    render: (row: Api.Store.TenantSku) =>
      h(NInputNumber, {
        value: row.price,
        onUpdateValue: (v) => {
          row.price = v || 0;
        },
        size: 'small',
        showButton: false,
        style: { width: '104px' },
      }),
  },
  {
    title: '库存/日限',
    key: 'stock',
    width: 120,
    render: (row: Api.Store.TenantSku) =>
      h(NInputNumber, {
        value: row.stock,
        onUpdateValue: (v) => {
          row.stock = v || 0;
        },
        size: 'small',
        showButton: false,
        style: { width: '104px' },
      }),
  },
  {
    title: '分佣模式/额',
    key: 'distConfig',
    width: 240,
    render: (row: Api.Store.TenantSku) =>
      h('div', { class: 'sku-commission-cell' }, [
        h(
          NTag,
          { size: 'small', type: getSkuDistributionModeMeta(row.distMode).tagType, class: 'sku-commission-mode' },
          { default: () => getSkuDistributionModeMeta(row.distMode).label },
        ),
        h(NInputNumber, {
          value: row.distRate,
          onUpdateValue: (v) => {
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
      ]),
  },
  {
    title: '利润预估',
    key: 'profit',
    width: 120,
    render: (row: Api.Store.TenantSku) => {
      const profit = calculateProfit(row);
      return h('span', { class: profit.isNegative() ? 'text-red font-bold' : 'text-green font-bold' }, profit.format());
    },
  },
  {
    title: '操作',
    key: 'action',
    width: 100,
    render: (row: Api.Store.TenantSku) =>
      h(
        NButton,
        {
          size: 'small',
          ghost: true,
          type: 'primary',
          onClick: () => handleSaveSku(row),
        },
        { default: () => '保存SKU' },
      ),
  },
];

async function handleSubmit() {
  await validate();

  try {
    await fetchUpdateStoreProductBase({
      id: model.id,
      status: model.status,
      customTitle: model.customTitle || undefined,
      overrideRadius: model.overrideRadius,
    });
    // 积分/营销字段挂在店铺 SKU 上，走 update-price（与后端 DTO、表结构一致）
    const marketingPayload = {
      pointsRatio: model.pointsRatio,
      isPromotionProduct: model.isPromotionProduct,
    };
    await Promise.all(
      model.skus.map((sku: Api.Store.TenantSku) =>
        fetchUpdateStoreProductPrice({
          tenantSkuId: sku.id,
          price: sku.price,
          stock: sku.stock,
          distRate: sku.distRate,
          distMode: sku.distMode,
          ...marketingPayload,
        }),
      ),
    );
    message.success('基础配置更新成功');
    visible.value = false;
    emit('submitted');
  } catch {
    // error handled by request
  }
}

function closeDrawer() {
  visible.value = false;
}
</script>

<template>
  <NDrawer v-model:show="visible" :width="920" display-directive="show">
    <NDrawerContent :title="drawerTitle" native-scrollbar>
      <div class="flex flex-col gap-6">
        <!-- HQ Info -->
        <NAlert title="总部基础信息 (不可修改)" type="info">
          <div class="flex gap-4">
            <img :src="model.albumPics.split(',')[0]" class="h-20 w-20 rounded object-cover shadow" />
            <div class="flex flex-col justify-around">
              <div class="text-lg font-bold">{{ model.name }}</div>
              <div class="text-gray-500">类型：{{ model.type === 'REAL' ? '实物' : '服务' }}</div>
            </div>
          </div>
        </NAlert>

        <NForm ref="formRef" :model="model" label-placement="left" :label-width="100">
          <NFormItem label="门店自定义标题" path="customTitle">
            <NInput v-model:value="model.customTitle" placeholder="留空则使用总部标题" />
          </NFormItem>

          <NFormItem label="营销商品" path="isPromotionProduct">
            <NSwitch v-model:value="model.isPromotionProduct">
              <template #checked>是</template>
              <template #unchecked>否</template>
            </NSwitch>
          </NFormItem>

          <NFormItem label="积分获得比例" path="pointsRatio">
            <NInputNumber v-model:value="model.pointsRatio" :min="0" :max="200" placeholder="0-200，100为正常">
              <template #suffix>%</template>
            </NInputNumber>
          </NFormItem>

          <NFormItem label="上架状态" path="status">
            <NSpace align="center">
              <NSwitch
                v-model:value="model.status"
                checked-value="ON_SHELF"
                unchecked-value="OFF_SHELF"
                :disabled="model.status !== 'ON_SHELF' && !canEnableShelf()"
              />
              <NTag :type="model.status === 'ON_SHELF' ? 'success' : 'default'">
                {{ model.status === 'ON_SHELF' ? '经营中' : '已下架' }}
              </NTag>
            </NSpace>
            <template v-if="!canEnableShelf() && model.status !== 'ON_SHELF'" #feedback>
              当前商品未通过审核，暂不支持上架
            </template>
          </NFormItem>

          <NFormItem v-if="model.type === 'SERVICE'" label="服务半径" path="overrideRadius">
            <NInputNumber v-model:value="model.overrideRadius" :min="0">
              <template #suffix>米</template>
            </NInputNumber>
          </NFormItem>

          <div class="mt-4">
            <div class="mb-2 font-bold">SKU 经营详情 (单独保存)</div>
            <NDataTable
              class="sku-config-table"
              :columns="columns"
              :data="model.skus"
              :row-key="(row) => row.id"
              size="small"
              :pagination="false"
              :single-line="false"
              :scroll-x="960"
            />
          </div>
        </NForm>
      </div>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="closeDrawer">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" @click="handleSubmit">{{ $t('common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
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
</style>
