<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NCard, NCollapse, NCollapseItem, NForm, NFormItemGi, NGrid, NInput, NSelect, NSpace } from 'naive-ui';
import type { SelectOption } from 'naive-ui';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';
import type { EntitlementPoolListQuery } from './entitlement-pool.types';

defineOptions({ name: 'EntitlementPoolSearch' });

const props = defineProps<{
  model: EntitlementPoolListQuery;
  poolTypeOptions: SelectOption[];
  statusOptions: SelectOption[];
}>();

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

const { formRef, validate, restoreValidation } = useNaiveForm();
const model = computed(() => props.model);

type RuleKey = keyof EntitlementPoolListQuery;

/** 与活动中心筛选一致：显式空规则，避免 naive Form 在无 rules 时校验行为不一致导致无法 emit search */
const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  keyword: [],
  poolType: [],
  status: [],
}));

async function search() {
  await validate();
  emit('search');
}

async function reset() {
  await restoreValidation();
  emit('reset');
}
</script>

<template>
  <!-- 权益池搜索区：按名称、池类型和编译状态筛选编排草稿。 -->
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['entitlement-search']">
      <NCollapseItem :title="$t('common.search')" name="entitlement-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="96">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:8" label="关键字" path="keyword" class="min-w-0 pr-24px">
              <NInput
                v-model:value="model.keyword"
                clearable
                class="max-w-full w-full"
                placeholder="池名称 / 模板ID / 任务ID / sourceKey"
                @keyup.enter="search"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:8" label="池类型" path="poolType" class="min-w-0 pr-24px">
              <NSelect
                v-model:value="model.poolType"
                clearable
                class="max-w-full w-full"
                :options="poolTypeOptions"
                placeholder="请选择池类型"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:8" label="编排状态" path="status" class="min-w-0 pr-24px">
              <NSelect
                v-model:value="model.status"
                clearable
                class="max-w-full w-full"
                :options="statusOptions"
                placeholder="请选择状态"
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
