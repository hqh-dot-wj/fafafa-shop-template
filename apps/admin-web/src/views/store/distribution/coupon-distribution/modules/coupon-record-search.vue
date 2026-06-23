<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NCard, NCollapse, NCollapseItem, NForm, NFormItemGi, NGrid, NInput, NSelect, NSpace } from 'naive-ui';
import MemberSelectModal from '@/components/business/member-select-modal.vue';
import type { MemberPickerSelection } from '@/components/business/entity-picker.shared';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({ name: 'CouponRecordSearch' });

interface Emits {
  (e: 'search'): void;
  (e: 'reset'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Marketing.UserCouponListSearchParams>('model', { required: true });
const memberPickerVisible = ref(false);
const memberDisplayValue = ref('');

type RuleKey = Extract<keyof Api.Marketing.UserCouponListSearchParams, 'memberId' | 'status'>;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  memberId: [],
  status: [],
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

const statusOptions = [
  { label: '未使用', value: 'UNUSED' },
  { label: '已使用', value: 'USED' },
  { label: '已过期', value: 'EXPIRED' },
  { label: '已锁定', value: 'LOCKED' },
];

async function reset() {
  await restoreValidation();
  clearMemberSelection();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}

function openMemberPicker() {
  memberPickerVisible.value = true;
}

function handleMemberSelect(selection: MemberPickerSelection) {
  model.value.memberId = selection.memberId;
  memberDisplayValue.value = selection.displayName || selection.nickname || selection.mobile || selection.memberId;
}

function clearMemberSelection() {
  model.value.memberId = null;
  memberDisplayValue.value = '';
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper mb-0">
    <NCollapse :default-expanded-names="['coupon-record-search']">
      <NCollapseItem :title="$t('common.search')" name="coupon-record-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="104">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="会员" path="memberId" class="pr-24px">
              <NInput
                v-model:value="memberDisplayValue"
                placeholder="可选，点击选择会员"
                clearable
                readonly
                @click="openMemberPicker"
                @clear="clearMemberSelection"
                @keyup.enter="search"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="状态" path="status" class="pr-24px">
              <NSelect v-model:value="model.status" :options="statusOptions" clearable placeholder="全部" />
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
</template>

<style scoped></style>
