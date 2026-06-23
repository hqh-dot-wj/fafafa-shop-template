---
title: Harness 默认工作流
status: active
doc_type: playbook
last_verified: 2026-05-21
---

# Harness 默认工作流

本文件是 **Agent/开发者执行时的唯一流程入口**。其它 playbook 与 `docs/governance/**` 仅在触发时打开，禁止默认全读、全跑。

减法登记见 [`docs/governance/HARNESS_FRICTION_INVENTORY.md`](../../docs/governance/HARNESS_FRICTION_INVENTORY.md)。分级细则见 [`risk-tiering.md`](./risk-tiering.md)。

## 0. 硬原则（MSV）

```text
最小足够 = 本任务 Tier 规定的最低验证已跑且 exit 0。
禁止用「可能有用」的全量流程代替足够证据。
禁止未用户要求时跑 pnpm verify / 全 monorepo test。
禁止用户已授权删除（路径+原因）时二次确认（Tier D0）。
```

合格谓词（勿混用）：

```text
SliceOK     ⇔ pnpm check:slice 对当前 diff exit 0
PhaseDone   ⇔ pnpm eval:phase --plan <active> exit 0
TaskComplete ⇔ PhaseDone ∧ SliceOK
```

## 1. 任务 Tier 与默认路径

| Tier | 典型意图 | 必读 | 默认命令 | 禁止默认 |
| --- | --- | --- | --- | --- |
| **T0** | typo/注释，非高风险路径 | 根 `AGENTS.md` | `pnpm fix:changed` | slice、plan、verify |
| **T1** | 单 app 小改 | + 一条路径 playbook | + `pnpm check:slice` | exec-plan、Agent Teams、verify |
| **T2** | 契约/佣金/seed/跨 app 切片 | + `context-scan.md`、一次范围确认 | slice + 域测试（见 verification-gates） | verify 全套 |
| **T3** | 大改：≥15 文件或 ≥2 app（§0.4） | + `active` exec-plan + `session-orchestration` 摘要 | 每 Phase：slice；收口：`eval:phase` | 同会话扫全仓 + 宣称 PR 完成 |
| **PR** | 用户明确合并前 | — | `pnpm verify` 或 `verify:pre-push:full` | 日常 `git push` 仅 `check:slice` |

路径 playbook：`backend-safe-change` / `admin-web-module-change` / `miniapp-page-change` / `dict-and-job-change`（按路径类型选一）。

## 2. 删除分级（Tier D）

| 级别 | 条件 | Agent 行为 |
| --- | --- | --- |
| **D0** | 用户消息含**明确路径** + **删除原因**；且非 prisma migration/seed/生产数据 | 直接 `git rm` + 改动；可选 `pnpm harness:impact`（模块退役） |
| **D1** | 批量删除或跨 app，无 D2 信号 | **一次**清单确认后执行 |
| **D2** | migration、已有 migration 修改、生产/批量回填 | 按 `HIGH_RISK_REGISTRY.md` 停手确认 |

## 3. 条件必读（非默认）

| 触发 | 打开 |
| --- | --- |
| cross-app / 契约不清 | `context-scan.md` |
| `refactor` 且命中 exec-plan 硬条件 | `docs/exec-plans/active/<TASK-ID>.md`、`session-orchestration.md` |
| 会话结束且已有 active plan | `docs/exec-plans/templates/HANDOFF.md` |
| 委派子代理（Cursor/Claude/Codex） | `subagent-roles.md` |
| 大 PR 只读多视角审查（Claude Code Teams） | `claude-agent-teams.md` |
| 模块下线 / 删多目录 | [`module-retirement.md`](./module-retirement.md)、`pnpm harness:impact` |
| review-only | `review-mode.md` |

## 4. 场景速查

**小改**：判 T1 → 改代码 → `fix:changed` → `check:slice` → 短交付（`tier` + `commands_run`）。

**授权删除**：D0 →（可选 impact）→ 删 → `check:slice`。

**大改**：建 plan → Phase 竖切 → 每轮 HANDOFF → `eval:phase`。

**PR 收尾**：`pnpm pr:land --current`（需 `gh`；`--dry-run` 预览）。合并前全量：`pnpm verify:pre-push:full`。

## 5. 与 exec-plan 硬触发

见 `HARNESS_ROADMAP.md` §0.4：`git diff origin/main` 文件数 ≥ 15，或 diff 命中 ≥2 个 app 根。豁免：`no-exec-plan:` trailer 或 PR label。

## 6. 交付最短字段

T0/T1 交付须含：`tier`、`commands_run`、`commands_skipped_and_why`、已完成/未验证/残余风险。T3 叠加 HANDOFF 与 plan 同步。
