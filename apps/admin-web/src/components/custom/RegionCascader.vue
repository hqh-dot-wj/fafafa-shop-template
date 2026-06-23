<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { CascaderOption } from 'naive-ui';
import { NCascader } from 'naive-ui';
import { fetchRegionList } from '@/service/api/lbs/region';

interface Props {
  value?: string | number | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'update:value', value: string | number | null): void;
  (e: 'update:label', value: string[]): void;
}

const emit = defineEmits<Emits>();

const modelValue = ref(props.value);
const options = ref<CascaderOption[]>([]);

async function loadProvinces() {
  try {
    const { data } = await fetchRegionList();
    if (data) {
      options.value = data.map((item: any) => ({
        label: item.name,
        value: item.code,
        depth: 1,
        isLeaf: false,
      }));
    }
  } catch {
    window.$message?.warning('地区数据加载失败');
  }
}

async function handleLoad(option: CascaderOption) {
  try {
    const parentId = option.value as string;
    const depth = (option.depth as number) + 1;
    const { data } = await fetchRegionList(parentId);

    if (data && data.length > 0) {
      option.children = data.map((item: any) => ({
        label: item.name,
        value: item.code,
        depth,
        isLeaf: depth >= 3,
      }));
    } else {
      option.isLeaf = true;
    }
  } catch {
    window.$message?.warning('子级地区加载失败');
    option.isLeaf = true;
  }
}

function handleUpdateValue(value: string | number | null, _option: CascaderOption, pathValues: Array<CascaderOption>) {
  emit('update:value', value);

  if (pathValues) {
    const labels = pathValues.map((opt) => opt.label as string);
    emit('update:label', labels);
  }
}

onMounted(() => {
  loadProvinces();
});
</script>

<template>
  <NCascader
    v-model:value="modelValue"
    :options="options"
    :remote="true"
    :on-load="handleLoad"
    check-strategy="all"
    placeholder="请选择行政区域"
    @update:value="handleUpdateValue"
  />
</template>
