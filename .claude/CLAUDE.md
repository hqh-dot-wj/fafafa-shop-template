# Claude Code 工具层（≤30 行入口）

**规则正文**：根 `CLAUDE.md` + **默认流程** [`.codex/playbooks/harness-workflow.md`](../.codex/playbooks/harness-workflow.md)。其它 playbook **按触发**打开，禁止默认全读。

## 每次任务（L0）

1. 根 `CLAUDE.md`（任务模式 + 路径类型）
2. `.codex/playbooks/harness-workflow.md`（Tier、命令上限、删除 D0/D2）

## 条件必读（非默认）

| 触发 | 阅读 |
| --- | --- |
| 写入/修复 | 一条路径 playbook（见 workflow §1） |
| 派发子代理 | `subagent-roles.md` + 对应 `.claude/agents/<name>.md` |
| T2 跨 app / 契约 / 域不清 | `context-scan.md` |
| 大改（≥15 文件或 ≥2 app） | `docs/exec-plans/active/<TASK-ID>.md` + `session-orchestration.md` 摘要 |
| 大 PR 并行审查（实验 Teams） | `claude-agent-teams.md`（非子代理；见根 `CLAUDE.md`） |
| L3 会话结束 | `docs/exec-plans/templates/HANDOFF.md` |

子代理与 Agent Teams 规则以根 `CLAUDE.md` + 上表 playbook 为准，**本文件不重复**派发长文。

## Hooks（本机 `.claude/hooks/`，非全员前提）

| Hook | 作用 |
| --- | --- |
| `pre-bash-guard` | 危险命令拦截 |
| `pre-write-guard` | 受保护路径 / migration |
| `post-edit-format` | `pnpm fix:changed` |
| `post-edit-chain` | 契约链提醒 |
| `stop-summary` | 待验证命令提示 |

Hook 不替代 `pnpm eval:phase` / `pnpm check:slice`。

## 验证快捷键（默认 T1）

`pnpm fix:changed` → `pnpm check:slice` →（仅 T3 Phase 收口）`pnpm eval:phase --plan <active-plan>`

**禁止默认** `pnpm verify`。合并前用户明确要求时再跑。
