<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NCard, NCollapse, NCollapseItem, NForm, NFormItemGi, NGrid, NInput, NSelect, NSpace } from 'naive-ui';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({ name: 'CourseGroupCommissionSearch' });

interface CommissionSearchModel {
  keyword: string;
  tenantName: string;
  status: string | null;
}

const props = defineProps<{
  model: CommissionSearchModel;
  statusOptions: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = computed(() => props.model);

type RuleKey = keyof CommissionSearchModel;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  keyword: [],
  tenantName: [],
  status: [],
}));

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
  <!-- 拼课分佣搜索区：按团、商品、活动、门店和分佣状态筛选。 -->
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['course-group-commission-search']">
      <NCollapseItem :title="$t('common.search')" name="course-group-commission-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="120">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:8" label="关键词" path="keyword" class="min-w-0 pr-24px">
              <NInput
                v-model:value="model.keyword"
                clearable
                class="max-w-full w-full"
                placeholder="团编号 / 商品名称 / 活动"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:8" label="门店" path="tenantName" class="min-w-0 pr-24px">
              <NInput v-model:value="model.tenantName" clearable class="max-w-full w-full" placeholder="门店名称" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:8" label="状态" path="status" class="min-w-0 pr-24px">
              <NSelect
                v-model:value="model.status"
                clearable
                class="max-w-full w-full"
                :options="statusOptions"
                placeholder="全部状态"
              />
            </NFormItemGi>
            <NFormItemGi span="24">
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
