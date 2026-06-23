---
title: Claude Code Agent Teams 协作手册
status: active
doc_type: playbook
last_verified: 2026-05-20
---

# Claude Code Agent Teams 协作手册

实验性功能说明见 [多智能体并行协作开发模式（博客园转载）](https://www.cnblogs.com/dhcn/p/19694044)。本 playbook 把三种模式**适配本 monorepo**（`AGENTS.md`、高风险、exec-plan、验证分层）。

## 0. 启用与显示模式（本机）

在 **用户级或项目级** `~/.claude/settings.json` 或仓库 `.claude/settings.json`：

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "in-process"
}
```

- Windows 默认用 **`in-process`**（`Shift+Up/Down` 切换队友）；有 tmux/iTerm2 可改为 `"tmux"` 分屏。
- 修改后**重启 Claude Code**，`/config` 中应出现 Agent Teams 相关项。
- 建议 Claude Code **≥ 2.1.33**（见上文链接）。

**与本仓库 Harness 的关系**

| 机制 | Agent Teams                         | 本仓库 Subagent / exec-plan               |
| ---- | ----------------------------------- | ----------------------------------------- |
| 协调 | Team Lead + 共享任务列表 + 队友互聊 | 主会话 + `docs/exec-plans/active/<id>.md` |
| 适用 | 并行审查、对抗排查、跨层并行实现    | 单线 Phase、高风险停手确认                |
| 成本 | 每队友独立上下文，token 更高        | 较低                                      |

**大改 / 资金 / 支付 / Prisma**：仍须 `active` exec-plan + `HIGH_RISK_REGISTRY.md`；Team Lead 在委托模式下**只调度不写代码**（`Shift+Tab` 委托模式）。

---

## 1. 并行代码审查（Parallel Code Review）

**何时用**：PR 或大 diff 需要从多视角同时看，且以**只读**或「仅写 review 结论」为主。

**不适合**：队友都要改同一文件同一函数（合并冲突 + 绕过 Harness）。

### 1.1 推荐队友拆分（本仓库）

| 队友              | 焦点                               | 必读                                                                             |
| ----------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| `review-security` | 租户隔离、权限、注入、敏感数据     | `HIGH_RISK_REGISTRY.md`、`.codex/playbooks/review-mode.md`                       |
| `review-money`    | 金额、幂等、状态机、退款/支付      | `MONEY_PRECISION_PROTOCOL.md`、`docs/governance/ERROR_OBSERVABILITY_STANDARD.md` |
| `review-contract` | OpenAPI / `libs/common-types` 漂移 | 根 `AGENTS.md` §1 契约链、`libs/AGENTS.md`                                       |
| `review-tests`    | spec 是否真行为、mock 是否失真     | `verification-gates.md` §证据等级、`.codex/playbooks/co-evolution-checklist.md`  |

### 1.2 复制即用的 Lead Prompt

```text
创建 Agent Team 对当前分支相对 origin/main 的 diff 做并行审查（只读，不改业务代码）。
队友 4 人：review-security、review-money、review-contract、review-tests（职责见 .codex/playbooks/claude-agent-teams.md §1.1）。
任务模式 review-only；路径类型按 diff 涉及 app 判定；高风险域标 L3。
每位队友独立输出 findings（严重度排序），Lead 汇总为一份合并清单，并标注未验证项。
禁止用 typecheck 通过代替业务审查结论。
```

### 1.3 Lead 收口格式

1. Findings（按严重度，带文件路径）
2. 各队友分歧或未证实假设
3. 建议验证命令（如 `pnpm check:slice`、`pnpm eval:phase --plan …`）— **须你或 Lead 重跑**，不以队友自述为准

---

## 2. 对抗式调试（Adversarial Debugging）

**何时用**：间歇性失败、多模块嫌疑、根因不明；让队友**提出并互相反驳**假设。

**不适合**：已知单点 bug 且已有失败测试（用 `test-first-fix` + 单会话更快）。

### 2.1 流程

1. Lead 写清**现象、复现步骤、环境、相关日志**（禁止编造）。
2. 生成 3～5 个调查队友，每人一条**可证伪假设**。
3. 队友只读调查 + 运行**只读/局部**命令；互相 `message` 质疑对方结论。
4. Lead 只采纳有**证据路径**的假设；转入修复前命中高风险须停手确认。

### 2.2 复制即用的 Lead Prompt

```text
创建 Agent Team 对抗式排查以下问题（先只读）：
【现象】
【复现】
【已排除】

生成 4 个调查队友，各负责一条不同假设（数据库/并发/第三方/配置/网络等）。
要求队友互相挑战：无日志、无代码路径的结论标为「未验证」。
路径类型 backend-only 或 cross-app 按涉及模块；禁止队友直接改生产数据。
汇总：存活假设 + 建议的最小验证实验（命令级）。
```

### 2.3 与本仓库 hooks

队友跑 Bash 仍受 `.claude/hooks/pre-bash-guard.mjs` 约束；禁止 `migrate reset`、批量写库等（见 `pre-write-guard`）。

---

## 3. 跨层功能开发（Cross-Layer Feature）

**何时用**：功能可拆成**文件边界清晰**的前端 / 后端 / 契约 / 测试，且已有 exec-plan Phase。

**不适合**：强顺序依赖且无法并行；或多人改同一 `service.ts`。

### 3.1 推荐队友与依赖（契约链）

```text
Phase 依赖（任务列表）：
  T1 backend API + DTO  →  T2 pnpm generate-types  →  T3 admin-web 消费类型
  T4 backend spec (L3)     （可与 T1 同队友或紧随 T1）
  T5 admin 页面/路由       （依赖 T3）
```

| 队友            | 范围                                                      | 禁止                   |
| --------------- | --------------------------------------------------------- | ---------------------- |
| `impl-backend`  | `apps/backend/**` 本 Phase 路径                           | 手写前端 DTO           |
| `impl-contract` | 触发 `pnpm generate-types`、检查 `libs/common-types`      | 跳过 backend 先改前端  |
| `impl-admin`    | `apps/admin-web/**`（views 时跑 verify:admin-view-types） | import backend `src`   |
| `impl-tests`    | `*.spec.ts`、共演清单                                     | mock 到失真状态机/金额 |

### 3.2 复制即用的 Lead Prompt

```text
创建 Agent Team 按 docs/exec-plans/active/<TASK-ID>.md 的 current_phase 实现功能。
先读 plan 与 AGENTS.md；cross-app 契约顺序：backend → generate-types → admin-web。
共享任务列表：T1 backend → T2 generate-types → T3 admin → T4 tests（依赖见 .codex/playbooks/claude-agent-teams.md §3.1）。
每位队友只改自己模块路径；触达文件须做注释审查（AGENTS.md §7）。
Lead 使用委托模式（Shift+Tab），不亲自写代码；Phase 结束由人类跑 pnpm eval:phase 与 pnpm check:slice。
```

### 3.3 计划批准（高风险）

对 Prisma / 支付 / 退款 Phase，在 prompt 中加：

```text
所有队友在修改代码前须提交计划；Lead 仅批准包含迁移说明/幂等/回滚/测试的 plan。
```

---

## 4. 操作速查

| 操作                    | 方式                                                      |
| ----------------------- | --------------------------------------------------------- |
| 委托模式（Lead 只调度） | `Shift+Tab`                                               |
| in-process 切换队友     | `Shift+Up` / `Shift+Down`                                 |
| 任务列表                | `Ctrl+T` 或 `/tasks`                                      |
| 清理团队                | 对 Lead 说「清理团队」（先关闭队友）                      |
| 权限预批                | `/permissions`（勿默认 `--dangerously-skip-permissions`） |

团队元数据路径（Claude 本地）：`~/.claude/teams/{team-name}/`、`~/.claude/tasks/{team-name}/`。

---

## 5. 限制与成本（必读）

- 实验功能：会话恢复、任务状态同步、嵌套团队等有限制（见外链文章「当前功能限制」）。
- Token：队友数 ≈ 线性成本；小任务用**单会话 + subagent** 更省。
- **完成判定**：Agent Teams 不能替代 `eval:phase` / `check:slice`；交付须区分已验证与未验证。

---

## 6. 与 Cursor / Codex

- **Cursor**：无 Agent Teams；并行审查可用多 subagent 或 `review-mode.md`，但无队友互聊。
- **Codex**：以 `.codex/playbooks/session-orchestration.md` + exec-plan 为主；复杂并行审查可复制 §1.2 Prompt 到 Codex 会话（人工扮演 Lead）。
