<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchApproveWorkerApplication, fetchRejectWorkerApplication } from '@/service/api/store/worker';

defineOptions({
  name: 'ApplicationReviewModal',
});

const props = defineProps<{
  mode: 'approve' | 'reject';
  row: Api.Store.WorkerApplication | null;
}>();

const emit = defineEmits<{
  submitted: [];
}>();

const visible = defineModel<boolean>('visible', { required: true });

const reviewRemark = ref('');
const loading = ref(false);

const title = computed(() => (props.mode === 'approve' ? '审核通过' : '拒绝申请'));

watch(
  () => visible.value,
  (value) => {
    if (value) {
      reviewRemark.value = props.mode === 'approve' ? '审核通过' : '';
    }
  },
);

async function submit() {
  if (!props.row) return;
  if (props.mode === 'reject' && !reviewRemark.value.trim()) {
    window.$message?.warning('请输入拒绝原因');
    return;
  }

  loading.value = true;
  try {
    if (props.mode === 'approve') {
      await fetchApproveWorkerApplication(props.row.applicationId, { reviewRemark: reviewRemark.value || undefined });
      window.$message?.success('审核通过，已创建正式工作者');
    } else {
      await fetchRejectWorkerApplication(props.row.applicationId, { reviewRemark: reviewRemark.value });
      window.$message?.success('已拒绝申请');
    }
    visible.value = false;
    emit('submitted');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <NModal v-model:show="visible" preset="card" :title="title" class="max-w-[92vw] w-520px">
    <!-- 审核操作只更新申请记录；通过时由后端在同一事务内生成正式 worker。 -->
    <NSpace vertical :size="12">
      <NAlert :type="mode === 'approve' ? 'success' : 'error'" :show-icon="false">
        {{ mode === 'approve' ? '确认通过该入驻申请并创建正式工作者资料。' : '拒绝后不会创建正式工作者资料。' }}
      </NAlert>
      <NInput
        v-model:value="reviewRemark"
        type="textarea"
        :placeholder="mode === 'approve' ? '请输入审核备注' : '请输入拒绝原因'"
      />
    </NSpace>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="visible = false">取消</NButton>
        <NButton :type="mode === 'approve' ? 'primary' : 'error'" :loading="loading" @click="submit"> 确认 </NButton>
      </NSpace>
    </template>
  </NModal>
</template>
