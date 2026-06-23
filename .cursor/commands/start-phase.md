# Start Phase（按 exec-plan 开工）

Cursor 入口命令；规范正文见 `docs/exec-plans/README.md` 与 `.codex/playbooks/large-refactor.md`。

## 执行步骤

1. 读取用户给出的 `TASK-ID`，或从 `docs/exec-plans/active/` 列出 active 计划。
2. 打开 `docs/exec-plans/active/<TASK-ID>.md`，以 YAML frontmatter 的 `current_phase` 为准。
3. 复述本 Phase：**范围**、**DoD**、**文件/行数上限**、任务模式/路径类型/高风险。
4. 实施前补读 `context-scan.md` 与路径类型对应 playbook。
5. 禁止超出当前 Phase 范围；禁止同对话跨 backend↔admin 实现（应 handoff）。

## 验证

- Phase 进行中：`pnpm fix:changed`（Micro）
- Phase 结束：`pnpm check:slice`（SliceOK）；M3 前勿单独宣称 PhaseDone

## 若无 plan

若 diff 触达 `HARNESS_ROADMAP.md` §0.4 硬阈值且无 `no-exec-plan` 豁免，先建 plan 再写代码。
