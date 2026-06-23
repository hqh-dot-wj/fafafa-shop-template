<script setup lang="ts">
/* eslint-disable vue/no-mutating-props -- 发布向导父级 formModel 由本步写回 attrs */
import { computed, onMounted, ref, watch } from 'vue';
import type { SelectOption } from 'naive-ui';
import { NButton, NCard, NForm, NFormItem, NInput, NSelect } from 'naive-ui';
import { $t } from '@/locales';
import type { ProductForm } from '../model';

defineOptions({ name: 'Step4Attr' });

const props = defineProps<{
  formModel: ProductForm;
  attributes: Api.Pms.AttributeItem[];
}>();

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'submit'): void;
}>();

const paramAttributes = computed(() => {
  return props.attributes.filter((attr) => attr.usageType === 'PARAM');
});

const attrValues = ref<Record<number, string>>({});

onMounted(() => {
  props.formModel.attrs.forEach((item) => {
    attrValues.value[item.attrId] = item.value;
  });
});

watch(
  attrValues,
  (newVal) => {
    props.formModel.attrs = Object.entries(newVal).map(([attrIdString, value]) => ({
      attrId: Number(attrIdString),
      value,
    }));
  },
  { deep: true },
);

function getOptions(attr: Api.Pms.AttributeItem): SelectOption[] {
  if (!attr.inputList) return [];
  return attr.inputList.split(',').filter(Boolean).map((s: string) => ({ label: s, value: s }));
}
</script>

<template>
  <div class="mx-auto max-w-3xl p-6">
    <NCard :title="$t('page.pms.globalProductCreate.step4.cardTitle')" bordered>
      <NForm label-placement="left" label-width="120">
        <template v-for="attr in paramAttributes" :key="attr.attrId">
          <NFormItem :label="attr.name">
            <NSelect
              v-if="attr.inputType === 1"
              v-model:value="attrValues[attr.attrId as number]"
              :options="getOptions(attr)"
              :placeholder="$t('page.pms.globalProductCreate.step4.selectPlaceholder')"
              filterable
              tag
            />
            <NInput
              v-else
              v-model:value="attrValues[attr.attrId as number]"
              :placeholder="$t('page.pms.globalProductCreate.step4.inputPlaceholder')"
            />
          </NFormItem>
        </template>

        <div v-if="paramAttributes.length === 0" class="py-10 text-center text-gray-400">
          {{ $t('page.pms.globalProductCreate.step4.emptyParams') }}
        </div>

        <div class="mt-6 flex justify-between">
          <NButton @click="emit('prev')">{{ $t('page.pms.globalProductCreate.step4.prev') }}</NButton>
          <NButton type="primary" @click="emit('submit')">{{ $t('page.pms.globalProductCreate.step4.submit') }}</NButton>
        </div>
      </NForm>
    </NCard>
  </div>
</template>
