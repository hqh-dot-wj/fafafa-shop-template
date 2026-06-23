<script setup lang="tsx">
import { computed, reactive, ref, watch } from 'vue';
import { NButton, NSpace, NTag } from 'naive-ui';
import { fetchSaveSceneModule, fetchSceneModuleList } from '@/service/api/marketing/scene';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import { $t } from '@/locales';
import MiniappRouteTargetEditor from '@/components/business/miniapp-route-target-editor.vue';
import ButtonIcon from '@/components/custom/button-icon.vue';
import SceneModuleSearch from './modules/scene-module-search.vue';

defineOptions({ name: 'MarketingSceneModule' });

// 场景模块页维护场景内的投放模块、策略编码和展示配置，发布出数仍由场景预检和后端裁决链路控制。
const appStore = useAppStore();

const submitting = ref(false);
const modalVisible = ref(false);
const editingId = ref<string | null>(null);
const moduleRouteValid = ref(true);
const uiBannerImage = ref('');
const uiBannerRoute = ref('');
const moduleForm = reactive<Api.Marketing.SaveSceneModuleParams & { sceneCode: string; id?: string }>({
  sceneCode: '',
  moduleCode: '',
  moduleName: '',
  moduleType: 'PRODUCT_LIST',
  title: '',
  subTitle: '',
  displayOrder: 1,
  limitSize: 20,
  sourcePolicyCode: '',
  resolverPolicyCode: '',
  sortPolicyCode: '',
  audiencePolicyCode: '',
  cardTemplateCode: '',
  attributionPolicyCode: '',
  uiConfig: {},
  status: 'ACTIVE',
});

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
}

function isBannerModuleType(moduleType: string): boolean {
  return moduleType.trim().toUpperCase().includes('BANNER');
}

const showBannerConfig = computed(() => isBannerModuleType(moduleForm.moduleType));

watch(
  () => moduleForm.moduleType,
  (value) => {
    // 切换到非广告模块时不校验广告路由，避免普通商品列表模块被无关路由字段阻断保存。
    if (!isBannerModuleType(value)) {
      moduleRouteValid.value = true;
    }
  },
);

const { data, loading, getData, getDataByPage, columns, searchParams, resetSearchParams, mobilePagination, scrollX } =
  useTable({
    apiFn: fetchSceneModuleList,
    apiParams: { pageNum: 1, pageSize: 20, sceneCode: null, moduleCode: null, status: null },
    columns: () => [
      { key: 'sceneCode', title: '场景编码', align: 'center', minWidth: 140 },
      {
        key: 'moduleCode',
        title: '模块编码',
        align: 'center',
        minWidth: 140,
        render: (row) => (
          <NTag type="info" bordered={false} class="font-mono">
            {row.moduleCode}
          </NTag>
        ),
      },
      { key: 'moduleName', title: '模块名称', align: 'center', minWidth: 160 },
      { key: 'moduleType', title: '模块类型', align: 'center', minWidth: 120 },
      { key: 'displayOrder', title: '排序', align: 'center', width: 80 },
      { key: 'limitSize', title: '数量上限', align: 'center', width: 100 },
      {
        key: 'status',
        title: '状态',
        align: 'center',
        width: 100,
        render: (row) => {
          let tagType: 'default' | 'success' | 'warning' = 'default';
          let label = '停用';
          if (row.status === 'ACTIVE') {
            tagType = 'success';
            label = '启用';
          } else if (row.status === 'DRAFT') {
            tagType = 'warning';
            label = '草稿';
          }
          return (
            <NTag type={tagType} size="small">
              {label}
            </NTag>
          );
        },
      },
      {
        key: 'operate',
        title: $t('common.operate'),
        align: 'center',
        width: 100,
        render: (row) => (
          <div class="flex-center gap-8px">
            <ButtonIcon
              type="primary"
              class="text-primary"
              tooltipContent={$t('common.edit')}
              icon="material-symbols:edit-square-outline"
              onClick={() => openEdit(row)}
            />
          </div>
        ),
      },
    ],
  });

function openCreate() {
  editingId.value = null;
  moduleRouteValid.value = true;
  uiBannerImage.value = '';
  uiBannerRoute.value = '';
  Object.assign(moduleForm, {
    sceneCode: '',
    moduleCode: '',
    moduleName: '',
    moduleType: 'PRODUCT_LIST',
    title: '',
    subTitle: '',
    displayOrder: 1,
    limitSize: 20,
    sourcePolicyCode: '',
    resolverPolicyCode: '',
    sortPolicyCode: '',
    audiencePolicyCode: '',
    cardTemplateCode: '',
    attributionPolicyCode: '',
    uiConfig: {},
    status: 'ACTIVE',
  });
  modalVisible.value = true;
}

function openEdit(row: Api.Marketing.MarketingSceneModule) {
  editingId.value = row.id;
  moduleRouteValid.value = true;
  Object.assign(moduleForm, {
    id: row.id,
    sceneCode: row.sceneCode,
    moduleCode: row.moduleCode,
    moduleName: row.moduleName,
    moduleType: row.moduleType,
    title: row.title ?? '',
    subTitle: row.subTitle ?? '',
    displayOrder: row.displayOrder ?? 1,
    limitSize: row.limitSize ?? 20,
    sourcePolicyCode: row.sourcePolicyCode,
    resolverPolicyCode: row.resolverPolicyCode,
    sortPolicyCode: row.sortPolicyCode ?? '',
    audiencePolicyCode: row.audiencePolicyCode ?? '',
    cardTemplateCode: row.cardTemplateCode,
    attributionPolicyCode: row.attributionPolicyCode ?? '',
    uiConfig: row.uiConfig ?? {},
    status: row.status ?? 'ACTIVE',
  });
  const uiConfig = toRecord(row.uiConfig);
  uiBannerImage.value =
    readString(uiConfig, 'imageUrl') || readString(uiConfig, 'bannerImage') || readString(uiConfig, 'image');
  uiBannerRoute.value =
    readString(uiConfig, 'pageRoute') || readString(uiConfig, 'targetPath') || readString(uiConfig, 'linkPath');
  modalVisible.value = true;
}

async function handleSave() {
  if (!moduleForm.sceneCode || !moduleForm.moduleCode || !moduleForm.moduleName) {
    window.$message?.warning('请填写场景编码、模块编码、模块名称');
    return;
  }
  if (!moduleForm.sourcePolicyCode || !moduleForm.resolverPolicyCode || !moduleForm.cardTemplateCode) {
    window.$message?.warning('请填写来源策略、裁决策略、卡片模板编码');
    return;
  }
  if (showBannerConfig.value && !uiBannerImage.value.trim()) {
    window.$message?.warning('请填写广告主图地址');
    return;
  }
  if (showBannerConfig.value && !moduleRouteValid.value) {
    window.$message?.warning('广告跳转路由参数不完整，请先修正');
    return;
  }

  submitting.value = true;
  try {
    // 保存时只把广告模块的图片和跳转路由写入 uiConfig，其他模块保留已有扩展配置。
    const sceneCode = moduleForm.sceneCode;
    const uiConfig: Record<string, unknown> = { ...toRecord(moduleForm.uiConfig) };
    if (showBannerConfig.value) {
      uiConfig.imageUrl = uiBannerImage.value.trim();
      uiConfig.pageRoute = uiBannerRoute.value.trim();
    }
    const payload: Api.Marketing.SaveSceneModuleParams = {
      ...moduleForm,
      id: editingId.value ?? undefined,
      uiConfig,
    };
    await fetchSaveSceneModule(sceneCode, payload);
    window.$message?.success(editingId.value ? '模块已更新' : '模块已创建');
    modalVisible.value = false;
    getData();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 搜索区：按场景编码、模块编码和状态筛选模块编排。 -->
    <SceneModuleSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <!-- 模块表格区：展示场景模块及其策略绑定，并提供新增入口。 -->
    <NCard title="模块编排" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NButton type="primary" ghost size="small" @click="openCreate">
          <template #icon>
            <icon-ic-round-plus class="text-icon" />
          </template>
          新增模块
        </NButton>
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="mobilePagination"
        remote
        :row-key="(row) => row.id"
        :flex-height="!appStore.isMobile"
        :scroll-x="scrollX"
        class="sm:h-full"
      >
        <template #empty>
          <div class="py-24px text-14px text-gray-500">{{ $t('datatable.empty') }}</div>
        </template>
      </NDataTable>
    </NCard>

    <!-- 模块编辑弹窗：维护模块身份、策略编码、展示上限和广告跳转配置。 -->
    <NModal v-model:show="modalVisible" preset="card" :title="editingId ? '编辑模块' : '新增模块'" class="w-720px">
      <NForm :model="moduleForm" label-placement="left" :label-width="120">
        <!-- 模块基础区：定义模块归属场景、编码、名称、类型和排序。 -->
        <NFormItem label="场景编码">
          <NInput v-model:value="moduleForm.sceneCode" :disabled="!!editingId" placeholder="HOME_FEATURED" />
        </NFormItem>
        <NFormItem label="模块编码">
          <NInput v-model:value="moduleForm.moduleCode" :disabled="!!editingId" placeholder="HOME_PRODUCT_LIST" />
        </NFormItem>
        <NFormItem label="模块名称">
          <NInput v-model:value="moduleForm.moduleName" placeholder="请输入模块名称" />
        </NFormItem>
        <NFormItem label="模块类型">
          <NInput v-model:value="moduleForm.moduleType" placeholder="PRODUCT_LIST / BANNER" />
        </NFormItem>
        <NFormItem label="排序">
          <NInputNumber v-model:value="moduleForm.displayOrder" :min="0" />
        </NFormItem>
        <NFormItem label="数量上限">
          <NInputNumber v-model:value="moduleForm.limitSize" :min="1" />
        </NFormItem>
        <!-- 策略绑定区：绑定来源、裁决、排序、受众和卡片模板策略。 -->
        <NFormItem label="来源策略编码">
          <NInput v-model:value="moduleForm.sourcePolicyCode" />
        </NFormItem>
        <NFormItem label="裁决策略编码">
          <NInput v-model:value="moduleForm.resolverPolicyCode" />
        </NFormItem>
        <NFormItem label="排序策略编码">
          <NInput v-model:value="moduleForm.sortPolicyCode" />
        </NFormItem>
        <NFormItem label="受众策略编码">
          <NInput v-model:value="moduleForm.audiencePolicyCode" />
        </NFormItem>
        <NFormItem label="卡片模板编码">
          <NInput v-model:value="moduleForm.cardTemplateCode" />
        </NFormItem>
        <NFormItem label="状态">
          <NSelect
            v-model:value="moduleForm.status"
            :options="[
              { label: '启用', value: 'ACTIVE' },
              { label: '停用', value: 'INACTIVE' },
              { label: '草稿', value: 'DRAFT' },
            ]"
          />
        </NFormItem>
        <NFormItem v-if="showBannerConfig" label="广告主图">
          <NInput v-model:value="uiBannerImage" placeholder="请输入广告图片 URL" />
        </NFormItem>
        <!-- 广告跳转区：广告模块才配置小程序目标页面。 -->
        <MiniappRouteTargetEditor
          v-if="showBannerConfig"
          v-model="uiBannerRoute"
          default-target-key="home_index"
          @update:valid="moduleRouteValid = $event"
        />
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="handleSave">保存</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped></style>
