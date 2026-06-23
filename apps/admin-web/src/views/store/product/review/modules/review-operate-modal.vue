<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { NButton, NForm, NFormItem, NInput, NModal, NSpace, useMessage } from 'naive-ui';
import { fetchApproveStoreProductAudit, fetchRejectStoreProductAudit } from '@/service/api/store/product';
import { useNaiveForm } from '@/hooks/common/form';
import { createOperationId } from '@/utils/operation-id';

interface Props {
  show: boolean;
  rowData: Api.Store.TenantProduct | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'submitted'): void;
}>();

const message = useMessage();
const loading = ref(false);
const { formRef, validate, restoreValidation } = useNaiveForm();
const rejectReasonDrafts = ref<Record<string, string>>({});
const formModel = reactive({
  rejectReason: ''
});

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value)
});

const reasonRules: App.Global.FormRule[] = [
  {
    required: true,
    validator: (_rule, value: string) => {
      if (!value || !value.trim()) {
        return new Error('请填写驳回原因');
      }

      if (value.trim().length > 500) {
        return new Error('驳回原因最多 500 个字符');
      }

      return true;
    },
    trigger: ['input', 'blur']
  }
];

function getCurrentDraftKey() {
  return props.rowData?.id ?? '';
}

function loadCurrentDraft() {
  const key = getCurrentDraftKey();
  formModel.rejectReason = key ? rejectReasonDrafts.value[key] || '' : '';
}

function clearCurrentDraft() {
  const key = getCurrentDraftKey();
  if (key) {
    delete rejectReasonDrafts.value[key];
  }
  formModel.rejectReason = '';
}

watch(
  () => [visible.value, props.rowData?.id] as const,
  ([show]) => {
    if (show) {
      loadCurrentDraft();
      restoreValidation();
    }
  },
  { immediate: true }
);

watch(
  () => formModel.rejectReason,
  value => {
    const key = getCurrentDraftKey();
    if (!key) return;
    rejectReasonDrafts.value[key] = value;
  }
);

async function handleApprove() {
  if (!props.rowData) return;
  loading.value = true;
  try {
    await fetchApproveStoreProductAudit(props.rowData.id, { operationId: createOperationId() });
    clearCurrentDraft();
    message.success('审核通过：商品已进入可上架状态');
    visible.value = false;
    emit('submitted');
  } finally {
    loading.value = false;
  }
}

async function handleReject() {
  if (!props.rowData) return;
  try {
    await validate();
  } catch {
    return;
  }

  const reason = formModel.rejectReason.trim();
  loading.value = true;
  try {
    await fetchRejectStoreProductAudit(props.rowData.id, {
      reason,
      operationId: createOperationId()
    });
    clearCurrentDraft();
    message.success('审核驳回已提交');
    visible.value = false;
    emit('submitted');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <NModal v-model:show="visible" preset="dialog" title="商品审核" style="width: 560px">
    <div class="flex flex-col gap-12px py-12px">
      <div class="text-15px font-bold">{{ rowData?.customTitle || rowData?.name }}</div>
      <div class="rounded border border-gray-200 bg-gray-50 px-12px py-10px text-13px">
        <div class="mb-6px">
          <span class="text-gray-500">提审时间：</span>
          <span>{{ rowData?.submittedAt || '-' }}</span>
        </div>
        <div>
          <span class="text-gray-500">历史驳回原因：</span>
          <span class="text-gray-700">{{ rowData?.auditReason || '无' }}</span>
        </div>
      </div>
      <NForm ref="formRef" :model="formModel" label-placement="left">
        <NFormItem label="驳回原因" path="rejectReason" :rule="reasonRules">
          <NInput
            v-model:value="formModel.rejectReason"
            type="textarea"
            placeholder="填写驳回原因（驳回时必填）"
            :maxlength="500"
            show-count
            :autosize="{ minRows: 3, maxRows: 6 }"
          />
        </NFormItem>
      </NForm>
    </div>
    <template #action>
      <NSpace>
        <NButton :disabled="loading" @click="visible = false">取消</NButton>
        <NButton type="error" :loading="loading" @click="handleReject">驳回</NButton>
        <NButton type="primary" :loading="loading" @click="handleApprove">通过</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
