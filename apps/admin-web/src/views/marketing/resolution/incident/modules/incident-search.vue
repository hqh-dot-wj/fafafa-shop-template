<script setup lang="ts">
import { computed } from 'vue';
import type { SelectOption } from 'naive-ui';
import { NButton, NCard, NCollapse, NCollapseItem, NForm, NFormItemGi, NGrid, NInput, NSelect, NSpace } from 'naive-ui';
import type { ResolutionIncidentSearchParams } from '@/service/api/marketing/resolution';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({ name: 'ResolutionIncidentSearch' });

interface IncidentSearchModel extends ResolutionIncidentSearchParams {
  keyword: string;
}

const props = defineProps<{
  model: IncidentSearchModel;
  statusOptions: SelectOption[];
  typeOptions: SelectOption[];
  levelOptions: SelectOption[];
}>();

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

const { formRef, validate, restoreValidation } = useNaiveForm();
const model = computed(() => props.model);

type RuleKey = keyof IncidentSearchModel;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  pageNum: [],
  pageSize: [],
  status: [],
  level: [],
  type: [],
  keyword: [],
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
  <!-- 排障查询区：按工单状态、类型、等级和关键词筛选列表。 -->
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['incident-search']">
      <NCollapseItem title="排障查询" name="incident-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="100">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="工单状态" path="status" class="pr-24px">
              <NSelect v-model:value="model.status" clearable :options="statusOptions" placeholder="请选择状态" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="工单类型" path="type" class="pr-24px">
              <NSelect v-model:value="model.type" clearable :options="typeOptions" placeholder="请选择类型" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="工单等级" path="level" class="pr-24px">
              <NSelect v-model:value="model.level" clearable :options="levelOptions" placeholder="请选择等级" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:12" label="关键字" path="keyword" class="pr-24px">
              <NInput
                v-model:value="model.keyword"
                clearable
                placeholder="请输入标题、内容或编码"
                @keyup.enter="search"
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

<style scoped></style>
