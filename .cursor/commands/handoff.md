# Handoff（会话交接）

Cursor 入口命令；规范正文见 `.codex/playbooks/session-orchestration.md` 与 `docs/exec-plans/templates/HANDOFF.md`。

## 执行步骤

1. 确认 `docs/exec-plans/active/<TASK-ID>.md` 存在；若无且属大任务，先从 `docs/exec-plans/templates/PLAN.md` 创建。
2. 更新 plan 的 `current_phase`、`phase_status`、§5 已执行验证（**仅填写实际运行过的命令与 exit code**）。
3. 在回复末尾输出：
   - `## 开发者下一步`
   - `## 下一会话 Prompt`（可复制块，首行指向 active plan 的 Phase）
4. 格式与 `HANDOFF.md` 一致；勿与 `AGENT_OUTPUT_PROTOCOL` 模板 29 另起一套结构。

## 必读

- `docs/governance/HARNESS_ROADMAP.md` §0.2（`SliceOK` / `PhaseDone`）
- 根 `AGENTS.md` 硬规则
