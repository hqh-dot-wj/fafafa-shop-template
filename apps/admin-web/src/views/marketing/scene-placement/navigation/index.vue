<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  NAlert,
  NButton,
  NCard,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  NTree,
} from 'naive-ui';
import type { SelectOption, TreeOption } from 'naive-ui';
import {
  type NavigationNode,
  type NavigationNodeType,
  fetchCreateNavigationNode,
  fetchNavigationTree,
  fetchSortNavigationNode,
  fetchUpdateNavigationNode,
} from '@/service/api/marketing';
import { $t } from '@/locales';
import TableSiderLayout from '@/components/advanced/table-sider-layout.vue';
import MiniappRouteTargetEditor from '@/components/business/miniapp-route-target-editor.vue';
import { navigationChannelScopeOptions, navigationNodeTypeOptions, navigationStatusOptions } from './navigation-labels';

defineOptions({ name: 'MarketingScenePlacementNavigationPage' });

// 场景投放导航页对应 NavigationAdminController，负责配置小程序可见的分类、场景和跳转节点。
// 路由字段必须通过 MiniappRouteTargetEditor 白名单生成，不能让运营任意输入未登记页面。
const router = useRouter();

function goScenePreview() {
  router.push({ name: 'marketing_scene-placement_preview' }).catch(() => {});
}

interface NavigationEditorModel {
  nodeType: NavigationNodeType;
  sceneCode: string;
  sceneName: string;
  categoryName: string;
  /** 空字符串表示挂载到根节点 */
  parentNodeId: string;
  sort: number;
  sceneType: string;
  pageRoute: string;
  status: string;
  channelScope: string[];
}

const loading = ref(false);
const saving = ref(false);
const sorting = ref(false);
const treeNodes = ref<NavigationNode[]>([]);
const selectedNodeId = ref<string | null>(null);
const editingMode = ref<'edit' | 'create'>('edit');
const treeFilter = ref('');
const routeValid = ref(true);

const editorModel = reactive<NavigationEditorModel>({
  nodeType: 'SCENE',
  sceneCode: '',
  sceneName: '',
  categoryName: '',
  parentNodeId: '',
  sort: 0,
  sceneType: 'MARKETING',
  pageRoute: '',
  status: 'ACTIVE',
  channelScope: ['miniapp'],
});

const treeOptions = computed<TreeOption[]>(() => buildTreeOptions(treeNodes.value));

const flatNodeOptions = computed<SelectOption[]>(() => {
  const nodes: SelectOption[] = [{ label: '根节点', value: '' }];

  walkTree(treeNodes.value, (node) => {
    nodes.push({
      label: `${getNodeTypePrefix(node.nodeType)} ${node.name}`,
      value: node.nodeId,
    });
  });

  return nodes;
});

const selectedNode = computed(() => {
  if (!selectedNodeId.value) return null;
  return findNodeById(treeNodes.value, selectedNodeId.value);
});

const selectedNodePath = computed(() => {
  if (!selectedNodeId.value) return [];
  return findNodePath(treeNodes.value, selectedNodeId.value);
});

function buildTreeOptions(nodes: NavigationNode[]): TreeOption[] {
  return nodes.map((node) => ({
    key: node.nodeId,
    label: `${getNodeTypePrefix(node.nodeType)} ${node.name}`,
    children: node.children?.length ? buildTreeOptions(node.children) : undefined,
  }));
}

function walkTree(nodes: NavigationNode[], visit: (node: NavigationNode) => void) {
  nodes.forEach((node) => {
    visit(node);
    if (node.children?.length) {
      walkTree(node.children, visit);
    }
  });
}

function findNodeById(nodes: NavigationNode[], nodeId: string): NavigationNode | null {
  for (const node of nodes) {
    if (node.nodeId === nodeId) return node;
    if (node.children?.length) {
      const child = findNodeById(node.children, nodeId);
      if (child) return child;
    }
  }
  return null;
}

function findNodePath(nodes: NavigationNode[], nodeId: string, path: string[] = []): string[] {
  for (const node of nodes) {
    const nextPath = [...path, node.name];
    if (node.nodeId === nodeId) return nextPath;
    if (node.children?.length) {
      const childPath = findNodePath(node.children, nodeId, nextPath);
      if (childPath.length > 0) return childPath;
    }
  }
  return [];
}

function getNodeTypePrefix(nodeType: NavigationNodeType) {
  if (nodeType === 'CATEGORY') return '[分类]';
  if (nodeType === 'LINK') return '[跳转]';
  return '[场景]';
}

function getNodeTypeLabel(nodeType: NavigationNodeType) {
  if (nodeType === 'CATEGORY') return '分类节点';
  if (nodeType === 'LINK') return '跳转节点';
  return '场景节点';
}

function mapNodeToEditor(node: NavigationNode) {
  editorModel.nodeType = node.nodeType;
  editorModel.sceneCode = node.nodeType === 'CATEGORY' ? '' : node.code;
  editorModel.sceneName = node.nodeType === 'CATEGORY' ? '' : node.name;
  editorModel.categoryName = node.nodeType === 'CATEGORY' ? node.name : '';
  editorModel.parentNodeId = node.parentNodeId ?? '';
  editorModel.sort = node.sort ?? 0;
  editorModel.sceneType = node.nodeType === 'LINK' ? 'LINK' : 'MARKETING';
  editorModel.pageRoute = node.pagePath ?? '';
  editorModel.status = node.status ?? 'ACTIVE';
  editorModel.channelScope = ['miniapp'];
}

async function loadTree() {
  loading.value = true;
  try {
    const { data } = await fetchNavigationTree();
    treeNodes.value = data?.nodes || [];

    if (!selectedNodeId.value && treeNodes.value.length > 0) {
      selectedNodeId.value = treeNodes.value[0].nodeId;
      const current = selectedNode.value;
      if (current) {
        editingMode.value = 'edit';
        mapNodeToEditor(current);
      }
    }
  } finally {
    loading.value = false;
  }
}

function handleSelectNode(keys: Array<string | number>) {
  const value = keys[0];
  if (!value) return;

  selectedNodeId.value = String(value);
  const node = selectedNode.value;
  if (!node) return;

  editingMode.value = 'edit';
  mapNodeToEditor(node);
}

function openCreate(nodeType: NavigationNodeType) {
  editingMode.value = 'create';
  editorModel.nodeType = nodeType;
  editorModel.sceneCode = '';
  editorModel.sceneName = '';
  editorModel.categoryName = '';
  editorModel.parentNodeId = selectedNodeId.value ?? '';
  editorModel.sort = 0;
  editorModel.sceneType = nodeType === 'LINK' ? 'LINK' : 'MARKETING';
  editorModel.pageRoute = '';
  editorModel.status = 'ACTIVE';
  editorModel.channelScope = ['miniapp'];
}

function validateEditorModel() {
  if (editorModel.nodeType === 'CATEGORY' && !editorModel.categoryName.trim()) {
    window.$message?.warning('请填写分类节点名称');
    return false;
  }
  if (editorModel.nodeType !== 'CATEGORY' && !editorModel.sceneName.trim()) {
    window.$message?.warning(editorModel.nodeType === 'LINK' ? '请填写跳转节点名称' : '请填写场景节点名称');
    return false;
  }
  if (editorModel.nodeType === 'LINK' && !editorModel.pageRoute.trim()) {
    window.$message?.warning('请填写跳转路径');
    return false;
  }
  if (editorModel.nodeType !== 'CATEGORY' && !routeValid.value) {
    window.$message?.warning('路由参数不完整，请先修正');
    return false;
  }
  return true;
}

function buildNavigationPayload() {
  // CATEGORY 与 SCENE/LINK 的 DTO 字段不同，构造 payload 时按节点类型拆分，避免提交无效字段。
  const basePayload = {
    nodeType: editorModel.nodeType,
    parentNodeId: editorModel.parentNodeId || undefined,
    sort: editorModel.sort,
  };

  if (editorModel.nodeType === 'CATEGORY') {
    return {
      ...basePayload,
      categoryName: editorModel.categoryName || undefined,
    };
  }

  return {
    ...basePayload,
    sceneCode: editorModel.sceneCode || undefined,
    sceneName: editorModel.sceneName || undefined,
    sceneType: editorModel.nodeType === 'LINK' ? 'LINK' : editorModel.sceneType || undefined,
    pageRoute: editorModel.pageRoute || undefined,
    status: editorModel.status || undefined,
    channelScope: editorModel.channelScope,
  };
}

async function persistNavigationNode(payload: ReturnType<typeof buildNavigationPayload>) {
  if (editingMode.value === 'create') {
    const { data } = await fetchCreateNavigationNode(payload);
    window.$message?.success('导航节点已创建');
    selectedNodeId.value = data?.nodeId ?? null;
    return;
  }

  if (selectedNodeId.value) {
    await fetchUpdateNavigationNode(selectedNodeId.value, payload);
    window.$message?.success('导航节点已更新');
  }
}

async function saveNode() {
  if (!validateEditorModel()) return;

  saving.value = true;
  try {
    await persistNavigationNode(buildNavigationPayload());
    await loadTree();
  } finally {
    saving.value = false;
  }
}

async function saveSort() {
  if (!selectedNodeId.value) return;

  sorting.value = true;
  try {
    // 排序单独保存，便于运营只调整展示顺序，不误改场景路由和状态。
    await fetchSortNavigationNode(selectedNodeId.value, {
      sort: editorModel.sort,
      parentNodeId: editorModel.parentNodeId || undefined,
    });
    window.$message?.success('排序已提交');
    await loadTree();
  } finally {
    sorting.value = false;
  }
}

onMounted(() => {
  loadTree().catch(() => {});
});
</script>

<template>
  <!-- 导航配置页：左侧维护树结构，右侧编辑当前节点和预览路径。 -->
  <div class="navigation-page h-full overflow-hidden">
    <TableSiderLayout sider-title="场景投放导航树">
      <template #header-extra>
        <!-- 顶部操作区：刷新树、新建节点和跳转投放预览。 -->
        <NSpace :size="8">
          <NButton size="small" :loading="loading" @click="loadTree">
            <template #icon>
              <icon-ic-round-refresh class="text-icon" />
            </template>
            {{ $t('common.refresh') }}
          </NButton>
          <NButton size="small" type="primary" ghost @click="openCreate('CATEGORY')">
            <template #icon>
              <icon-ic-round-plus class="text-icon" />
            </template>
            新建分类
          </NButton>
          <NButton size="small" type="info" ghost @click="openCreate('SCENE')">
            <template #icon>
              <icon-ic-round-plus class="text-icon" />
            </template>
            新建场景
          </NButton>
          <NButton size="small" type="warning" ghost @click="openCreate('LINK')">
            <template #icon>
              <icon-ic-round-link class="text-icon" />
            </template>
            新建跳转
          </NButton>
          <NButton size="small" quaternary @click="goScenePreview">
            {{ $t('route.marketing_scene-placement_preview') }}
          </NButton>
        </NSpace>
      </template>

      <template #sider>
        <!-- 导航树区：按节点名称过滤并选择要编辑的分类、场景或跳转。 -->
        <div class="h-full min-h-0 flex flex-col flex-1 gap-12px">
          <NInput v-model:value="treeFilter" clearable placeholder="筛选节点" class="shrink-0" />
          <NSpin :show="loading" class="navigation-tree-spin min-h-0 flex-1">
            <NTree
              block-node
              selectable
              :data="treeOptions"
              :selected-keys="selectedNodeId ? [selectedNodeId] : []"
              :default-expand-all="true"
              :pattern="treeFilter"
              :show-irrelevant-nodes="false"
              class="min-h-0 flex-1 overflow-auto"
              @update:selected-keys="handleSelectNode"
            >
              <template #empty>
                <NEmpty description="暂无导航节点" class="h-full justify-center py-24px" />
              </template>
            </NTree>
          </NSpin>
        </div>
      </template>

      <div class="h-full min-h-0 flex-col-stretch gap-16px overflow-y-auto lt-sm:overflow-auto">
        <!-- 节点编辑区：按节点类型保存名称、父节点、路由、排序和渠道。 -->
        <NCard :bordered="false" size="small" class="card-wrapper">
          <template #header>
            <div class="flex items-center gap-10px">
              <span class="font-semibold">
                {{ editingMode === 'create' ? '新增场景投放节点' : '场景投放节点编辑' }}
              </span>
              <NTag
                v-if="selectedNode"
                size="small"
                :type="
                  selectedNode.nodeType === 'CATEGORY'
                    ? 'info'
                    : selectedNode.nodeType === 'LINK'
                      ? 'warning'
                      : 'success'
                "
              >
                {{ getNodeTypeLabel(selectedNode.nodeType) }}
              </NTag>
            </div>
          </template>
          <NForm :model="editorModel" label-placement="left" :label-width="108">
            <NFormItem label="节点类型">
              <NSelect
                v-model:value="editorModel.nodeType"
                :options="navigationNodeTypeOptions"
                class="max-w-full w-full"
              />
            </NFormItem>
            <NFormItem label="节点名称">
              <NInput
                v-if="editorModel.nodeType !== 'CATEGORY'"
                v-model:value="editorModel.sceneName"
                class="max-w-full w-full"
                :placeholder="editorModel.nodeType === 'LINK' ? '跳转节点名称' : '场景名称'"
              />
              <NInput
                v-else
                v-model:value="editorModel.categoryName"
                class="max-w-full w-full"
                placeholder="分类名称"
              />
            </NFormItem>
            <NFormItem v-if="editorModel.nodeType !== 'CATEGORY'" label="场景编码">
              <NInput
                v-model:value="editorModel.sceneCode"
                class="max-w-full w-full"
                :placeholder="
                  editorModel.nodeType === 'LINK' ? '可选，不填自动生成 LINK_ 开头编码' : '可选，不填自动生成'
                "
              />
            </NFormItem>
            <NFormItem label="父节点">
              <NSelect
                v-model:value="editorModel.parentNodeId"
                clearable
                class="max-w-full w-full"
                :options="flatNodeOptions"
              />
            </NFormItem>
            <MiniappRouteTargetEditor
              v-if="editorModel.nodeType !== 'CATEGORY'"
              v-model="editorModel.pageRoute"
              :default-target-key="editorModel.nodeType === 'LINK' ? 'home_index' : 'product_list'"
              @update:valid="routeValid = $event"
            />
            <NFormItem label="排序值">
              <NInputNumber v-model:value="editorModel.sort" :step="1" class="max-w-full w-full" />
            </NFormItem>
            <NFormItem v-if="editorModel.nodeType !== 'CATEGORY'" label="状态">
              <NSelect
                v-model:value="editorModel.status"
                class="max-w-full w-full"
                :options="navigationStatusOptions"
              />
            </NFormItem>
            <NFormItem v-if="editorModel.nodeType !== 'CATEGORY'" label="生效端">
              <NSelect
                v-model:value="editorModel.channelScope"
                class="max-w-full w-full"
                multiple
                :options="navigationChannelScopeOptions"
              />
            </NFormItem>
          </NForm>
          <NSpace class="mt-16px" justify="end">
            <NButton :loading="sorting" @click="saveSort">仅保存排序</NButton>
            <NButton type="primary" :loading="saving" @click="saveNode">{{ $t('common.save') }}</NButton>
          </NSpace>
        </NCard>

        <!-- 节点预览区：只读展示当前节点路径、类型、路由和子节点数量。 -->
        <NCard title="场景投放导航预览" :bordered="false" size="small" class="card-wrapper">
          <NAlert type="info" :bordered="false" class="mb-12px">
            支持在一级分类下挂场景节点或跳转节点；可通过“父节点 + 排序值”调整展示顺序。
          </NAlert>
          <div v-if="selectedNode" class="flex-col gap-8px">
            <div>
              <strong>当前节点：</strong>
              {{ selectedNode.name }}
            </div>
            <div>
              <strong>节点路径：</strong>
              {{ selectedNodePath.join(' / ') || '-' }}
            </div>
            <div>
              <strong>节点类型：</strong>
              {{ getNodeTypeLabel(selectedNode.nodeType) }}
            </div>
            <div>
              <strong>目标路由：</strong>
              {{ selectedNode.pagePath || '-' }}
            </div>
            <div>
              <strong>子节点数：</strong>
              {{ selectedNode.children?.length || 0 }}
            </div>
          </div>
          <div v-else class="text-gray-500">请选择左侧节点进行预览</div>
        </NCard>
      </div>
    </TableSiderLayout>
  </div>
</template>

<style scoped>
.navigation-tree-spin {
  min-height: 0;
}

.navigation-tree-spin :deep(.n-spin-content) {
  display: flex;
  height: 100%;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.navigation-page :deep(.table-sider-layout-desktop) {
  height: 100%;
  min-height: 0;
}

.navigation-page :deep(.table-sider-layout-desktop .n-layout-scroll-container) {
  height: 100%;
  min-height: 0;
}

.navigation-page :deep(.table-sider-layout-sider .n-layout-sider-scroll-container) {
  min-height: 0;
}
</style>
