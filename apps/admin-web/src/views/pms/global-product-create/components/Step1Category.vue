<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NButton, NCard, NCascader, NRadioButton, NRadioGroup, NSelect, useMessage } from 'naive-ui';
import { fetchGetCategoryTree } from '@/service/api/pms/category';
import { fetchGetAttributeList } from '@/service/api/pms/attribute';

defineOptions({ name: 'Step1Category' });

type TemplateSource = 'CATEGORY' | 'CUSTOM';

interface NextPayload {
  categoryId: number;
  templateSource: TemplateSource;
  templateId?: number;
}

const props = defineProps<{
  formModel: {
    categoryId: number | null;
    templateSource?: TemplateSource;
    templateId?: number | null;
  };
}>();

const emit = defineEmits<{
  (e: 'next', payload: NextPayload): void;
}>();

const message = useMessage();
const value = ref<number | null>(props.formModel.categoryId ?? null);
const templateSource = ref<TemplateSource>(props.formModel.templateSource ?? 'CATEGORY');
const templateId = ref<number | null>(props.formModel.templateId ?? null);
const options = ref<any[]>([]);
const templateOptions = ref<Array<{ label: string; value: number }>>([]);
const loading = ref(false);

async function init() {
  loading.value = true;
  try {
    const [{ data: categoryTree }, { data: templateList }] = await Promise.all([
      fetchGetCategoryTree(),
      fetchGetAttributeList({ pageNum: 1, pageSize: 200 }),
    ]);
    // Recursively map children if needed, or if API returns standard structure
    // Category: { catId, name, children }
    // NCascader expects: { value, label, children }
    options.value = mapToCascader(categoryTree || []);
    templateOptions.value = (templateList?.rows || []).map((item) => ({
      label: item.name,
      value: item.templateId,
    }));
  } finally {
    loading.value = false;
  }
}

function mapToCascader(list: any[]): any[] {
  return list.map((item) => ({
    label: item.name,
    value: item.catId, // Assuming catId is the ID
    children: item.children && item.children.length ? mapToCascader(item.children) : undefined,
  }));
}

function handleNext() {
  if (value.value) {
    if (templateSource.value === 'CUSTOM' && !templateId.value) {
      message.warning('选择自定义模板时，请先选择模板');
      return;
    }
    emit('next', {
      categoryId: value.value,
      templateSource: templateSource.value,
      templateId: templateSource.value === 'CUSTOM' ? templateId.value || undefined : undefined,
    });
  }
}

onMounted(init);
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center p-10">
    <h2 class="mb-4 text-xl font-bold">请选择商品分类</h2>
    <div class="max-w-xl w-full">
      <NCascader
        v-model:value="value"
        :options="options"
        placeholder="请选择分类 (支持搜索)"
        filterable
        check-strategy="child"
        class="mb-8"
        size="large"
      />
      <NCard title="属性模板来源" size="small" class="mb-6">
        <NRadioGroup v-model:value="templateSource">
          <NRadioButton value="CATEGORY">使用分类绑定模板（推荐）</NRadioButton>
          <NRadioButton value="CUSTOM">使用自定义模板</NRadioButton>
        </NRadioGroup>
        <NSelect
          v-if="templateSource === 'CUSTOM'"
          v-model:value="templateId"
          :options="templateOptions"
          class="mt-3"
          filterable
          clearable
          placeholder="请选择自定义属性模板"
        />
      </NCard>
      <NButton type="primary" block size="large" :disabled="!value" @click="handleNext">下一步，填写信息</NButton>
    </div>
  </div>
</template>
