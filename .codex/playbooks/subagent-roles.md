---
title: 子代理角色注册表
status: active
doc_type: playbook
last_verified: 2026-05-21
---

# 子代理角色注册表

业务规则 **只在本文件与引用的 playbook/governance** 维护。三端 agent 壳（`.cursor/agents/`、`.claude/agents/`、`.codex/agents/`）只做触发与指针，禁止在壳内复制根 `AGENTS.md` 全文。

## 0. 三种模式（主会话先选）

| 模式 | 何时用 | 工具 |
| --- | --- | --- |
| **主会话** | T0/T1 小改；无并行需求 | Cursor / Claude / Codex 默认 |
| **子代理** | 单任务要隔离上下文（扫文档、出规格、单视角 review、跑测） | Cursor Task/`/name`；Claude `@name`；Codex 显式 spawn |
| **Agent Teams** | 大 PR 四视角并行审查；exec-plan 多队友实现 | **仅 Claude Code**，见 `claude-agent-teams.md`；启用见该文 §0 |

完成判定永远是主会话或人类跑 `pnpm check:slice` / `pnpm eval:phase`，**不以**子代理/队友自述代替。

## 1. 角色一览

| name | 只读 | 典型触发 |
| --- | --- | --- |
| `doc-explorer` | 是 | 找文档、context-scan、跨 app 边界不清 |
| `test-spec` | 是 | backend 新增/改测前出规格 |
| `review-security` | 是 | auth/租户/权限/注入类 diff |
| `review-money` | 是 | 金额/退款/支付/对账/佣金 diff |
| `review-contract` | 是 | OpenAPI、`libs/common-types`、前后端契约 |
| `review-tests` | 是 | spec 质量、mock 假绿、缺边界用例 |
| `implementer` | 否 | 已有 test-spec 或明确实现范围 |
| `test-runner` | 否 | 跑验证命令、核对 exit code |

## 2. 各角色必读与输出

### doc-explorer

- **任务模式**：`review-only`
- **必读**：`context-scan.md`、`doc-request-flow.md`（若涉及新建 `.md`）
- **输出**：模板 **26** 精简版（路径 + 用途 + 未验证假设）；`context-scan` 第 9 问摘要
- **禁止**：改业务代码；未确认新建 `.md`

### test-spec

- **任务模式**：`test-first-fix`（仅规格阶段）
- **必读**：`docs/governance/TEST_SPEC_PROTOCOL.md`
- **输出**：规格表（**不是**测试代码）
- **禁止**：写实现；弱化规格

### review-security

- **任务模式**：`review-only`
- **必读**：`review-mode.md`、`HIGH_RISK_REGISTRY.md`
- **输出**：模板 **25** Findings（安全/租户/权限面）
- **禁止**：改代码

### review-money

- **任务模式**：`review-only`
- **必读**：`MONEY_PRECISION_PROTOCOL.md`（含 §5.3 派发硬约束）、`review-mode.md`
- **输出**：模板 **25** Findings（金额/状态机/对账面）
- **禁止**：改代码；引入 `Number()` 金额运算

### review-contract

- **任务模式**：`review-only` 或 `contract-change` 审查
- **必读**：根 `AGENTS.md` 契约链、`libs/AGENTS.md`
- **输出**：模板 **25** Findings（契约漂移）
- **禁止**：手写前端 DTO 绕过 `common-types`

### review-tests

- **任务模式**：`review-only`
- **必读**：`verification-gates.md`、`co-evolution-checklist.md`（若改 service）
- **输出**：模板 **15** + **25** 测试缺口与假绿风险
- **禁止**：用 typecheck/lint 代替行为测试结论

### implementer

- **任务模式**：按任务（常 `test-first-fix` / `new-feature`）
- **必读**：路径 playbook（`backend-safe-change.md` 等）、`co-evolution-checklist.md`（触达 service 时）
- **输入**：test-spec 产出（若有）；`docs/exec-plans/active/<id>.md` 当前 Phase
- **禁止**：修改 test-spec；扩大 Phase 范围；mock 假绿

### test-runner

- **任务模式**：验证
- **必读**：`verification-gates.md`、`harness-workflow.md` Tier 上限
- **输出**：实际运行的命令 + **exit code**；未运行则写「未验证」
- **禁止**：未跑命令写「已通过」；默认 `pnpm verify` 全量

## 3. 主会话派发子代理时必带

每条子任务 prompt 须重复（根 `CLAUDE.md` 子代理段）：

- 任务模式、路径类型、high-risk、cross-app
- 只读/可写范围、本角色 name
- 上表「必读」路径
- 预期输出模板编号
- 禁止 mock 假绿、禁止无证据结论

## 4. 三端配置位置

| 工具 | 项目级路径 |
| --- | --- |
| Cursor | `.cursor/agents/<name>.md` |
| Claude Code | `.claude/agents/<name>.md`（可与 Cursor 同文） |
| Codex | `.codex/agents/<name>.toml` |

### 4.1 Cursor 自动委派（description 规范）

`description` 字段 **必须英文**，并包含（见 [Cursor Subagents](https://cursor.com/docs/subagents)）：

1. **`Use proactively when …`** — 明确触发场景（关键词：finance、refund、cross-app、test-spec 等）
2. **`Do not use when …`** — 避免误触发
3. **输出形态** — read-only findings / spec table / exit codes

主 Agent 靠 `description` 匹配 Task 委派；中文-only 描述自动命中率低。

### 4.2 可靠触发（已验证，三端通用）

仅写业务需求（如「审查退款代码」）时，Cursor **可能**不自动 Task 委派；下列写法 **稳定**（Composer / Claude Code / Codex 在具备 Task/spawn 时均有效）：

**英文（推荐，一行）**

```text
Launch the Task tool with subagent_type <name>. Parent agent only summarizes; do not grep the whole repo first.
```

**中文（等价）**

```text
请用 Task 工具委派子代理 <name>，主会话只汇总结果，不要先在主会话里全仓搜索。
```

`<name>` 取 §1 表：`doc-explorer` | `test-spec` | `review-security` | `review-money` | `review-contract` | `review-tests` | `implementer` | `test-runner`。

**示例（金额审查）**

```text
Launch the Task tool with subagent_type review-money.
Scope: apps/backend payment/refund/commission paths (you pick 5–10 files). review-only; read MONEY_PRECISION_PROTOCOL; findings only; no edits.
Parent summarizes when done.
```

显式 `/review-money` 或 Claude `@review-money` 亦可；与上一句二选一。

### 4.3 排错：配置了仍不触发

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 父 Agent 自己 Grep/Read 全文 | 无 **Task** 工具或未读 `subagent-delegation.mdc` | Agent 模型改为 **Sonnet / GPT / Opus**（勿 Auto、勿 Composer 1）；见 [论坛](https://forum.cursor.com/t/composer-1-cant-use-sub-agent/149773) |
| 提示 `Tool not found: Task` | 同上 | 换模型或升级 Cursor（2.5+ 部分版本已修 Composer） |
| 有 Task、业务话不委派、加「Launch Task…」就委派 | 隐式委派不可靠 | 用户提示用 §4.2 一行模板；父 Agent 见 `subagent-delegation.mdc` |
| 手动「派发」可用、自然语言不行 | Task 有，但父 Agent 未委派 | 新开会话 + §4.2 模板 |
| 内置 explore 有、自定义没有 | 仅 Explore 走内置路径 | 换模型 + §4.2 指名子代理 |

**30 秒自检**（贴到 Agent，勿读仓库）：

```text
只回答：① 你当前可用工具名列表里有没有 Task；② 你在用什么模型；③ 若无 Task，明确说不能委派自定义子代理。
```

## 5. 与 Agent Teams

四视角并行审查（security / money / contract / tests）在 Claude 下可用 **Teams** 一次起 4 队友；单视角或 Cursor 上用对应 **子代理** 即可，不必强行 Teams。
