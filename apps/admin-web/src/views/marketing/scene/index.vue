<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { SelectOption } from 'naive-ui';
import {
  fetchCreateSceneFromTemplate,
  fetchSaveScene,
  fetchSceneList,
  fetchSceneTemplateList,
} from '@/service/api/marketing/scene';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import SceneEditModal from './modules/scene-edit-modal.vue';
import SceneMetricsPanel from './modules/scene-metrics-panel.vue';
import ScenePrecheckReportModal from './modules/scene-precheck-report-modal.vue';
import SceneSearch from './modules/scene-search.vue';
import { createSceneTableColumns } from './modules/scene-table-columns';
import SceneTableCard from './modules/scene-table-card.vue';
import { useScenePrecheck } from './modules/use-scene-precheck';
import SceneWorkflowGuide from './modules/scene-workflow-guide.vue';

defineOptions({ name: 'MarketingScene' });

// 场景配置页对应 SceneAdminController / ScenePlacementController。
// 场景草稿、模板创建、发布预检共同决定 C 端 ClientSceneController 的出数快照。
type SceneStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';

const appStore = useAppStore();
const router = useRouter();

function goMarketingPolicy() {
  router.push({ name: 'marketing_policy' });
}

function goMarketingSceneModule() {
  router.push({ name: 'marketing_scene-module' });
}

function goMarketingConfig() {
  router.push({ name: 'marketing_config' });
}

function goRuntimeLedger() {
  router.push({ name: 'marketing_client-runtime-ledger' });
}

const modalVisible = ref(false);
const submitting = ref(false);
const editingCode = ref<string | null>(null);
const routeValid = ref(true);
const metricsPanelRef = ref<{ refresh: () => Promise<void> } | null>(null);
const templateRows = ref<Api.Marketing.MarketingSceneTemplate[]>([]);
const templateLoading = ref(false);
const useTemplateCreate = ref(true);
const selectedTemplateCode = ref<string | null>(null);

const templateOptions = computed<SelectOption[]>(() =>
  templateRows.value.map((template) => ({
    label: template.templateName,
    value: template.templateCode,
  })),
);

const selectedTemplate = computed(() =>
  templateRows.value.find((template) => template.templateCode === selectedTemplateCode.value),
);

const {
  precheckingSceneCode,
  publishingSceneCode,
  precheckResultVisible,
  latestPrecheckResult,
  handlePrecheck,
  handlePublish: publishScene,
} = useScenePrecheck();

const sceneForm = reactive<Api.Marketing.SaveSceneParams & { id?: string }>({
  sceneCode: '',
  sceneName: '',
  sceneType: 'HOMEPAGE',
  channelScope: ['miniapp'],
  pageRoute: '',
  defaultCardTemplateCode: '',
  defaultResolverPolicyCode: '',
  status: 'ACTIVE' as SceneStatus,
});

onMounted(() => {
  loadSceneTemplates();
});

const { data, loading, getData, getDataByPage, columns, searchParams, resetSearchParams, mobilePagination, scrollX } =
  useTable({
    apiFn: fetchSceneList,
    apiParams: {
      pageNum: 1,
      pageSize: 10,
      sceneCode: null,
      status: null,
    },
    columns: () =>
      createSceneTableColumns({
        precheckingSceneCode,
        publishingSceneCode,
        onEdit: openEdit,
        onPrecheck: handlePrecheck,
        onPublish: handlePublish,
      }),
  });

function openCreate() {
  editingCode.value = null;
  routeValid.value = true;
  useTemplateCreate.value = true;
  Object.assign(sceneForm, {
    sceneCode: '',
    sceneName: '',
    sceneType: 'HOMEPAGE',
    channelScope: ['miniapp'],
    pageRoute: '',
    defaultCardTemplateCode: '',
    defaultResolverPolicyCode: '',
    status: 'ACTIVE',
  });
  loadSceneTemplates();
  modalVisible.value = true;
}

function openEdit(row: Api.Marketing.MarketingScene) {
  editingCode.value = row.sceneCode;
  routeValid.value = true;
  Object.assign(sceneForm, {
    sceneCode: row.sceneCode,
    sceneName: row.sceneName,
    sceneType: row.sceneType,
    channelScope: row.channelScope ?? [],
    pageRoute: row.pageRoute ?? '',
    defaultCardTemplateCode: row.defaultCardTemplateCode ?? '',
    defaultResolverPolicyCode: row.defaultResolverPolicyCode ?? '',
    status: (row.status as SceneStatus) ?? 'ACTIVE',
    id: row.id,
  });
  modalVisible.value = true;
}

async function loadSceneTemplates() {
  if (templateLoading.value) return;
  templateLoading.value = true;
  try {
    const response = await fetchSceneTemplateList({ pageNum: 1, pageSize: 50, isActive: 'true' });
    templateRows.value = response.data?.rows ?? [];
    if (!selectedTemplateCode.value && templateRows.value[0]) {
      selectedTemplateCode.value = templateRows.value[0].templateCode;
      applyTemplateToForm(templateRows.value[0]);
    }
  } finally {
    templateLoading.value = false;
  }
}

function handleTemplateModeChange(value: boolean) {
  useTemplateCreate.value = value;
  if (value && selectedTemplate.value) {
    applyTemplateToForm(selectedTemplate.value);
  }
}

function handleTemplateCodeChange(value: string | null) {
  selectedTemplateCode.value = value;
  const template = selectedTemplate.value;
  if (template) {
    applyTemplateToForm(template);
  }
}

function applyTemplateToForm(template: Api.Marketing.MarketingSceneTemplate) {
  if (editingCode.value) return;
  // 模板只给新场景提供默认结构，编辑已有场景时不能用模板覆盖线上配置。
  Object.assign(sceneForm, {
    sceneType: template.sceneType,
    channelScope: [...template.channelScope],
    pageRoute: template.pageRoute ?? '',
    defaultCardTemplateCode: template.defaultCardTemplateCode ?? '',
    defaultResolverPolicyCode: template.defaultResolverPolicyCode ?? '',
    placementConfig: template.placementConfig ?? null,
    status: 'DRAFT',
  });
}

function handleSceneFormUpdate(value: Api.Marketing.SaveSceneParams & { id?: string }) {
  Object.assign(sceneForm, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => valuesEqual(item, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length && leftKeys.every((key) => valuesEqual(left[key], right[key]));
  }
  return false;
}

function buildTemplateOverrides() {
  const template = selectedTemplate.value;
  if (!template) return undefined;

  // 只提交相对模板发生变化的字段，保留模板本身作为场景默认约束。
  const overrides: Record<string, unknown> = {};
  if (sceneForm.sceneType !== template.sceneType) overrides.sceneType = sceneForm.sceneType;
  if (!valuesEqual(sceneForm.channelScope ?? [], template.channelScope ?? [])) {
    overrides.channelScope = sceneForm.channelScope;
  }
  if ((sceneForm.pageRoute ?? '') !== (template.pageRoute ?? '')) overrides.pageRoute = sceneForm.pageRoute;
  if ((sceneForm.defaultCardTemplateCode ?? '') !== (template.defaultCardTemplateCode ?? '')) {
    overrides.defaultCardTemplateCode = sceneForm.defaultCardTemplateCode;
  }
  if ((sceneForm.defaultResolverPolicyCode ?? '') !== (template.defaultResolverPolicyCode ?? '')) {
    overrides.defaultResolverPolicyCode = sceneForm.defaultResolverPolicyCode;
  }
  if (!valuesEqual(sceneForm.placementConfig ?? null, template.placementConfig ?? null)) {
    overrides.placementConfig = sceneForm.placementConfig;
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

async function handleSave() {
  if (!sceneForm.sceneCode || !sceneForm.sceneName || !sceneForm.sceneType) {
    window.$message?.warning('请填写场景编码、名称和类型');
    return;
  }
  if (!editingCode.value && useTemplateCreate.value && !selectedTemplateCode.value) {
    window.$message?.warning('请选择场景模板');
    return;
  }
  if (!routeValid.value) {
    window.$message?.warning('页面路由参数不完整，请先修正');
    return;
  }
  submitting.value = true;
  try {
    // 新建场景默认走模板创建；手工保存只用于编辑或显式关闭模板模式的场景。
    if (!editingCode.value && useTemplateCreate.value && selectedTemplateCode.value) {
      await fetchCreateSceneFromTemplate({
        templateCode: selectedTemplateCode.value,
        sceneCode: sceneForm.sceneCode,
        sceneName: sceneForm.sceneName,
        status: sceneForm.status,
        overrides: buildTemplateOverrides(),
      });
    } else {
      await fetchSaveScene(sceneForm);
    }
    window.$message?.success(editingCode.value ? '场景已更新' : '场景已创建');
    modalVisible.value = false;
    getData();
  } finally {
    submitting.value = false;
  }
}

async function handlePublish(sceneCode: string) {
  await publishScene(sceneCode, {
    onPublished: () => {
      getData();
      metricsPanelRef.value?.refresh?.();
    },
  });
}
</script>

<template>
  <div class="h-full min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 场景工作流区：聚合策略、模块、配置、监控和搜索入口。 -->
    <div class="flex flex-col shrink-0 gap-16px">
      <SceneWorkflowGuide
        @to-policy="goMarketingPolicy"
        @to-scene-module="goMarketingSceneModule"
        @to-config="goMarketingConfig"
        @to-runtime-ledger="goRuntimeLedger"
      />

      <SceneSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />

      <SceneMetricsPanel ref="metricsPanelRef" />
    </div>

    <!-- 场景表格区：展示场景列表并提供创建、预检和发布入口。 -->
    <SceneTableCard
      :columns="columns"
      :data="data"
      :loading="loading"
      :pagination="mobilePagination"
      :flex-height="!appStore.isMobile"
      :scroll-x="scrollX"
      @create="openCreate"
    />

    <!-- 场景编辑弹窗：维护场景基础信息、模板覆盖和页面路由。 -->
    <SceneEditModal
      v-model:show="modalVisible"
      :editing-code="editingCode"
      :submitting="submitting"
      :form="sceneForm"
      :route-valid="routeValid"
      :template-options="templateOptions"
      :template-loading="templateLoading"
      :use-template-create="useTemplateCreate"
      :selected-template-code="selectedTemplateCode"
      @update:form="handleSceneFormUpdate"
      @update:route-valid="routeValid = $event"
      @update:use-template-create="handleTemplateModeChange"
      @update:selected-template-code="handleTemplateCodeChange"
      @save="handleSave"
    />

    <!-- 发布预检弹窗：展示预检问题并控制是否允许发布。 -->
    <ScenePrecheckReportModal
      v-model:show="precheckResultVisible"
      :result="latestPrecheckResult"
      :prechecking-scene-code="precheckingSceneCode"
      :publishing-scene-code="publishingSceneCode"
      @recheck="handlePrecheck"
      @publish="handlePublish"
    />
  </div>
</template>

<style scoped></style>
