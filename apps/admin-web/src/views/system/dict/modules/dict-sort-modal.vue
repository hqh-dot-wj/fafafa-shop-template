<script setup lang="ts">
import { ref, watch } from 'vue';
import { fetchSortDictData } from '@/service/api/system';

defineOptions({
  name: 'DictSortModal',
});

interface Props {
  dictType: string | null;
  rows: Api.System.DictData[];
}

interface SortRow {
  dictCode: number;
  dictLabel: string;
  dictValue: string;
  dictSort: number;
}

interface Emits {
  (e: 'submitted'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });
const loading = ref(false);
const sortRows = ref<SortRow[]>([]);

function syncRows() {
  sortRows.value = props.rows
    .map((item) => ({
      dictCode: Number(item.dictCode),
      dictLabel: item.dictLabel || '',
      dictValue: item.dictValue || '',
      dictSort: Number(item.dictSort || 0),
    }))
    .sort((a, b) => a.dictSort - b.dictSort);
}

function resetByCurrentOrder() {
  sortRows.value = sortRows.value.map((item, index) => ({
    ...item,
    dictSort: index + 1,
  }));
}

async function handleSubmit() {
  if (!props.dictType) {
    window.$message?.warning('请先选择字典类型');
    return;
  }
  loading.value = true;
  try {
    await fetchSortDictData({
      dictType: props.dictType,
      sortList: sortRows.value.map((item) => ({
        dictCode: item.dictCode,
        dictSort: item.dictSort,
      })),
    });
    window.$message?.success('排序更新成功');
    visible.value = false;
    emit('submitted');
  } catch {
    // 错误消息已在请求工具中显示
  } finally {
    loading.value = false;
  }
}

watch(
  () => visible.value,
  (show) => {
    if (show) {
      syncRows();
    }
  },
);

watch(
  () => props.rows,
  () => {
    if (visible.value) {
      syncRows();
    }
  },
  { deep: true },
);
</script>

<template>
  <NModal v-model:show="visible" preset="card" title="字典排序" class="w-760px">
    <div class="mb-8px flex justify-between">
      <NText depth="3">可直接修改每行排序值，提交后按新的数值保存。</NText>
      <NButton size="small" @click="resetByCurrentOrder">按当前顺序重排</NButton>
    </div>
    <NScrollbar style="max-height: 420px">
      <div v-for="item in sortRows" :key="item.dictCode" class="mb-8px flex items-center gap-8px">
        <div class="min-w-260px flex-1 truncate">{{ item.dictLabel }}（{{ item.dictValue }}）</div>
        <NInputNumber v-model:value="item.dictSort" :min="0" :precision="0" class="w-120px" />
      </div>
    </NScrollbar>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="visible = false">取消</NButton>
        <NButton type="primary" :loading="loading" @click="handleSubmit">保存排序</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped></style>
