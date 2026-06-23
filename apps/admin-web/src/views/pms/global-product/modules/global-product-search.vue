<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useNaiveForm } from '@/hooks/common/form';
import { useDict } from '@/hooks/business/dict';
import { $t } from '@/locales';
import { fetchTenantList } from '@/service/api/auth';

defineOptions({
  name: 'GlobalProductSearch',
});

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Pms.ProductSearchParams>('model', { required: true });

const { options: publishStatusOptions } = useDict('pms_publish_status', true);
const buildStatusOptions: Array<{ label: string; value: Api.Pms.ProductBuildStatus }> = [
  { label: '草稿', value: 'DRAFT' },
  { label: '已完成', value: 'COMPLETED' },
];
const productTypeOptions: Array<{ label: string; value: Api.Pms.ProductType }> = [
  { label: '实物商品', value: 'REAL' },
  { label: '服务商品', value: 'SERVICE' },
];
const tenantOptions = ref<Array<{ label: string; value: string }>>([]);

async function initTenantOptions() {
  const { data, error } = await fetchTenantList();
  if (error || !data?.voList) {
    return;
  }
  tenantOptions.value = data.voList.map((item) => ({
    label: `${item.companyName} (${item.tenantId})`,
    value: item.tenantId,
  }));
}

async function reset() {
  await restoreValidation();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}

onMounted(() => {
  void initTenantOptions();
});
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse>
      <NCollapseItem :title="$t('common.search')" name="product-search">
        <NForm ref="formRef" :model="model" label-placement="left" :label-width="80">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="商品名称" path="name" class="pr-24px">
              <NInput v-model:value="model.name" placeholder="请输入商品名称" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="发布状态" path="publishStatus" class="pr-24px">
              <NSelect
                v-model:value="model.publishStatus"
                placeholder="请选择发布状态"
                :options="publishStatusOptions"
                clearable
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="构建状态" path="buildStatus" class="pr-24px">
              <NSelect
                v-model:value="model.buildStatus"
                placeholder="请选择构建状态"
                :options="buildStatusOptions"
                clearable
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="商品类型" path="type" class="pr-24px">
              <NSelect v-model:value="model.type" placeholder="请选择商品类型" :options="productTypeOptions" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="创建租户" path="creatorTenantId" class="pr-24px">
              <NSelect
                v-model:value="model.creatorTenantId"
                placeholder="请选择租户"
                :options="tenantOptions"
                filterable
                clearable
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" class="pr-24px">
              <NSpace class="w-full" justify="end">
                <NButton @click="reset">
                  <template #icon>
                    <SvgIcon icon="ic:round-refresh" class="text-icon" />
                  </template>
                  {{ $t('common.reset') }}
                </NButton>
                <NButton type="primary" ghost @click="search">
                  <template #icon>
                    <SvgIcon icon="ic:round-search" class="text-icon" />
                  </template>
                  {{ $t('common.search') }}
                </NButton>
              </NSpace>
            </NFormItemGi>
          </NGrid>
        </NForm>
      </NCollapseItem>
    </NCollapse>
  </NCard>
</template>

<style scoped></style>
