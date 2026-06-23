<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { SelectOption } from 'naive-ui';
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSpace,
  useMessage,
} from 'naive-ui';
import MemberSelectModal from '@/components/business/member-select-modal.vue';
import TenantSelectModal from '@/components/business/tenant-select-modal.vue';
import type { MemberPickerSelection, TenantPickerSelection } from '@/components/business/entity-picker.shared';
import { usePickerField } from '@/hooks/business/use-picker-field';
import { fetchUpdateMemberLevel, fetchUpdateMemberReferrer, fetchUpdateMemberTenant } from '@/service/api/member/member';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'MemberOperateDrawer',
});

interface Props {
  /** the type of operation */
  operateType: 'editReferrer' | 'editTenant' | 'editLevel';
  /** the edit row data */
  rowData?: Api.Member.Member | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false,
});

const message = useMessage();
const { formRef, validate, restoreValidation } = useNaiveForm();
const referrerPickerVisible = ref(false);
const tenantPickerVisible = ref(false);

const title = computed(() => {
  if (props.operateType === 'editReferrer') return $t('page.member.editReferrer');
  if (props.operateType === 'editLevel') return $t('page.member.editLevel');
  return $t('page.member.editTenant');
});

const levelOptions = computed<SelectOption[]>(() => [
  { label: $t('page.member.levelOptionMember'), value: 0 },
  { label: $t('page.member.levelOptionCaptain'), value: 1 },
  { label: $t('page.member.levelOptionShareholder'), value: 2 },
]);

type Model = {
  referrerId: string;
  tenantId: string;
  levelId: number;
};

const model = reactive<Model>(createDefaultModel());
const {
  displayValue: referrerDisplayValue,
  applySelection: applyReferrerSelection,
  setDisplayValue: setReferrerDisplayValue,
  clearSelection: clearReferrerSelection,
} = usePickerField({
  model,
  key: 'referrerId',
  emptyValue: '',
});

const {
  displayValue: tenantDisplayValue,
  applySelection: applyTenantSelection,
  setDisplayValue: setTenantDisplayValue,
  clearSelection: clearTenantSelection,
} = usePickerField({
  model,
  key: 'tenantId',
  emptyValue: '',
});

const selectedReferrer = computed(() =>
  referrerDisplayValue.value ? { memberId: model.referrerId, displayName: referrerDisplayValue.value } : null,
);

const selectedTenant = computed(() =>
  tenantDisplayValue.value ? { tenantId: model.tenantId, displayName: tenantDisplayValue.value } : null,
);

function createDefaultModel(): Model {
  return {
    referrerId: '',
    tenantId: '',
    levelId: 0,
  };
}

const rules = computed<Record<string, App.Global.FormRule[]>>(() => {
  return {};
});

function handleInitModel() {
  if (props.rowData) {
    model.referrerId = props.rowData.referrerId || '';
    model.tenantId = props.rowData.tenantId || '';
    model.levelId = props.rowData.levelId ?? 0;
    setReferrerDisplayValue(props.rowData.referrerName || props.rowData.referrerMobile || props.rowData.referrerId || '');
    setTenantDisplayValue(props.rowData.tenantName || props.rowData.tenantId || '');
    return;
  }

  model.referrerId = '';
  model.tenantId = '';
  model.levelId = 0;
  clearReferrerSelection();
  clearTenantSelection();
}

watch(visible, (val) => {
  if (val) {
    handleInitModel();
    restoreValidation();
  }
});

async function handleSubmit() {
  await validate();

  if (props.operateType === 'editReferrer') {
    if (props.rowData?.memberId) {
      await fetchUpdateMemberReferrer({ memberId: props.rowData.memberId, referrerId: model.referrerId });
      message.success($t('page.member.confirm.updateSuccess'));
      closeDrawer();
      emit('submitted');
    }
  } else if (props.operateType === 'editTenant') {
    if (props.rowData?.memberId) {
      await fetchUpdateMemberTenant({ memberId: props.rowData.memberId, tenantId: model.tenantId });
      message.success($t('page.member.confirm.updateSuccess'));
      closeDrawer();
      emit('submitted');
    }
  } else if (props.operateType === 'editLevel') {
    if (props.rowData?.memberId) {
      await fetchUpdateMemberLevel({ memberId: props.rowData.memberId, levelId: Number(model.levelId) });
      message.success($t('page.member.confirm.updateSuccess'));
      closeDrawer();
      emit('submitted');
    }
  }
}

function closeDrawer() {
  visible.value = false;
}

function openReferrerPicker() {
  referrerPickerVisible.value = true;
}

function openTenantPicker() {
  tenantPickerVisible.value = true;
}

function handleReferrerSelect(selection: MemberPickerSelection) {
  applyReferrerSelection({
    value: selection.memberId,
    label: selection.displayName || selection.nickname || selection.mobile || selection.memberId,
  });
}

function handleTenantSelect(selection: TenantPickerSelection) {
  applyTenantSelection({
    value: selection.tenantId,
    label: selection.displayName || selection.companyName || selection.tenantId,
  });
}

function handleReferrerClear() {
  clearReferrerSelection();
}

function handleTenantClear() {
  clearTenantSelection();
}
</script>

<template>
  <NDrawer v-model:show="visible" display-directive="show" :width="360">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NForm ref="formRef" :model="model" :rules="rules">
        <NFormItem v-if="operateType === 'editReferrer'" :label="$t('page.member.form.referrerId')" path="referrerId">
          <NInput
            v-model:value="referrerDisplayValue"
            clearable
            readonly
            placeholder="点击选择推荐人"
            @click="openReferrerPicker"
            @clear="handleReferrerClear"
          />
        </NFormItem>
        <NFormItem v-if="operateType === 'editTenant'" :label="$t('page.member.form.tenantId')" path="tenantId">
          <NInput
            v-model:value="tenantDisplayValue"
            clearable
            readonly
            placeholder="点击选择租户"
            @click="openTenantPicker"
            @clear="handleTenantClear"
          />
        </NFormItem>
        <NFormItem v-if="operateType === 'editLevel'" :label="$t('page.member.form.levelId')" path="levelId">
          <NSelect v-model:value="model.levelId" :options="levelOptions" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end" :size="16">
          <NButton @click="closeDrawer">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" @click="handleSubmit">{{ $t('common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>

  <MemberSelectModal v-model:visible="referrerPickerVisible" :selected="selectedReferrer" @select="handleReferrerSelect" />

  <TenantSelectModal v-model:visible="tenantPickerVisible" :selected="selectedTenant" @select="handleTenantSelect" />
</template>
