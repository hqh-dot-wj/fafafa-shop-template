---
title: Root Agent Rules
status: active
scope: whole-repository
owner: engineering-governance
last_verified: 2026-05-19
---

# Nest-Admin-Soybean Agent Rules

pnpm + Turborepo monorepo：`backend`（NestJS + Prisma）、`admin-web`（Vue3 + Naive UI）、`miniapp-client`（uniapp）。

根 `AGENTS.md` = **目录 + 硬规则 + 路由表**。步骤见子 `AGENTS.md`、`.codex/playbooks/**`、`docs/governance/**`。Harness 注册表：`pnpm harness:manifest`。

## 0. 硬规则

| #   | 规则                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------- |
| 1   | 不读规则，不实施                                                                                      |
| 2   | 须同时明确任务模式与路径类型                                                                          |
| 3   | 须判断 high-risk 与 cross-app                                                                         |
| 4   | 不用局部验证冒充完整验证                                                                              |
| 5   | 不用 mock 假绿 / smoke / typecheck 冒充业务完成                                                       |
| 6   | 不在前端手写 backend DTO/VO 绕过 `libs/common-types`                                                  |
| 7   | 不跨包 import 他 app 的 `src/**`、`dist/**`                                                           |
| 8   | 不顺手改无关范围                                                                                      |
| 9   | 未确认不做删除、批量写入、迁移、改已有 migration                                                      |
| 10  | 不编造路径、命令结果、验证结论                                                                        |
| 11  | 新增 `.md`/PRD/设计稿前须用户确认                                                                     |
| 12  | 同方向失败 >2 次 → 停手回到需求与边界                                                                 |
| 13  | 禁止用全量 verify/全读 playbook 代替本任务 Tier 足够证据（见 `.codex/playbooks/harness-workflow.md`） |

实施前 5 件事：任务模式、路径/app、cross-app、high-risk、已读规则文件。**默认流程** → `.codex/playbooks/harness-workflow.md`；摩擦减法登记 → `docs/governance/HARNESS_FRICTION_INVENTORY.md`。

## 1. 权威与边界

**权威顺序**：用户指令 → 最近 `AGENTS.md` → 根 `AGENTS.md` → `.codex/playbooks/**` → `docs/governance/*` → 工具适配层（`.cursor/`、`.claude/` 等，冲突时以前者为准）。

**目录边界**（详表见各子 `AGENTS.md`）：`apps/backend` 契约源头；`admin-web` / `miniapp-client` 互不依赖源码；`libs/*` 仅经 `package.json` exports；`apps/backend/prisma/` 禁止改已有 migration；`scripts/` 为可执行治理层。

**跨 app 契约**：`backend HTTP API → OpenAPI → @libs/common-types → 前端`。

## 2. 任务模式 × 路径类型

| 任务模式               | 默认动作                                                                          |
| ---------------------- | --------------------------------------------------------------------------------- |
| `review-only`          | 只读；高风险只读不需确认，须 L3 + 证据路径                                        |
| `test-first-fix`       | 先失败测试；backend 测试见 `TEST_SPEC_PROTOCOL.md`                                |
| `new-feature`          | 需求/方案/验收后再写                                                              |
| `contract-change`      | backend → `pnpm generate-types` → 前端                                            |
| `refactor`             | 保护行为；大任务必读 `session-orchestration.md` + `large-refactor.md` + exec-plan |
| `data-migration`       | dry-run、幂等；未确认不写入                                                       |
| `ui-page-change`       | 评估 `pnpm verify:admin-view-types`                                               |
| `doc-governance`       | 新增 `.md` 须确认                                                                 |
| `debug-or-performance` | 证据驱动                                                                          |

| 路径类型         | 必读链（顺序）                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `backend-only`   | 根 → `apps/backend/AGENTS.md` → `backend-safe-change.md` → `AGENT_OUTPUT_PROTOCOL.md`                            |
| `admin-web-only` | 根 → `apps/admin-web/AGENTS.md` → `admin-web-module-change.md` → 输出协议                                        |
| `c-web-only`     | 根 → `apps/c-web/AGENTS.md` → `miniapp-page-change.md` → 输出协议                                                |
| `miniapp-only`   | 根 → `apps/miniapp-client/AGENTS.md` → `miniapp-page-change.md` → 输出协议                                       |
| `cross-app`      | 根 → 相关子 AGENTS → `context-scan.md` → `verification-gates.md` → 输出协议；大任务加 `session-orchestration.md` |
| `doc-only`       | 根 → `doc-request-flow.md` → `DOCUMENT_POLICY.md`                                                                |

`review-only` 额外读 `review-mode.md`。命中 `libs/**`、≥2 app、契约/字典/任务联动等 → 按 `cross-app`。cross-app 顺序：`backend` → 必要时 build → `generate-types` → 前端 → 验证。

## 3. 高风险

触发条件与停手确认内容 → **`docs/governance/HIGH_RISK_REGISTRY.md`**。review-only 命中时保持只读；转入写入须先确认。

## 4. 验证分层

环境：Node `>=20.19.0`，pnpm `>=10.5.0`，shell 默认 `pwsh`。

| 层级    | 命令                                                    | 用途                                                     |
| ------- | ------------------------------------------------------- | -------------------------------------------------------- |
| Micro   | `pnpm fix:changed`                                      | 当前变更文件                                             |
| Slice   | `pnpm check:slice`                                      | 受影响 app 切片（≠ Phase 完成，见 `HARNESS_ROADMAP.md`） |
| Phase   | `pnpm eval:phase --plan docs/exec-plans/active/<id>.md` | 重跑 DoD（PhaseDone，与 Slice 合取）                     |
| PR 自检 | `pnpm verify:pr-slice`                                  | 质量属性勾选建议 + exec-plan 提示                        |
| Batch   | 见 `verification-gates.md` 矩阵                         | 阶段收口                                                 |
| PR      | `pnpm verify` 全套                                      | 合并前                                                   |

常用：`pnpm dev:*`、`pnpm typecheck:*`、`pnpm test:*`、`pnpm harness:doctor`、`pnpm harness:manifest`、`pnpm verify:scripts`。联调优先 `dev`；非必要不 `build`。

证据等级 L1–L4、Mock 边界、按改动类型的验证矩阵 → **`.codex/playbooks/verification-gates.md`**（manifest 登记 `evidence-levels-mock`，`enforcement: human-only`）。

## 5. 输出与交付

结构化输出 → `docs/governance/AGENT_OUTPUT_PROTOCOL.md`（模板见 `AGENT_OUTPUT_TEMPLATES.md`）。新增 `.md` 须确认。交付须区分已完成/已验证/未验证/残余风险；禁止未跑命令写「已通过」。

Commit：`<type>(<scope>): <中文描述>`。

## 6. 子代理（三端）

角色注册表：`.codex/playbooks/subagent-roles.md`。壳文件：`.cursor/agents/`、`.claude/agents/`（Markdown 同文）、`.codex/agents/`（TOML）。派发子代理须在 prompt 中重复：任务模式、路径类型、cross-app、high-risk、读写范围、必读文件、禁止假绿。Claude Agent Teams 见 `claude-agent-teams.md`（≠ 单子代理）。

## 7. 团队约定（Harness）

- 大改默认有 `docs/exec-plans/active/<TASK-ID>.md`，或 `no-exec-plan` 豁免（见 `HARNESS_ROADMAP.md` §0.4）。
- 交付须含「开发者下一步」；完成 = `eval:phase` 重跑 DoD + `check:slice`，不以自述为准。
- 争论以 `pnpm harness:manifest` 登记与命令 exit code 为准。
- `active` plan 超 14 天无更新：跑 `pnpm harness:plan-stale` 处理（归档 / blocked）。
- 三端规则冲突：canonical（`AGENTS.md` + playbook）优先于工具适配层。
- **注释（触达必审）**：凡本次改动的源码文件，缺少能说明业务语义、状态机、幂等、金额/租户边界的注释须补上； obvious 样板代码不堆注释。清单见 `.codex/playbooks/co-evolution-checklist.md` §四。
- **Harness 治理专项**：仅改 `docs/governance/**`、`scripts/harness-*`、`eval-phase`、`exec-plans` 模板与 playbook 时，用 `docs/exec-plans/active/HARNESS-GOV-2026-05.md`（或后续 `HARNESS-GOV-*`），**不**与资金/订单业务 plan 混 Phase。

## 8. 异常

命令失败且属当前改动 → 修复继续；无关 → 停手。相邻 bug / 新高风险 / 连续失败 → 停手。验证不足 → 只列风险与推荐验证，不宣称完成。

## 9. 权威文件索引

**子 AGENTS**：`apps/backend/AGENTS.md`、`apps/backend/prisma/AGENTS.md`、`apps/admin-web/AGENTS.md`、`apps/c-web/AGENTS.md`、`apps/miniapp-client/AGENTS.md`、`libs/AGENTS.md`、`scripts/AGENTS.md`、`docs/AGENTS.md`、`docs/delivery/AGENTS.md`、`.codex/playbooks/AGENTS.md`。

**Playbooks**：`harness-workflow.md`（**默认执行入口，先读**）、`subagent-roles.md`（八角色注册表）、`risk-tiering.md`、`module-retirement.md`、`context-scan.md`、`session-orchestration.md`（大任务分会话）、`large-refactor.md`（跨模块重构 Phase）、`claude-agent-teams.md`（Claude Code 多队友：并行审查/对抗调试/跨层）、`backend-safe-change.md`、`admin-web-module-change.md`、`miniapp-page-change.md`、`dict-and-job-change.md`、`verification-gates.md`、`review-mode.md`、`doc-request-flow.md`、`co-evolution-checklist.md`（改 service/processor/repository）。

**Governance**：`AGENT_OUTPUT_PROTOCOL.md`、`AGENT_OUTPUT_TEMPLATES.md`、`AGENT_OUTPUT_PROTOCOL_EXAMPLES.md`、`DOCUMENT_POLICY.md`、`ERROR_OBSERVABILITY_STANDARD.md`（日志/指标）、`HARNESS_ENGINEERING.md`、`HARNESS_ROADMAP.md`、`HARNESS_AUDIT.md`、`HARNESS_FRICTION_INVENTORY.md`（摩擦减法登记）、`HIGH_RISK_REGISTRY.md`、`ENGINEERING_CONSTITUTION.md`、`MONEY_PRECISION_PROTOCOL.md`、`TEST_SPEC_PROTOCOL.md`、`docs/exec-plans/README.md`、`docs/delivery/README.md`（Feature Pack + `exec_plan` 关联）。

**工具层**：`CLAUDE.md`、`.claude/CLAUDE.md`、`.cursor/rules/**`、`.cursor/commands/**`（`handoff`、`start-phase`）、`.serena/memories/**`。
