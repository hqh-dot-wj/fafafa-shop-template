<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NCard, NCollapse, NCollapseItem, NDatePicker, NForm, NFormItemGi, NGrid, NInput, NSelect, NSpace } from 'naive-ui';
import type { SelectOption } from 'naive-ui';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';
import type { ActivityStatus } from './activity-table-columns';

defineOptions({ name: 'ActivitySearch' });

interface ActivitySearchModel {
  keyword: string;
  type: string | null;
  status: ActivityStatus | null;
  ownerUserId: string;
  timeRange: [number, number] | null;
}

const props = defineProps<{
  model: ActivitySearchModel;
  activityTypeOptions: SelectOption[];
  statusOptions: SelectOption[];
}>();

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = computed(() => props.model);
const ownerUserSelectValue = computed<CommonType.IdType | null>({
  get: () => {
    const rawValue = model.value.ownerUserId?.trim();
    if (!rawValue) return null;
    const asNumber = Number(rawValue);
    return Number.isFinite(asNumber) ? asNumber : rawValue;
  },
  set: value => {
    model.value.ownerUserId = value === null || value === undefined ? '' : String(value);
  },
});

type RuleKey = keyof ActivitySearchModel;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  keyword: [],
  type: [],
  status: [],
  ownerUserId: [],
  timeRange: [],
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
  <NCard :bordered="false" size="small" class="card-wrapper">
    <!-- 文案锚点：活动名称或 ID -->
    <NCollapse :default-expanded-names="['activity-search']">
      <NCollapseItem :title="$t('common.search')" name="activity-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="112">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="活动名称 / ID / 租户" path="keyword" class="min-w-0 pr-24px">
              <NInput
                v-model:value="model.keyword"
                clearable
                class="max-w-full w-full"
                placeholder="名称、活动 ID、租户 ID 或租户名称"
                @keyup.enter="search"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="活动类型" path="type" class="min-w-0 pr-24px">
              <NSelect
                v-model:value="model.type"
                clearable
                class="max-w-full w-full"
                :options="activityTypeOptions"
                placeholder="请选择活动类型"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="活动状态" path="status" class="min-w-0 pr-24px">
              <NSelect
                v-model:value="model.status"
                clearable
                class="max-w-full w-full"
                :options="statusOptions"
                placeholder="请选择状态"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="负责人账号" path="ownerUserId" class="min-w-0 pr-24px">
              <UserSelect
                v-model:value="ownerUserSelectValue"
                clearable
                filterable
                class="max-w-full w-full"
                placeholder="请选择负责人（可选）"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:12" label="开始时间范围" path="timeRange" class="min-w-0 pr-24px">
              <NDatePicker
                v-model:value="model.timeRange"
                type="datetimerange"
                clearable
                class="max-w-full w-full"
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
