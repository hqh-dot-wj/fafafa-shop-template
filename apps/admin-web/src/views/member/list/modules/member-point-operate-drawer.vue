<script setup lang="ts">
import { reactive, watch } from 'vue';
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSpace,
  useMessage,
} from 'naive-ui';
import { fetchAdjustMemberPoints } from '@/service/api/member/member';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'MemberPointOperateDrawer',
});

interface Props {
  /** Member ID */
  memberId: string;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false,
});

const { formRef, validate, restoreValidation } = useNaiveForm();
const { defaultRequiredRule } = useFormRules();
const message = useMessage();

const model = reactive({
  type: 'ADD' as 'ADD' | 'SUB',
  amount: 0,
  remark: '',
});

const rules = {
  amount: defaultRequiredRule,
  remark: defaultRequiredRule,
};

watch(visible, (val) => {
  if (val) {
    model.type = 'ADD';
    model.amount = 0;
    model.remark = '';
    restoreValidation();
  }
});

async function handleSubmit() {
  await validate();

  const adjustAmount = model.type === 'ADD' ? model.amount : -model.amount;

  try {
    await fetchAdjustMemberPoints({
      memberId: props.memberId,
      amount: adjustAmount,
      remark: model.remark,
    });

    message.success($t('page.member.pointAdjust.msgSuccess'));
    visible.value = false;
    emit('submitted');
  } catch {
    // error handled by request
  }
}
</script>

<template>
  <NDrawer v-model:show="visible" :width="400" :title="$t('page.member.pointAdjust.drawerTitle')">
    <NDrawerContent>
      <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="100">
        <NFormItem :label="$t('page.member.pointAdjust.typeLabel')" path="type">
          <NRadioGroup v-model:value="model.type">
            <NRadioButton value="ADD">{{ $t('page.member.pointAdjust.typeAdd') }}</NRadioButton>
            <NRadioButton value="SUB">{{ $t('page.member.pointAdjust.typeSub') }}</NRadioButton>
          </NRadioGroup>
        </NFormItem>

        <NFormItem :label="$t('page.member.pointAdjust.amountLabel')" path="amount">
          <NInputNumber v-model:value="model.amount" :min="1" :precision="0" class="w-full" />
        </NFormItem>

        <NFormItem :label="$t('page.member.pointAdjust.remarkLabel')" path="remark">
          <NInput v-model:value="model.remark" type="textarea" :placeholder="$t('page.member.pointAdjust.remarkPlaceholder')" />
        </NFormItem>
      </NForm>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="visible = false">{{ $t('page.member.pointAdjust.btnCancel') }}</NButton>
          <NButton type="primary" @click="handleSubmit">{{ $t('page.member.pointAdjust.btnSubmit') }}</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
