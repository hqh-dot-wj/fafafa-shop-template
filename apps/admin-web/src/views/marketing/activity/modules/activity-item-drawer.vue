<script setup lang="ts">
import { computed, ref } from 'vue';
import { NButton, NDrawer, NDrawerContent, NForm, NFormItem, NInput, NInputNumber, NSelect, NSpace } from 'naive-ui';
import type { SelectOption } from 'naive-ui';
import ProductSelectModal from '@/components/business/product-select-modal.vue';
import type { ProductPickerSelection } from '@/components/business/entity-picker.shared';
import { $t } from '@/locales';

interface ItemFormModel {
  productId: string;
  skuId: string;
  productName: string;
  skuName: string;
  originPrice: number;
  activityPrice: number;
  displayTag: string;
  sort: number;
  enabled: boolean;
}

type BooleanSelectValue = 'true' | 'false';

// 活动商品抽屉只维护活动项展示字段和商品/SKU 绑定。
// 运营填写的活动价是营销展示输入，最终成交价仍由订单链路按活动规则计算。
const props = defineProps<{
  show: boolean;
  editing: boolean;
  submitting: boolean;
}>();

const model = defineModel<ItemFormModel>('model', { required: true });

const emit = defineEmits<{
  'update:show': [value: boolean];
  save: [];
}>();

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});
const productPickerVisible = ref(false);

const title = computed(() => (props.editing ? `${$t('common.edit')}商品` : `${$t('common.add')}商品`));
const enabledOptions: SelectOption[] = [
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' },
];
const enabledValue = computed<BooleanSelectValue>({
  get: () => (model.value.enabled ? 'true' : 'false'),
  set: (value) => {
    model.value.enabled = value === 'true';
  },
});

function openProductPicker() {
  productPickerVisible.value = true;
}

function handleProductSelect(selection: ProductPickerSelection) {
  // 选择商品时带入建议原价，但只有在活动价为空时才同步，避免覆盖运营已填写的活动价。
  model.value.productId = selection.productId || '';
  model.value.skuId = selection.skuId || '';
  model.value.productName = selection.displayName || selection.productName || selection.name || selection.productId;
  model.value.skuName = selection.specLabel || '';
  const origin = Number(selection.guidePrice ?? selection.price ?? 0) || 0;
  if (origin > 0) {
    model.value.originPrice = origin;
    if (!model.value.activityPrice || model.value.activityPrice <= 0) {
      model.value.activityPrice = origin;
    }
  }
}

function clearProductSelection() {
  model.value.productId = '';
  model.value.skuId = '';
  model.value.productName = '';
  model.value.skuName = '';
}
</script>

<template>
  <!-- 活动商品抽屉：编辑活动项展示字段和商品/SKU 绑定关系。 -->
  <NDrawer v-model:show="visible" :width="460">
    <NDrawerContent :title="title" closable>
      <NForm :model="model" label-placement="left" :label-width="108">
        <NFormItem label="商品/规格">
          <NSpace class="w-full" :wrap="false">
            <NInput
              :value="model.productName || model.productId || ''"
              placeholder="点击选择商品（可选规格）"
              clearable
              readonly
              @click="openProductPicker"
              @clear="clearProductSelection"
            />
            <NButton type="primary" ghost @click="openProductPicker">选择</NButton>
          </NSpace>
        </NFormItem>
        <NFormItem label="商品名称">
          <NInput v-model:value="model.productName" />
        </NFormItem>
        <NFormItem label="规格名称">
          <NInput v-model:value="model.skuName" />
        </NFormItem>
        <NFormItem label="原价">
          <NInputNumber v-model:value="model.originPrice" :min="0" :step="1" class="w-full" />
        </NFormItem>
        <NFormItem label="活动价">
          <NInputNumber v-model:value="model.activityPrice" :min="0" :step="1" class="w-full" />
        </NFormItem>
        <NFormItem label="展示标签">
          <NInput v-model:value="model.displayTag" placeholder="例如：团购价" />
        </NFormItem>
        <NFormItem label="排序">
          <NInputNumber v-model:value="model.sort" :min="1" :step="1" class="w-full" />
        </NFormItem>
        <NFormItem label="启用状态">
          <NSelect v-model:value="enabledValue" :options="enabledOptions" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="visible = false">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" :loading="submitting" @click="emit('save')">{{ $t('common.save') }}</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>

  <!-- 商品选择弹窗：复用业务选择器返回商品和规格摘要。 -->
  <ProductSelectModal
    v-model:visible="productPickerVisible"
    :selected="
      model.productId
        ? {
            productId: model.productId,
            skuId: model.skuId || undefined,
            displayName: model.productName || model.productId,
          }
        : null
    "
    @select="handleProductSelect"
  />
</template>
