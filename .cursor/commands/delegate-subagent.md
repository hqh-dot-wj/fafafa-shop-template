# Delegate Subagent（Task 委派）

入口命令；正文见 `.codex/playbooks/subagent-roles.md` §4.2 与 `.cursor/rules/subagent-delegation.mdc`。

## 用法

用户说明 **子代理名** + **任务范围** 后，父 Agent **必须**先调用 **Task**（`subagent_type` = 该名），主会话只汇总，禁止先全仓 Grep。

## 复制模板（英文，最稳）

```text
Launch the Task tool with subagent_type <name>.
<任务范围与约束，review-only 或 test-spec 等>
Parent agent only summarizes after the subagent returns.
```

## 常用 name

| name | 用途 |
| --- | --- |
| `doc-explorer` | 找文档 / context-scan |
| `test-spec` | 测试规格（不写代码） |
| `review-money` | 金额/退款/支付 |
| `review-security` | 安全/租户/权限 |
| `review-contract` | 契约 / common-types |
| `review-tests` | 测试质量 |
| `implementer` | 按规格写代码 |
| `test-runner` | 跑 fix:changed / check:slice |

## 中文等价

```text
请用 Task 工具委派子代理 <name>，主会话只汇总，不要先在主会话全仓搜索。
```
