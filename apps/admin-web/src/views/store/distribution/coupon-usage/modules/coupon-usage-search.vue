<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NCard, NCollapse, NCollapseItem, NDatePicker, NForm, NFormItemGi, NGi, NGrid, NInput, NSpace } from 'naive-ui';
import CouponTemplateSelectModal from '@/components/business/coupon-template-select-modal.vue';
import MemberSelectModal from '@/components/business/member-select-modal.vue';
import type { CouponTemplatePickerSelection, MemberPickerSelection } from '@/components/business/entity-picker.shared';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({ name: 'CouponUsageSearch' });

interface Emits {
  (e: 'search'): void;
  (e: 'reset'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Marketing.CouponUsageRecordListSearchParams>('model', { required: true });
const memberPickerVisible = ref(false);
const templatePickerVisible = ref(false);
const memberDisplayValue = ref('');
const templateDisplayValue = ref('');

type RuleKey = Extract<keyof Api.Marketing.CouponUsageRecordListSearchParams, 'memberId' | 'templateId' | 'startTime' | 'endTime'>;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  memberId: [],
  templateId: [],
  startTime: [],
  endTime: [],
}));

watch(
  () => model.value.memberId,
  value => {
    if (!value) {
      memberDisplayValue.value = '';
      return;
    }
    if (!memberDisplayValue.value) {
      memberDisplayValue.value = String(value);
    }
  },
  { immediate: true },
);

watch(
  () => model.value.templateId,
  value => {
    if (!value) {
      templateDisplayValue.value = '';
      return;
    }
    if (!templateDisplayValue.value) {
      templateDisplayValue.value = String(value);
    }
  },
  { immediate: true },
);

function parseToMs(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

const rangeMs = computed({
  get(): [number, number] | null {
    const a = parseToMs(model.value.startTime ?? undefined);
    const b = parseToMs(model.value.endTime ?? undefined);
    if (a !== null && b !== null) return [a, b];
    return null;
  },
  set(v: [number, number] | null) {
    if (v && v.length === 2) {
      model.value.startTime = new Date(v[0]).toISOString();
      model.value.endTime = new Date(v[1]).toISOString();
    } else {
      model.value.startTime = null;
      model.value.endTime = null;
    }
  },
});

async function reset() {
  await restoreValidation();
  memberDisplayValue.value = '';
  templateDisplayValue.value = '';
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}

function openMemberPicker() {
  memberPickerVisible.value = true;
}

function openTemplatePicker() {
  templatePickerVisible.value = true;
}

function handleMemberSelect(selection: MemberPickerSelection) {
  model.value.memberId = selection.memberId;
  memberDisplayValue.value = selection.displayName || selection.nickname || selection.mobile || selection.memberId;
}

function handleTemplateSelect(selection: CouponTemplatePickerSelection) {
  model.value.templateId = selection.templateId;
  templateDisplayValue.value = selection.displayName || selection.name || selection.templateId;
}

function clearMemberSelection() {
  model.value.memberId = null;
  memberDisplayValue.value = '';
}

function clearTemplateSelection() {
  model.value.templateId = null;
  templateDisplayValue.value = '';
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['coupon-usage-search']">
      <NCollapseItem :title="$t('common.search')" name="coupon-usage-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="80">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.store_distribution.couponUsageSearch.memberId')" path="memberId" class="pr-24px">
              <NInput
                v-model:value="memberDisplayValue"
                :placeholder="$t('page.store_distribution.couponUsageSearch.memberIdPlaceholder')"
                clearable
                readonly
                @click="openMemberPicker"
                @clear="clearMemberSelection"
                @keyup.enter="search"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.store_distribution.couponUsageSearch.templateId')" path="templateId" class="pr-24px">
              <NInput
                v-model:value="templateDisplayValue"
                :placeholder="$t('page.store_distribution.couponUsageSearch.templateIdPlaceholder')"
                clearable
                readonly
                @click="openTemplatePicker"
                @clear="clearTemplateSelection"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:24 m:12" :label="$t('page.store_distribution.couponUsageSearch.usedTime')" path="startTime" class="pr-24px">
              <NDatePicker
                v-model:value="rangeMs"
                type="datetimerange"
                clearable
                class="w-full"
                :start-placeholder="$t('page.store_distribution.couponUsageSearch.startTime')"
                :end-placeholder="$t('page.store_distribution.couponUsageSearch.endTime')"
              />
            </NFormItemGi>
            <NGi span="24 s:24 m:6" offset="0 m:18" class="flex items-end justify-end pr-24px">
              <NSpace :wrap="false">
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
            </NGi>
          </NGrid>
        </NForm>
      </NCollapseItem>
    </NCollapse>
  </NCard>

  <MemberSelectModal
    v-model:visible="memberPickerVisible"
    :selected="
      model.memberId
        ? {
            memberId: String(model.memberId),
            displayName: memberDisplayValue || String(model.memberId),
          }
        : null
    "
    @select="handleMemberSelect"
  />

  <CouponTemplateSelectModal
    v-model:visible="templatePickerVisible"
    :selected="
      model.templateId
        ? {
            templateId: String(model.templateId),
            displayName: templateDisplayValue || String(model.templateId),
          }
        : null
    "
    @select="handleTemplateSelect"
  />
</template>

<style scoped></style>
