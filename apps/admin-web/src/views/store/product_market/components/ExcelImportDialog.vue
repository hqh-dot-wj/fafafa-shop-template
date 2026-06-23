<script setup lang="ts">
import { computed, ref } from 'vue';
import { NAlert, NButton, NModal, useMessage } from 'naive-ui';
import { fetchGetStoreProductImportJob, fetchImportStoreProductExcel } from '@/service/api/store/product';

interface Props {
  show: boolean;
  categoryId: number | null;
  templateVersionId?: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'success', payload: Api.Store.ImportExcelJobResult): void;
}>();

const message = useMessage();
const loading = ref(false);
const file = ref<File | null>(null);

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
});

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const selected = target.files?.[0] ?? null;
  file.value = selected;
}

function fileToBase64(selectedFile: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(selectedFile);
  });
}

async function handleSubmit() {
  if (!props.categoryId) {
    message.warning('请先选择分类后再上传 Excel');
    return;
  }
  if (!file.value) {
    message.warning('请先选择 Excel 文件');
    return;
  }

  loading.value = true;
  try {
    const fileBase64 = await fileToBase64(file.value);
    const { data } = await fetchImportStoreProductExcel({
      categoryId: props.categoryId,
      templateVersionId: props.templateVersionId || undefined,
      fileBase64,
    });
    if (!data) {
      return;
    }
    const receipt = await fetchGetStoreProductImportJob(data.jobId);
    if (!receipt.data) {
      return;
    }
    emit('success', receipt.data);
    message.success(`导入完成：成功 ${receipt.data.successCount} 行，失败 ${receipt.data.failCount} 行`);
    visible.value = false;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <NModal v-model:show="visible" preset="dialog" title="批量导入 Excel" style="width: 520px">
    <div class="flex flex-col gap-12px py-12px">
      <NAlert type="info" :bordered="false">
        请先在选品中心选择分类与模板版本（可选），再上传按模板填写的 Excel 文件（仅支持 `.xlsx`）。
      </NAlert>
      <input accept=".xlsx" type="file" @change="handleFileChange" />
      <div class="text-13px text-gray-500">
        {{ file ? `已选择：${file.name}` : '未选择文件' }}
      </div>
    </div>
    <template #action>
      <NButton @click="visible = false">取消</NButton>
      <NButton type="primary" :loading="loading" @click="handleSubmit">开始导入</NButton>
    </template>
  </NModal>
</template>
