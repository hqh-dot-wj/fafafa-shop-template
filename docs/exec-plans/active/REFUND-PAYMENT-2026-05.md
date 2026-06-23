---
task_id: REFUND-PAYMENT-2026-05
status: implemented
current_phase: 5
task_mode: new-feature
path_type: cross-app
high_risk: true
created: 2026-05-19
last_updated: 2026-05-19
related_feat: null
---

# Exec Plan: REFUND-PAYMENT-2026-05

客户端退款链路 + 财务 `fin_refund` 台账 + 支付网关退款能力 + 订单终态对齐。  
**Harness 治理改动**（`docs/governance/*`、`scripts/harness-*`）建议 **独立 PR** 或在本 plan **Phase H** 收口，避免与资金逻辑混审。

## 1. 目标 / 非目标

**目标**

- Prisma：`fin_refund` 模型与 migration 落地（`20260518190000_add_fin_refund`）。
- 支付：微信/mock 网关退款接口、client `payment` 退款入口、重试队列与对账调度。
- 订单：`order-refund-finalizer` 与 `store-order` 退款语义一致。
- 财务：`fin-refund.service` 记账与测试。
- 验证：`pnpm check:slice`（backend）+ 关键 service spec；高风险路径 L3+。

**非目标**

- 本 Phase 不做 admin-web 营销编排大改（`orchestration/*` 另开 TASK 或后续 Phase）。
- 不在本 plan 内宣称生产环境已验账；结算口径变更须单独评审。

## 2. 任务元数据

| 字段     | 值                                                                                                        |
| -------- | --------------------------------------------------------------------------------------------------------- |
| 任务模式 | `new-feature`                                                                                             |
| 路径类型 | `cross-app`（以 backend 为主；若动 OpenAPI 再 Phase 契约）                                                |
| 高风险   | **是** — 支付/退款/订单/Prisma migration/资金                                                             |
| 必读     | `HIGH_RISK_REGISTRY.md`、`MONEY_PRECISION_PROTOCOL.md`、`backend-safe-change.md`、`TEST_SPEC_PROTOCOL.md` |

## 3. Phase 列表

### Phase 0 — 只读 + 高风险确认 ✅ done

- **范围**：`payment/**`、`finance/refund/**`、`client/order/refund/**`、`prisma/models/60-finance-payment.prisma`、migration SQL
- **DoD**：停手确认已记录；context-scan 第 9 问：需要本 exec-plan，分多会话。
- **会话**：1

### Phase 1 — Schema + migration ✅ done

- **范围**：
  - `apps/backend/prisma/models/50-order.prisma`
  - `apps/backend/prisma/models/60-finance-payment.prisma`
  - `apps/backend/prisma/migrations/20260518190000_add_fin_refund/**`
- **文件上限**：≤10
- **DoD**：
  - [x] migration 仅新增、未改历史 migration
  - [x] `pnpm --filter @apps/backend typecheck`
  - [ ] 本地 `prisma migrate deploy` dry-run 未执行；合并前仍需 DBA / 环境确认
- **会话**：1

### Phase 2 — 支付网关 + client payment ✅ done

- **范围**：
  - `apps/backend/src/module/payment/**`
  - `apps/backend/src/module/client/payment/**`
  - `apps/backend/src/module/client/payment/refund-retry.*`
  - `apps/backend/src/module/client/payment/refund-reconciliation.scheduler.*`
- **文件上限**：≤20
- **DoD**：
  - [x] `payment.service.spec.ts`、`wechat-pay.adapter.spec.ts` 覆盖退款成功/失败路径
  - [x] `pnpm check:slice`
- **会话**：1～2

### Phase 3 — 订单终态 + store-order ✅ done

- **范围**：
  - `apps/backend/src/module/client/order/refund/**`
  - `apps/backend/src/module/client/order/order.module.ts`
  - `apps/backend/src/module/store/order/store-order.service.ts`
- **文件上限**：≤15
- **DoD**：
  - [x] `order-refund-finalizer.service.spec.ts` 绿灯
  - [x] `store-order.service.spec.ts` 更新断言
  - [x] `pnpm check:slice`
- **会话**：1

### Phase 4 — 财务 fin-refund ✅ done

- **范围**：`apps/backend/src/module/finance/refund/**`、`finance.module.ts`
- **DoD**：
  - [x] `fin-refund.service.spec.ts` 含幂等/金额边界
  - [x] `pnpm check:slice`
- **会话**：1

### Phase 5 — 集成收口 + Batch ✅ implemented

- **范围**：bootstrap、seed 触达退款数据处（若有）
- **DoD**：
  - [ ] `pnpm dev:backend` 未运行；已用 `pnpm --filter @apps/backend build` 替代编译验证
  - [x] `pnpm --filter @apps/backend build`
  - [x] `pnpm check:slice`
- **会话**：1

### Phase H — Harness 治理（可选，建议独立 PR）

- **范围**：`docs/governance/HARNESS_*`、`scripts/harness-*`、`docs/exec-plans/**`、`.codex/playbooks/session-*`、`AGENTS.md` 等
- **DoD**：
  - [ ] `pnpm harness:manifest:check`
  - [ ] `pnpm harness:docs`
  - [ ] 与资金 PR 不混 diff
- **说明**：当前工作区已含 Harness M1–M4；合并前用 `git add -p` 或拆分支。

## 4. 当前状态

| 字段               | 值                                                                        |
| ------------------ | ------------------------------------------------------------------------- |
| **current_phase**  | `5`                                                                       |
| **phase_status**   | `implemented`                                                             |
| **blocked_reason** | `pnpm dev:backend` 未运行；本批仅声明 build/typecheck/test/slice 验证通过 |

## 5. 已执行验证（命令 + 退出码，由 eval:phase 重跑写入）

| Phase | 命令                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | exit code | 时间       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------- |
| 0     | （停手确认 + 本 plan 创建）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | —         | 2026-05-19 |
| 5     | `pnpm --filter @apps/backend build`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 0         | 2026-05-19 |
| 5     | `pnpm --filter @apps/backend test:unit -- payment.service.spec.ts payment.controller.spec.ts refund-retry.queue.spec.ts refund-retry.processor.spec.ts order-refund-finalizer.service.spec.ts store-order.service.spec.ts fin-refund.service.spec.ts wechat-pay.service.spec.ts wechat-pay.adapter.spec.ts mock-payment-gateway.adapter.spec.ts refund-reconciliation.scheduler.spec.ts integration.service.spec.ts order-checkout.service.spec.ts rule.service.spec.ts commission-settler.service.spec.ts wallet.service.spec.ts withdrawal-audit.service.spec.ts withdrawal-payment.service.spec.ts withdrawal.repository.spec.ts withdrawal.service.spec.ts settlement-core.service.spec.ts settlement-reconciliation-center.service.spec.ts --runInBand` | 0         | 2026-05-19 |
| 5     | `pnpm check:slice`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 0         | 2026-05-19 |

## 6. 下一会话 Prompt（复制）

```text
你是续作 Agent。先读 docs/exec-plans/active/REFUND-PAYMENT-2026-05.md Phase 1。
任务模式：new-feature | 路径类型：cross-app | 高风险：是
本 Phase 范围：apps/backend/prisma/models/50-order.prisma、60-finance-payment.prisma、prisma/migrations/20260518190000_add_fin_refund/**
约束：禁止改历史 migration；金额遵守 MONEY_PRECISION_PROTOCOL；未确认不执行 migrate deploy 写生产。
验证：pnpm --filter @apps/backend typecheck；Phase 结束 pnpm check:slice
不要改 Harness 文档（Phase H）或 admin-web marketing。
```

## 7. 开发者下一步

1. 合并前在目标数据库环境执行 migration dry-run / deploy 预演。
2. 如需要生产联调，单独跑 `pnpm dev:backend` 并验证微信退款回调公网地址。
3. 提交时保持 Harness 治理、后端资金链路、前端金额展示分批。
