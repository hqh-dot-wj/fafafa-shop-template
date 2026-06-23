<script setup lang="ts">
import type { SelectOption } from 'naive-ui';
import { NForm, NFormItemGi, NGrid, NInputNumber, NSelect, NSwitch } from 'naive-ui';
import { $t } from '@/locales';

interface Props {
  model: Api.Store.SharePolicy;
  bindingModeOptions: SelectOption[];
  attributionModeOptions: SelectOption[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:model', value: Api.Store.SharePolicy): void;
}>();

function updateModel(patch: Partial<Api.Store.SharePolicy>) {
  emit('update:model', {
    ...props.model,
    ...patch,
  });
}

function updateNumberField(
  key: keyof Pick<
    Api.Store.SharePolicy,
    'linkExpireMinutes' | 'maxClickCount' | 'maxBindCount' | 'maxOrderCount' | 'attributionWindowMinutes'
  >,
  value: number | null,
) {
  updateModel({ [key]: value ?? props.model[key] });
}

type SelectValue = string | number | Array<string | number> | null;

function updateBindingMode(value: SelectValue) {
  if (typeof value !== 'string') return;
  updateModel({ bindingMode: value as Api.Store.ShareBindingMode });
}

function updateAttributionMode(value: SelectValue) {
  if (typeof value !== 'string') return;
  updateModel({ attributionMode: value as Api.Store.ShareAttributionMode });
}
</script>

<template>
  <NForm :model="model" label-placement="left" :label-width="220">
    <NGrid :cols="24" :x-gap="16">
      <NFormItemGi :span="24" :label="$t('page.store_distribution.sharePolicy.status')">
        <NSwitch :value="model.isActive" @update:value="(value) => updateModel({ isActive: value })" />
      </NFormItemGi>

      <NFormItemGi span="24 s:12" :label="$t('page.store_distribution.sharePolicy.linkExpireMinutes')">
        <NInputNumber
          :value="model.linkExpireMinutes"
          :min="1"
          :step="30"
          class="w-full"
          @update:value="(value) => updateNumberField('linkExpireMinutes', value)"
        >
          <template #suffix>{{ $t('page.store_distribution.sharePolicy.minuteUnit') }}</template>
        </NInputNumber>
      </NFormItemGi>

      <NFormItemGi span="24 s:12" :label="$t('page.store_distribution.sharePolicy.maxClickCount')">
        <NInputNumber
          :value="model.maxClickCount"
          :min="1"
          :step="10"
          class="w-full"
          @update:value="(value) => updateNumberField('maxClickCount', value)"
        />
      </NFormItemGi>
      <NFormItemGi span="24 s:12" :label="$t('page.store_distribution.sharePolicy.maxBindCount')">
        <NInputNumber
          :value="model.maxBindCount"
          :min="1"
          :step="10"
          class="w-full"
          @update:value="(value) => updateNumberField('maxBindCount', value)"
        />
      </NFormItemGi>
      <NFormItemGi span="24 s:12" :label="$t('page.store_distribution.sharePolicy.maxOrderCount')">
        <NInputNumber
          :value="model.maxOrderCount"
          :min="1"
          :step="10"
          class="w-full"
          @update:value="(value) => updateNumberField('maxOrderCount', value)"
        />
      </NFormItemGi>

      <NFormItemGi span="24 s:12" :label="$t('page.store_distribution.sharePolicy.bindingMode')">
        <NSelect
          :value="model.bindingMode"
          :options="bindingModeOptions"
          :placeholder="$t('page.store_distribution.sharePolicy.bindingModePlaceholder')"
          @update:value="updateBindingMode"
        />
      </NFormItemGi>
      <NFormItemGi span="24 s:12" :label="$t('page.store_distribution.sharePolicy.attributionMode')">
        <NSelect
          :value="model.attributionMode"
          :options="attributionModeOptions"
          :placeholder="$t('page.store_distribution.sharePolicy.attributionModePlaceholder')"
          @update:value="updateAttributionMode"
        />
      </NFormItemGi>
      <NFormItemGi span="24 s:12" :label="$t('page.store_distribution.sharePolicy.attributionWindowMinutes')">
        <NInputNumber
          :value="model.attributionWindowMinutes"
          :min="1"
          :step="60"
          class="w-full"
          @update:value="(value) => updateNumberField('attributionWindowMinutes', value)"
        >
          <template #suffix>{{ $t('page.store_distribution.sharePolicy.minuteUnit') }}</template>
        </NInputNumber>
      </NFormItemGi>

      <NFormItemGi :span="24" :label="$t('page.store_distribution.sharePolicy.enableCrossTenantBind')">
        <NSwitch
          :value="model.enableCrossTenantBind"
          @update:value="(value) => updateModel({ enableCrossTenantBind: value })"
        />
      </NFormItemGi>
    </NGrid>
  </NForm>
</template>
