# Codex 仓库执行层说明

`.codex/` 用于存放仓库内的 Codex 执行手册（playbook）。

这些文件不是业务设计文档，也不是 IDE 私有配置；它们解决的是：

- 接任务时先读什么
- 读到什么程度算够
- backend / admin-web / miniapp 分别怎么改
- 哪些场景必须升级风险意识
- 什么时候需要哪些验证
- 哪些任务必须按统一输出协议给出分析、方案、Mock 与交付

## 规则优先级

发生冲突时，按以下顺序处理：

1. 用户当前指令
2. 当前目录最近的 `AGENTS.md`
3. 仓库根 `AGENTS.md`
4. `.codex/playbooks/*`
5. `docs/governance/AGENT_OUTPUT_PROTOCOL.md` / `docs/governance/AGENT_OUTPUT_TEMPLATES.md` / `docs/governance/DOCUMENT_POLICY.md`
6. `.cursor/*` / `.claude/*` / `.serena/memories/*`

说明：

- `.codex/playbooks/*` 负责执行动作，不负责重新定义仓库硬约束。
- `.cursor/*`、`.claude/*`、`.serena/memories/*` 是工具兼容层或摘要，不是 canonical 规则正文。

## 长任务默认路径

大 refactor、跨 app、预计多会话：先 `playbooks/session-orchestration.md`，再维护 `docs/exec-plans/active/<TASK-ID>.md`（模板见 `docs/exec-plans/templates/`）。Phase 顺序见 `playbooks/large-refactor.md`。

## 当前 playbook

- `playbooks/context-scan.md`
- `playbooks/session-orchestration.md`
- `playbooks/large-refactor.md`
- `playbooks/backend-safe-change.md`
- `playbooks/admin-web-module-change.md`
- `playbooks/miniapp-page-change.md`
- `playbooks/dict-and-job-change.md`
- `playbooks/verification-gates.md`
- `playbooks/review-mode.md`
- `playbooks/doc-request-flow.md`
- `playbooks/co-evolution-checklist.md`

## Canonical 模板

- `docs/governance/AGENT_OUTPUT_PROTOCOL.md`
- `docs/governance/AGENT_OUTPUT_TEMPLATES.md`
- `docs/governance/AGENT_OUTPUT_PROTOCOL_EXAMPLES.md`

## 工程执行入口

完整验证矩阵与命令分层见根 `AGENTS.md` §4-§6 + `.codex/playbooks/verification-gates.md`。本节只保留 `.codex/` 视角的独有约束：

- root package scripts 是公共命令 API；复杂实现放在 `scripts/tasks/*.mjs`，新增公共入口后必须能通过 `pnpm verify:scripts`。

## 使用原则

- 先读最近的 `AGENTS.md`，再读相关 playbook。
- playbook 只解决“怎么执行”，不替代仓库规则本身。
- 统一输出协议入口以 `docs/governance/AGENT_OUTPUT_PROTOCOL.md` 为准，完整模板正文以 `docs/governance/AGENT_OUTPUT_TEMPLATES.md` 为准。
- `.codex/` 下只有 `playbooks/` 与本 README 属于规则正文；`tmp/`、`runtime-logs/` 属于本地执行产物，不入库。
- 若当前任务不需要某个 playbook，不要为了形式把全部 playbook 都读一遍。
