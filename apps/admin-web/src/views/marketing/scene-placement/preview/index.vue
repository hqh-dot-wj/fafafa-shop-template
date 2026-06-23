<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { NCard, NDescriptions, NDescriptionsItem, NTag } from 'naive-ui';
import {
  type NavigationNode,
  type SceneDefinition,
  type ScenePreviewCard,
  fetchAllSceneDefinitions,
  fetchNavigationTree,
  fetchScenePreviewProducts,
} from '@/service/api/marketing';
import { useAppStore } from '@/store/modules/app';
import ScenePreviewSearch from './modules/scene-preview-search.vue';
import { createScenePreviewTableColumns } from './modules/scene-preview-table-columns';
import ScenePreviewTableCard from './modules/scene-preview-table-card.vue';

defineOptions({ name: 'MarketingScenePlacementPreviewPage' });

// 场景投放预览页把后台 scene definition、navigation tree 与 preview-products 结果并排展示。
// ADMIN_PREVIEW 只用于运营排查，不代表 C 端会员最终能看到相同权益或库存。
const appStore = useAppStore();

const sceneLoading = ref(false);
const previewLoading = ref(false);
const previewError = ref('');
const sceneRows = ref<SceneDefinition[]>([]);
const navigationNodes = ref<NavigationNode[]>([]);
const previewRows = ref<ScenePreviewCard[]>([]);

const query = reactive({
  sceneCode: '',
  channel: 'ADMIN_PREVIEW' as 'MINIAPP' | 'H5' | 'ADMIN_PREVIEW',
  memberId: '',
  clientVersion: '',
  pageNum: 1,
  pageSize: 20,
});

const pager = reactive({
  total: 0,
});

const columns = createScenePreviewTableColumns();

const paginationProps = computed(() => ({
  page: query.pageNum,
  pageSize: query.pageSize,
  pageCount: Math.max(1, Math.ceil((pager.total || 1) / query.pageSize)),
  itemCount: pager.total,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  onUpdatePage: (page: number) => {
    query.pageNum = page;
    loadPreview().catch(() => {});
  },
  onUpdatePageSize: (size: number) => {
    query.pageSize = size;
    query.pageNum = 1;
    loadPreview().catch(() => {});
  },
}));

const sceneOptions = computed(() =>
  sceneRows.value.map((scene) => ({
    label: `${scene.sceneName} (${scene.sceneCode})`,
    value: scene.sceneCode,
  })),
);

// quality-gate allow-semantic-options
const channelOptions = [
  { label: '后台预览', value: 'ADMIN_PREVIEW' as const },
  { label: '小程序', value: 'MINIAPP' as const },
  { label: 'H5', value: 'H5' as const },
];

const selectedScene = computed(() => sceneRows.value.find((item) => item.sceneCode === query.sceneCode) ?? null);
const selectedChannelLabel = computed(
  () => channelOptions.find((item) => item.value === query.channel)?.label ?? query.channel,
);

const matchedNavigationNodes = computed(() => {
  // 一个场景可能挂在多个导航节点，预览时需要同时暴露这些入口，方便核对投放路径。
  const code = query.sceneCode.trim();
  if (!code) return [];
  const result: NavigationNode[] = [];
  const walk = (nodes: NavigationNode[]) => {
    for (const node of nodes) {
      if ((node.nodeType === 'SCENE' || node.nodeType === 'LINK') && node.code === code) {
        result.push(node);
      }
      if (node.children?.length) walk(node.children);
    }
  };
  walk(navigationNodes.value);
  return result;
});

function getSceneTypeLabel(sceneType: string | null | undefined) {
  if (!sceneType) return '-';
  if (sceneType === 'HOMEPAGE') return '首页场景';
  if (sceneType === 'CATEGORY') return '分类场景';
  if (sceneType === 'COURSE_GROUP_RECOMMEND') return '拼课推荐';
  if (sceneType === 'FEATURED') return '严选专区';
  return sceneType;
}

function getStatusLabel(status: string | null | undefined) {
  if (!status) return '-';
  if (status === 'ACTIVE') return '启用';
  if (status === 'INACTIVE') return '停用';
  if (status === 'DRAFT') return '草稿';
  return status;
}

function getNodeTypeLabel(nodeType: NavigationNode['nodeType']) {
  if (nodeType === 'CATEGORY') return '分类';
  if (nodeType === 'LINK') return '跳转';
  return '场景';
}

// 基础数据加载场景定义和导航树，预览结果依赖二者共同解释投放入口。
async function loadBaseData() {
  sceneLoading.value = true;
  try {
    const [scenes, navRes] = await Promise.all([fetchAllSceneDefinitions(), fetchNavigationTree()]);
    sceneRows.value = scenes;
    // navRes.data 在请求失败时为 null（请求拦截器统一处理），落空数组保证后续展开逻辑稳定。
    navigationNodes.value = navRes.data?.nodes || [];
    if (!query.sceneCode && sceneRows.value.length > 0) {
      query.sceneCode = sceneRows.value[0].sceneCode;
    }
  } finally {
    sceneLoading.value = false;
  }
}

async function loadPreview() {
  if (!query.sceneCode) {
    window.$message?.warning('请先选择场景');
    return;
  }
  previewLoading.value = true;
  previewError.value = '';
  try {
    // memberId/clientVersion 只是模拟上下文，真实 C 端出数还会带登录态、渠道和设备摘要。
    const { data } = await fetchScenePreviewProducts(query.sceneCode, {
      channel: query.channel,
      memberId: query.memberId.trim() || undefined,
      clientVersion: query.clientVersion.trim() || undefined,
      pageNum: query.pageNum,
      pageSize: query.pageSize,
    });
    // data 在请求失败时为 null，rows/total 都用可选链兜底，保证预览面板渲染不抛。
    previewRows.value = data?.rows || [];
    pager.total = Number(data?.total || 0);
  } catch (error) {
    previewRows.value = [];
    pager.total = 0;
    previewError.value = (error as Error)?.message || '预览卡片加载失败';
  } finally {
    previewLoading.value = false;
  }
}

// 切换场景后回到第一页重新预览，避免沿用上一个场景的分页位置。
function onSceneChange() {
  query.pageNum = 1;
  loadPreview().catch(() => {});
}

// 重置预览上下文时回到首个场景和后台预览渠道，不保留会员与版本模拟条件。
function resetQuery() {
  query.sceneCode = sceneRows.value[0]?.sceneCode || '';
  query.channel = 'ADMIN_PREVIEW';
  query.memberId = '';
  query.clientVersion = '';
  query.pageNum = 1;
  query.pageSize = 20;
  loadPreview().catch(() => {});
}

// 手动查询只刷新 preview-products 结果，不重新拉取场景定义和导航树。
function runSearch() {
  loadPreview().catch(() => {});
}

onMounted(() => {
  loadBaseData()
    .then(() => loadPreview())
    .catch(() => {});
});
</script>

<template>
  <!-- 场景预览页主体：编排模拟上下文、投放信息和 preview-products 结果。 -->
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 预览搜索区：选择场景、渠道、会员和客户端版本作为模拟上下文。 -->
    <ScenePreviewSearch
      v-model:scene-code="query.sceneCode"
      v-model:channel="query.channel"
      v-model:member-id="query.memberId"
      v-model:client-version="query.clientVersion"
      :scene-loading="sceneLoading"
      :preview-loading="previewLoading"
      :scene-options="sceneOptions"
      :channel-options="channelOptions"
      @scene-change="onSceneChange"
      @reset="resetQuery"
      @search="runSearch"
    />

    <!-- 投放信息区：展示当前场景定义、导航挂载和模拟上下文。 -->
    <NCard title="场景投放信息" :bordered="false" size="small" class="card-wrapper">
      <NDescriptions label-placement="left" bordered :column="3">
        <NDescriptionsItem label="场景编码">{{ selectedScene?.sceneCode || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="场景名称">{{ selectedScene?.sceneName || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="状态">{{ getStatusLabel(selectedScene?.status) }}</NDescriptionsItem>
        <NDescriptionsItem label="场景类型">{{ getSceneTypeLabel(selectedScene?.sceneType) }}</NDescriptionsItem>
        <NDescriptionsItem label="路由">{{ selectedScene?.pageRoute || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="导航节点数">{{ matchedNavigationNodes.length }}</NDescriptionsItem>
        <NDescriptionsItem label="模拟渠道">{{ selectedChannelLabel }}</NDescriptionsItem>
        <NDescriptionsItem label="模拟会员">{{ query.memberId.trim() || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="客户端版本">{{ query.clientVersion.trim() || '-' }}</NDescriptionsItem>
      </NDescriptions>
      <div class="mt-12px flex flex-wrap gap-8px">
        <NTag v-for="item in matchedNavigationNodes" :key="item.nodeId" type="info">
          {{ getNodeTypeLabel(item.nodeType) }} · {{ item.name }} / {{ item.pagePath || '-' }}
        </NTag>
      </div>
    </NCard>

    <!-- 预览结果区：展示后端 preview-products 返回的卡片列表。 -->
    <ScenePreviewTableCard
      :columns="columns"
      :data="previewRows"
      :loading="previewLoading"
      :pagination="paginationProps"
      :flex-height="!appStore.isMobile"
      :scroll-x="1300"
      :total="pager.total"
      :preview-error="previewError"
    />
  </div>
</template>
