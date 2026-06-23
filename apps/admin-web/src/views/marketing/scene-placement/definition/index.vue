<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NDrawer, NDrawerContent, NForm, NFormItem, NInput, NSelect, NSpace } from 'naive-ui';
import {
  type SaveSceneDefinitionPayload,
  type SceneDefinition,
  fetchCreateSceneDefinition,
  fetchSceneDefinitionList,
  fetchUpdateSceneDefinition,
} from '@/service/api/marketing';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import { $t } from '@/locales';
import MiniappRouteTargetEditor from '@/components/business/miniapp-route-target-editor.vue';
import SceneDefinitionMetricsPanel from './modules/scene-definition-metrics-panel.vue';
import SceneDefinitionSearch from './modules/scene-definition-search.vue';
import {
  cardTemplateSelectOptions,
  sceneDefinitionChannelOptions,
  sceneDefinitionSortModeOptions,
  sceneDefinitionStatusOptions,
  sceneDefinitionStoreMatchModeOptions,
  sceneTypeSelectOptions,
} from './modules/scene-definition-labels';
import { createSceneDefinitionTableColumns } from './modules/scene-definition-table-columns';
import SceneDefinitionTableCard from './modules/scene-definition-table-card.vue';

defineOptions({ name: 'MarketingScenePlacementDefinitionPage' });

// 场景定义页对应 ScenePlacementController，是后台管理旧投放定义的入口。
// 路由、渠道、活动类型过滤和裁决策略共同影响 C 端场景出数，前端只做配置整形。
interface SceneDefinitionFormModel {
  sceneCode: string;
  sceneName: string;
  sceneType: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  pageRoute: string;
  channelScope: string[];
  activityTypeFilter: string;
  storeMatchMode: string;
  sortMode: string;
  /** 对应 mkt_scene.default_resolver_policy_code（mkt_policy.policy_code） */
  resolverPolicyCode: string;
  cardTemplate: string;
}

const appStore = useAppStore();
const router = useRouter();

function goScenePreview() {
  router.push({ name: 'marketing_scene-placement_preview' }).catch(() => {});
}

const searchModel = reactive({
  sceneName: '',
  sceneCode: '',
  sceneType: null as string | null,
  status: null as string | null,
  activityType: null as string | null,
});

const sceneTypeOptions = sceneTypeSelectOptions;
const cardTemplateOptions = cardTemplateSelectOptions;

function readString(source: unknown, key: string) {
  if (!source || typeof source !== 'object') return null;
  const value = (source as Record<string, unknown>)[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// 优先读取列表展开字段，否则读取 placementConfig JSON。
function readPlacementString(row: SceneDefinition, key: string): string | null {
  // 后端列表可能已经展开 placementConfig 字段；兼容读取可减少旧数据迁移期间的页面空值。
  const flat = readString(row, key);
  if (flat) return flat;
  const cfg = row.placementConfig;
  if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
    const value = (cfg as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

const drawerVisible = ref(false);
const saving = ref(false);
const editingSceneId = ref<string | null>(null);
const editingPlacementConfig = ref<Record<string, unknown>>({});
const routeValid = ref(true);

const formModel = reactive<SceneDefinitionFormModel>({
  sceneCode: '',
  sceneName: '',
  sceneType: 'HOMEPAGE',
  status: 'ACTIVE',
  pageRoute: '',
  channelScope: ['miniapp'],
  activityTypeFilter: 'COURSE_GROUP',
  storeMatchMode: 'CURRENT_STORE',
  sortMode: 'RECOMMEND_WEIGHT',
  resolverPolicyCode: '',
  cardTemplate: '',
});

const drawerTitle = computed(() =>
  editingSceneId.value ? `${$t('common.edit')}场景定义` : `${$t('common.add')}场景定义`,
);

const { data, loading, columns, mobilePagination, scrollX, updateSearchParams, searchParams, getData, getDataByPage } =
  useTable({
    apiFn: fetchSceneDefinitionList,
    apiParams: {
      pageNum: 1,
      pageSize: 20,
      sceneCode: undefined,
      status: undefined,
    },
    columns: () => createSceneDefinitionTableColumns({ onEdit: openEdit }),
  });

// 前端名称、类型和活动过滤只筛当前页数据；编码与状态查询走后端分页参数。
const filteredData = computed(() => {
  const nameKeyword = searchModel.sceneName.trim().toLowerCase();
  const activityKeyword = searchModel.activityType?.trim().toLowerCase();

  return data.value.filter((row) => {
    if (nameKeyword && !row.sceneName.toLowerCase().includes(nameKeyword)) return false;
    if (searchModel.sceneType && row.sceneType !== searchModel.sceneType) return false;
    if (activityKeyword) {
      const filter = readPlacementString(row, 'activityTypeFilter') ?? 'course_group';
      if (!filter.toLowerCase().includes(activityKeyword)) return false;
    }
    return true;
  });
});

// 指标卡按当前筛选结果统计定义状态，真实投放生效仍以后端发布和裁决链路为准。
const metrics = computed(() => {
  const list = filteredData.value;
  return {
    total: list.length,
    active: list.filter((row) => row.status === 'ACTIVE').length,
    draft: list.filter((row) => row.status === 'DRAFT').length,
    inactive: list.filter((row) => row.status === 'INACTIVE').length,
  };
});

// 搜索时把场景编码和状态同步给后端，其他配置字段在当前页结果内过滤。
async function handleSearch() {
  updateSearchParams({
    pageNum: 1,
    pageSize: searchParams.pageSize as number,
    sceneCode: searchModel.sceneCode || undefined,
    status: searchModel.status || undefined,
  });
  await getDataByPage(1);
}

// 重置时同时清空本地筛选模型和后端编码/状态参数，再回到第一页。
function resetSearch() {
  searchModel.sceneName = '';
  searchModel.sceneCode = '';
  searchModel.sceneType = null;
  searchModel.status = null;
  searchModel.activityType = null;
  updateSearchParams({
    pageNum: 1,
    pageSize: searchParams.pageSize as number,
    sceneCode: undefined,
    status: undefined,
  });
  getDataByPage(1).catch(() => {});
}

// 新建场景定义时恢复默认投放配置，避免复用上一次编辑的 placementConfig。
function openCreate() {
  editingSceneId.value = null;
  editingPlacementConfig.value = {};
  Object.assign(formModel, {
    sceneCode: '',
    sceneName: '',
    sceneType: 'HOMEPAGE',
    status: 'ACTIVE',
    pageRoute: '',
    channelScope: ['miniapp'],
    activityTypeFilter: 'COURSE_GROUP',
    storeMatchMode: 'CURRENT_STORE',
    sortMode: 'RECOMMEND_WEIGHT',
    resolverPolicyCode: '',
    cardTemplate: '',
  });
  drawerVisible.value = true;
}

// 编辑场景定义时兼容读取展开字段和 placementConfig，保存时再统一映射回后端 payload。
function openEdit(row: SceneDefinition) {
  editingSceneId.value = row.id;
  editingPlacementConfig.value =
    row.placementConfig && typeof row.placementConfig === 'object' && !Array.isArray(row.placementConfig)
      ? { ...row.placementConfig }
      : {};

  Object.assign(formModel, {
    sceneCode: row.sceneCode,
    sceneName: row.sceneName,
    sceneType: row.sceneType,
    status: (row.status as SceneDefinitionFormModel['status']) || 'ACTIVE',
    pageRoute: row.pageRoute || '',
    channelScope: row.channelScope?.length ? row.channelScope : ['miniapp'],
    activityTypeFilter: readPlacementString(row, 'activityTypeFilter') ?? 'COURSE_GROUP',
    storeMatchMode: readPlacementString(row, 'storeMatchMode') ?? 'CURRENT_STORE',
    sortMode: readPlacementString(row, 'sortMode') ?? 'RECOMMEND_WEIGHT',
    resolverPolicyCode: row.defaultResolverPolicyCode?.trim() ?? '',
    cardTemplate: row.defaultCardTemplateCode || '',
  });

  drawerVisible.value = true;
}

function buildPayload(): SaveSceneDefinitionPayload {
  // placementConfig 保留未知字段，只覆盖当前页面负责的活动过滤、门店匹配和排序策略。
  const placement: Record<string, unknown> = { ...editingPlacementConfig.value };
  const activityTypeFilter = formModel.activityTypeFilter.trim();
  const storeMatchMode = formModel.storeMatchMode.trim();
  const sortMode = formModel.sortMode.trim();

  if (activityTypeFilter) {
    placement.activityTypeFilter = activityTypeFilter;
  } else {
    delete placement.activityTypeFilter;
  }

  if (storeMatchMode) {
    placement.storeMatchMode = storeMatchMode;
  } else {
    delete placement.storeMatchMode;
  }

  if (sortMode) {
    placement.sortMode = sortMode;
  } else {
    delete placement.sortMode;
  }

  return {
    sceneCode: formModel.sceneCode.trim(),
    sceneName: formModel.sceneName.trim(),
    sceneType: formModel.sceneType,
    channelScope: formModel.channelScope,
    pageRoute: formModel.pageRoute || undefined,
    defaultCardTemplateCode: formModel.cardTemplate || undefined,
    defaultResolverPolicyCode: formModel.resolverPolicyCode.trim() || undefined,
    placementConfig: Object.keys(placement).length > 0 ? placement : undefined,
    status: formModel.status,
  };
}

async function saveSceneDefinition() {
  if (!formModel.sceneCode.trim() || !formModel.sceneName.trim()) {
    window.$message?.warning('请填写场景编码和场景名称');
    return;
  }
  if (!routeValid.value) {
    window.$message?.warning('页面路由参数不完整，请先修正');
    return;
  }

  saving.value = true;
  try {
    // sceneCode 创建后不可编辑，避免已有导航和 C 端缓存引用失效。
    const payload = buildPayload();
    if (editingSceneId.value) {
      await fetchUpdateSceneDefinition(editingSceneId.value, payload);
      window.$message?.success('场景定义已更新');
    } else {
      await fetchCreateSceneDefinition(payload);
      window.$message?.success('场景定义已创建');
    }
    drawerVisible.value = false;
    await getData();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <!-- 场景定义页主体：编排定义搜索、状态指标、定义列表和配置抽屉。 -->
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 搜索区：按场景名称、编码、类型、状态和活动类型筛选定义。 -->
    <SceneDefinitionSearch
      :model="searchModel"
      :scene-type-options="sceneTypeOptions"
      :status-options="sceneDefinitionStatusOptions"
      @search="handleSearch"
      @reset="resetSearch"
    />

    <!-- 指标区：展示当前筛选结果中的启用、草稿和停用数量。 -->
    <SceneDefinitionMetricsPanel
      :total="metrics.total"
      :active="metrics.active"
      :draft="metrics.draft"
      :inactive="metrics.inactive"
    />

    <!-- 场景定义表格区：维护场景配置并提供预览入口。 -->
    <SceneDefinitionTableCard
      :columns="columns"
      :data="filteredData"
      :loading="loading"
      :pagination="mobilePagination"
      :flex-height="!appStore.isMobile"
      :scroll-x="scrollX"
      @create="openCreate"
      @refresh="getData"
      @preview="goScenePreview"
    />

    <!-- 场景定义抽屉：编辑路由、裁决策略、卡片模板和投放范围。 -->
    <NDrawer v-model:show="drawerVisible" :width="520">
      <NDrawerContent :title="drawerTitle" closable>
        <NForm :model="formModel" label-placement="left" :label-width="120">
          <!-- 基础配置区：定义场景身份、类型和活动过滤条件。 -->
          <NFormItem label="场景编码">
            <NInput v-model:value="formModel.sceneCode" :disabled="Boolean(editingSceneId)" />
          </NFormItem>
          <NFormItem label="场景名称">
            <NInput v-model:value="formModel.sceneName" />
          </NFormItem>
          <NFormItem label="场景类型">
            <NSelect v-model:value="formModel.sceneType" :options="sceneTypeOptions" />
          </NFormItem>
          <NFormItem label="活动类型过滤">
            <NInput v-model:value="formModel.activityTypeFilter" placeholder="如 COURSE_GROUP、FLASH_SALE" />
          </NFormItem>
          <NFormItem label="默认裁决策略编码">
            <NInput
              v-model:value="formModel.resolverPolicyCode"
              placeholder="如 NR_RESOLVER_DEFAULT、HF_RESOLVER_DEFAULT（对应 mkt_policy）"
            />
          </NFormItem>
          <NFormItem label="匹配门店方式">
            <NSelect v-model:value="formModel.storeMatchMode" :options="sceneDefinitionStoreMatchModeOptions" />
          </NFormItem>
          <NFormItem label="排序方式">
            <NSelect v-model:value="formModel.sortMode" :options="sceneDefinitionSortModeOptions" />
          </NFormItem>
          <NFormItem label="卡片模板">
            <NSelect
              v-model:value="formModel.cardTemplate"
              filterable
              tag
              clearable
              :options="cardTemplateOptions"
              placeholder="选择或输入策略编码（如 HF_CARD_SIMPLE）"
            />
          </NFormItem>
          <!-- 路由与渠道区：通过白名单编辑器生成小程序页面路径。 -->
          <MiniappRouteTargetEditor
            v-model="formModel.pageRoute"
            default-target-key="product_list"
            @update:valid="routeValid = $event"
          />
          <NFormItem label="生效端">
            <NSelect v-model:value="formModel.channelScope" multiple :options="sceneDefinitionChannelOptions" />
          </NFormItem>
          <NFormItem label="状态">
            <NSelect v-model:value="formModel.status" :options="sceneDefinitionStatusOptions" />
          </NFormItem>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="drawerVisible = false">{{ $t('common.cancel') }}</NButton>
            <NButton type="primary" :loading="saving" @click="saveSceneDefinition">{{ $t('common.save') }}</NButton>
          </NSpace>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>
