<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NSpin, NTag, useMessage } from 'naive-ui';
import { fetchCreateActivity } from '@/service/api/marketing';
import { useAuthStore } from '@/store/modules/auth';
import OrchestrationFlow from '@/components/orchestration/OrchestrationFlow.vue';
import { deriveNodeStatus, isNodeInActiveBranch, nextRecommended } from '@/components/orchestration/state-machine';
import SchemaForm from '@/components/schema-form/SchemaForm.vue';
import { resolveNodeSchema } from '@/components/schema-form/schema-resolver';
import { CAMPAIGN_CREATE_WORKFLOW } from '../../_orchestration/workflows';
import type {
  JsonSchemaObject,
  NodeStatusContext,
  NodeValidationState,
  OrchestrationNode,
} from '../../_orchestration/types';

defineOptions({ name: 'MarketingCampaignOrchestrationWizard' });

// 旧编排向导把节点表单收敛成活动草稿 rules.workflowCode/nodes。
// 它不发布活动，只保存 DRAFT，后续仍需进入活动工作台做预检和发布。
const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();
const isSuperAdmin = computed(() => authStore.isStaticSuper);
const currentTenantId = computed(() => authStore.userInfo.user?.tenantId ?? '');

const workflow = CAMPAIGN_CREATE_WORKFLOW;
const formData = reactive<Record<string, Record<string, unknown>>>({
  'select-type': { type: 'FIRST_ORDER' },
  'basic-info': {},
});
const validations = reactive<Record<string, NodeValidationState>>({});
const activeNodeId = ref(workflow.entryNode);
const activeSchema = ref<JsonSchemaObject | null>(null);
const loadingSchema = ref(false);
const saving = ref(false);
const emptyNodeModel: Record<string, unknown> = {};

const ctx = computed<NodeStatusContext>(() => ({
  workflow,
  formData,
  validations,
}));

const activeNode = computed(() => workflow.nodes.find((node) => node.id === activeNodeId.value) ?? workflow.nodes[0]);
const activeModel = computed({
  get: () => formData[activeNodeId.value] ?? emptyNodeModel,
  set: (value) => {
    formData[activeNodeId.value] = value;
  },
});
const recommendedNode = computed(() => nextRecommended(ctx.value));
const activeStatus = computed(() => deriveNodeStatus(activeNode.value, ctx.value));
const visibleNodes = computed(() => workflow.nodes.filter((node) => isNodeInActiveBranch(node, ctx.value)));
const completedCount = computed(
  () => visibleNodes.value.filter((node) => deriveNodeStatus(node, ctx.value) === 'completed').length,
);
const totalCount = computed(() => visibleNodes.value.length);
const isAtExit = computed(() => activeNodeId.value === workflow.exitNode);
const isAllDone = computed(() => recommendedNode.value === null);
const STATUS_LABEL: Record<ReturnType<typeof deriveNodeStatus>, string> = {
  idle: '待启动',
  in_progress: '进行中',
  completed: '已完成',
  error: '待修复',
};

watch(
  [activeNodeId, () => formData['select-type']?.type],
  async () => {
    if (!isNodeInActiveBranch(activeNode.value, ctx.value)) {
      activeNodeId.value = workflow.entryNode;
      return;
    }
    await loadActiveSchema();
  },
  { immediate: true },
);

async function loadActiveSchema() {
  loadingSchema.value = true;
  try {
    const schemaRef = activeNode.value.schema;
    const resolved = schemaRef
      ? await resolveNodeSchema(schemaRef, {
          workflowData: {
            campaign: {
              type: formData['select-type']?.type,
            },
          },
          nodeFormData: formData,
        })
      : null;
    if (resolved && activeNodeId.value === 'link-products') {
      adaptLinkProductsSchema(resolved);
    }
    activeSchema.value = resolved;
  } finally {
    loadingSchema.value = false;
  }
}

function adaptLinkProductsSchema(schema: JsonSchemaObject) {
  // 多租户：门店 = 租户。非超管不应跨租户选择，自动用当前租户填充并隐藏字段；超管才暴露租户下拉。
  if (!formData['link-products']) {
    formData['link-products'] = {};
  }
  const linkModel = formData['link-products'];
  const stores = linkModel.stores;
  if (!Array.isArray(stores) || stores.length === 0) {
    if (currentTenantId.value) linkModel.stores = [currentTenantId.value];
  }
  if (!isSuperAdmin.value && schema.properties?.stores) {
    delete schema.properties.stores;
  }
}

function handleNodeClick(nodeId: string) {
  const target = workflow.nodes.find((node) => node.id === nodeId);
  if (!target) return;
  if (!isNodeInActiveBranch(target, ctx.value)) {
    message.warning('当前活动类型未走到该节点，请先返回选择活动类型');
    return;
  }
  activeNodeId.value = nodeId;
}

function markCurrentCompleted() {
  const errors = validateNode(activeNode.value, activeModel.value);
  validations[activeNodeId.value] = {
    completed: errors.length === 0,
    errors,
  };
  if (errors.length) {
    message.warning(errors[0]);
  }
  return errors.length === 0;
}

function goRecommended() {
  const node = recommendedNode.value;
  if (!node || node.id === activeNodeId.value) return;
  activeNodeId.value = node.id;
}

function goAdvancedMode() {
  return router.push({ name: 'marketing_campaigns_new' });
}

async function goNext() {
  if (isAtExit.value) {
    await saveDraft();
    return;
  }
  if (!markCurrentCompleted()) return;
  const next = nextRecommended(ctx.value);
  if (next && next.id !== activeNodeId.value) {
    activeNodeId.value = next.id;
  }
}

function validateNode(node: OrchestrationNode, model: Record<string, unknown>) {
  if (!node.required || !activeSchema.value?.required?.length) return [];
  return activeSchema.value.required
    .filter((key) => {
      const value = model[key];
      return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    })
    .map((key) => `请完成「${activeSchema.value?.properties[key]?.title ?? key}」`);
}

async function saveDraft() {
  if (!markCurrentCompleted()) return;
  saving.value = true;
  try {
    // 节点数据完整保存在 rules.nodes，避免前端把未完成的编排节点翻译成运行时活动规则。
    const campaignType = String(formData['select-type']?.type || 'FIRST_ORDER');
    const basic = formData['basic-info'] ?? {};
    const payload: Parameters<typeof fetchCreateActivity>[0] = {
      type: campaignType as Parameters<typeof fetchCreateActivity>[0]['type'],
      name: String(basic.name || `营销活动草稿-${new Date().toLocaleString('zh-CN')}`),
      description: String(basic.description || '编排向导创建的活动草稿'),
      triggerCondition: {},
      rules: {
        workflowCode: workflow.code,
        nodes: { ...formData },
      },
      rewards: (formData['handler-light-rewards'] ?? {}) as Record<string, unknown>,
      priority: 0,
      isEnabled: false,
    };
    const { data } = await fetchCreateActivity(payload);
    if (!data?.id) {
      throw new Error('草稿创建失败');
    }
    message.success('草稿已创建，正在进入活动工作台');
    await router.push({ name: 'marketing_campaigns_detail', query: { campaignId: data.id } });
  } catch {
    message.error('保存草稿失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <!-- 旧编排向导：按节点收集草稿规则，最终保存 DRAFT 活动。 -->
  <NSpin :show="saving" class="h-full">
    <div class="h-full min-h-640px flex flex-col gap-16px overflow-auto bg-[#f6f7f9] p-16px">
      <!-- 顶部状态区：展示当前节点、完成进度和草稿保存入口。 -->
      <div
        class="flex flex-wrap items-center justify-between gap-12px border border-gray-200 rounded-8px bg-white px-16px py-12px"
      >
        <div class="min-w-0">
          <div class="text-18px font-600">创建营销活动</div>
          <div class="mt-4px flex flex-wrap items-center gap-8px text-12px text-gray-500">
            <span>{{ workflow.name }}</span>
            <NTag size="small" type="info">已完成 {{ completedCount }} / {{ totalCount }}</NTag>
            <NTag size="small" :type="activeStatus === 'error' ? 'error' : 'success'"
              >当前：{{ activeNode.label }}</NTag
            >
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-8px">
          <NButton size="small" quaternary @click="goAdvancedMode">高级模式</NButton>
          <NButton
            size="small"
            secondary
            type="primary"
            :disabled="!recommendedNode || recommendedNode.id === activeNodeId"
            @click="goRecommended"
          >
            {{ isAllDone ? '已到终点' : `下一步推荐：${recommendedNode?.label ?? '完成'}` }}
          </NButton>
          <NButton size="small" type="primary" :loading="saving" @click="saveDraft">保存草稿</NButton>
        </div>
      </div>

      <!-- 编排流程图区：展示活动创建节点和可点击的当前分支。 -->
      <OrchestrationFlow :workflow="workflow" :ctx="ctx" @node-click="handleNodeClick" />

      <!-- 节点编辑区：左侧编辑当前节点 schema，右侧展示节点状态列表。 -->
      <div class="grid min-h-0 gap-16px lg:grid-cols-[minmax(0,1fr)_280px]">
        <div class="border border-gray-200 rounded-8px bg-white p-16px">
          <div class="mb-12px flex items-center justify-between gap-12px">
            <div>
              <div class="text-16px font-600">{{ activeNode.label }}</div>
              <div v-if="activeNode.hint" class="mt-4px text-12px text-gray-500">{{ activeNode.hint }}</div>
            </div>
            <NButton size="small" type="primary" :loading="saving" @click="goNext">
              {{ isAtExit ? '保存并完成草稿' : '保存当前并推荐下一步' }}
            </NButton>
          </div>

          <NSpin :show="loadingSchema">
            <SchemaForm v-if="activeSchema" v-model="activeModel" :schema="activeSchema" />
          </NSpin>
        </div>

        <div class="border border-gray-200 rounded-8px bg-white p-16px">
          <div class="mb-10px text-14px font-600">节点状态</div>
          <div class="flex flex-col gap-8px">
            <button
              v-for="node in visibleNodes"
              :key="node.id"
              class="w-full border border-gray-200 rounded-6px bg-white px-10px py-8px text-left text-13px"
              :class="{ 'border-#2080f0 bg-#eef5ff': node.id === activeNodeId }"
              type="button"
              @click="handleNodeClick(node.id)"
            >
              <span>{{ node.label }}</span>
              <span v-if="node.id === activeNodeId" class="ml-6px text-12px text-#2080f0">· 当前</span>
              <NTag
                class="float-right"
                size="small"
                :type="
                  deriveNodeStatus(node, ctx) === 'completed'
                    ? 'success'
                    : deriveNodeStatus(node, ctx) === 'in_progress'
                      ? 'info'
                      : deriveNodeStatus(node, ctx) === 'error'
                        ? 'error'
                        : 'default'
                "
              >
                {{ STATUS_LABEL[deriveNodeStatus(node, ctx)] }}
              </NTag>
            </button>
          </div>
        </div>
      </div>
    </div>
  </NSpin>
</template>
