---
title: 交付与功能文档
status: active
doc_type: delivery
last_verified: 2026-05-19
---

# 交付（Delivery）

产品/功能交付文档入口。与 **Agent 执行 WIP**（`docs/exec-plans/`）分工见下表。

## 文档分工

| 类型                 | 路径                                  | 用途                                 | 消费者             |
| -------------------- | ------------------------------------- | ------------------------------------ | ------------------ |
| **Feature Pack**     | `docs/delivery/features/<FEAT-ID>/`   | 需求、方案、测试计划、发布清单       | 产品、测试、发布   |
| **Exec Plan**        | `docs/exec-plans/active/<TASK-ID>.md` | Phase、DoD、会话 HANDOFF、验证退出码 | Agent / 开发者编排 |
| **Superpowers spec** | `docs/superpowers/**`                 | 历史设计参考，**非**执行 WIP         | 设计对照           |

```text
REQ / SOLUTION（delivery）  →  立项与验收口径
       ↓ 关联 META.yaml exec_plan
Exec Plan（active）         →  多会话实施、pnpm eval:phase / check:slice
       ↓ 完成后
completed/ + PR 链接        →  可追溯交付
```

## Feature Pack 结构

模板目录：`docs/delivery/templates/feature-pack/`

| 文件                   | 说明                          |
| ---------------------- | ----------------------------- |
| `META.yaml`            | 元数据（含 `exec_plan` 关联） |
| `REQ.md`               | 背景、范围、验收              |
| `SOLUTION.md`          | 方案与影响面                  |
| `TEST_PLAN.md`         | 测试与回归                    |
| `RELEASE_CHECKLIST.md` | 发布检查（可选）              |

新建功能包：

```text
docs/delivery/features/FEAT-YYYY-NNN-<slug>/
  META.yaml
  REQ.md
  SOLUTION.md
  TEST_PLAN.md
```

示例：`docs/delivery/features/FEAT-2026-002-distribution-qualification/`

## 与 Exec Plan 关联

在 `META.yaml` 中填写：

```yaml
exec_plan: docs/exec-plans/active/<TASK-ID>.md
task_mode: new-feature # 与根 AGENTS.md 任务模式对齐
path_type: cross-app
```

- 大任务 / 跨 app：必须先有 exec-plan（见 `HARNESS_ROADMAP.md` §0.4）。
- Phase 完成：`pnpm eval:phase`（PhaseDone）+ `pnpm check:slice`（SliceOK）。
- 会话结束：`.codex/playbooks/session-orchestration.md` + `docs/exec-plans/templates/HANDOFF.md`。

## 与 PR 的衔接

1. PR 描述链接 Feature Pack 与 exec-plan（`active` 或 `completed`）。
2. 本地自检：`pnpm verify:pr-slice`（质量属性勾选建议 + exec-plan 提示）。
3. 合并前：按根 `AGENTS.md` PR 分层跑 `pnpm verify`（用户明确要求时）。

## Superpowers 目录

`docs/superpowers/specs/`、`docs/superpowers/plans/` 为历史设计稿，**执行时以 exec-plan + playbook 为准**，不要把它当作 active WIP。迁移规则见 `docs/exec-plans/README.md` §0.8。

## 其他入口

- 演示/说明类页面：[`../features/`](../features/)（VitePress）
- 应用内遗留文档：`apps/admin-web/docs/` 等 — 逐步迁入 Feature Pack
