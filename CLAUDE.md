# Claude Code Entry

@AGENTS.md

仓库规则正文以根 `AGENTS.md` 为 canonical。本文件只保留 Claude Code 必须优先遵守的硬摘要，避免长规则在主会话或子代理派发时被压缩丢失。

## 语言

始终用中文回复用户。代码本身保持项目既有命名和注释风格。

## 执行前必判

每个任务开始前先明确：

1. 任务模式：`review-only` / `test-first-fix` / `new-feature` / `contract-change` / `refactor` / `data-migration` / `ui-page-change` / `doc-governance` / `debug-or-performance`。
2. 路径类型：`backend-only` / `admin-web-only` / `miniapp-only` / `cross-app` / `doc-only`。注意：`review-only` 是任务模式，不是路径类型，详见 `AGENTS.md` §2.2。
3. 是否 high-risk、是否 cross-app、已读哪些规则文件。

## 不可绕过

- 只读分析保持只读；高风险只读分析不需要停手确认，但必须标记 L3、写清证据路径和未验证风险。
- 一旦转入修复、写入、迁移、数据变更或契约变更，命中高风险必须先确认。
- backend 测试新增或修改必须先按 `docs/governance/TEST_SPEC_PROTOCOL.md` 产出规格。
- backend 契约变更必须走 `backend -> 必要时 build backend -> pnpm generate-types -> 前端适配`。
- admin-web `src/views/**`、`useTable`、`NDataTable`、列定义改动必须评估 `pnpm verify:admin-view-types`。
- 新增或生成任何 `.md` 前必须先获得用户确认。
- 禁止用 mock 假绿、smoke、typecheck / lint 冒充业务完成。
- 禁止无证据结论；不确定内容必须标记为疑似、推断或未验证。

## 子代理派发

不要假设 subagent 会完整继承 `AGENTS.md`。派发任何子代理时，必须在子任务 prompt 中重复：

- 任务模式、路径类型、是否 high-risk / cross-app。
- 只读 / 可写范围。
- 必读文件。
- 禁止 mock 假绿、禁止无证据结论。
- 预期输出和验证要求。

**大任务 / 多 Phase**：在 prompt 首行指定 `docs/exec-plans/active/<TASK-ID>.md` 的 `current_phase` 与范围；子代理不得扩大 Phase。会话结束须 HANDOFF（见 `docs/exec-plans/templates/HANDOFF.md`、`.codex/playbooks/session-orchestration.md`）。

**子代理角色（8）**：注册表 `.codex/playbooks/subagent-roles.md`；壳文件 `.claude/agents/<name>.md`（与 `.cursor/agents/` 同文）。开工 30 秒内说明本回合用主会话还是哪个子代理。

**Agent Teams（实验，仅 Claude Code 多队友）**：启用与 Lead Prompt 见 `.codex/playbooks/claude-agent-teams.md` §0–§1；与单子代理不同，不要混用。大改仍须 exec-plan；完成判定仍须 `eval:phase` + `check:slice`。

**默认流程与 Hooks**：见 `.claude/CLAUDE.md`（本文件不重复 workflow / Teams 正文）。

## 快速验证口径

完整按改动类型的验证矩阵见根 `AGENTS.md` §6。本节只列 Claude Code 操作期最常用的执行层快捷键：

- 小改默认 Micro Gate：`pnpm fix:changed`
- 切片收口：`pnpm check:slice`
- 前端 strict 只跑非阻塞报告：`pnpm report:strict`
- root scripts 治理：`pnpm verify:scripts`
- PR / 合并前才跑 full gate：`pnpm verify-monorepo; pnpm verify:scripts; pnpm lint; pnpm typecheck; pnpm test`
