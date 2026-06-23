---
task_id: FAFAFA-PIVOT-PHASE2-2026-06
status: implemented
current_phase: 2.2
task_mode: refactor
path_type: cross-app
high_risk: true
created: 2026-06-23
last_updated: 2026-06-23
related_plan: c:/Users/13415/.cursor/plans/fafafa-template-pivot_72a80291.plan.md
prev_phase_plan: docs/exec-plans/active/FAFAFA-PIVOT-PHASE1-2026-06.md
phase_status:
  '2.0': done
  '2.1': implemented
  '2.2': implemented
---

# Exec Plan: FAFAFA-PIVOT-PHASE2-2026-06

父 plan（[`fafafa-template-pivot`](C:/Users/13415/.cursor/plans/fafafa-template-pivot_72a80291.plan.md)）的 **Phase 2「去多租户运行时」**。

Phase 1 已交付 fafafa 模板适配层（CI / Compose / Scripts / 品牌 seed），现在进入运行时清理：让 `BaseRepository` 不再依赖"超级租户跨租户查看"语义，让 `TenantGuard` 在缺少租户上下文时兜底注入 `000000`，**保留 `tenantId` 字段与 SysTenant 表**避免触动 200+ Prisma model。

## 1. 目标 / 非目标

**目标**

Phase 2.1（backend）：

- `apps/backend/src/common/tenant/tenant.guard.ts`：在 `TenantContext` 已 run 但 `tenantId` 缺失时兜底注入 `TenantContext.SUPER_TENANT_ID`（`000000`）；保留 `IgnoreTenant` 装饰器语义；保留默认 `return true` 放行
- `apps/backend/src/common/repository/base.repository.ts`：在 `getTenantWhere()` 中**移除"超级租户短路"分支**（`isSuper || ...` → 仅保留 `isIgnore || !tenantId`），让所有 Repository 调用统一走 `tenantId` 过滤；审计日志中关于 `isSuperTenant` 的 `isCrossTenant` 计算保留（语义独立，未来扩展或测试可继续读到）
- 同步更新 `apps/backend/src/common/repository/base.repository.spec.ts`：原"super tenant 不注入 tenantId"测试改为"super tenant 也走过滤"（与新语义一致）

Phase 2.2（admin-web）：

- 移除顶栏租户切换 UI：删除 `apps/admin-web/src/components/custom/tenant-select.vue` + 清理 `layouts/modules/global-header/index.vue` 中的 `<TenantSelect>` 与相关 `tenantId` ref / `useAuthStore` import
- 移除运行时切换 API：从 `apps/admin-web/src/service/api/system/tenant.ts` 移除 `fetchChangeTenant` / `fetchClearTenant`；同步删除 `tenant.spec.ts` 中对应两条断言
- 保留 `apps/admin-web/src/service/request/tenant.ts`（请求头 `tenant-id` 注入兜底工具）— backend `tenant.middleware.ts` 的 `strict_admin → 403` 仍在，admin-web 后台请求仍需注入

**非目标（本 Phase 不做，留待后续 Phase / 单独治理）**

- **不**改 `tenant.middleware.ts` 的 `strict_admin → 403` 分支（admin-web 后台路径仍会带 `tenant-id` 头，不影响现有流程；彻底放开 admin 路径未带头需求由后续 Phase 处理）
- **不**改 `tenant.extension.ts`、`tenant.helper.ts` 中的 `isSuperTenant` 短路（影响 Prisma 全局扩展行为，属同一治理范围但范围更广；本 Phase 不动避免一次性触面过大）
- **不**改业务代码（`module/finance/*`、`module/payment/*`、`module/store/*`、`module/marketing/*`、`module/admin/*` 中大量 `const isSuper = TenantContext.isSuperTenant()` 使用点不动；单租户兜底下 `isSuper` 始终返回 `true`，行为与现状等价 — 全表数据 `tenantId='000000'`）
- **不**删 `SysTenant` 表、`tenantId` 字段、`SysTenantAuditLog`、`/system/tenant/*` 后台接口；admin-web `views/system/tenant/**` 平台租户管理页保留（Phase 4 改造为「店铺设置」）
- **不**改 Prisma schema / migration / seed
- **不**改 `TenantContext.isSuperTenant()` / `SUPER_TENANT_ID` 静态方法（其他业务代码大量依赖）
- **不**改 admin-web 业务实体选择器（`components/business/tenant-select-modal.vue`、`views/store/worker/profile/modules/tenant-select.vue`、`views/marketing/resolution/simulator/index.vue` 等）— 属业务字段选择，与"顶栏租户切换"无关

## 2. 任务元数据

| 字段     | 值                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 任务模式 | `refactor`                                                                                                                   |
| 路径类型 | `cross-app`（backend tenant/repository + admin-web Grep 定位；仅 backend 改动）                                              |
| 高风险   | **是** — 触动多租户隔离边界（根 `AGENTS.md` §3 高风险流程）                                                                  |
| 必读     | 根 `AGENTS.md`、`apps/backend/AGENTS.md`、`.codex/playbooks/large-refactor.md`、`.codex/playbooks/co-evolution-checklist.md` |
| 上游     | [`FAFAFA-PIVOT-PHASE1-2026-06`](./FAFAFA-PIVOT-PHASE1-2026-06.md)（status=implemented）                                      |

## 3. Phase 列表

### Phase 2.0 — 只读扫描 [done]

- **范围**：`apps/backend/src/common/tenant/**`、`apps/backend/src/common/repository/**`、`apps/admin-web/src/**`（Grep 定位租户切换 UI）
- **DoD**：
  - [x] `TenantGuard` 现状逻辑摸清（仅设置 `IGNORE_TENANT_KEY` 标志；自动注入实际在 `TenantMiddleware`）
  - [x] `BaseRepository.getTenantWhere()` 三分支识别（`isSuper` / `isIgnore` / `!tenantId`）
  - [x] 业务代码 `TenantContext.isSuperTenant()` 使用面盘点（21 个文件，约 38 处使用点；本 Phase 不动）
  - [x] admin-web 租户切换 UI 入口定位（见 Phase 2.2 §3）
- **会话**：当前会话

### Phase 2.1 — backend 运行时单租户兜底 [done]

- **范围**：
  - `apps/backend/src/common/tenant/tenant.guard.ts`（改）
  - `apps/backend/src/common/repository/base.repository.ts`（改）
  - `apps/backend/src/common/repository/base.repository.spec.ts`（改：spec 同步 + 新增 IgnoreTenant 测试）
- **文件上限**：≤5（实际 3）
- **DoD**：
  - [x] `TenantGuard.canActivate` 在租户启用 + `TenantContext` 已 run 但 `tenantId` 为空时，兜底 `TenantContext.setTenantId(SUPER_TENANT_ID)`；保留 `IgnoreTenant` 装饰器；保留 `return true` 默认放行
  - [x] `BaseRepository.getTenantWhere()` 中 `if (isSuper || isIgnore || !tenantId)` → `if (isIgnore || !tenantId)`；移除 `const isSuper = ...` 局部变量
  - [x] 审计日志 `recordAuditLog` 中 `isSuperTenant` 与 `isCrossTenant` 计算保留（独立语义；与 BaseRepository 行为解耦）
  - [x] `base.repository.spec.ts`：原"findMany does not inject tenantId for super tenant"改为 "single-tenant fallback mode"；新增"skips tenantId injection when IgnoreTenant flag is set"
  - [x] `pnpm fix:changed` / `pnpm --filter @apps/backend typecheck` / `pnpm check:slice` 全 exit 0
- **会话**：本会话
- **风险与回退**：
  - 风险：单租户兜底下 `tenantId='000000'` 始终生效，与生产数据一致（全表 `tenantId='000000'`），行为等价；若历史数据存在非 `000000` 的脏数据，新行为会"看不见"它们 → 属于数据治理问题，不属于本改动回退点
  - 回退：单文件 git revert 即可恢复短路分支

### Phase 2.2 — admin-web 顶栏租户切换 UI 清理 [done]

- **范围**（实际交付 4 改 1 删）：
  - `apps/admin-web/src/layouts/modules/global-header/index.vue`（改：移除 `<TenantSelect>` + `tenantId` ref + `useAuthStore` import）
  - `apps/admin-web/src/components/custom/tenant-select.vue`（删：整文件）
  - `apps/admin-web/src/service/api/system/tenant.ts`（改：移除 `fetchChangeTenant`、`fetchClearTenant` 两个函数）
  - `apps/admin-web/src/service/api/system/tenant.spec.ts`（改：移除对应 2 个 vitest 断言）
- **文件上限**：≤5（实际 4 改 + 1 删 = 5 触达）
- **DoD**：
  - [x] 顶栏不再渲染租户下拉；登录后直接进入页面，不再有"我是 userId=1 才显示"的切换组件
  - [x] `fetchChangeTenant` / `fetchClearTenant` 全代码库无运行时引用（grep 验证仅余两条新加的说明注释）
  - [x] `fetchGetTenantList` / `fetchCreateTenant` 等平台租户管理 API 保留（`views/system/tenant/**` 仍可用，Phase 4 再改造为「店铺设置」页）
  - [x] `service/request/tenant.ts`（请求头注入兜底）保留不动 — backend `tenant.middleware.ts` 的 `strict_admin → 403` 未移除，admin-web 后台请求仍需带 `tenant-id` 头
  - [x] 不动业务实体选择器（`components/business/tenant-select-modal.vue`、`views/store/worker/profile/modules/tenant-select.vue`、`views/marketing/resolution/simulator/index.vue` 等）
  - [x] `pnpm fix:changed` / `pnpm --filter @apps/admin-web typecheck` / `pnpm verify:admin-view-types` / `pnpm check:slice` 全 exit 0
  - [x] `tenant.spec.ts` 7 tests 全绿（原 9 - 2 = 7）；admin-web vitest 总数从 511 → 509
- **会话**：与 Phase 2.1 同会话执行（累计 4 backend + 4 admin-web + 1 plan ≈ 9 文件触达，远低于 `large-refactor.md` 单对话 20 文件红线，且都属于父 plan 同一 Phase 2 治理范围）
- **风险与回退**：
  - 风险：若 admin-web 顶栏外仍有零散页面期待 `userId=1` 显示切换下拉（grep 未发现），可能漏改 → 已通过全仓 `<TenantSelect ` 与 `fetchChangeTenant`/`fetchClearTenant` grep 验证无运行时残留
  - 回退：单文件 git revert + 恢复 `tenant-select.vue`

#### 已识别但留待后续 Phase 处理的清单

| #   | 路径                                                                                                                                                                | 角色                               | 后续 Phase                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| A   | `apps/backend/src/common/tenant/tenant.middleware.ts` `strict_admin → 403`                                                                                          | admin 路径未带头返回 403           | 父 Phase 5 多模板能力时可考虑放开（admin-web 仍带头无影响） |
| B   | `apps/backend/src/common/tenant/tenant.extension.ts` / `tenant.helper.ts` 的 `isSuperTenant` 短路                                                                   | Prisma 全局扩展行为                | 同上；触面更广，需独立 Phase 评估                           |
| C   | 业务代码 21 文件 / 38 处 `TenantContext.isSuperTenant()` 使用点（`module/finance/*`、`module/payment/*`、`module/store/*`、`module/marketing/*`、`module/admin/*`） | "isSuper ? {} : { tenantId }" 旁路 | 单租户兜底下行为等价，不阻塞父 plan 推进                    |
| D   | `apps/admin-web/src/views/system/tenant/**` 平台租户管理页                                                                                                          | 后台 CRUD 页（保留）               | 父 Phase 4 改造为「店铺设置」页                             |
| E   | `apps/admin-web/src/service/api/auth.ts` 的 `fetchTenantList()`（登录页 + 营销 / pms / finance 仍引用）                                                             | 登录前/品牌相关租户列表            | 等 backend `/auth/tenant/list` 行为明确后再评估             |

> 本 Phase 仅 Grep 定位，**不改动 admin-web 代码**。已识别入口列表如下，待新会话按 `admin-web-module-change.md` 单独处理。

#### admin-web 待清理路径清单

| #   | 路径                                                                                         | 角色                                                                                 | 影响                                                         |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 1   | `apps/admin-web/src/layouts/modules/global-header/index.vue`                                 | 顶栏渲染 `<TenantSelect>`                                                            | 移除引用 + `tenantId` ref                                    |
| 2   | `apps/admin-web/src/components/custom/tenant-select.vue`                                     | 顶栏租户下拉切换组件（`fetchChangeTenant` / `fetchClearTenant` / `fetchTenantList`） | 可整文件删除                                                 |
| 3   | `apps/admin-web/src/service/api/system/tenant.ts` 中 `fetchChangeTenant`、`fetchClearTenant` | 动态切换 API                                                                         | 移除 2 个函数（`fetchGetTenantList` 等保留供租户管理页）     |
| 4   | `apps/admin-web/src/service/request/tenant.ts`                                               | 请求头 `tenant-id` 注入工具                                                          | 评估保留（兜底）或移除（彻底单租户）                         |
| 5   | `apps/admin-web/src/views/system/tenant/index.vue` 等平台租户管理页                          | 平台租户 CRUD 页                                                                     | 保留（仍可作为"本店信息"管理入口，Phase 4 改造为店铺设置页） |

## 4. 会话切分建议

| Phase      | 建议对话数 | 实际                                                              |
| ---------- | ---------- | ----------------------------------------------------------------- |
| 2.0        | 同 2.1     | 只读，与 2.1 合并 ✓                                               |
| 2.1        | 1          | backend 3 文件，≤200 行 ✓                                         |
| 2.2        | 1          | admin-web 4 改 1 删，与 2.1 同会话续作（合计 9 文件，远低于上限） |
| 父 Phase 3 | 独立       | C 端响应式 web 新建（Nuxt 3，独立 plan）                          |

## 5. 当前状态

| 字段                | 值                                                                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **current_phase**   | `2.2`                                                                                                                                                                                                                                                                   |
| **phase_status**    | `implemented`（Phase 2.0/2.1/2.2 全部 done；端到端 admin-web e2e 待人工跑）                                                                                                                                                                                             |
| **blocked_reason**  | —                                                                                                                                                                                                                                                                       |
| **delivered_files** | 8 触达：本 plan + Phase 2.1 三件（`tenant.guard.ts` / `base.repository.ts` / `base.repository.spec.ts`）+ Phase 2.2 五件（`global-header/index.vue` / `components/custom/tenant-select.vue` 删 / `service/api/system/tenant.ts` / `service/api/system/tenant.spec.ts`） |

## 6. 已执行验证（命令 + 退出码）

| Phase | 命令                                                                                | exit | 时间       | 结果                                                                                                           |
| ----- | ----------------------------------------------------------------------------------- | ---- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| 2.1   | `pnpm fix:changed`                                                                  | 0    | 2026-06-23 | prettier/eslint 全过；4 个 warning 为预存在 unused-vars，与本改动无关                                          |
| 2.1   | `pnpm --filter @apps/backend typecheck`                                             | 0    | 2026-06-23 | `tsc --noEmit` 全过                                                                                            |
| 2.1   | `pnpm check:slice`                                                                  | 0    | 2026-06-23 | lint + typecheck + check-spec-drift + admin-web vitest 82 spec / 511 test 全绿                                 |
| 2.1   | `pnpm --filter @apps/backend test -- src/common/repository/base.repository.spec.ts` | 0    | 2026-06-23 | 4 tests 全绿（含改后的 super-tenant 注入 + 新增 IgnoreTenant 跳过）                                            |
| 2.1   | `pnpm --filter @apps/backend test -- src/common/tenant`                             | 0    | 2026-06-23 | 4 spec suites / 53 tests 全绿                                                                                  |
| 2.2   | `pnpm fix:changed`                                                                  | 0    | 2026-06-23 | 同时 prettier admin-web 3 文件 + backend 3 文件                                                                |
| 2.2   | `pnpm --filter @apps/admin-web typecheck`                                           | 0    | 2026-06-23 | `vue-tsc --noEmit` 全过                                                                                        |
| 2.2   | `pnpm verify:admin-view-types`                                                      | 0    | 2026-06-23 | `OK no targeted admin-web view files`（本次仅触达 layouts + service/api，未触达 views/\*\*）                   |
| 2.2   | `pnpm --filter @apps/admin-web test -- src/service/api/system/tenant.spec.ts`       | 0    | 2026-06-23 | 7 tests 全绿（原 9 - 2）                                                                                       |
| 2.2   | `pnpm check:slice`                                                                  | 0    | 2026-06-23 | 涵盖 lint + typecheck + check-spec-drift + admin-web vitest 82 spec / **509 test** 全绿（- 2 = 删的 2 个断言） |

未跑（不在本 Phase 范围）：

- `pnpm --filter @apps/backend test` / `pnpm --filter @apps/admin-web test` 全量：未跑（非 PR 阶段不要求；改动作用面已被针对 spec 覆盖）
- `pnpm dev:backend` / `pnpm dev:admin` smoke：未跑（不改启动链路与模块注册）
- `pnpm --filter @apps/admin-web test:e2e`：未跑（属"开发者下一步"§8 人工验证）

## 7. 下一会话 Prompt（复制 — 进入父 plan Phase 3）

```text
你是续作 Agent。父 plan（fafafa-template-pivot）的 Phase 2「去多租户运行时」已完成
（见 docs/exec-plans/active/FAFAFA-PIVOT-PHASE2-2026-06.md，phase_status 2.0/2.1/2.2=done）。
现在做父 plan 的 Phase 3「新 C 端响应式 Web」。

任务模式：new-feature | 路径类型：new-app（apps/c-web）| 高风险：否（不动现有业务）
范围：
  - 新建 apps/c-web/（推荐 Nuxt 3；备选 Vue 3 + Vite SPA）
  - 对齐 miniapp 功能（商品/购物车/下单/支付/会员/订单/优惠券/收货地址等）
  - 接入 @libs/common-types（OpenAPI 生成的类型）
  - 新增 deploy/docker/c-web.Dockerfile + 更新 docker-compose.tpl.yml + gateway.conf
  - 按 multi_templates 战略**预留**基础版/O2O 版差异化能力
约束：
  - 不动 apps/miniapp-client（Phase 4 才下线）
  - 不动现有 backend 业务代码
  - 单会话 ≤20 文件，超出立刻 HANDOFF
必读：AGENTS.md / apps/admin-web/AGENTS.md（Vue3 治理参考）/ .codex/playbooks/large-refactor.md / libs/AGENTS.md
先建 docs/exec-plans/active/FAFAFA-PIVOT-PHASE3-2026-06.md（含技术选型 ADR + Phase 拆分），
再启动脚手架与最小可跑骨架。
```

## 8. 开发者下一步（复制）

1. 本地执行：`pnpm fix:changed && pnpm --filter @apps/backend typecheck && pnpm --filter @apps/admin-web typecheck && pnpm check:slice`
2. 预期：exit 0（全绿，与上文 §6 一致）
3. 端到端人工验证（强烈建议）：
   - admin-web 登录后**确认顶栏没有租户下拉**
   - 点几个高风险页面（finance / wallet / commission / store-order）确认数据查询行为与改动前一致
   - 跑 `pnpm dev:backend` + `pnpm dev:admin` smoke 一次
4. 若通过：粘贴 §7 Prompt 开新会话推进父 plan Phase 3
5. 若失败：先修当前 Phase 2，不要进入父 Phase 3
