# P1-05 合并 MktActivity 与 MktCampaignDraft 为单源 MktCampaign

**owner**: 待指派 / 后端 + admin-web
**status**: draft（待评审 → 待实施）
**last_verified**: 2026-05-15（仅取证，未执行任何代码改动）
**related**: [[P1-06-merge-play-strategy-handler]]、[[P1-07-scene-templates]]、[[P2-13-eligibility-share-commission-chain]]

---

> **跨文档硬约束**：本设计涉及金额字段（含 `PolicyEvaluator.effect.discountValue`）全链路遵循 [[P0-00-money-precision]]；`discountValue` 在 `policyJson` 内以 string 持久化，运行时 `new Decimal(...)`。幂等键格式遵循 [[P2-14-idempotency-key-convention]]。

## 1. 目标与范围

### 1.1 目标

当前营销活动的"实体源"裂成两条不该并存的轨道：

- **MktActivity**（3 JSON 列：triggerCondition / rules / rewards），通过 `IActivityHandler` 在运行时执行；unique 约束 `[tenantId, type]`，意味着**一个租户一种 type 只能存在 1 个活动**。
- **MktCampaignDraft**（6 JSON 列：foundation / audience / rights / stages / delivery / constraints）+ `MktCampaignRelease` 快照 + `MktCampaignDraftEntitlementPool` 权益池绑定，自带 DRAFT/APPROVED/PUBLISHED/PAUSED/ARCHIVED 生命周期。

两条轨道现状：

| 链路       | 写入入口                                         | 数据落点                                                             | 运行时消费                                                |
| ---------- | ------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------- |
| Admin 草稿 | `campaign-shell` / `campaign-admin` controller   | `MktCampaignDraft`，可指向 `MktCampaign Release`、`sourceActivityId` | 没有 handler 直接消费                                     |
| Admin 直写 | `activity.controller`、`activity-center.service` | `MktActivity`                                                        | `IActivityHandler` 实现（NEWCOMER / DISTRIBUTION_GROWTH） |
| 运行时裁决 | `resolution.service`、`scene.service` 等         | 读 `MktActivity`（通过 `activity.repository`）                       | 取走 type/rules/rewards 走 handler 链路                   |

落差：

1. Admin 改 Draft 不自动写 MktActivity；改 MktActivity 不自动写 Draft；两条轨道的"活动事实"长期对不齐。`MktCampaignDraft.sourceActivityId` 是字符串字段，没有 FK，孤儿是常态。
2. `[tenantId, type]` unique 让"同一租户多个 FULL_REDUCTION 活动并行"在 MktActivity 上不可表达，运营被迫把多个活动塞进同一 type 的 rules.json 数组，把 admin form 推向"超大 JSON 表单"。
3. 5 类前端暴露的 type 没有 `IActivityHandler` 也没有 `@PlayStrategy`：`FIRST_ORDER` / `FULL_REDUCTION` / `MEMBER_DAY` / `PROMOTION_PRICE` / `BIRTHDAY` —— 这些活动本质是"满足条件就按规则直降/送券"，没有特殊状态机，却被迫挂在 MktActivity 上等一个永远不会出现的 handler，跑出来发现"活动配了不生效"。
4. `MktActivityPriorityRule`、`MktResolutionAudit`、`scene.service` 的 type 硬编码（`scene.service.ts:384`、`resolution.service.ts:574` 等）形成 type 字符串散落，没有受 schema 约束。

本设计要解决：

- 把 MktActivity 的能力（type / 条件 / 规则 / 奖励）并入 MktCampaign（Draft 改名）一处。
- 删除 `[tenantId, type]` 的硬唯一约束：允许同 type 多活动并存。
- 5 类纯配置 type 改为声明式 Policy（不要 handler）；运行时由通用 Policy Evaluator 解释 `policyJson`。
- 保留 NEWCOMER_EXCLUSIVE / DISTRIBUTION_GROWTH 这两个有真业务逻辑的 type 走 handler 路径，**但 handler 接口在 [[P1-06]] 中与 PlayStrategy 合并为统一 `play_definition` 表 + 单一 dispatch 入口**，本设计只保证数据底座干净。

### 1.2 范围

- ✅ 重命名 / 调整 schema：`MktCampaignDraft` → `MktCampaign`；废弃 `MktActivity` 表（写迁移 + 保留为只读视图过渡）。
- ✅ MktCampaign 增加 `kind`（`POLICY` / `HANDLER`）+ `policyJson`（声明式 policy 表达）。
- ✅ 删除 `[tenantId, type]` unique；新约束基于 `[tenantId, type, id]` 自然唯一。
- ✅ `IActivityHandler` 接口签名改为 `evaluate(campaign: MktCampaign, ctx)` —— 不再读 MktActivity 类型；具体实现重定向到 `MktCampaign.rights/audience/...`。
- ✅ 新建 `PolicyEvaluator` 服务，覆盖 5 种纯 policy type：FIRST_ORDER / FULL_REDUCTION / MEMBER_DAY / PROMOTION_PRICE / BIRTHDAY。
- ✅ Admin-web 活动 CRUD 收敛到 `campaign-shell`，废弃 `activity.controller`。
- ✅ 数据迁移：把现有 MktActivity 行迁入 MktCampaign（status=PUBLISHED + 自动生成 release no=1）。
- ❌ 不动 `PlayStrategy` 系（COURSE_GROUP_BUY / FLASH_SALE / MEMBER_UPGRADE）—— 那是 [[P1-06]] 的范围。
- ❌ 不重做权益池 / 触点模型（`MktEntitlementPool` / `MktActivityTouchpoint` 保留，只是 owner 改为 MktCampaign）。
- ❌ 不实现新的活动 type；本设计只调底座，type 增加由后续 PRD 驱动。

### 1.3 DoD（Definition of Done）

1. Prisma 中 `MktActivity` 模型移除（保留 `mkt_activity` 表 8 周作回滚池），新模型 `MktCampaign` 上线。
2. `IActivityHandler.checkEligibility/grantRewards/getPrice` 三个方法的入参类型从 `MktActivity` 改为 `MktCampaign`；NewcomerHandler / DistributionGrowthHandler 改完编译通过。
3. 5 种 policy-only type 由 `PolicyEvaluator.apply(campaign, ctx)` 接管；handler.registry 注册 1 个 `PolicyEvaluatorAdapter` 而不是 5 个空壳 handler。
4. `[tenantId, type]` unique 约束删除；新增 `[tenantId, id]` + `[tenantId, type, status, startTime, endTime]` 用作运营查询。
5. 数据迁移脚本 `migrate-mkt-activity-to-campaign.ts` 标准 prisma migration + 自定义 SQL 两步走，可重复执行（幂等）。
6. `activity.controller` 删除；admin-web 的活动 CRUD 改走 `campaign-shell` controller；契约 generate-types 同步。
7. 集成测试覆盖：创建 FULL_REDUCTION campaign → resolution.service 取得；NEWCOMER_EXCLUSIVE campaign → handler 触发。

---

## 2. 现状取证

### 2.1 两张表的字段对比

| 概念        | `MktActivity`                                   | `MktCampaignDraft`                                                       |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| 基础        | id / tenantId / type / name / description       | id / tenantId / type / name / description                                |
| 时间        | startTime / endTime                             | foundationJson.startTime / endTime                                       |
| 条件        | triggerCondition (Json)                         | audienceJson (Json)                                                      |
| 规则        | rules (Json)                                    | rightsJson + stagesJson + constraintsJson                                |
| 奖励 / 触点 | rewards (Json) + `MktActivityTouchpoint` 关联表 | deliveryJson.touchpoints + `MktCampaignDraftEntitlementPool` 关联表      |
| 状态        | isEnabled bool                                  | status enum（DRAFT/PENDING_APPROVAL/APPROVED/PUBLISHED/PAUSED/ARCHIVED） |
| 优先级      | priority Int                                    | （在 foundationJson 内表达）                                             |
| 审批        | 无                                              | 有（status 流转）                                                        |
| 发布历史    | 无                                              | `MktCampaignRelease`                                                     |
| 权益池      | 无                                              | `MktCampaignDraftEntitlementPool`                                        |
| 唯一性      | `[tenantId, type]` —— 同 type 仅 1 个           | `[tenantId, sourceActivityId]` —— 与某个 MktActivity 一一对应            |

### 2.2 跨表关联现状

`MktCampaignDraft.sourceActivityId`（`80-marketing.prisma:1131`）：

```prisma
sourceActivityId String?                @map("source_activity_id")
@@unique([tenantId, sourceActivityId])
```

**没有 FK** —— 这是孤儿桥接列，理论上指向 `MktActivity.id`，但 schema 不保证。`campaign-admin.service.ts:503` 还在用 `row.sourceActivityId ?? row.id` 兜底，证明 owner 自己也不确定它是不是非空。

### 2.3 IActivityHandler 注册现状

```
apps/backend/src/module/marketing/activity/handlers/
├── activity-handler.interface.ts   ← 接口定义
├── handler.registry.ts             ← @ActivityHandler 装饰器收集
├── newcomer.handler.ts             ← NEWCOMER_EXCLUSIVE
└── distribution-growth.handler.ts  ← DISTRIBUTION_GROWTH
```

实际接入 IActivityHandler 的只有 2 类。前端 admin form 暴露的 11 种 type 中，剩下 9 种依赖：

- 3 种走 `@PlayStrategy`（在 `play/` 目录）：COURSE_GROUP_BUY / FLASH_SALE / MEMBER_UPGRADE
- 1 种走 Newcomer 当通用模板：NEWCOMER_EXCLUSIVE
- 1 种走 DistributionGrowth：DISTRIBUTION_GROWTH
- **5 种没有任何后端运行时**：FIRST_ORDER / FULL_REDUCTION / MEMBER_DAY / PROMOTION_PRICE / BIRTHDAY → 后端写了 type，但没有 handler 也没有 strategy 消费

### 2.4 type 字符串散落

```ts
// apps/backend/src/module/marketing/scene/scene.service.ts:384
type: 'NEWCOMER_EXCLUSIVE',

// apps/backend/src/module/marketing/resolution/resolution.service.ts:574
type: 'NEWCOMER_EXCLUSIVE',
```

```ts
// apps/backend/src/module/marketing/campaign-shell/campaign-shell.service.spec.ts:11
type: 'FLASH_SALE',
```

11 种 type 在 backend / admin-web / 前端 spec 字符串中散落，没有 enum 也没有 const 文件统一。

### 2.5 admin 入口当前并行

```ts
// 当前 admin 端两条入口同时存在：
apps / backend / src / module / marketing / activity / activity.controller.ts; // 直写 MktActivity
apps / backend / src / module / marketing / campaign - shell / campaign - admin.controller.ts; // 走 MktCampaignDraft
apps / backend / src / module / marketing / campaign - shell / campaign - shell.controller.ts; // 草稿生命周期
```

admin-web 是哪条入口？看页面调用即可（**实施期 grep `apps/admin-web/src` 上 controller 路径**，TODO-1）。

---

## 3. 设计方案

### 3.1 目标 schema

```prisma
// 重命名 + 扩展：MktCampaignDraft → MktCampaign

enum MktCampaignKind {
  POLICY    // 声明式策略，由 PolicyEvaluator 解释 policyJson，零 handler
  HANDLER   // 需要 server-side handler（注入触发条件、奖励发放、价格覆盖）
}

enum MktCampaignStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  PUBLISHED
  PAUSED
  ARCHIVED
}

model MktCampaign {
  id              String              @id @default(cuid())
  tenantId        String              @map("tenant_id") @db.VarChar(20)

  // 类型与归属
  type            String              @db.VarChar(50)           // FIRST_ORDER / NEWCOMER_EXCLUSIVE / ...
  kind            MktCampaignKind     @default(POLICY)          // ↑ 新增

  // 元数据
  name            String              @db.VarChar(120)
  description     String?             @db.VarChar(500)

  // 时间（提到顶层，方便索引和运营列表）
  startTime       DateTime?           @map("start_time")
  endTime         DateTime?           @map("end_time")
  priority        Int                 @default(0)

  // 配置 JSON：兼容现有六列（旧 Draft 的 foundation/audience/rights/stages/delivery/constraints）
  foundationJson  Json?               @map("foundation_json")
  audienceJson    Json?               @map("audience_json")
  rightsJson      Json?               @map("rights_json")
  stagesJson      Json?               @map("stages_json")
  deliveryJson    Json?               @map("delivery_json")
  constraintsJson Json?               @map("constraints_json")

  // POLICY 类活动新增的统一字段，HANDLER 类可忽略
  policyJson      Json?               @map("policy_json")       // ↑ 新增

  // 状态机
  status          MktCampaignStatus   @default(DRAFT)
  version         Int                 @default(1)

  // 审计
  ownerUserId     String?             @map("owner_user_id") @db.VarChar(64)
  createdBy       String?             @map("created_by") @db.VarChar(64)
  updatedBy       String?             @map("updated_by") @db.VarChar(64)
  createTime      DateTime            @default(now()) @map("create_time")
  updateTime      DateTime            @updatedAt @map("update_time")

  releases         MktCampaignRelease[]
  entitlementPools MktCampaignEntitlementPool[]
  touchpoints      MktCampaignTouchpoint[]
  participations   MktCampaignParticipation[]

  // 不再有 [tenantId, type] 唯一约束 —— 允许并行
  @@index([tenantId, type, status])
  @@index([tenantId, status, startTime, endTime])
  @@map("mkt_campaign")
}

// MktCampaignRelease 不变（仅外键改名）
model MktCampaignRelease {
  // ... 同现状
  campaign MktCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  campaignId String   @map("campaign_id")
  // ...
  @@map("mkt_campaign_release")
}

// 触点表与参与表迁入 MktCampaign（取代 MktActivityTouchpoint / MktActivityParticipation）
model MktCampaignTouchpoint { ... @@map("mkt_campaign_touchpoint") }
model MktCampaignParticipation { ... @@map("mkt_campaign_participation") }
model MktCampaignEntitlementPool { ... @@map("mkt_campaign_entitlement_pool") } // 原 MktCampaignDraftEntitlementPool 改名
```

**保留** `mkt_activity` 物理表 8 周（不在 schema 中保留模型，但保留表）作回滚池；新代码绝不读旧表。8 周后由独立 PR 真删（migration drop）。

### 3.2 PolicyEvaluator（5 种 POLICY type 统一解释）

POLICY 类活动的 `policyJson` schema：

```ts
interface CampaignPolicy {
  trigger: {
    // 触发条件
    isNewMember?: boolean; // FIRST_ORDER / NEWCOMER_EXCLUSIVE
    isFirstOrder?: boolean;
    birthdayWindowDays?: number; // BIRTHDAY
    memberDayOfMonth?: number; // MEMBER_DAY
    minOrderAmount?: number; // FULL_REDUCTION
  };
  effect: {
    // 奖励 / 价格覆盖
    discountType: 'AMOUNT' | 'PERCENT' | 'FIXED_PRICE';
    discountValue: number; // 抵扣金额 / 折扣率 / 固定价
    productScope?: 'ALL' | 'SKU_LIST' | 'CATEGORY_LIST';
    productTargets?: string[];
  };
  stacking: {
    // 叠加规则
    allowCoupon?: boolean;
    allowPoints?: boolean;
    allowOtherCampaign?: boolean;
  };
}
```

```ts
// apps/backend/src/module/marketing/campaign/policy-evaluator.service.ts
@Injectable()
export class PolicyEvaluatorService {
  /** 给定 campaign + 用户上下文，返回是否命中 + 奖励效果 */
  async evaluate(campaign: MktCampaign, ctx: PolicyContext): Promise<PolicyResult> {
    const policy = campaign.policyJson as CampaignPolicy | null;
    if (!policy) {
      return { eligible: false, reason: 'missing policy' };
    }

    // 1. 通用触发条件检查
    if (!(await this.matchTrigger(policy.trigger, ctx))) {
      return { eligible: false };
    }

    // 2. 计算 effect（价格覆盖 / 优惠抵扣）
    const effect = this.applyEffect(policy.effect, ctx);
    return { eligible: true, effect, stacking: policy.stacking };
  }

  // matchTrigger / applyEffect 都是纯函数，无外部副作用
}
```

类型 → 默认 policy 映射（admin form 创建时按 type 预填）：

| type              | 默认 trigger            | 默认 effect                    |
| ----------------- | ----------------------- | ------------------------------ |
| `FIRST_ORDER`     | `isFirstOrder: true`    | `AMOUNT` 减 X 元               |
| `FULL_REDUCTION`  | `minOrderAmount: M`     | `AMOUNT` 减 X 元               |
| `MEMBER_DAY`      | `memberDayOfMonth: D`   | `PERCENT` X 折                 |
| `PROMOTION_PRICE` | （无条件）              | `FIXED_PRICE` 直接定价         |
| `BIRTHDAY`        | `birthdayWindowDays: W` | `AMOUNT` 减 X 元（或固定送券） |

### 3.3 IActivityHandler 接口改造

```ts
// apps/backend/src/module/marketing/activity/handlers/activity-handler.interface.ts

export interface IActivityHandler {
  readonly type: string;
  /** 替代 checkEligibility：入参从 MktActivity 改为 MktCampaign */
  checkEligibility(campaign: MktCampaign, memberId: string): Promise<boolean>;
  grantRewards(campaign: MktCampaign, memberId: string): Promise<void>;
  getPrice?(campaign: MktCampaign, skuId: string, memberId: string): Promise<Decimal | null>;
  /** 校验对象从 triggerCondition/rules/rewards 改为 campaign 的 6 个 json 列（HANDLER kind） */
  validateConfig(
    campaign: Pick<
      MktCampaign,
      'foundationJson' | 'audienceJson' | 'rightsJson' | 'stagesJson' | 'deliveryJson' | 'constraintsJson'
    >,
  ): Promise<void>;
}
```

`NewcomerHandler` / `DistributionGrowthHandler` 各自从 `activity.rules` / `activity.triggerCondition` 读取的代码，改为从 `campaign.rightsJson` / `campaign.audienceJson` 读取（具体字段映射见 §5.2 数据迁移）。

POLICY 类活动**不实现** IActivityHandler；由统一的 `PolicyEvaluatorAdapter` 在 handler.registry 内代理 5 个 type：

```ts
@Injectable()
export class PolicyEvaluatorAdapter implements IActivityHandler {
  readonly type = '*POLICY*'; // sentinel；registry 看 campaign.kind===POLICY 时优先用 adapter
  constructor(private readonly evaluator: PolicyEvaluatorService) {}

  async checkEligibility(campaign: MktCampaign, memberId: string) {
    const result = await this.evaluator.evaluate(campaign, { memberId });
    return result.eligible;
  }
  async grantRewards(campaign: MktCampaign, memberId: string) {
    const result = await this.evaluator.evaluate(campaign, { memberId });
    if (result.effect?.discountType === 'AMOUNT' && result.effect.couponTemplateId) {
      // 发券走 coupon distribution module
    }
    // POLICY 类多数 effect 是"价格覆盖"，由 getPrice 处理
  }
  async getPrice(campaign: MktCampaign, skuId: string, memberId: string) {
    const result = await this.evaluator.evaluate(campaign, { memberId, skuId });
    return result.effect?.computedPrice ?? null;
  }
  async validateConfig(campaign) {
    /* policy 校验：policyJson schema 校验 */
  }
}
```

### 3.4 Handler dispatch 选择

```ts
// handler.registry.ts
resolve(campaign: MktCampaign): IActivityHandler {
  if (campaign.kind === MktCampaignKind.POLICY) {
    return this.policyAdapter;       // ← 5 种 type 全走这里
  }
  const handler = this.handlers.get(campaign.type);
  if (!handler) {
    throw new BusinessException(`No handler registered for campaign.type=${campaign.type}`);
  }
  return handler;
}
```

**同 type 多活动并行的 tie-break 顺序（resolution.service 选活动时必须 deterministic）**：

```sql
ORDER BY priority DESC, start_time DESC, id DESC
```

含义：

1. 优先级高的胜出（priority 越大越优先）；
2. 同优先级取**最近开始**的活动（startTime 越新越优先；适合"双 11 → 双 12 接力"运营场景）；
3. 同优先级 + 同 startTime（巧合，极少）取 id 字典序最大（cuid 时间序，事实上等价于"最后创建的"）。

resolution.service / candidateLoader / scene.service 等所有"按 type 加载候选活动并选一个"的位置统一遵守此排序；禁止隐式依赖 DB 自然顺序（如 `ORDER BY id ASC` 默认）。

`campaign.kind` 在 admin form 创建时按 type 自动决定：

| type                                                                   | kind                                     |
| ---------------------------------------------------------------------- | ---------------------------------------- |
| FIRST_ORDER / FULL_REDUCTION / MEMBER_DAY / PROMOTION_PRICE / BIRTHDAY | POLICY                                   |
| NEWCOMER_EXCLUSIVE / DISTRIBUTION_GROWTH                               | HANDLER                                  |
| COURSE_GROUP_BUY / FLASH_SALE / MEMBER_UPGRADE                         | HANDLER（[[P1-06]] 中并入统一 dispatch） |

### 3.5 Admin / 运行时入口收敛

| 入口                                                        | 处置                                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `activity.controller`                                       | **删除**。所有 CRUD 走 `campaign-shell`/`campaign-admin`。                             |
| `activity.service` / `activity-center.service`              | 收敛为 `campaign-shell.service` 的 readonly 视图层（保留只读 list/byId 给运行时使用）  |
| `activity.repository`                                       | **删除**。`findEnabledByType` 改为 `campaignRepository.findActivePublishedByType(...)` |
| `campaign-admin.controller`                                 | 保留，作为唯一 admin 入口                                                              |
| `campaign-shell.controller`                                 | 保留，作为草稿生命周期入口                                                             |
| `resolution.service` 内 `'NEWCOMER_EXCLUSIVE'` 硬编码字符串 | 提取到 `apps/backend/src/module/marketing/common/campaign-type.constants.ts`           |

### 3.6 Type 字符串收敛

```ts
// apps/backend/src/module/marketing/common/campaign-type.ts
export const CAMPAIGN_TYPE = {
  // POLICY
  FIRST_ORDER: 'FIRST_ORDER',
  FULL_REDUCTION: 'FULL_REDUCTION',
  MEMBER_DAY: 'MEMBER_DAY',
  PROMOTION_PRICE: 'PROMOTION_PRICE',
  BIRTHDAY: 'BIRTHDAY',
  // HANDLER
  NEWCOMER_EXCLUSIVE: 'NEWCOMER_EXCLUSIVE',
  DISTRIBUTION_GROWTH: 'DISTRIBUTION_GROWTH',
  COURSE_GROUP_BUY: 'COURSE_GROUP_BUY',
  FLASH_SALE: 'FLASH_SALE',
  MEMBER_UPGRADE: 'MEMBER_UPGRADE',
} as const;

export type CampaignType = (typeof CAMPAIGN_TYPE)[keyof typeof CAMPAIGN_TYPE];
export const POLICY_CAMPAIGN_TYPES = new Set<CampaignType>([
  CAMPAIGN_TYPE.FIRST_ORDER,
  CAMPAIGN_TYPE.FULL_REDUCTION,
  CAMPAIGN_TYPE.MEMBER_DAY,
  CAMPAIGN_TYPE.PROMOTION_PRICE,
  CAMPAIGN_TYPE.BIRTHDAY,
]);
```

放 `libs/common-constants` 是更彻底的方案（前后端共用），但 type 与 `play_definition`（P1-06）合并前先放后端；P1-06 实施时统一迁到 `libs/common-constants`。

---

## 4. 决策依据（trade-off）

### 4.1 Q1 单源选择：保 Campaign 还是保 Activity？

| 选项               | 优                                                   | 劣                                                                  | 选择 |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------------------- | ---- |
| **A. 保 Campaign** | 已有草稿生命周期 / 发布快照 / 权益池，运营功能更完整 | 需把 MktActivity 行迁过来；handler 改读 6 个 json 列                | ✅   |
| B. 保 Activity     | 字段简单（3 json 列），迁移成本低                    | 失去 release 快照、审批流；运营回不去 Draft 体验；admin form 要重写 |      |
| C. 完全重做新表    | 设计自由                                             | 用户已确认"保 Campaign"，且现实中草稿/发布是更大投入沉淀            |      |

### 4.2 Q2 POLICY vs HANDLER 边界

| 选项                                                 | 优                                                   | 劣                                                                              | 选择 |
| ---------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- | ---- |
| **A. 5 个 type 强制 POLICY，禁止其退化为 HANDLER**   | 边界清晰；admin form 配置极简；不写 5 个空壳 handler | 未来若发现 FULL_REDUCTION 需要复杂逻辑，要从 POLICY 升级到 HANDLER（migration） | ✅   |
| B. 5 个 type 都允许 HANDLER 覆盖                     | 灵活                                                 | 鼓励"每个 type 都写一个 handler" 反 pattern                                     |      |
| C. POLICY 与 HANDLER 共存：先跑 POLICY，再跑 HANDLER | 增加灵活度                                           | 调用顺序与结果合并语义复杂                                                      |      |

### 4.3 Q3 `[tenantId, type]` unique 删除

| 选项                                                                 | 优                                    | 劣                                                 | 选择 |
| -------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------- | ---- |
| **A. 完全删除，允许同 type 多活动**                                  | 与 admin Draft 已支持的多草稿语义一致 | resolution.service 在选活动时要按优先级/时间窗排序 | ✅   |
| B. 改为 `[tenantId, type, status]` unique（同时只能 1 个 PUBLISHED） | 强一致                                | 与运营"双 11/双 12 同 type 并行"诉求冲突           |      |
| C. 保留 unique                                                       | 当前行为不变                          | Draft 多草稿 + Activity 单条的矛盾延续             |      |

### 4.4 Q4 旧 MktActivity 表回滚保留期

| 选项                | 优                  | 劣                                    | 选择 |
| ------------------- | ------------------- | ------------------------------------- | ---- |
| **A. 8 周物理保留** | 出问题可以 SQL 回滚 | DB 体积略增（活动表通常很小，可忽略） | ✅   |
| B. 立即 drop        | 干净                | 一旦回滚需要重建表，DBA 操作面大      |      |
| C. 永久保留         | 最安全              | 长期数据债                            |      |

---

## 5. 迁移与回滚

### 5.1 部署顺序

1. **D1**：合并 schema 变更（新 `MktCampaign` 系列 + 保留旧 `MktActivity`），新代码读旧表 = false；migration 1。
2. **D2**：合并数据迁移脚本（`migrate-mkt-activity-to-campaign.ts`）；先 staging 跑一次；行数对账。
3. **D3**：合并 `IActivityHandler` 改造 + `PolicyEvaluator` + handler.registry 升级；切流到 `MktCampaign` 读路径。
4. **D4**：合并 admin-web `campaign-shell` 收敛 + `activity.controller` 删除。
5. **D5**：8 周后单独 PR 真 drop `mkt_activity` 表（migration 2）。

### 5.2 数据迁移

迁移规则（一对一映射）：

| 旧 MktActivity 字段                  | 新 MktCampaign 字段                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| id                                   | id（保留，方便外部引用未失效）                                                    |
| tenantId / type / name / description | tenantId / type / name / description                                              |
| startTime / endTime                  | startTime / endTime（提到顶层）                                                   |
| isEnabled = true                     | status = PUBLISHED                                                                |
| isEnabled = false                    | status = PAUSED                                                                   |
| priority                             | priority                                                                          |
| triggerCondition                     | audienceJson                                                                      |
| rules                                | rightsJson                                                                        |
| rewards                              | deliveryJson                                                                      |
| —                                    | kind = `POLICY` if type ∈ {5 种}, else `HANDLER`                                  |
| —                                    | policyJson = 由 migration 脚本基于旧 `rules` 推断（POLICY 类型）；HANDLER 留 null |
| createdBy / createTime / ...         | 直拷                                                                              |

`MktCampaignDraft` 已有的行（admin 已经在用 Draft 路径创建的）：

- 直接 ALTER TABLE rename 到 `mkt_campaign`，字段名兼容；
- 把 `sourceActivityId` 列填回 `MktCampaign.id`（如果它指向的 MktActivity 行已被前一步迁移过来）；
- DROP COLUMN `sourceActivityId`（迁移完后无意义）。

```ts
// scripts/migrations/migrate-mkt-activity-to-campaign.ts（建议路径）
async function migrate() {
  await prisma.$transaction(async (tx) => {
    // 1. MktCampaignDraft → MktCampaign rename（在 prisma migrate 中通过 @@map 改名实现）
    // 2. MktActivity 行入 MktCampaign：
    const activities = await tx.mktActivity.findMany();
    for (const a of activities) {
      const existing = await tx.mktCampaign.findFirst({ where: { id: a.id } });
      if (existing) continue; // 幂等：脚本可重跑
      await tx.mktCampaign.create({
        data: {
          id: a.id,
          tenantId: a.tenantId,
          type: a.type,
          name: a.name,
          description: a.description,
          startTime: a.startTime,
          endTime: a.endTime,
          priority: a.priority,
          status: a.isEnabled ? 'PUBLISHED' : 'PAUSED',
          kind: POLICY_TYPES.has(a.type) ? 'POLICY' : 'HANDLER',
          audienceJson: a.triggerCondition,
          rightsJson: a.rules,
          deliveryJson: a.rewards,
          policyJson: POLICY_TYPES.has(a.type) ? inferPolicyFromRules(a.type, a.rules) : null,
          createdBy: a.createdBy,
          updatedBy: a.updatedBy,
          createTime: a.createTime,
          updateTime: a.updateTime,
        },
      });
    }
    // 3. 触点：MktActivityTouchpoint → MktCampaignTouchpoint（同字段，仅 FK 改名）
    // 4. 参与：MktActivityParticipation → MktCampaignParticipation
  });
}
```

`inferPolicyFromRules` 是为 5 种 POLICY type 写的"从旧 rules.json 反推 policyJson"的脏函数；admin 迁移后请把 policyJson 字段在 admin form 中允许手动覆盖，方便修正。

### 5.3 回滚

- D3 出问题：`git revert` 业务代码；数据保留双轨（旧 mkt_activity 表 + 新 mkt_campaign 表都有），新代码恢复到 MktActivity 读路径即可。
- D5 真 drop 后才不可回滚；D5 PR 单独评审。

### 5.4 admin-web 兼容

- `activity.controller` 删除一刻起，admin-web 旧的"活动列表/创建/编辑"页面 API 调用会 404；admin-web 必须在 D4 同 PR 内切换。
- 推荐 admin-web 一次性把 5 种 POLICY type 在新 form 中暴露"policyJson 可视化编辑器"（如 schema-form），避免运营被迫填裸 JSON。

---

## 6. 验证矩阵

| 层       | 用例                                                                                                                   | 工具                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------- | ---- |
| 静态     | `grep -r "prisma.mktActivity\b" apps/backend/src --include='\*.ts'                                                     | grep -v spec               | grep -v migrate` 命中 0 | `rg` |
| 静态     | `grep -r "activity.controller" apps/admin-web/src` 命中 0                                                              | `rg`                       |
| 静态     | type 字符串散落清零：`grep -r "'NEWCOMER_EXCLUSIVE'" apps/backend/src` 仅命中 `campaign-type.ts` 常量定义              | `rg`                       |
| Spec     | PolicyEvaluator：5 种 type 的 trigger × effect 矩阵；boundary（minOrderAmount=0、负数）                                | `policy-evaluator.spec.ts` |
| Spec     | handler.registry.resolve：POLICY → PolicyEvaluatorAdapter；HANDLER → 对应 handler；type 未注册抛 BusinessException     | 同上                       |
| Spec     | NewcomerHandler / DistributionGrowthHandler 改读 campaign.rightsJson 通过                                              | `newcomer.handler.spec.ts` |
| 数据迁移 | migrate 脚本对账：`COUNT(mkt_activity)` == `COUNT(mkt_campaign WHERE id IN (...))`；POLICY 行 `policyJson IS NOT NULL` | DBA 查询                   |
| 集成     | E2E：admin 创建 FULL_REDUCTION campaign（POLICY）→ resolution.service 取得 → checkout 下单触发 effect                  | supertest                  |
| 集成     | E2E：admin 创建 NEWCOMER_EXCLUSIVE campaign（HANDLER）→ checkout 验证 handler.checkEligibility 调用                    | supertest                  |
| 集成     | 同 type 多活动并行：FULL_REDUCTION ×2 同时 PUBLISHED → resolution 按 priority 选最高                                   | supertest                  |
| 回滚演练 | staging 模拟 D3 回滚：恢复 activity.controller、回写 mkt_activity 行无丢失                                             | 手动                       |

---

## 7. 风险与未决问题

### 7.1 留给实施者的 TODO

1. **TODO-1**：grep `apps/admin-web/src` 找出当前实际调用的是 `activity.controller` 还是 `campaign-admin.controller`。结果决定 §5.4 的迁移工作量。
2. **TODO-2**：`inferPolicyFromRules` 的反推质量。如果运营在旧 `rules.json` 里塞了非标准字段（如 `"自定义文案"`），反推会失败 / 失真。**实施期应先在 staging 跑一次 dry-run，把"无法反推"的行列清单交给运营手动补 policyJson**。
3. **TODO-3**：`MktCampaign.priority` 是否应该 normalize 到 `[0, 100]`？当前 MktActivity.priority 是任意 Int，可能有负数 / 大数。建议 migration 中 `Math.max(0, Math.min(100, priority))` 收敛。
4. **TODO-4**：是否暴露 `policyJson` 给 admin form？如果暴露，需要 schema-form 组件（admin-web 端工作量约 2 人日，本设计**不强制**，先用 JSON 文本框过渡）。

### 7.2 已知风险

| 风险                                                              | 等级 | 缓解                                                                                                     |
| ----------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------- |
| `inferPolicyFromRules` 推不出来的活动                             | 中   | dry-run 出清单；上线前运营手动覆盖；POLICY 类未填则 `evaluate` 返回 `eligible:false`，不会误发           |
| `mkt_activity` 在 8 周内被外部脚本误删 / 误更新                   | 低   | 加 PG 触发器：`ALTER TABLE mkt_activity DISABLE TRIGGER ALL`（实施期决定，本设计不强求）                 |
| handler 改读 campaign 字段后语义微差                              | 中   | Spec 覆盖 NewcomerHandler / DistributionGrowthHandler 关键 path；线上对账"活动触发次数曲线"              |
| 同 type 多活动并行后的优先级冲突                                  | 中   | resolution.service 必须实现 priority DESC + startTime DESC 兜底；本设计在 §3.4 未细化，由 [[P1-06]] 完善 |
| admin-web form 字段从 3 json 列变 6 json 列 + policyJson 学习成本 | 低   | 短期保留旧 form 文本编辑；运营培训文档（不本 PR 做）                                                     |

### 7.3 不在本设计范围

- 营销活动审批流（PENDING_APPROVAL → APPROVED）的具体审批逻辑：现有 status 流转保留，本设计不重新设计审批权限模型。
- `MktEntitlementPool` / `MktCampaignTouchpoint` 的字段重构：保留现有结构，只跟随 owner 改名。
- 与 `play_definition` 的合并：[[P1-06]] 处理；本设计在 schema 上不预留 `play_definition` 字段，等 [[P1-06]] PR 内再增加。

---

## 8. 实施清单

### 8.1 backend

- [ ] `apps/backend/prisma/models/80-marketing.prisma`：
  - 新增 `MktCampaign` / `MktCampaignKind` / `MktCampaignTouchpoint` / `MktCampaignParticipation` / `MktCampaignEntitlementPool`；
  - 移除 `MktActivity` / `MktActivityTouchpoint` / `MktActivityParticipation` / `MktCampaignDraft` / `MktCampaignDraftEntitlementPool` 模型；
  - 标准 `pnpm prisma:migrate --name rename_campaign_unify_activity`；
  - 二次 migration（同 PR）：写 SQL 把 `mkt_campaign_draft` 表 rename 到 `mkt_campaign`，外键级联 rename。
- [ ] `scripts/migrations/migrate-mkt-activity-to-campaign.ts`：迁移脚本（幂等可重跑）；放 `apps/backend/scripts/migrations/`。
- [ ] `apps/backend/src/module/marketing/common/campaign-type.ts`：常量收敛。
- [ ] `apps/backend/src/module/marketing/campaign/policy-evaluator.service.ts`：新增 `PolicyEvaluatorService`。
- [ ] `apps/backend/src/module/marketing/activity/handlers/policy-evaluator.adapter.ts`：新增 `PolicyEvaluatorAdapter`。
- [ ] `apps/backend/src/module/marketing/activity/handlers/activity-handler.interface.ts`：入参 `MktActivity` → `MktCampaign`。
- [ ] `apps/backend/src/module/marketing/activity/handlers/newcomer.handler.ts`：改读 `campaign.audienceJson / rightsJson / deliveryJson`。
- [ ] `apps/backend/src/module/marketing/activity/handlers/distribution-growth.handler.ts`：同上。
- [ ] `apps/backend/src/module/marketing/activity/handlers/handler.registry.ts`：`resolve(campaign)` 新逻辑（POLICY → adapter，HANDLER → registry.get(type)）。
- [ ] `apps/backend/src/module/marketing/activity/activity.repository.ts`：**删除**；新增 `apps/backend/src/module/marketing/campaign-shell/campaign.repository.ts` 内 `findActivePublishedByType` 方法。
- [ ] `apps/backend/src/module/marketing/activity/activity.service.ts` / `activity.controller.ts` / `activity-center.service.ts`：**删除**。
- [ ] `apps/backend/src/module/marketing/resolution/resolution.service.ts:574` / `scene/scene.service.ts:384`：硬编码 `'NEWCOMER_EXCLUSIVE'` 改用 `CAMPAIGN_TYPE.NEWCOMER_EXCLUSIVE`。
- [ ] `apps/backend/src/module/marketing/campaign-shell/campaign-admin.service.ts:503` 的 `row.sourceActivityId ?? row.id` 兜底逻辑删除（迁移后字段不存在）。
- [ ] 删 `apps/backend/src/module/marketing/activity/__tests__/`，spec 改写到 `campaign-shell` 下。

### 8.2 契约同步

- [ ] `pnpm build:backend && pnpm generate-types`
- [ ] admin-web：删除调用 `/marketing/activity/*` 旧接口的所有页面 / API；统一改 `/marketing/campaign/*`。
- [ ] admin-web：新增"POLICY 编辑器"占位（最小可用：JSON 文本框，TODO-4）。

### 8.3 验证

- [ ] `pnpm typecheck:backend && pnpm lint:backend`
- [ ] `pnpm test:backend -- campaign`
- [ ] `pnpm test:backend -- activity-handler`
- [ ] `pnpm test:backend -- policy-evaluator`
- [ ] `pnpm test:backend -- resolution`
- [ ] `pnpm check:slice`
- [ ] `pnpm verify:admin-view-types`（admin-web views 改了表格列）
- [ ] PR 前：`pnpm verify-monorepo; pnpm verify:scripts; pnpm lint; pnpm typecheck; pnpm test`

### 8.4 PR 标题

`refactor(backend): 合并 MktActivity 与 MktCampaignDraft 为单源 MktCampaign，5 种 type 转 POLICY`
