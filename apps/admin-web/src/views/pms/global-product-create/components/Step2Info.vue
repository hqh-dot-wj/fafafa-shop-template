<script setup lang="ts">
/* 与分步向导其它步骤一致：formModel 为父级 reactive，步骤内就地编辑 */
/* eslint-disable vue/no-mutating-props */
import { nextTick, onMounted, ref } from 'vue';
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSwitch,
  useMessage,
} from 'naive-ui';
import { fetchGetBrandList } from '@/service/api/pms/brand';
import UmoDocEditor from '@/components/custom/umo-doc-editor.vue';
import type { ProductForm } from '../model';
import { detailHtmlContainsBlobUrl } from '../utils/detail-html-blob';
import ProductMainImagesUpload from './ProductMainImagesUpload.vue';

defineOptions({ name: 'Step2Info' });

const props = defineProps<{
  formModel: ProductForm;
}>();

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
}>();

const message = useMessage();
const brandOptions = ref<{ label: string; value: number }[]>([]);
const umoEditorRef = ref<InstanceType<typeof UmoDocEditor>>();

async function initBrands() {
  const { data } = await fetchGetBrandList({ pageNum: 1, pageSize: 100 });
  if (data && typeof data === 'object' && 'rows' in data && Array.isArray((data as { rows: unknown }).rows)) {
    const rows = (data as { rows: Array<{ name: string; brandId: number }> }).rows;
    brandOptions.value = rows.map((b) => ({ label: b.name, value: b.brandId }));
  }
}

function flushRichText() {
  umoEditorRef.value?.saveContent();
}

/**
 * 将 Umo 导出为「可持久化」HTML：优先 getVanillaHTML，避免 blob: 临时地址写入接口
 */
async function syncDetailHtmlFromEditor(): Promise<void> {
  umoEditorRef.value?.saveContent();
  await nextTick();
  try {
    const html = await umoEditorRef.value?.getVanillaHTML?.();
    if (typeof html === 'string') {
      props.formModel.detailHtml = html;
    }
  } catch {
    /* 保持 v-model 已同步内容 */
  }
}

async function handleNext() {
  await syncDetailHtmlFromEditor();
  if (detailHtmlContainsBlobUrl(props.formModel.detailHtml ?? '')) {
    message.error('详情里仍有未上传完成的图片，请等待每张图片上传成功（或稍候）后再进入下一步');
    return;
  }
  emit('next');
}

onMounted(() => {
  initBrands().catch(() => {
    /* 错误由请求封装统一提示 */
  });
});

defineExpose({
  flushRichText,
  syncDetailHtmlFromEditor,
});
</script>

<template>
  <!-- max-w-3xl 过窄会导致 Umo 工具栏出现横向滚动；与通知抽屉类似需要较宽编辑区 -->
  <div class="step2-page mx-auto w-full p-4 md:p-6">
    <NForm :model="formModel" label-placement="top" require-mark-placement="right-hanging" class="step2-form">
      <NCard bordered>
        <template #header>基本信息与图文</template>

        <NFormItem label="商品名称" path="name" rule-path="name">
          <NInput v-model:value="formModel.name" placeholder="请输入商品名称" />
        </NFormItem>

        <NFormItem label="副标题" path="subTitle">
          <NInput v-model:value="formModel.subTitle" placeholder="请输入副标题" />
        </NFormItem>

        <NFormItem label="商品品牌" path="brandId">
          <NSelect v-model:value="formModel.brandId" :options="brandOptions" placeholder="请选择品牌" clearable />
        </NFormItem>

        <NFormItem label="商品主图" path="albumPics">
          <ProductMainImagesUpload v-model:model-value="formModel.albumPics!" />
        </NFormItem>

        <NFormItem label="商品介绍" path="description">
          <NInput v-model:value="formModel.description" type="textarea" placeholder="列表/卡片用的短文案（可选）" />
        </NFormItem>

        <NFormItem label="商品详情" path="detailHtml" class="detail-form-item">
          <div class="detail-editor-shell border border-gray-200 rounded dark:border-gray-700">
            <UmoDocEditor ref="umoEditorRef" v-model:value="formModel.detailHtml!" />
          </div>
        </NFormItem>

        <NFormItem label="商品类型" path="type">
          <NRadioGroup v-model:value="formModel.type">
            <NRadioButton value="REAL">实物商品 (物流发货)</NRadioButton>
            <NRadioButton value="SERVICE">服务/虚拟商品 (无需物流)</NRadioButton>
          </NRadioGroup>
        </NFormItem>

        <template v-if="formModel.type === 'REAL'">
          <NFormItem label="重量(克)" path="weight">
            <NInputNumber
              v-model:value="formModel.weight"
              :min="0"
              :precision="0"
              placeholder="与运费计算一致，请填克"
            />
          </NFormItem>
          <NFormItem label="包邮" path="isFreeShip">
            <NSwitch v-model:value="formModel.isFreeShip" />
          </NFormItem>
        </template>

        <template v-if="formModel.type === 'SERVICE'">
          <NFormItem label="服务时长(分)" path="serviceDuration">
            <NInputNumber v-model:value="formModel.serviceDuration" :min="0" />
          </NFormItem>
          <NFormItem label="服务半径(km)" path="serviceRadius">
            <NInputNumber v-model:value="formModel.serviceRadius" :min="0" />
          </NFormItem>
        </template>

        <div class="mt-6 flex justify-between">
          <NButton @click="emit('prev')">上一步</NButton>
          <NButton type="primary" :disabled="!formModel.name" @click="handleNext">下一步，设置规格</NButton>
        </div>
      </NCard>
    </NForm>
  </div>
</template>

<style scoped>
.step2-page {
  max-width: min(100%, 88rem);
}

.step2-form :deep(.n-form-item) {
  max-width: 100%;
}

/* 顶部标签时限制窄字段可读宽度，富文本项单独拉满 */
.step2-form :deep(.n-form-item:not(.detail-form-item)) {
  max-width: 42rem;
}

.detail-form-item {
  max-width: 100% !important;
}

.detail-editor-shell {
  width: 100%;
  min-width: 0;
  min-height: min(70vh, 640px);
}

.detail-editor-shell :deep(.umo-editor) {
  min-height: min(65vh, 600px);
  width: 100%;
  min-width: 0;
}

.detail-editor-shell :deep(.umo-editor > *) {
  min-width: 0;
}
</style>
