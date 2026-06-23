<script setup lang="ts">
import { computed } from 'vue';
import { useDict } from '@/hooks/business/dict';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'TemplateSearch',
});

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Marketing.CouponTemplateSearchParams>('model', { required: true });

type RuleKey = Extract<keyof Api.Marketing.CouponTemplateSearchParams, 'name' | 'type' | 'status'>;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => {
  return {
    name: [],
    type: [],
    status: [],
  };
});

async function reset() {
  await restoreValidation();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}

const { options: typeOptions } = useDict('marketing_coupon_type', true);
const { options: statusOptions } = useDict('marketing_coupon_status', true);
</script>

<template>
  <!-- 券模板搜索区：按模板名称、券类型和状态筛选优惠券模板。 -->
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['template-search']">
      <NCollapseItem :title="$t('common.search')" name="template-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="104">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="模板名称" path="name" class="pr-24px">
              <NInput v-model:value="model.name" placeholder="请输入模板名称" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="优惠券类型" path="type" class="pr-24px">
              <NSelect v-model:value="model.type" placeholder="请选择类型" :options="typeOptions" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="状态" path="status" class="pr-24px">
              <NSelect v-model:value="model.status" placeholder="请选择状态" :options="statusOptions" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6">
              <NSpace class="w-full" justify="end">
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
            </NFormItemGi>
          </NGrid>
        </NForm>
      </NCollapseItem>
    </NCollapse>
  </NCard>
</template>

<style scoped></style>
