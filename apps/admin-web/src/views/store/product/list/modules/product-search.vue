<script setup lang="ts">
import { computed } from 'vue';
import type { SelectOption } from 'naive-ui';
import {
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NForm,
  NFormItemGi,
  NGi,
  NGrid,
  NInput,
  NSelect,
  NSpace,
} from 'naive-ui';
import { useDict } from '@/hooks/business/dict';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'ProductSearch',
});

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Store.ListStoreProductParams>('model', { required: true });

const { formRef, validate, restoreValidation } = useNaiveForm();

const { options: productTypeDictOptions } = useDict('store_product_type', true);
const { options: productStatusDictOptions } = useDict('store_product_status', true);

async function reset() {
  await restoreValidation();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}

const typeOptions = computed<SelectOption[]>(() => [{ label: '全部', value: '' }, ...productTypeDictOptions.value]);

const statusOptions = computed<SelectOption[]>(() => [{ label: '全部', value: '' }, ...productStatusDictOptions.value]);
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['store-product-list-search']">
      <NCollapseItem :title="$t('common.search')" name="store-product-list-search">
        <NForm ref="formRef" :model="model" label-placement="left" :label-width="80">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="商品名称" path="name" class="pr-24px">
              <NInput v-model:value="model.name" placeholder="请输入名称/标题" clearable @keyup.enter="search" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="商品类型" path="type" class="pr-24px">
              <NSelect v-model:value="model.type" placeholder="请选择类型" :options="typeOptions" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="商品状态" path="status" class="pr-24px">
              <NSelect v-model:value="model.status" placeholder="请选择状态" :options="statusOptions" clearable />
            </NFormItemGi>
            <NGi span="24 s:24 m:6" class="flex items-end justify-end pr-24px">
              <NSpace :wrap="false">
                <NButton @click="reset">
                  <template #icon>
                    <icon-ic-round-refresh class="text-icon" />
                  </template>
                  {{ $t('common.reset') }}
                </NButton>
                <NButton type="primary" ghost @click="search">
                  <template #icon>
                    <icon-ic-round-search class="text-icon" />
                  </template>
                  {{ $t('common.search') }}
                </NButton>
              </NSpace>
            </NGi>
          </NGrid>
        </NForm>
      </NCollapseItem>
    </NCollapse>
  </NCard>
</template>

<style scoped></style>
