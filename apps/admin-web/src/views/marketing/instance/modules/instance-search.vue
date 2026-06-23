<script setup lang="ts">
import { computed, ref } from 'vue';
import { NButton, NCard, NCollapse, NCollapseItem, NForm, NFormItemGi, NGrid, NInput, NSelect, NSpace } from 'naive-ui';
import { usePickerField } from '@/hooks/business/use-picker-field';
import { useNaiveForm } from '@/hooks/common/form';
import MemberSelectModal from '@/components/business/member-select-modal.vue';
import type { MemberPickerSelection } from '@/components/business/entity-picker.shared';
import { $t } from '@/locales';
import { instanceStatusOptions } from './instance-labels';

defineOptions({ name: 'PlayInstanceSearch' });

interface Emits {
  (e: 'search'): void;
  (e: 'reset'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Marketing.PlayInstanceSearchParams>('model', { required: true });

const memberPickerVisible = ref(false);
const {
  displayValue: memberDisplayValue,
  applySelection: applyMemberSelection,
  clearSelection: clearMemberSelection,
} = usePickerField({
  model: model.value,
  key: 'memberId',
  emptyValue: '',
});

const selectedMember = computed(() =>
  memberDisplayValue.value ? { memberId: model.value.memberId ?? '', displayName: memberDisplayValue.value } : null,
);

type RuleKey = Extract<keyof Api.Marketing.PlayInstanceSearchParams, 'memberId' | 'status'>;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  memberId: [],
  status: [],
}));

function openMemberPicker() {
  memberPickerVisible.value = true;
}

function handleMemberSelect(member: MemberPickerSelection) {
  applyMemberSelection({
    value: member.memberId,
    label: member.displayName || member.nickname || member.mobile || member.memberId,
  });
}

function handleMemberClear() {
  clearMemberSelection();
}

async function reset() {
  await restoreValidation();
  clearMemberSelection();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}
</script>

<template>
  <!-- 实例搜索区：按会员和实例状态筛选活动参与记录。 -->
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['instance-search']">
      <NCollapseItem :title="$t('common.search')" name="instance-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="104">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="会员名称" path="memberId" class="pr-24px">
              <NInput
                v-model:value="memberDisplayValue"
                clearable
                readonly
                placeholder="点击选择会员"
                @click="openMemberPicker"
                @clear="handleMemberClear"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="状态" path="status" class="pr-24px">
              <NSelect
                v-model:value="model.status"
                :options="instanceStatusOptions"
                clearable
                placeholder="请选择状态"
              />
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

  <!-- 会员选择弹窗：回填 memberId 作为实例查询条件。 -->
  <MemberSelectModal v-model:visible="memberPickerVisible" :selected="selectedMember" @select="handleMemberSelect" />
</template>

<style scoped></style>
