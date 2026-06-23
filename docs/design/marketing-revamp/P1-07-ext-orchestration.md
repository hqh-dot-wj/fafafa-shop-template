# P1-07-ext 营销流程编排：6 条工作流 fork-join 图 + 动态表单 + Vue Flow

**owner**: 待指派 / admin-web + 后端
**status**: draft（待评审 → 待实施）
**last_verified**: 2026-05-15
**related**: [[P1-05-merge-activity-campaign]]、[[P1-06-merge-play-strategy-handler]]、[[P1-07-scene-templates]]

---

> **跨文档硬约束**：本设计涉及金额字段全链路遵循 [[P0-00-money-precision]]；动态表单内金额输入控件以 string 形式持久化到 `policyJson` 等 schema JSON 列。幂等键格式遵循 [[P2-14-idempotency-key-convention]]。

## 1. 目标与范围

### 1.1 目标

为 admin-web 营销管理引入统一的"工作流编排可视化 + 动态表单"机制，解决：

- 现有 `CampaignWizardRail`（垂直 NSteps）和 `SceneWorkflowGuide`（折叠文字 hint）不是真流程图——没有节点状态、没有连线高亮、没有"下一步推荐"，运营仍要靠经验记顺序。
- 营销管理有 **6 条独立配置流**（Campaign / Scene / Play / Coupon / Points / Entitlement Pool），但每条流的"中段分支动作"不一样（按 type / template / play 切分），现状要么揉成一个 wizard（campaigns/new 把 10 种 type 强塞同一份 7 步），要么没有 wizard（Play 实例化散落 store admin）。
- 每新增一种 campaign type / play code，admin form 都要写新代码——没有"运营改 schema、前端零代码"的红利，与后端已 schema-driven 的设计错位（`mkt_play_template.ruleSchema` / `PlayDefinition.ruleSchema` / `MktCampaign.policyJson` / `MktSceneTemplateModule.uiConfig` 已是 schema-aware）。

修复方式：

- **每条工作流一张 fork-join 流程图**：共同前缀 + 中段分支（按 type/template） + 共同后缀；用 **Vue Flow** 渲染节点和连线，只读模式（不可拖拽、不可连线编辑）。
- **节点表单 schema-driven**：点击节点 → 抽屉打开 → 加载该节点对应 schema → 动态表单渲染。schema 来源对齐 backend metadata。
- **状态机驱动节点视觉**：未开始 / 进行中 / 已完成 / 有错四态；完成则出边高亮 + 下一节点变 in_progress；"下一步推荐"按状态机算出。

### 1.2 范围

- ✅ 定义 6 条工作流的节点/边/分支/状态机元数据。
- ✅ Vue Flow 封装规范：只读模式、自定义节点组件、自动布局（dagre / ELK horizontal）。
- ✅ 动态表单组件 `SchemaForm`（基于 Naive UI 自研，JSON Schema 子集）+ 自定义 widget 注册表。
- ✅ schema 来源：后端 metadata 字段 + 必要的 fallback 常量。
- ✅ 实施路径：先 Campaign 流跑通，再复制 Scene / Play / Coupon / Points / Pool。
- ❌ 不替换现有 `CampaignWizardRail`（先做新组件，老组件并存；老路由保留为高级模式）。
- ❌ 不实现 schema 编辑器（运营改 schema 仍是开发 PR，[[P1-06]] 的"仅开发可改 PlayDefinition"原则保留）。
- ❌ 不动后端 schema 字段语义（只消费，不重塑）。

### 1.3 DoD

1. `apps/admin-web/src/components/orchestration/` 目录下含 Vue Flow 封装 + 节点组件 + 状态机；只读模式默认开启，节点数 ≤30 时性能无明显延迟。
2. `apps/admin-web/src/components/schema-form/` 目录下含 JSON Schema 渲染器 + ≥6 个自定义 widget（ProductPicker / StorePicker / TimeRangePicker / TimeBoxPicker / ScheduleEditor / MemberFilterEditor / CouponPicker / ActivityPoolPicker）。
3. Campaign 创建工作流接入新组件；老路由 `marketing/campaigns/new` 保留为"高级模式"入口，新路由 `marketing/campaigns/wizard` 为默认入口。
4. 节点状态机覆盖 4 态 + 边高亮 + "下一步推荐"角标。
5. 6 条工作流元数据写到 `apps/admin-web/src/views/marketing/_orchestration/workflows/` 下；增加新工作流只需新增一份 ts 元数据文件，不动 Vue Flow 封装。

---

## 2. 现状取证

### 2.1 现有 wizard 实现

| 文件                                                       | 类型           | 形态                               |
| ---------------------------------------------------------- | -------------- | ---------------------------------- |
| `marketing/campaigns/new/modules/campaign-wizard-rail.vue` | NSteps 垂直    | 文字步骤条；无节点状态；无分支     |
| `marketing/scene/modules/scene-workflow-guide.vue`         | NCollapse 折叠 | 文字 hint + "去策略配置"等跳转按钮 |
| 其它 5 条流                                                | 无 wizard      | 单页表单 / 多 tab drawer           |

### 2.2 后端已就绪的 schema 字段

| 来源表                                                                             | 字段                       | 用于哪条流的哪段                          |
| ---------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------- |
| `MktCampaign.policyJson` ([[P1-05]])                                               | Json                       | Campaign 流 POLICY 分支中段表单           |
| `PlayDefinition.handlerClassName` ([[P1-06]])                                      | string + 代码侧 ruleSchema | Campaign 流 HANDLER-重 分支 + Play 流中段 |
| `mkt_play_template.ruleSchema`                                                     | Json                       | Play 流中段；前端动态表单消费             |
| `MktSceneTemplate.placementConfig` + `MktSceneTemplateModule.uiConfig` ([[P1-07]]) | Json                       | Scene 流中段                              |
| `mkt_coupon_template` 字段                                                         | 表结构本身                 | Coupon 流（schema 由 backend DTO 推导）   |

### 2.3 现有 Naive UI 体系

- 全仓 admin-web 用 Naive UI 组件；表单组件 `NForm` / `NFormItem` 已熟稔
- 节点图无既有库；Vue Flow 未引入

---

## 3. 设计方案

### 3.1 工作流元数据模型

```ts
// apps/admin-web/src/views/marketing/_orchestration/types.ts

export type NodeStatus = 'idle' | 'in_progress' | 'completed' | 'error';

export interface OrchestrationNode {
  id: string;
  label: string;
  /** 当前所属分支组；同 branchGroup 内的节点同一时刻只能激活一条 */
  branchGroup?: string;
  /** 节点关联的 schema 来源（用于动态表单） */
  schema?: NodeSchemaRef;
  /** 节点是否必填；false 则可跳过 */
  required: boolean;
  /** 显示徽标的辅助信息 */
  hint?: string;
}

export interface OrchestrationEdge {
  from: string;
  to: string;
  /** 当该边的 from 节点完成时高亮；目标节点变 in_progress */
  highlightOnComplete: boolean;
}

export interface OrchestrationBranchRule {
  /** 分支的判定来源节点（通常是工作流第一个节点） */
  decidedBy: string;
  /** 根据该节点表单某字段的值，决定走哪个 branchGroup */
  field: string;
  /** value → branchGroup 映射 */
  routes: Record<string, string>;
}

export interface OrchestrationWorkflow {
  code: string; // 'CAMPAIGN_CREATE' | 'SCENE_BUILD' | ...
  name: string;
  nodes: OrchestrationNode[];
  edges: OrchestrationEdge[];
  branchRules: OrchestrationBranchRule[];
  /** 入口节点 id */
  entryNode: string;
  /** 终点节点 id */
  exitNode: string;
}

export interface NodeSchemaRef {
  /** schema 解析方式 */
  source: 'static' | 'campaign-policy' | 'play-rule' | 'scene-template' | 'coupon-dto';
  /** 静态 schema 内联或资源 key */
  schemaId?: string;
  /** 运行时取 schema 的依赖（如 campaign.type、scene.templateCode） */
  contextRef?: string;
}
```

### 3.2 6 条工作流的节点定义

#### A. Campaign 创建（CAMPAIGN_CREATE）

```ts
export const CAMPAIGN_CREATE_WORKFLOW: OrchestrationWorkflow = {
  code: 'CAMPAIGN_CREATE',
  name: '创建营销活动',
  entryNode: 'select-type',
  exitNode: 'publish',
  nodes: [
    // 共同前缀
    {
      id: 'select-type',
      label: '选择活动类型',
      required: true,
      schema: { source: 'static', schemaId: 'campaign-type-select' },
    },
    {
      id: 'basic-info',
      label: '基础信息',
      required: true,
      schema: { source: 'static', schemaId: 'campaign-basic-info' },
    },

    // 中段分支：POLICY
    {
      id: 'policy-config',
      label: '配置策略（trigger + effect）',
      branchGroup: 'POLICY',
      required: true,
      schema: { source: 'campaign-policy', contextRef: 'campaign.type' },
    },

    // 中段分支：HANDLER-轻
    {
      id: 'handler-light-audience',
      label: '配置目标人群',
      branchGroup: 'HANDLER_LIGHT',
      required: true,
      schema: { source: 'static', schemaId: 'audience-form' },
    },
    {
      id: 'handler-light-rewards',
      label: '配置奖励',
      branchGroup: 'HANDLER_LIGHT',
      required: true,
      schema: { source: 'static', schemaId: 'rewards-form' },
    },

    // 中段分支：HANDLER-重（拼班/秒杀/会员升级）
    {
      id: 'handler-heavy-rules',
      label: '配置玩法规则',
      branchGroup: 'HANDLER_HEAVY',
      required: true,
      schema: { source: 'play-rule', contextRef: 'campaign.type' },
    },

    // 共同后缀
    {
      id: 'link-products',
      label: '关联商品/门店',
      required: true,
      schema: { source: 'static', schemaId: 'product-store-link' },
    },
    { id: 'precheck', label: '预检', required: true, schema: { source: 'static', schemaId: 'precheck-summary' } },
    { id: 'publish', label: '预览与发布', required: true, schema: { source: 'static', schemaId: 'publish-confirm' } },
  ],
  edges: [
    { from: 'select-type', to: 'basic-info', highlightOnComplete: true },

    // 分叉
    { from: 'basic-info', to: 'policy-config', highlightOnComplete: true },
    { from: 'basic-info', to: 'handler-light-audience', highlightOnComplete: true },
    { from: 'basic-info', to: 'handler-heavy-rules', highlightOnComplete: true },

    // HANDLER_LIGHT 内部串
    { from: 'handler-light-audience', to: 'handler-light-rewards', highlightOnComplete: true },

    // 汇聚
    { from: 'policy-config', to: 'link-products', highlightOnComplete: true },
    { from: 'handler-light-rewards', to: 'link-products', highlightOnComplete: true },
    { from: 'handler-heavy-rules', to: 'link-products', highlightOnComplete: true },

    { from: 'link-products', to: 'precheck', highlightOnComplete: true },
    { from: 'precheck', to: 'publish', highlightOnComplete: true },
  ],
  branchRules: [
    {
      decidedBy: 'select-type',
      field: 'type',
      routes: {
        // POLICY 类
        FIRST_ORDER: 'POLICY',
        FULL_REDUCTION: 'POLICY',
        MEMBER_DAY: 'POLICY',
        PROMOTION_PRICE: 'POLICY',
        BIRTHDAY: 'POLICY',
        // HANDLER 轻
        NEWCOMER_EXCLUSIVE: 'HANDLER_LIGHT',
        DISTRIBUTION_GROWTH: 'HANDLER_LIGHT',
        // HANDLER 重
        COURSE_GROUP_BUY: 'HANDLER_HEAVY',
        FLASH_SALE: 'HANDLER_HEAVY',
        MEMBER_UPGRADE: 'HANDLER_HEAVY',
      },
    },
  ],
};
```

#### B. Scene 搭建（SCENE_BUILD）

入口节点 `select-template` → 基础信息 → **5 路分支**（HOMEPAGE_FEED / NEW_CUSTOMER_ZONE / MEMBER_DAY_BANNER / FLASH_SALE_TIMEBOX / DISTRIBUTION_LANDING），各 2 个节点；汇聚到 `touchpoint` → `preview` → `publish`。

中段每条分支的两个节点示例（FLASH_SALE_TIMEBOX）：

```ts
{ id: 'flash-time-box-config', label: '配置时间盒',
  branchGroup: 'FLASH_SALE_TIMEBOX', required: true,
  schema: { source: 'scene-template', contextRef: 'scene.templateCode' } },
{ id: 'flash-pool-select', label: '选秒杀活动池',
  branchGroup: 'FLASH_SALE_TIMEBOX', required: true,
  schema: { source: 'static', schemaId: 'activity-pool-picker' } },
```

注意中段是"**选**"活动池而非"配秒杀玩法"（参见此前评审）。

#### C. Play 运行实例（PLAY_INSTANCE）

入口 `select-play` → 选商品 SKU → 3 路分支（拼班 / 秒杀 / 会员升级），每路 1-2 个节点；汇聚到 `preview` → `online`。

```ts
// 拼班分支
{ id: 'course-group-schedule', label: '配排课/地址/截止时间',
  branchGroup: 'COURSE_GROUP_BUY',
  schema: { source: 'play-rule', contextRef: 'play.code' } },
{ id: 'course-group-virtual-fill', label: '配虚拟补位策略',
  branchGroup: 'COURSE_GROUP_BUY', required: false,
  schema: { source: 'static', schemaId: 'virtual-fill-form' } },
```

#### D. Coupon Template 创建（COUPON_CREATE）

入口 `coupon-basic` → 配限制 → **3 路分支**（MANUAL_CLAIM / ACTIVITY_GRANT / SIGNIN_GRANT），各 1 个节点 → 汇聚预览 / 发布。

#### E. Points 规则配置（POINTS_RULES）

**无分支**的线性 6 节点：基础信息 → 获取规则 → 抵扣规则 → 过期策略 → 预览 → 发布。

#### F. Entitlement Pool 权益池（ENTITLEMENT_POOL）

入口 `select-pool-type` → **3 路分支**（PRODUCT / COUPON / POINTS），各 1 个配置节点 → 编译 → 关联 campaign → 发布。

### 3.3 状态机

```ts
type NodeStatusContext = {
  workflow: OrchestrationWorkflow;
  formData: Record<string, unknown>; // 各节点表单值
  validations: Record<string, ValidationResult>;
};

function deriveNodeStatus(node: OrchestrationNode, ctx: NodeStatusContext): NodeStatus {
  const inActiveBranch = isNodeInActiveBranch(node, ctx);
  if (!inActiveBranch) return 'idle'; // 灰色

  const v = ctx.validations[node.id];
  if (v?.errors?.length) return 'error';
  if (v?.completed) return 'completed';
  if (isReachable(node, ctx)) return 'in_progress';
  return 'idle';
}

function isNodeInActiveBranch(node, ctx) {
  if (!node.branchGroup) return true; // 共同前后缀
  const rule = ctx.workflow.branchRules[0]; // 简化：单 rule
  const decidingValue = ctx.formData[rule.decidedBy]?.[rule.field];
  return rule.routes[decidingValue as string] === node.branchGroup;
}

function isReachable(node, ctx) {
  const incoming = ctx.workflow.edges.filter((e) => e.to === node.id);
  return incoming.some((e) => ctx.validations[e.from]?.completed);
}
```

**边高亮**：边的 `from.status === 'completed'` 时，边变 `animated=true, style.stroke='#18a058'`（Naive UI 主色）；否则 `style.stroke='#d9d9d9'` 静态。

**下一步推荐**：

```ts
function nextRecommended(ctx): OrchestrationNode | null {
  // 1. 优先 error 节点
  const errored = ctx.workflow.nodes.find((n) => deriveNodeStatus(n, ctx) === 'error');
  if (errored) return errored;
  // 2. 其次 in_progress
  const inProgress = ctx.workflow.nodes.find((n) => deriveNodeStatus(n, ctx) === 'in_progress');
  if (inProgress) return inProgress;
  // 3. 都完成时推荐 publish
  return ctx.workflow.nodes.find((n) => n.id === ctx.workflow.exitNode) ?? null;
}
```

页面顶部固定一行"下一步推荐：[配置玩法规则] →"，点击直跳对应节点。

### 3.4 动态表单 schema 来源与自定义 widget

#### 3.4.1 schema 解析

```ts
// apps/admin-web/src/components/schema-form/schema-resolver.ts

export async function resolveNodeSchema(
  ref: NodeSchemaRef,
  ctx: { workflowData: Record<string, unknown> },
): Promise<JSONSchema7> {
  switch (ref.source) {
    case 'static':
      return STATIC_SCHEMAS[ref.schemaId!];
    case 'campaign-policy': {
      const type = readContextRef(ctx, ref.contextRef!); // e.g. 'FIRST_ORDER'
      return await fetchCampaignPolicySchema(type); // 后端 endpoint：GET /marketing/schema/policy/:type
    }
    case 'play-rule': {
      const code = readContextRef(ctx, ref.contextRef!);
      return await fetchPlayRuleSchema(code); // GET /marketing/schema/play/:code
    }
    case 'scene-template': {
      const templateCode = readContextRef(ctx, ref.contextRef!);
      return await fetchSceneTemplateSchema(templateCode); // GET /marketing/schema/scene-template/:code
    }
    case 'coupon-dto':
      return STATIC_SCHEMAS['coupon-base-form'];
    default:
      throw new Error(`Unknown schema source: ${ref.source}`);
  }
}
```

后端 3 个新增 endpoint（轻量，仅返回 schema JSON）：

```
GET /marketing/schema/policy/:type      → 返回 5 种 POLICY 类的 JSON Schema
GET /marketing/schema/play/:code        → 返回拼班/秒杀/会员升级的 ruleSchema
GET /marketing/schema/scene-template/:templateCode → 返回模板模块的 schema
```

schema 内容存于 backend 代码常量或对应表（`mkt_play_template.ruleSchema` 已就绪；POLICY schema 写代码常量，10 KB 内）。

#### 3.4.2 SchemaForm 组件

```vue
<!-- apps/admin-web/src/components/schema-form/SchemaForm.vue -->
<template>
  <NForm :model="model" :rules="formRules" label-placement="top">
    <SchemaField
      v-for="(fieldSchema, key) in propertiesMap"
      :key="key"
      :field-key="key"
      :schema="fieldSchema"
      :value="model[key]"
      @update:value="updateField(key, $event)"
    />
  </NForm>
</template>
```

`SchemaField` 按 schema.type / schema['ui:widget'] 派发到具体控件：

| schema                                            | widget         |
| ------------------------------------------------- | -------------- |
| `{ type: 'string' }`                              | `NInput`       |
| `{ type: 'number' }`                              | `NInputNumber` |
| `{ type: 'boolean' }`                             | `NSwitch`      |
| `{ type: 'string', enum: [...] }`                 | `NSelect`      |
| `{ type: 'string', 'ui:widget': 'datetime' }`     | `NDatePicker`  |
| `{ type: 'array', 'ui:widget': 'ProductPicker' }` | 自定义控件     |

#### 3.4.3 自定义 widget 注册表

```ts
// apps/admin-web/src/components/schema-form/widget-registry.ts
import ProductPicker from './widgets/ProductPicker.vue';
import StorePicker from './widgets/StorePicker.vue';
import TimeRangePicker from './widgets/TimeRangePicker.vue';
import TimeBoxPicker from './widgets/TimeBoxPicker.vue';
import ScheduleEditor from './widgets/ScheduleEditor.vue';
import MemberFilterEditor from './widgets/MemberFilterEditor.vue';
import CouponPicker from './widgets/CouponPicker.vue';
import ActivityPoolPicker from './widgets/ActivityPoolPicker.vue';

export const WIDGET_REGISTRY = {
  ProductPicker,
  StorePicker,
  TimeRangePicker,
  TimeBoxPicker,
  ScheduleEditor,
  MemberFilterEditor,
  CouponPicker,
  ActivityPoolPicker,
} as const;
```

每个 widget 接受统一 props：`{ schema, value, ctx, onUpdate }`，便于后续扩展。

### 3.5 Vue Flow 封装规范

#### 3.5.1 依赖与初始化

```jsonc
// package.json
{
  "dependencies": {
    "@vue-flow/core": "^1.41.0",
    "@vue-flow/controls": "^1.1.0", // 可选：放大缩小控件
    "dagre": "^0.8.5", // 自动布局
  },
}
```

#### 3.5.2 OrchestrationFlow 组件

```vue
<!-- apps/admin-web/src/components/orchestration/OrchestrationFlow.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { VueFlow } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
import WorkflowNode from './WorkflowNode.vue';
import { layoutDagre } from './layout-dagre';
import type { OrchestrationWorkflow, NodeStatusContext } from '@/views/marketing/_orchestration/types';

const props = defineProps<{
  workflow: OrchestrationWorkflow;
  ctx: NodeStatusContext;
}>();
const emit = defineEmits<{ (e: 'nodeClick', nodeId: string): void }>();

const nodeTypes = { workflow: WorkflowNode };

const { nodes, edges } = computed(() => layoutDagre(props.workflow, props.ctx)).value;
</script>

<template>
  <VueFlow
    :nodes="nodes"
    :edges="edges"
    :node-types="nodeTypes"
    :nodes-draggable="false"
    :nodes-connectable="false"
    :edges-updatable="false"
    :pan-on-drag="false"
    :zoom-on-double-click="false"
    fit-view-on-init
    @node-click="(e) => emit('nodeClick', e.node.id)"
  />
</template>
```

关键配置：所有"编辑性"交互全关，只保留 hover + click。

#### 3.5.3 WorkflowNode 自定义节点

```vue
<template>
  <div class="orchestration-node" :class="[`is-${data.status}`, data.recommended ? 'is-recommended' : '']">
    <div class="node-status-icon">
      <NIcon v-if="data.status === 'completed'"><CheckCircle /></NIcon>
      <NSpinner v-else-if="data.status === 'in_progress'" size="14" />
      <NIcon v-else-if="data.status === 'error'"><AlertTriangle /></NIcon>
      <span v-else class="placeholder">○</span>
    </div>
    <div class="node-label">{{ data.label }}</div>
    <div v-if="data.hint" class="node-hint">{{ data.hint }}</div>
    <NBadge v-if="data.recommended" type="info" dot processing class="recommend-badge" />
  </div>
</template>

<style scoped>
.orchestration-node {
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid #d9d9d9;
  background: #fafafa;
  min-width: 140px;
  cursor: pointer;
  transition: all 0.2s;
}
.is-completed {
  border-color: #18a058;
  background: #e6f4ea;
}
.is-in_progress {
  border-color: #2080f0;
  background: #e6f0ff;
}
.is-error {
  border-color: #d03050;
  background: #fff0f0;
}
.is-recommended {
  box-shadow: 0 0 0 2px rgba(32, 128, 240, 0.3);
}
</style>
```

#### 3.5.4 layout-dagre

```ts
import dagre from 'dagre';

export function layoutDagre(workflow: OrchestrationWorkflow, ctx: NodeStatusContext) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120 }); // 横向布局
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of workflow.nodes) {
    g.setNode(node.id, { width: 180, height: 60 });
  }
  for (const edge of workflow.edges) {
    g.setEdge(edge.from, edge.to);
  }
  dagre.layout(g);

  const recommendedId = nextRecommended(ctx)?.id;

  const nodes = workflow.nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: 'workflow',
      position: { x: pos.x, y: pos.y },
      data: {
        label: n.label,
        hint: n.hint,
        status: deriveNodeStatus(n, ctx),
        recommended: n.id === recommendedId,
      },
    };
  });

  const edges = workflow.edges.map((e) => {
    const fromStatus = deriveNodeStatus(workflow.nodes.find((n) => n.id === e.from)!, ctx);
    const highlight = e.highlightOnComplete && fromStatus === 'completed';
    return {
      id: `${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      animated: highlight,
      style: { stroke: highlight ? '#18a058' : '#d9d9d9', strokeWidth: highlight ? 2 : 1 },
    };
  });

  return { nodes, edges };
}
```

### 3.6 页面布局

```
┌────────────────────────────────────────────────────────────────────┐
│  [面包屑: 营销 > 创建活动]                                          │
│  下一步推荐：[配置策略] →           [保存草稿] [预检] [取消]         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   [OrchestrationFlow 横向流程图 ~ 200-300px 高]                    │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│  当前节点：配置策略                                                  │
│  [SchemaForm 渲染 policyJson 表单]                                  │
│                                                                    │
│  [上一节点]  [保存当前]  [下一节点]                                  │
└────────────────────────────────────────────────────────────────────┘
```

可选：节点点击改抽屉打开（详见 §4 Q3）。

---

## 4. 决策依据

### 4.1 Q1 Vue Flow vs 自研 SVG vs vueuse-flow

| 选项                  | 优                                                      | 劣                          | 选择 |
| --------------------- | ------------------------------------------------------- | --------------------------- | ---- |
| **A. @vue-flow/core** | 活跃维护；自定义节点/边；自动布局插件；只读模式开箱即用 | 引入 ~100KB 体积            | ✅   |
| B. 自研 SVG           | 0 依赖                                                  | 状态管理 / 布局算法都要重写 |      |
| C. AntV X6            | 强                                                      | 体积大；学习曲线高          |      |

### 4.2 Q2 表单库选型

| 选项                        | 优                                       | 劣                                    | 选择 |
| --------------------------- | ---------------------------------------- | ------------------------------------- | ---- |
| **A. 自研 Naive UI 适配层** | 复用现有组件；自定义 widget 简单；体积小 | 写一次基础设施（~200 行）             | ✅   |
| B. form-render              | 阿里活跃                                 | Naive UI 适配差，要写 antd→naive 转换 |      |
| C. vue-json-schema-form     | 配置简单                                 | 维护一般；自定义控件接口弱            |      |

### 4.3 Q3 节点表单展示：内嵌 vs 抽屉 vs 跳转

| 选项                             | 优                             | 劣               | 选择 |
| -------------------------------- | ------------------------------ | ---------------- | ---- |
| **A. 同页面下方内嵌 SchemaForm** | 上下文一致；编辑期间能看流程图 | 长表单时滚动多   | ✅   |
| B. 节点抽屉                      | 强 focus                       | 不能边看流程边填 |      |
| C. 节点跳到独立路由              | 单独 URL                       | 流程图位置丢失   |      |

### 4.4 Q4 schema 来源：后端 endpoint vs 前端常量

| 选项                                                                           | 优                                                                    | 劣                           | 选择 |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------- | ---- |
| **A. 后端 endpoint 返回（POLICY / play-rule / scene-template）+ 静态常量兜底** | schema 与 backend metadata 强一致；运营改 PlayDefinition 后前端零代码 | 加 3 个 endpoint             | ✅   |
| B. 全部前端常量                                                                | 简单                                                                  | backend 改 schema 时前端滞后 |      |
| C. 全部后端 endpoint                                                           | 一致性最强                                                            | 静态/简单表单也走网络        |      |

### 4.5 Q5 实施粒度

| 选项                                      | 优       | 劣     | 选择 |
| ----------------------------------------- | -------- | ------ | ---- |
| **A. Campaign 流先跑通 PoC，再复制 5 条** | 风险隔离 | 6 PR   | ✅   |
| B. 6 条一并上线                           | 一次性   | 风险大 |      |

---

## 5. 迁移与回滚

### 5.1 部署顺序

1. **D1**：引入 Vue Flow + dagre 依赖；落 `OrchestrationFlow` / `WorkflowNode` / `SchemaForm` / `widget-registry` 4 个组件 + storybook 验证。
2. **D2**：后端补 3 个 schema endpoint（policy / play-rule / scene-template）。
3. **D3**：Campaign 流接入新组件，新路由 `marketing/campaigns/wizard` 默认入口；老路由 `marketing/campaigns/new` 保留作高级模式（仅修复，不增功能）。
4. **D4**：Scene 流接入；老 `SceneWorkflowGuide` 移除。
5. **D5**：Play 流接入（store admin + admin-web 端）。
6. **D6**：Coupon / Points / Pool 接入。

### 5.2 回滚

D3-D6 每条流单独可 revert。新组件本身保留无副作用。

---

## 6. 验证矩阵

| 层   | 用例                                                              | 工具            |
| ---- | ----------------------------------------------------------------- | --------------- |
| 静态 | `nodes-draggable=false` 在所有 VueFlow 调用点 grep 100% 命中      | rg              |
| Spec | deriveNodeStatus 4 态 × 各种 ctx 组合                             | vitest          |
| Spec | isNodeInActiveBranch：选 POLICY type → HANDLER 分支节点全 idle    | vitest          |
| Spec | nextRecommended：error > in_progress > publish                    | vitest          |
| Spec | resolveNodeSchema：source=campaign-policy → fetch 后端 endpoint   | vitest mock     |
| 视觉 | storybook 4 态节点 + 高亮边 + 推荐徽标                            | storybook       |
| E2E  | 创建 FIRST_ORDER campaign：流程图 POLICY 分支节点亮起；其它分支灰 | playwright      |
| E2E  | 创建 COURSE_GROUP_BUY campaign：HANDLER_HEAVY 分支亮              | playwright      |
| 性能 | 30 节点流程图首次渲染 < 200ms                                     | chrome devtools |

---

## 7. 风险与未决

### 7.1 留给实施者的 TODO

1. **TODO-1**：Vue Flow 在 Naive UI dark theme 下的颜色变量；建议 storybook 上 dark / light 各跑一遍。
2. **TODO-2**：dagre 横向布局在分叉数 > 5 时高度可能撑爆视口；准备一个 `:fit-view-padding="0.2"` + 横向滚动兜底。
3. **TODO-3**：`fetchPlayRuleSchema` 后端实现：若 `mkt_play_template.ruleSchema` 为空，是否回 404 还是返回空对象？建议返回空对象 + `error: 'schema not configured'`，前端展示"该玩法尚未配置 schema，请联系开发"。
4. **TODO-4**：自定义 widget（ProductPicker 等）若已在 admin-web 其他页面存在，应抽到 `apps/admin-web/src/components/widget/` 共享，**不要在 schema-form 目录里 fork 一份**。grep 现有 ProductPicker 实现。
5. **TODO-5**：Campaign 流上线后，老 `CampaignWizardRail` 折叠成 "高级模式" 隐藏入口，观察 1 个 release 周期后再决定是否删。

### 7.2 已知风险

| 风险                                                   | 等级 | 缓解                                                                                               |
| ------------------------------------------------------ | ---- | -------------------------------------------------------------------------------------------------- |
| 节点表单 schema 与 backend `validateConfig` 校验不一致 | 中   | schema endpoint 与 backend handler 共用同一 schema 文件（[[P1-06]] PlayDefinition.handler 内导出） |
| 自定义 widget 重复实现                                 | 中   | TODO-4 强制 grep 复用                                                                              |
| 长表单滚动体验差（内嵌方案）                           | 低   | schema 设计上拆分多 step，单 step 表单 ≤ 10 字段                                                   |
| Vue Flow 升级 break                                    | 低   | 锁定 minor 版本；自定义节点接口稳定                                                                |
| `nodes-draggable=false` 漏配漏关                       | 低   | 静态检查 + e2e 验证                                                                                |
| schema endpoint 性能                                   | 低   | schema JSON 极小（< 5 KB），加 etag 304 即可                                                       |

### 7.3 不在本设计范围

- 后端 schema 版本管理（schema 改了之后旧草稿的兼容）：留 P2 阶段单独设计。
- 运营自助编辑 schema 的可视化 schema 编辑器：[[P1-06]] 已决"仅开发可改"，本设计沿用。
- 多人协同编辑同一份 draft：留产品 PRD。

---

## 8. 实施清单

### 8.1 admin-web

- [ ] `package.json`：加 `@vue-flow/core` / `dagre` 依赖。
- [ ] `src/components/orchestration/OrchestrationFlow.vue` 新增。
- [ ] `src/components/orchestration/WorkflowNode.vue` 新增。
- [ ] `src/components/orchestration/layout-dagre.ts` 新增。
- [ ] `src/components/orchestration/state-machine.ts` 新增（deriveNodeStatus / isNodeInActiveBranch / isReachable / nextRecommended）。
- [ ] `src/components/schema-form/SchemaForm.vue` 新增。
- [ ] `src/components/schema-form/SchemaField.vue` 新增（按 type 派发）。
- [ ] `src/components/schema-form/schema-resolver.ts` 新增。
- [ ] `src/components/schema-form/widget-registry.ts` 新增 + 8 个 widget 占位。
- [ ] `src/views/marketing/_orchestration/types.ts` 新增。
- [ ] `src/views/marketing/_orchestration/workflows/campaign-create.ts` 新增（A 的完整定义）。
- [ ] `src/views/marketing/_orchestration/workflows/scene-build.ts` 新增。
- [ ] `src/views/marketing/_orchestration/workflows/play-instance.ts` 新增。
- [ ] `src/views/marketing/_orchestration/workflows/coupon-create.ts` 新增。
- [ ] `src/views/marketing/_orchestration/workflows/points-rules.ts` 新增。
- [ ] `src/views/marketing/_orchestration/workflows/entitlement-pool.ts` 新增。
- [ ] `src/views/marketing/campaigns/wizard/index.vue` 新路由（Campaign 流）。
- [ ] `src/router/routes` 注册 wizard 路由。
- [ ] storybook：4 态节点 + 推荐徽标 + 高亮边。
- [ ] 单测：state-machine 4 函数。

### 8.2 backend

- [ ] `apps/backend/src/module/marketing/schema/schema.controller.ts` 新增 3 个 endpoint：
  - `GET /marketing/schema/policy/:type`
  - `GET /marketing/schema/play/:code`
  - `GET /marketing/schema/scene-template/:templateCode`
- [ ] schema 内容来源：
  - POLICY：写在 `apps/backend/src/module/marketing/schema/policy-schemas.ts` 常量
  - Play：`PlayDefinition.handlerClassName` 对应类导出 `static schema = {...}`，schema controller 调 `PlayDispatcher.resolveSchema(code)` 取
  - Scene template：`MktSceneTemplate.placementConfig` 内含 schema 子字段，或单独 `schema` 列（按需 schema 变更）

### 8.3 验证

- [ ] `pnpm typecheck:admin && pnpm lint:admin && pnpm typecheck:backend`
- [ ] `pnpm test:admin -- orchestration`
- [ ] `pnpm test:admin -- schema-form`
- [ ] `pnpm test:backend -- schema.controller`
- [ ] `pnpm verify:admin-view-types`
- [ ] PR 前完整 verify。

### 8.4 PR 分批

- PR1：Vue Flow + SchemaForm 组件骨架 + Campaign 流元数据（不接入路由，storybook 验证）
- PR2：后端 3 个 schema endpoint
- PR3：Campaign 流接入 wizard 路由，灰度
- PR4-8：Scene / Play / Coupon / Points / Pool 各自接入

### 8.5 PR 标题

PR1: `feat(admin-web): 引入 Vue Flow 工作流编排组件 + JSON Schema 动态表单`
PR2: `feat(backend): 新增 marketing schema endpoint（policy / play-rule / scene-template）`
PR3: `feat(admin-web): Campaign 创建流接入 orchestration wizard`
