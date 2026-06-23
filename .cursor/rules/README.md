# Cursor Rules 兼容层说明

`.cursor/rules/` 是 Cursor 的 IDE 兼容层，不是仓库规范的主权威来源。

## Canonical 顺序

发生冲突时，按以下顺序处理：

1. 用户当前指令
2. 当前目录最近的 `AGENTS.md`
3. 仓库根 `AGENTS.md`
4. `.codex/playbooks/*`
5. `.cursor/rules/*`

说明：

- `AGENTS.md` 与 `.codex/playbooks/*` 是 canonical。
- `.cursor/rules/*` 负责将 canonical 规则适配到 Cursor 的自动附着机制。
- `.cursor/rules/*` 不应再重复定义仓库硬约束。

## 当前生效规则

### 入口

- `000-entry.mdc`（Cursor 上下文入口，只指向 canonical，不复制全文）

### 通用规则

- `common/core.mdc`
- `common/monorepo.mdc`
- `common/security.mdc`
- `common/architecture.mdc`
- `karpathy-guidelines.mdc`（行为准则摘要；正文在根 `AGENTS.md`）
- `testing.mdc`

### backend

- `backend/backend-runtime.mdc`
- `backend/backend-quality.mdc`

### admin-web

- `admin-web/admin-web-structure.mdc`
- `admin-web/admin-web-type-data.mdc`

### miniapp

- `miniapp/conventions.mdc`
- `miniapp/ui-spec.mdc`

## 弃用规则

以下文件保留为弃用说明，不再承载规范正文：

- `dev-cognitive-flow.mdc`
- `notion-workspace.mdc`

## 子代理（Cursor）

项目级定义见 `.cursor/agents/*.md`；角色正文见 `.codex/playbooks/subagent-roles.md` §4.2。

- **稳定委派**：`Launch the Task tool with subagent_type <name>.`（见 `subagent-delegation.mdc`）
- **斜杠**：`/review-money` 等；命令 `delegate-subagent`

## 维护原则

- 一条规则只保留一个 canonical 来源。
- `.cursor/rules/*` 可以做摘要和适配，但不要重述完整规范。
- 需要大段正文时，优先修改 `AGENTS.md` 或 `.codex/playbooks/*`，再回到这里做适配。
- Micro / Slice / Batch / PR 验证分层以根 `AGENTS.md` 与 `.codex/playbooks/verification-gates.md` 为准。
