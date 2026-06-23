<script setup lang="tsx">
import { computed, onMounted, reactive, ref } from 'vue';
import type { DataTableColumns, SelectOption } from 'naive-ui';
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItemGridItem,
  NGrid,
  NInputNumber,
  NSelect,
  NSpace,
  NSwitch,
} from 'naive-ui';
import {
  fetchGetDistributionConfig,
  fetchGetDistributionConfigLogs,
  fetchUpdateDistributionConfig,
} from '@/service/api/store/distribution';
import { $t } from '@/locales';

defineOptions({
  name: 'StoreDistributionConfig',
});

const loading = ref(false);
const submitting = ref(false);

const model = reactive<Api.Store.UpdateDistributionConfigDto>({
  enableLV0: true,
  enableCrossTenant: false,
  crossTenantRate: 1,
  crossMaxDaily: 500,
  commissionBaseType: 'ORIGINAL_PRICE',
  maxCommissionRate: 50,
});

const commissionBaseTypeOptions = computed<SelectOption[]>(() => [
  { label: $t('page.finance_distribution_config.commissionBase.ORIGINAL_PRICE'), value: 'ORIGINAL_PRICE' },
  { label: $t('page.finance_distribution_config.commissionBase.ACTUAL_PAID'), value: 'ACTUAL_PAID' },
  { label: $t('page.finance_distribution_config.commissionBase.ZERO'), value: 'ZERO' },
]);

const history = ref<Api.Store.DistributionConfigLog[]>([]);

function formatCommissionBaseType(value?: string): string {
  const matched = commissionBaseTypeOptions.value.find((option) => option.value === value);
  const label = matched?.label;
  if (typeof label === 'string') {
    return label;
  }
  return value || '-';
}

const columns: DataTableColumns<Api.Store.DistributionConfigLog> = [
  { title: $t('page.common.createTime'), key: 'createTime', width: 180 },
  {
    title: $t('page.store_distribution.commissionBaseType'),
    key: 'commissionBaseType',
    render: (row) => formatCommissionBaseType(row.commissionBaseType),
  },
  {
    title: $t('page.store_distribution.enableLV0'),
    key: 'enableLV0',
    render: (row) => (row.enableLV0 ? $t('common.yesOrNo.yes') : $t('common.yesOrNo.no')),
  },
  {
    title: $t('page.store_distribution.enableCrossTenant'),
    key: 'enableCrossTenant',
    render: (row) => (row.enableCrossTenant ? $t('common.yesOrNo.yes') : $t('common.yesOrNo.no')),
  },
  {
    title: $t('page.store_distribution.commissionFuse'),
    key: 'maxCommissionRate',
    render: (row) =>
      row.maxCommissionRate === null || row.maxCommissionRate === undefined ? '-' : `${row.maxCommissionRate}%`,
  },
  { title: $t('page.common.createBy'), key: 'operator' },
];

async function init() {
  loading.value = true;
  try {
    const { data } = await fetchGetDistributionConfig();
    if (data) {
      Object.assign(model, {
        enableLV0: data.enableLV0,
        enableCrossTenant: data.enableCrossTenant ?? false,
        crossTenantRate: data.crossTenantRate ?? 1,
        crossMaxDaily: data.crossMaxDaily ?? 500,
        commissionBaseType: data.commissionBaseType ?? 'ORIGINAL_PRICE',
        maxCommissionRate: data.maxCommissionRate ?? 50,
      });
    }
    const { data: logData } = await fetchGetDistributionConfigLogs({ pageNum: 1, pageSize: 5 });
    if (logData) {
      history.value = logData.rows;
    }
  } catch {
    /* request layer handles error toast */
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  submitting.value = true;
  try {
    await fetchUpdateDistributionConfig(model);
    window.$message?.success($t('common.updateSuccess'));
    await init();
  } catch {
    /* request layer handles error toast */
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  init();
});
</script>

<template>
  <div class="h-full min-h-0 min-h-500px flex-col-stretch gap-16px overflow-y-auto lt-sm:overflow-auto">
    <NSpace vertical :size="16">
      <NCard :title="$t('page.store_distribution.title')" :bordered="false" size="small" class="card-wrapper">
        <NForm :model="model" label-placement="left" :label-width="200" class="max-w-800px">
          <NGrid :cols="24" :x-gap="24">
            <NFormItemGridItem :span="24" :label="$t('page.store_distribution.enableLV0')" path="enableLV0">
              <NSwitch v-model:value="model.enableLV0" />
            </NFormItemGridItem>

            <NFormItemGridItem
              :span="24"
              :label="$t('page.store_distribution.commissionBaseType')"
              path="commissionBaseType"
            >
              <NSelect
                v-model:value="model.commissionBaseType"
                :options="commissionBaseTypeOptions"
                :placeholder="$t('page.store_distribution.commissionBasePlaceholder')"
                class="w-full"
              />
            </NFormItemGridItem>

            <NFormItemGridItem
              :span="24"
              :label="$t('page.store_distribution.commissionFuse')"
              path="maxCommissionRate"
            >
              <NInputNumber v-model:value="model.maxCommissionRate" :min="0" :max="100" class="w-full">
                <template #suffix>%</template>
              </NInputNumber>
              <div class="ml-8px text-12px text-gray-400">{{ $t('page.store_distribution.commissionFuseTip') }}</div>
            </NFormItemGridItem>

            <NFormItemGridItem :span="24">
              <NAlert type="info" :show-icon="true" class="w-full">
                <div class="flex-col gap-8px">
                  <p>
                    <strong>{{ $t('page.store_distribution.lv0Policy') }}:</strong>
                  </p>
                  <p>{{ $t('page.store_distribution.lv0PolicyDesc') }}</p>
                  <p>{{ $t('page.store_distribution.lv1PolicyDesc') }}</p>
                </div>
              </NAlert>
            </NFormItemGridItem>

            <NFormItemGridItem :span="24">
              <div class="my-16px h-1px bg-gray-200"></div>
              <div class="mb-16px text-16px font-bold">{{ $t('page.store_distribution.crossTenantSettings') }}</div>
            </NFormItemGridItem>

            <NFormItemGridItem
              :span="24"
              :label="$t('page.store_distribution.enableCrossTenant')"
              path="enableCrossTenant"
            >
              <div class="flex-col gap-8px">
                <NSwitch v-model:value="model.enableCrossTenant" />
                <div class="text-12px text-gray-400">{{ $t('page.store_distribution.enableCrossTenantDesc') }}</div>
              </div>
            </NFormItemGridItem>

            <NFormItemGridItem
              v-if="model.enableCrossTenant"
              :span="24"
              :label="$t('page.store_distribution.crossTenantRate')"
              path="crossTenantRate"
            >
              <NInputNumber v-model:value="model.crossTenantRate" :min="0" :max="1" :step="0.01" class="w-full">
                <template #suffix>x</template>
              </NInputNumber>
              <div class="ml-8px text-12px text-gray-400">{{ $t('page.store_distribution.crossTenantRateTip') }}</div>
            </NFormItemGridItem>

            <NFormItemGridItem
              v-if="model.enableCrossTenant"
              :span="24"
              :label="$t('page.store_distribution.crossMaxDaily')"
              path="crossMaxDaily"
            >
              <NInputNumber v-model:value="model.crossMaxDaily" :min="0" :step="10" class="w-full">
                <template #prefix>¥</template>
              </NInputNumber>
              <div class="ml-8px text-12px text-gray-400">{{ $t('page.store_distribution.crossMaxDailyTip') }}</div>
            </NFormItemGridItem>

            <NFormItemGridItem :span="24">
              <NButton type="primary" :loading="submitting" @click="handleSubmit">
                {{ $t('common.save') }}
              </NButton>
            </NFormItemGridItem>
          </NGrid>
        </NForm>
      </NCard>

      <NCard :title="$t('page.store_distribution.historyTitle')" :bordered="false" size="small" class="card-wrapper">
        <NDataTable :columns="columns" :data="history" :loading="loading" :pagination="{ pageSize: 5 }" />
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped>
.card-wrapper {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.card-wrapper:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>
