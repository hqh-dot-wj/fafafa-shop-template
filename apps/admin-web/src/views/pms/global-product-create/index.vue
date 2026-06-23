<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { NCard, NStep, NSteps, useMessage } from 'naive-ui';
import { useDebounceFn } from '@vueuse/core';
import type { components } from '@libs/common-types';
import {
  fetchCreateGlobalProduct,
  fetchGetGlobalProduct,
  fetchSaveGlobalProductStep,
  fetchUpdateGlobalProduct,
} from '@/service/api/pms/product';
import { fetchGetAttribute, fetchGetAttributesByCategory } from '@/service/api/pms/attribute';
import { useTabStore } from '@/store/modules/tab';
import { getRoutePath } from '@/router/elegant/transform';
import { createFormModel } from './model';
import Step1Category from './components/Step1Category.vue';
import Step2Info from './components/Step2Info.vue';
import Step3Sku from './components/Step3Sku.vue';
import Step4Attr from './components/Step4Attr.vue';
import { detailHtmlContainsBlobUrl } from './utils/detail-html-blob';
import { mapGlobalSkuForSubmit } from './utils/map-global-sku-for-submit';
import { normalizeMainImagesFromProductDetail } from './utils/normalize-product-main-images';
import { resolveProductSpecDefForForm } from './utils/spec-def-from-product';

type CreateProductBody = components['schemas']['CreateProductDto'];
type TemplateSource = 'CATEGORY' | 'CUSTOM';
type DraftStep = 1 | 2 | 3 | 4;
type StepSavePayload = Partial<CreateProductBody> & { templateSource?: TemplateSource; templateId?: number };
type TemplateSelection = {
  categoryId: number;
  templateSource: TemplateSource;
  templateId?: number;
};

defineOptions({ name: 'GlobalProductCreate' });

const router = useRouter();
const route = useRoute();
const message = useMessage();
const tabStore = useTabStore();

const currentStep = ref(1);
const formModel = createFormModel();
const attributes = ref<Api.Pms.AttributeItem[]>([]);
const loading = ref(false);
const step2InfoRef = ref<InstanceType<typeof Step2Info> | null>(null);
const openedAsEdit = ref(Boolean(route.query.id));
const isHydrating = ref(true);
const isAutoSaving = ref(false);
const pendingByStep = ref<Record<number, boolean>>({
  1: false,
  2: false,
  3: false,
  4: false,
});
const stepPayloadSignatures = ref<Record<number, string>>({
  1: '',
  2: '',
  3: '',
  4: '',
});

const productId = computed(() => (route.query.id as string | undefined) || undefined);
const isEdit = computed(() => openedAsEdit.value);
const hasUnsavedChanges = computed(() => Object.values(pendingByStep.value).some(Boolean));

const currentStatus = computed(() => {
  return 'process' as const; // process, finish, error, wait
});

function normalizeStep(step: number): DraftStep {
  if (step <= 1) return 1;
  if (step >= 4) return 4;
  return step as DraftStep;
}

function buildSubmitData(): CreateProductBody & { templateSource?: TemplateSource; templateId?: number } {
  const albumPics = formModel.albumPics ?? [];
  const weightGrams =
    formModel.type === 'REAL' && formModel.weight !== undefined && formModel.weight !== null
      ? Math.round(Number(formModel.weight))
      : undefined;

  return {
    categoryId: formModel.categoryId as number,
    brandId: formModel.brandId,
    templateSource: formModel.templateSource || 'CATEGORY',
    templateId: formModel.templateSource === 'CUSTOM' ? formModel.templateId : undefined,
    name: formModel.name,
    subTitle: formModel.subTitle,
    mainImages: albumPics,
    detailHtml: formModel.detailHtml ?? '',
    type: formModel.type,
    ...(formModel.type === 'REAL'
      ? { weight: weightGrams ?? 0, isFreeShip: formModel.isFreeShip }
      : {
          serviceDuration: formModel.serviceDuration,
          serviceRadius: formModel.serviceRadius,
        }),
    specDef: formModel.specDef as CreateProductBody['specDef'],
    skus: formModel.skus.map((s) => mapGlobalSkuForSubmit(s)),
    attrs: formModel.attrs,
    publishStatus: formModel.publishStatus as CreateProductBody['publishStatus'],
  };
}

function getStepPayload(step: DraftStep): StepSavePayload {
  const submitData = buildSubmitData();

  if (step === 1) {
    return {
      categoryId: formModel.categoryId ?? undefined,
      templateSource: formModel.templateSource || 'CATEGORY',
      templateId: formModel.templateSource === 'CUSTOM' ? formModel.templateId : undefined,
      type: formModel.type,
    };
  }

  if (step === 2) {
    return {
      categoryId: submitData.categoryId,
      templateSource: submitData.templateSource,
      templateId: submitData.templateId,
      name: submitData.name,
      subTitle: submitData.subTitle,
      brandId: submitData.brandId,
      mainImages: submitData.mainImages,
      detailHtml: submitData.detailHtml,
      type: submitData.type,
      isFreeShip: submitData.isFreeShip,
      weight: submitData.weight,
      serviceDuration: submitData.serviceDuration,
      serviceRadius: submitData.serviceRadius,
    };
  }

  if (step === 3) {
    return {
      categoryId: submitData.categoryId,
      templateSource: submitData.templateSource,
      templateId: submitData.templateId,
      type: submitData.type,
      specDef: submitData.specDef,
      skus: submitData.skus,
    };
  }

  return {
    categoryId: submitData.categoryId,
    templateSource: submitData.templateSource,
    templateId: submitData.templateId,
    type: submitData.type,
    attrs: submitData.attrs,
  };
}

function buildStepSignature(step: DraftStep): string {
  return JSON.stringify(getStepPayload(step));
}

function markStepSaved(step: DraftStep) {
  stepPayloadSignatures.value[step] = buildStepSignature(step);
  pendingByStep.value[step] = false;
}

function markStepPristine(step: DraftStep) {
  stepPayloadSignatures.value[step] = buildStepSignature(step);
  pendingByStep.value[step] = false;
}

function syncCurrentStepDirtyState() {
  const step = normalizeStep(currentStep.value);
  pendingByStep.value[step] = buildStepSignature(step) !== stepPayloadSignatures.value[step];
}

function initStepSignatures() {
  const steps: DraftStep[] = [1, 2, 3, 4];
  for (const step of steps) {
    stepPayloadSignatures.value[step] = buildStepSignature(step);
    pendingByStep.value[step] = false;
  }
}

function canAutoSaveCurrentStep() {
  const step = normalizeStep(currentStep.value);
  if (!pendingByStep.value[step]) return false;
  if (step === 1) {
    if (!formModel.categoryId) return false;
    if (loading.value || isAutoSaving.value) return false;
    return true;
  }
  if (!productId.value) return false;
  if (loading.value || isAutoSaving.value) return false;
  return true;
}

const debouncedAutoSave = useDebounceFn(async () => {
  const step = normalizeStep(currentStep.value);
  if (!canAutoSaveCurrentStep()) {
    return;
  }
  isAutoSaving.value = true;
  try {
    const saved = await saveStepDraft(step, getStepPayload(step), { markSaved: true });
    if (saved) {
      markStepSaved(step);
    }
  } finally {
    isAutoSaving.value = false;
  }
}, 1200);

async function saveStepDraft(
  step: DraftStep,
  payload: StepSavePayload = {},
  options: { markSaved?: boolean } = { markSaved: true },
) {
  const { data, error } = await fetchSaveGlobalProductStep({
    productId: productId.value,
    step,
    ...payload,
  });
  if (error || !data?.productId) {
    return false;
  }
  if (!productId.value) {
    await router.replace({
      path: route.path,
      query: {
        ...route.query,
        id: data.productId,
      },
    });
  }
  if (options.markSaved !== false) {
    markStepSaved(step);
  }
  return true;
}

async function handleCategoryNext(payload: TemplateSelection) {
  formModel.categoryId = payload.categoryId;
  formModel.templateSource = payload.templateSource;
  formModel.templateId = payload.templateId;
  const saved = await saveStepDraft(1, getStepPayload(1), { markSaved: true });
  if (!saved) {
    return;
  }
  await fetchAttributes(payload);
  currentStep.value = 2;
  markStepPristine(2);
}

async function fetchAttributes(selection: TemplateSelection) {
  loading.value = true;
  try {
    if (selection.templateSource === 'CUSTOM' && selection.templateId) {
      const { data, error } = await fetchGetAttribute(selection.templateId);
      if (!error && data?.attributes) {
        attributes.value = data.attributes;
      }
      return;
    }
    const { data, error } = await fetchGetAttributesByCategory(selection.categoryId);
    if (!error && data) {
      attributes.value = data;
    }
  } finally {
    loading.value = false;
  }
}

function nextStep() {
  if (currentStep.value < 4) {
    currentStep.value += 1;
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value -= 1;
  }
}

async function handleStep2Next() {
  const saved = await saveStepDraft(2, getStepPayload(2), { markSaved: true });
  if (!saved) {
    return;
  }
  nextStep();
  markStepPristine(3);
}

async function handleStep3Next() {
  const saved = await saveStepDraft(3, getStepPayload(3), { markSaved: true });
  if (!saved) {
    return;
  }
  nextStep();
  markStepPristine(4);
}

async function handleSubmit() {
  loading.value = true;
  try {
    if (!formModel.categoryId) {
      message.error('请选择分类');
      return;
    }

    await step2InfoRef.value?.syncDetailHtmlFromEditor?.();
    if (detailHtmlContainsBlobUrl(formModel.detailHtml ?? '')) {
      message.error(
        '商品详情中仍有未上传完成的图片（浏览器临时地址）。请等待每张图片上传成功后再提交，或删除未传完的图片。',
      );
      return;
    }

    const submitData = buildSubmitData();
    const stepSaved = await saveStepDraft(4, getStepPayload(4), { markSaved: true });
    if (!stepSaved) {
      return;
    }

    let error;
    if (productId.value) {
      const res = await fetchUpdateGlobalProduct(productId.value, submitData);
      error = res.error;
    } else {
      const res = await fetchCreateGlobalProduct(submitData);
      error = res.error;
    }

    if (!error) {
      message.success(isEdit.value ? '保存商品成功' : '发布商品成功');
      router.push({ path: getRoutePath('pms_global-product') });
    }
  } finally {
    loading.value = false;
  }
}

async function initData() {
  if (!openedAsEdit.value) {
    initStepSignatures();
    isHydrating.value = false;
    return;
  }

  // If editing, set tab title
  tabStore.setTabLabel('编辑标准商品');
  loading.value = true; // Replaced startLoading()
  try {
    const { data } = await fetchGetGlobalProduct(productId.value);
    if (data) {
      // Basic fields
      let rawSpecDef = typeof data.specDef === 'string' ? JSON.parse(data.specDef) : data.specDef;
      if (!Array.isArray(rawSpecDef)) {
        rawSpecDef = [];
      }
      const specDef = resolveProductSpecDefForForm(rawSpecDef, data.globalSkus);
      Object.assign(formModel, {
        ...data,
        templateSource: (data as { templateSource?: TemplateSource }).templateSource || 'CATEGORY',
        templateId: (data as { templateId?: number }).templateId,
        specDef,
        albumPics: normalizeMainImagesFromProductDetail(data),
      });

      // SKUs
      if (data.globalSkus) {
        formModel.skus = data.globalSkus.map((sku) => ({
          ...sku,
          guidePrice: Number(sku.guidePrice),
          costPrice: Number(sku.costPrice ?? 0),
          guideRate: Number(sku.guideRate),
          minDistRate: Number(sku.minDistRate),
          maxDistRate: Number(sku.maxDistRate),
          stock: Number(sku.stock ?? 0),
          specValues:
            typeof sku.specValues === 'string'
              ? (JSON.parse(sku.specValues) as Record<string, string>)
              : sku.specValues,
        }));
      }

      // Attrs
      if (data.attrs) {
        formModel.attrs = data.attrs;
      }

      // Load Category Attributes
      if (formModel.categoryId) {
        await fetchAttributes({
          categoryId: formModel.categoryId,
          templateSource: formModel.templateSource || 'CATEGORY',
          templateId: formModel.templateId || undefined,
        });
        const buildStatus = (data as { buildStatus?: Api.Pms.ProductBuildStatus }).buildStatus;
        const lastEditStep = (data as { lastEditStep?: number }).lastEditStep;
        if (buildStatus === 'DRAFT') {
          currentStep.value = Math.min(Math.max(lastEditStep || 2, 2), 4);
        } else {
          currentStep.value = 2;
        }
      }
      initStepSignatures();
    }
  } catch {
    message.error('获取商品详情失败');
  } finally {
    isHydrating.value = false;
    loading.value = false;
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasUnsavedChanges.value && !isAutoSaving.value) {
    return;
  }
  event.preventDefault();
  event.returnValue = '';
}

watch(
  () => [currentStep.value, formModel],
  () => {
    if (isHydrating.value) {
      return;
    }
    syncCurrentStepDirtyState();
    if (canAutoSaveCurrentStep()) {
      void debouncedAutoSave();
    }
  },
  { deep: true },
);

onBeforeRouteLeave(() => {
  if (!hasUnsavedChanges.value && !isAutoSaving.value) {
    return true;
  }
  return window.confirm('当前步骤存在未保存内容，确认离开吗？');
});

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
  void initData();
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  tabStore.resetTabLabel();
});
</script>

<template>
  <div class="h-full overflow-y-auto bg-gray-50 p-4 dark:bg-gray-900">
    <NCard class="mb-4">
      <NSteps :current="currentStep" :status="currentStatus">
        <NStep title="选择分类" description="选择商品所属分类" />
        <NStep title="基本信息与图文" description="主图(OSS)、详情富文本与属性" />
        <NStep title="规格设置" description="设置SKU和价格" />
        <NStep title="详细参数" description="设置动态属性" />
      </NSteps>
      <div class="mt-2 text-right text-xs text-gray-500 dark:text-gray-400">
        {{ isAutoSaving ? '自动保存中...' : hasUnsavedChanges ? '当前步骤有未保存改动' : '已自动保存' }}
      </div>
    </NCard>

    <div class="mt-4">
      <!--
 KeepAlive could be used if we want to preserve state when switching steps back and forth, 
            but we are passing raw object so state is preserved in formModel. 
            However, component internal state (like collapsed groups) might be lost. 
            For now, simpler with v-if/v-show. 
-->

      <Step1Category v-if="currentStep === 1" :form-model="formModel" @next="handleCategoryNext" />

      <Step2Info
        v-show="currentStep === 2"
        ref="step2InfoRef"
        :form-model="formModel"
        @prev="prevStep"
        @next="handleStep2Next"
      />

      <Step3Sku
        v-if="currentStep === 3"
        :form-model="formModel"
        :attributes="attributes"
        @prev="prevStep"
        @next="handleStep3Next"
      />

      <Step4Attr
        v-if="currentStep === 4"
        :form-model="formModel"
        :attributes="attributes"
        @prev="prevStep"
        @submit="handleSubmit"
      />
    </div>
  </div>
</template>
