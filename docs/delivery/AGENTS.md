# Delivery 文档指引

## 速览

- 适用范围：`docs/delivery/**`
- 职责：产品交付、Feature Pack、发布与验收文档。
- 执行 WIP 不在此目录：见 `docs/exec-plans/README.md`。

## 必读

1. 根 `AGENTS.md`
2. `docs/delivery/README.md`
3. 大任务实施：`.codex/playbooks/session-orchestration.md`

## 边界

| 放 delivery            | 放 exec-plans          |
| ---------------------- | ---------------------- |
| REQ / 验收 / 发布清单  | Phase / DoD / HANDOFF  |
| 业务方案与影响说明     | 命令退出码、当前 Phase |
| `META.yaml` 产品元数据 | `TASK-ID` 编排状态     |

## 验证

- 文档改动：核对路径与 `META.yaml` 字段。
- 关联实施：确认 `exec_plan` 路径存在且 `task_mode` / `path_type` 与根 `AGENTS.md` 一致。
