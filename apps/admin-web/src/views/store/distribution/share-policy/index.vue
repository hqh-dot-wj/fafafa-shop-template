<script setup lang="ts">
import { onMounted } from 'vue';
import { NButton, NCard, NDescriptions, NDescriptionsItem } from 'naive-ui';
import { $t } from '@/locales';
import { useSharePolicyForm } from './hooks/use-share-policy-form';
import PolicyForm from './modules/policy-form.vue';

defineOptions({
  name: 'StoreDistributionSharePolicy',
});

const { model, loading, submitting, bindingModeOptions, attributionModeOptions, loadPolicy, submitPolicy } =
  useSharePolicyForm();

onMounted(() => {
  loadPolicy();
});

function handlePolicyUpdate(value: Api.Store.SharePolicy) {
  Object.assign(model, value);
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-y-auto lt-sm:overflow-auto">
    <NCard :title="$t('route.store_distribution_share-policy')" :bordered="false" size="small" class="card-wrapper">
      <PolicyForm
        :model="model"
        :binding-mode-options="bindingModeOptions"
        :attribution-mode-options="attributionModeOptions"
        @update:model="handlePolicyUpdate"
      />
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton :loading="loading" @click="loadPolicy">
            {{ $t('common.refresh') }}
          </NButton>
          <NButton type="primary" :loading="submitting" @click="submitPolicy">
            {{ $t('common.save') }}
          </NButton>
        </div>
      </template>
    </NCard>

    <NCard :title="$t('page.store_distribution.sharePolicy.summaryTitle')" :bordered="false" size="small">
      <NDescriptions :column="2" bordered label-placement="left" size="small">
        <NDescriptionsItem :label="$t('page.store_distribution.sharePolicy.linkExpireMinutes')">
          {{ model.linkExpireMinutes }}{{ $t('page.store_distribution.sharePolicy.minuteUnit') }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.store_distribution.sharePolicy.maxClickCount')">
          {{ model.maxClickCount }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.store_distribution.sharePolicy.maxBindCount')">
          {{ model.maxBindCount }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.store_distribution.sharePolicy.maxOrderCount')">
          {{ model.maxOrderCount }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('page.store_distribution.sharePolicy.attributionWindowMinutes')">
          {{ model.attributionWindowMinutes }}{{ $t('page.store_distribution.sharePolicy.minuteUnit') }}
        </NDescriptionsItem>
      </NDescriptions>
    </NCard>
  </div>
</template>
