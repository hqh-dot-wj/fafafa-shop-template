<script setup lang="tsx">
import { computed } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import { NDataTable, NModal, NTag } from 'naive-ui';

defineOptions({
  name: 'BatchOperationResultModal',
});

export interface BatchOperationDetailRow {
  id: string;
  success: boolean;
  error?: string;
}

interface Props {
  show: boolean;
  title: string;
  successLabel?: string;
  idColumnTitle?: string;
  result: {
    successCount: number;
    failCount: number;
    details: BatchOperationDetailRow[];
  } | null;
}

const props = withDefaults(defineProps<Props>(), {
  successLabel: '成功',
  idColumnTitle: '标识',
});

const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>();

const showModel = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
});

const failedRows = computed(() => props.result?.details.filter((d) => !d.success) ?? []);

const columns = computed<DataTableColumns<BatchOperationDetailRow>>(() => [
  {
    key: 'id',
    title: props.idColumnTitle,
    align: 'center',
    width: 220,
  },
  {
    key: 'success',
    title: '结果',
    align: 'center',
    width: 88,
    render: (row) => (
      <NTag type={row.success ? 'success' : 'error'} size="small">
        {row.success ? props.successLabel : '失败'}
      </NTag>
    ),
  },
  {
    key: 'error',
    title: '原因',
    align: 'left',
    ellipsis: { tooltip: true },
    render: (row) => row.error ?? '—',
  },
]);
</script>

<template>
  <NModal
    v-model:show="showModel"
    preset="card"
    :title="title"
    class="w-640px max-w-90vw"
    :mask-closable="true"
  >
    <div v-if="result" class="flex flex-col gap-12px">
      <div class="text-14px text-gray-600">
        成功 <span class="text-success font-medium">{{ result.successCount }}</span> 条，失败
        <span class="text-error font-medium">{{ result.failCount }}</span> 条
      </div>
      <NDataTable
        v-if="failedRows.length > 0"
        :columns="columns"
        :data="failedRows"
        size="small"
        :bordered="false"
        :single-line="false"
        max-height="280"
      />
      <div v-else class="py-16px text-center text-14px text-gray-500">无失败项</div>
    </div>
  </NModal>
</template>

<style scoped>
.text-success {
  color: #18a058;
}
.text-error {
  color: #d03050;
}
</style>
