<script setup lang="ts">
import { ref } from 'vue';
import { fetchImportDict } from '@/service/api/system';

defineOptions({
  name: 'DictImportModal',
});

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });
const loading = ref(false);

const jsonText = ref(`[
  {
    "dictName": "订单状态",
    "dictType": "store_order_status",
    "remark": "订单状态字典",
    "dataList": [
      { "dictLabel": "待支付", "dictValue": "PENDING_PAY", "dictSort": 1 },
      { "dictLabel": "已支付", "dictValue": "PAID", "dictSort": 2 }
    ]
  }
]`);

function closeModal() {
  visible.value = false;
}

async function handleSubmit() {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText.value);
  } catch {
    window.$message?.error('JSON 格式不正确，请检查后重试');
    return;
  }

  if (!Array.isArray(parsed)) {
    window.$message?.error('导入数据必须是数组');
    return;
  }

  loading.value = true;
  try {
    const { data } = await fetchImportDict(parsed as Api.System.ImportDictParams[]);
    window.$message?.success(
      `导入完成：类型新增 ${data.successTypeCount}，数据新增 ${data.successDataCount}，跳过 ${data.skippedDataCount}`,
    );
    closeModal();
    emit('submitted');
  } catch {
    // 错误消息已在请求工具中显示
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <NModal v-model:show="visible" preset="card" title="导入字典" class="w-900px">
    <NAlert type="info" class="mb-12px">
      支持批量导入字典类型与字典数据，数据格式请保持 JSON 数组结构。
    </NAlert>
    <NInput v-model:value="jsonText" type="textarea" :autosize="{ minRows: 16, maxRows: 24 }" />
    <template #footer>
      <NSpace justify="end">
        <NButton @click="closeModal">取消</NButton>
        <NButton type="primary" :loading="loading" @click="handleSubmit">开始导入</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped></style>
