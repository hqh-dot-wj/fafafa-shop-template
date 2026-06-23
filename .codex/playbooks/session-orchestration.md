# 会话编排（Session Orchestration）

## 目标

把 **Planner → Generator →（可选）会话型 Evaluator** 落到可复制的会话切分上；**程序性验证**以 `pnpm check:slice` / 未来的 `pnpm eval:phase` 为准（见 `docs/governance/HARNESS_ROADMAP.md` §0）。

本 playbook 与 `docs/exec-plans/**` 配套；HANDOFF 片段格式以 `docs/exec-plans/templates/HANDOFF.md` 为准，并并入交付模板 28/29。

## 何时必须建 exec-plan

满足 **任一硬条件**（`HARNESS_ROADMAP.md` §0.4）：

- `git diff origin/main --name-only` 文件数 ≥ `EXEC_PLAN_FILE_THRESHOLD`（`pnpm harness:manifest` 可见，默认 15）
- diff 同时命中 ≥2 个 app 根（`apps/backend/`、`apps/admin-web/`、`apps/miniapp-client/`）

满足 **任一软条件**（playbook 约束，合并前人工 review）：

- 任务模式 `refactor` 且预计跨模块
- 任务模式 `new-feature` 且新模块或跨 2+ app
- 用户明确「大改 / 整模块 / 分会话」

**豁免**（须持久化）：commit trailer `no-exec-plan: <reason>` 或 PR label `no-exec-plan`。

文件路径：`docs/exec-plans/active/<TASK-ID>.md`（从 `templates/PLAN.md` 复制）。

## 何时必须新开对话

| 信号                                                            | 动作                              |
| --------------------------------------------------------------- | --------------------------------- |
| 同会话 tool 调用 ≥15 且当前 Phase 未完成                        | 结束本轮，更新 plan，输出 HANDOFF |
| 已读完 ≥3 份 AGENTS + 2 playbook 才开始改代码                   | 应先建 plan 并拆 Phase            |
| 从 backend 实现切到 admin（或反向）                             | 新对话或新 Phase                  |
| 验证失败连续 2 次同方向                                         | 停手更新 plan，新对话             |
| 单对话 diff 将超 `large-refactor.md` 红线（≤20 文件 / ≤800 行） | 结束本轮                          |

## 每轮结束强制输出（所有 L2+ 实施任务）

交付或会话结束前，聊天中 **必须** 包含（可复制块）：

1. **## 开发者下一步** — 本地命令、预期 exit 0 条件、失败时禁止进入下一 Phase
2. **## 下一会话 Prompt** — 续作 Agent 用；首行指向 `docs/exec-plans/active/<TASK-ID>.md` 的 `current_phase`

同步更新 exec-plan 内「当前 Phase 状态」；**禁止**仅用聊天历史交接。

## 合格谓词（禁止混用）

```text
SliceOK     ⇔ pnpm check:slice exit 0（对当前 diff）
PhaseDone   ⇔ pnpm eval:phase exit 0（M3 前：人工核对 Phase DoD + 记录命令与退出码）
TaskComplete ⇔ PhaseDone ∧ SliceOK
```

M3 之前：Phase 标 `done` 须在 plan 的「已执行验证」表写入 **实际运行** 的命令与退出码，不得手写未执行的 `0`。

## 与 AGENT_OUTPUT_PROTOCOL 关系

| 场景                 | 模板                                                      |
| -------------------- | --------------------------------------------------------- |
| Phase / 任务切片交付 | 模板 28 交付说明 + §11–§12 开发者下一步 / 下一会话 Prompt |
| 会话结束、决策备忘   | 模板 29；与 `HANDOFF.md` 二选一主格式，勿两套矛盾         |

## 三端入口

| 工具           | 入口                                                         |
| -------------- | ------------------------------------------------------------ |
| 全仓 canonical | 根 `AGENTS.md` §8、`context-scan.md` 第 9 问                 |
| Codex          | `.codex/README.md`                                           |
| Cursor         | `.cursor/rules/000-entry.mdc`；命令 `handoff`、`start-phase` |
| Claude Code    | `CLAUDE.md` 子代理派发段                                     |

## 停止规则

- 无 active plan（且未豁免）不进入跨 app 实现。
- 禁止同对话完成「全量 context-scan + 多 app 实现 + 宣称 PR 级 verify 完成」。
- 争论以 manifest 登记命令的 **exit code** 为准，不以 Agent 自述为准。
