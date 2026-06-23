# P1-09 拆分 course-group.service（lifecycle / member / virtual-fill / refund）

**owner**: 待指派 / 后端
**status**: draft
**last_verified**: 2026-05-15
**related**: [[P1-06-merge-play-strategy-handler]]、[[P0-02-order-outbox]]、[[P1-08-clean-fake-events]]

---

> **跨文档硬约束**：本设计涉及金额字段（refund.service 退款金额、loadTeamFinancialSnapshot 等）全链路遵循 [[P0-00-money-precision]]。幂等键格式遵循 [[P2-14-idempotency-key-convention]]。

## 1. 目标与范围

### 1.1 目标

`apps/backend/src/module/marketing/course-group/course-group.service.ts` 单文件 1287 行，承担了课程拼班的几乎所有职责。同目录已经存在 6 个子服务（`team-projection / team-course-runtime / team-state / team-reconcile / virtual-fill / commission / failure-resolution`），但**主 service 仍然是 god service**：openTeam、listProductTeams、getTeamDetail、closeTeam、startClass、finishClass、resolveMemberFailure、markStoreTeamAttendance、addStoreTeamVirtualFill、buildTeamSummary、loadTeamFinancialSnapshot 等 40+ 公私方法挤在一个类。

修复方式：按"拼班课程的业务子领域"切 4 个服务，把主 service 降级为"门面 service"或彻底删除：

- **`CourseGroupLifecycleService`**：openTeam / closeTeam / startClass / finishClass / 状态机推进。
- **`CourseGroupMemberService`**：join 预览、成员列表、成员失败处置、考勤标记。
- **`CourseGroupVirtualFillService`**：复用现 `services/virtual-fill.service.ts`，把主 service 的 addStoreTeamVirtualFill / removeStoreTeamVirtualFill 迁过来。
- **`CourseGroupRefundService`**：失败成员退款、closed team 退款编排（与 [[P0-02]] outbox 的 refunded 路径对接）。

主 service **彻底删除**（决策见 §4 Q1）。controller 直接依赖 4 个 service；过渡期 `CourseGroupService` 作为 thin facade 兼容，但本设计目标是 0 facade。

### 1.2 范围

- ✅ 拆 4 个 service，每个 ≤ 400 行；私有工具方法（`readObject / readString / readNumber / decimalToNumber` 等）抽到 `course-group-util.ts`。
- ✅ controller 改依赖：`course-group-admin.controller` / `course-group-store.controller` / `course-group-client.controller` 各自重定向到对应 service。
- ✅ 删除 `course-group.service.ts`（不留 thin facade）。
- ✅ 单测拆分：从 `__tests__/course-group.service.spec.ts` 拆 4 个 spec 与 4 个 service 对应。
- ❌ 不重做业务逻辑（行为完全等价）。
- ❌ 不动 PlayInstance 状态机定义。
- ❌ 不动 `course-group.module.ts` 的对外 exports（外部消费方接口不变）。

### 1.3 DoD

1. `course-group.service.ts` 文件不再存在；新拆 4 个 service 文件总行数 ≤ 1300（含必要的 import）。
2. 3 个 controller 不再注入 `CourseGroupService`。
3. 行为等价：现有 `__tests__/course-group.service.spec.ts` 中所有用例迁到对应新 spec，全部通过。
4. course-group / course-group-buy 这条 [[P1-06]] handler 路径下，`onPaymentSuccess` / `onStatusChange` 不再调用 god service。

---

## 2. 现状取证

### 2.1 公开方法清单（按用途分组）

| 子领域       | 方法                                                                                                                                                                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lifecycle    | `openTeam` (168) / `closeTeam` (610) / `startClass` (629) / `finishClass` (633) / `getProductRuntime` (665)                                                                                                                                                                                           |
| Read         | `listProductTeams` (264) / `getTeamDetail` (301) / `getStoreTeamDetail` (309) / `getStoreTeamMembers` (320) / `getStoreTeamCourseSummary` (328) / `getStoreTeamSchedules` (339) / `getStoreTeamAttendances` (345) / `listStoreTeams` (582) / `getJoinPreview` (511) / `inspectClientTeamMember` (550) |
| Member       | `markStoreTeamAttendance` (357) / `resolveMemberFailure` (643)                                                                                                                                                                                                                                        |
| VirtualFill  | `addStoreTeamVirtualFill` (377) / `removeStoreTeamVirtualFill` (405)                                                                                                                                                                                                                                  |
| Builder/Util | `buildTeamRows` (753) / `buildTeamSummary` (809) / `buildMemberViews` (1014) / `buildTeamProjection` (1105) / 1100-1287 之间的 read\* 工具函数                                                                                                                                                        |

### 2.2 controller 现状

| controller                          | 注入                 | 调用面                                                                                                                                                        |
| ----------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `course-group-admin.controller.ts`  | `CourseGroupService` | listStoreTeams / closeTeam / startClass / finishClass / addStoreTeamVirtualFill / removeStoreTeamVirtualFill / markStoreTeamAttendance / resolveMemberFailure |
| `course-group-store.controller.ts`  | `CourseGroupService` | openTeam / 各种 storeTeam\* / getStoreTeamCourseSummary                                                                                                       |
| `course-group-client.controller.ts` | `CourseGroupService` | listProductTeams / getTeamDetail / getJoinPreview / inspectClientTeamMember / getProductRuntime                                                               |

### 2.3 子服务现状（已存在）

`services/team-projection.service.ts` (345) / `team-course-runtime.service.ts` (260) / `team-state.service.ts` (187) / `team-reconcile.service.ts` (110) / `virtual-fill.service.ts` (119) / `commission.service.ts` (52) / `failure-resolution.service.ts` (34) —— 主 service 大量调用这些子服务，证明子领域边界本就清晰，god service 是历史包袱。

---

## 3. 设计方案

### 3.1 新服务清单

#### `CourseGroupLifecycleService`（target ≤ 320 行）

```
方法迁入：
  openTeam
  closeTeam
  startClass / finishClass
  getProductRuntime
  simpleRuntimeAction（私有，迁入）
  updateTeamRuntimeState（私有，迁入）
  findCourseGroupConfigByProduct
  resolveOpenPermissions
  isStoreReady
  resolveTenantId

依赖：team-state / team-reconcile / team-projection / course-group-util
```

#### `CourseGroupMemberService`（target ≤ 320 行）

```
方法迁入：
  getJoinPreview
  inspectClientTeamMember
  markStoreTeamAttendance
  resolveMemberFailure
  getStoreTeamMembers
  getStoreTeamAttendances
  buildAttendanceMembers
  findTeamMembers
  buildMemberViews

依赖：member.repository / team.repository / failure-resolution.service / course-group-util
```

#### `CourseGroupVirtualFillService`（扩 services/virtual-fill.service.ts，target ≤ 280 行）

```
新增方法（从主 service 迁入）：
  addStoreTeamVirtualFill
  removeStoreTeamVirtualFill
现有方法保持。
```

#### `CourseGroupRefundService`（target ≤ 200 行）

```
方法（部分新建，部分从 commission/failure-resolution 抽）：
  refundMemberOnFailure(...)
  refundClosedTeam(...)
  并通过 [[P0-02]] outbox 的 refunded 路径写出 omsOrder 的 partial refund

依赖：integration.service（[[P0-02]] 改造后的 handleOrderRefunded）
```

#### `CourseGroupReadService`（target ≤ 280 行）

```
方法迁入：
  listProductTeams
  getTeamDetail / getStoreTeamDetail
  getStoreTeamCourseSummary
  getStoreTeamSchedules
  listStoreTeams
  buildTeamRows
  buildTeamSummary
  buildTeamProjection
  loadTeamFinancialSnapshot
  loadTeamRuntimeContext
  ensureStoreTeamExists
  getTeamDetailInternal

依赖：team.repository / team-projection.service / team-course-runtime.service / course-group-util
```

5 个 service 合计 ≤ 1400 行（含 import 头），覆盖原 1287 行的全部职责。

#### `course-group-util.ts`

把所有 `read*` / `to*` / `decimalToNumber` / `buildActivityContextKey` / `normalizeOperatorId` 等纯函数抽到独立文件作为 `export function`。

### 3.2 controller 改造

```ts
// course-group-admin.controller.ts
constructor(
  private readonly lifecycle: CourseGroupLifecycleService,
  private readonly member: CourseGroupMemberService,
  private readonly virtualFill: CourseGroupVirtualFillService,
  private readonly read: CourseGroupReadService,
) {}
```

各 controller 按职责拆调用面，**禁止跨 service 串行调多个**（如果发现需要，那应该是 lifecycle 内部协调，而非 controller）。

### 3.3 删 god service

`course-group.service.ts` 整文件删除。`CourseGroupService` provider 从 `course-group.module.ts` 移除；exports 调整为 5 个新 service。

外部消费方（如 [[P1-06]] 的 `CourseGroupBuyService` handler）改注入对应的细分 service。

### 3.4 测试拆分

```
__tests__/course-group.service.spec.ts → 删除
__tests__/course-group-lifecycle.service.spec.ts → 新增
__tests__/course-group-member.service.spec.ts → 新增
__tests__/course-group-virtual-fill.service.spec.ts → 扩展现有
__tests__/course-group-refund.service.spec.ts → 新增
__tests__/course-group-read.service.spec.ts → 新增
```

每个 spec 不重做集成测试，只覆盖各自 service 的关键路径。集成层（end-to-end）保留现有测试不动。

---

## 4. 决策依据

### 4.1 Q1 facade 保留 vs 彻底删

| 选项                    | 优                     | 劣                               | 选择 |
| ----------------------- | ---------------------- | -------------------------------- | ---- |
| **A. 彻底删主 service** | 一次性收口；调用方清晰 | 工作量大                         | ✅   |
| B. 保 thin facade       | 兼容期友好             | 永远拖延，god service 心智不消失 |      |

### 4.2 Q2 是否合并 lifecycle + member

| 选项                                  | 优                            | 劣                                             | 选择 |
| ------------------------------------- | ----------------------------- | ---------------------------------------------- | ---- |
| **A. 分开 5 个 service**              | 单 service 行数可控；边界清晰 | service 数多                                   | ✅   |
| B. 合 3 个（lifecycle + member 合一） | 文件少                        | lifecycle 与 member 关注点不同，再合就是新 god |      |

### 4.3 Q3 service 之间是否允许互调

| 选项                                                         | 优                       | 劣                       | 选择 |
| ------------------------------------------------------------ | ------------------------ | ------------------------ | ---- |
| **A. lifecycle 可调 virtualFill / refund；member/read 只读** | 编排逻辑集中在 lifecycle | lifecycle 仍是"调度中心" | ✅   |
| B. controller 编排                                           | service 之间 0 耦合      | controller 业务逻辑下沉  |      |

---

## 5. 迁移与回滚

### 5.1 部署顺序

1. **D1**：建 5 个 service 文件 + `course-group-util.ts`；逐个迁方法（保持主 service 仍存在，作为协调）。
2. **D2**：controller 改注入；删主 service。
3. **D3**：扫尾跑测试。

### 5.2 回滚

git revert PR；主 service 文件回归。子 service 改动可保留（不影响行为）。

---

## 6. 验证矩阵

| 层       | 用例                                                             | 工具            |
| -------- | ---------------------------------------------------------------- | --------------- | --- |
| 静态     | `grep -r "CourseGroupService" apps/backend/src --include='\*.ts' | grep -v spec` 0 | rg  |
| 静态     | 各新 service 文件 wc -l ≤ 400                                    | bash            |
| Spec     | 拆分后各 service 单测覆盖率 ≥ 拆分前主 service                   | jest --coverage |
| 集成     | 端到端：开团 → 加成员 → 虚拟补位 → 满员开课 → 考勤 → 结课        | supertest       |
| 集成     | 失败路径：人数不足 → resolveMemberFailure → refund               | supertest       |
| 行为对比 | git diff API 响应：拆分前后同请求同响应                          | snapshot tests  |

---

## 7. 风险与未决

### 7.1 TODO

1. **TODO-1**：`CourseGroupRefundService` 的退款路径是否完全走 [[P0-02]] outbox？当前 `failure-resolution.service.ts` 34 行的实现非常薄，可能直接调 `omsOrder.update` 改状态。实施期需对齐到 outbox 的 refunded 事件流。
2. **TODO-2**：`buildActivityContextKey` 私有方法（1266 行）在 [[P0-03]] 中被签名 token 取代，迁入 util 时直接调 `ActivityContextTokenService.issue`，不要硬编码 `${activityType}:${configId}`。
3. **TODO-3**：5 个新 service 注入 chain 在 NestJS DI 中是否会引入循环依赖？lifecycle ↔ refund ↔ member 之间需要图验证；如有，按 forwardRef 处理。

### 7.2 风险

| 风险                             | 等级 | 缓解                                                                 |
| -------------------------------- | ---- | -------------------------------------------------------------------- |
| 行为微差导致 e2e 失败            | 中   | snapshot tests 锁住响应结构                                          |
| 单测拆分遗漏用例                 | 中   | spec 拆分前先 dump 原 spec 的 describe/it 清单，对照新 spec 逐项划掉 |
| 字段读取工具方法散到 util 后误改 | 低   | util 加 spec 覆盖每个 read\* 函数                                    |

---

## 8. 实施清单

### 8.1 backend

- [ ] `course-group/services/lifecycle.service.ts` 新增
- [ ] `course-group/services/member.service.ts` 新增
- [ ] `course-group/services/virtual-fill.service.ts` 扩展（add/remove store fill 入）
- [ ] `course-group/services/refund.service.ts` 新增
- [ ] `course-group/services/read.service.ts` 新增
- [ ] `course-group/course-group-util.ts` 新增（read* / to* / decimalToNumber 等）
- [ ] `course-group/course-group.service.ts` 删除
- [ ] `course-group/course-group.module.ts` 调整 providers / exports
- [ ] 3 个 controller 改注入

### 8.2 验证

- [ ] `pnpm typecheck:backend && pnpm lint:backend`
- [ ] `pnpm test:backend -- course-group`
- [ ] `pnpm check:slice`
- [ ] PR 前完整 verify

### 8.3 PR 标题

`refactor(backend): 拆分 course-group.service 为 lifecycle/member/virtual-fill/refund/read 五服务`
