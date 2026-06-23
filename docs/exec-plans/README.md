---
title: Exec Plans 执行计划
status: active
doc_type: governance
last_verified: 2026-05-19
---

# Exec Plans（Agent 执行 WIP）

**执行真相**在本目录；**产品设计交付**在 `docs/delivery/features/`。二者可关联，但不得互相替代。

| 目录                                 | 用途                                      |
| ------------------------------------ | ----------------------------------------- |
| `active/<TASK-ID>.md`                | 进行中任务（YAML frontmatter + Phase 节） |
| `completed/HARNESS-DRILL-2026-05.md` | M2/M3 演练归档样例                        |
| `completed/`                         | 已归档计划                                |
| `templates/PLAN.md`                  | 新建 plan                                 |
| `templates/HANDOFF.md`               | 会话交接片段                              |

## 与 superpowers 区分

- `docs/superpowers/**`：设计参考 / 历史 spec，**非**执行 WIP。
- 旧 `docs/superpowers/plans/*` **不会**自动成为 `active/`；迁移须复制并改 TASK-ID。

## 合格谓词（勿与 slice 混用）

见 `docs/governance/HARNESS_ROADMAP.md` §0：`PhaseDone` 依赖 `pnpm eval:phase`（M3）；`SliceOK` 依赖 `pnpm check:slice`；`TaskComplete = PhaseDone ∧ SliceOK`。

## 强制触发（可机械判定）

- `git diff origin/main` 变更文件数 ≥ `EXEC_PLAN_FILE_THRESHOLD`（见 `scripts/harness-manifest.mjs`，默认 15）
- 或 diff 同时命中 ≥2 个 app 根路径

豁免：commit trailer `no-exec-plan: <reason>` 或 PR label `no-exec-plan`。

编排 playbook：`.codex/playbooks/session-orchestration.md`、`.codex/playbooks/large-refactor.md`。

**Harness 治理专项**（不改业务代码）：已归档 `completed/HARNESS-GOV-2026-05.md`（§6 列人工项）；后续治理另开 `HARNESS-GOV-*`（见根 `AGENTS.md` §7）。

三端入口：Codex `.codex/README.md`；Cursor `handoff` / `start-phase` 命令；Claude `CLAUDE.md` 子代理段。
