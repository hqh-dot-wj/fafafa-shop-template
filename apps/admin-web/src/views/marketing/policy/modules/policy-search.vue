<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NCard, NCollapse, NCollapseItem, NForm, NFormItemGi, NGrid, NSelect, NSpace } from 'naive-ui';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({ name: 'PolicySearch' });

interface Emits {
  (e: 'search'): void;
  (e: 'reset'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Marketing.PolicySearchParams>('model', { required: true });

type RuleKey = Extract<keyof Api.Marketing.PolicySearchParams, 'policyType' | 'status'>;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  policyType: [],
  status: [],
}));

// quality-gate allow-semantic-options
const policyTypeOptions = [
  { label: '商品池(SOURCE)', value: 'SOURCE' },
  { label: '裁决(RESOLVER)', value: 'RESOLVER' },
  { label: '受众(AUDIENCE)', value: 'AUDIENCE' },
  { label: '排序(SORT)', value: 'SORT' },
  { label: '卡片模板(CARD_TEMPLATE)', value: 'CARD_TEMPLATE' },
];

const statusOptions = [
  { label: '启用', value: 'ACTIVE' },
  { label: '停用', value: 'INACTIVE' },
];

async function reset() {
  await restoreValidation();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}
</script>

<template>
  <!-- 策略搜索区：按策略类型和启停状态筛选策略列表。 -->
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['policy-search']">
      <NCollapseItem :title="$t('common.search')" name="policy-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="104">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="策略类型" path="policyType" class="pr-24px">
              <NSelect
                v-model:value="model.policyType"
                :options="policyTypeOptions"
                clearable
                placeholder="请选择类型"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="状态" path="status" class="pr-24px">
              <NSelect v-model:value="model.status" :options="statusOptions" clearable placeholder="请选择状态" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:12">
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
