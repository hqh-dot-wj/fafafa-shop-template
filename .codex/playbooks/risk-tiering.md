---
title: 风险与验证分级
status: active
doc_type: playbook
last_verified: 2026-05-21
---

# 风险与验证分级

与 [harness-workflow.md](./harness-workflow.md) 配套；**不**重复任务模式定义（见根 `AGENTS.md` §2）。

## 1. 验证 Tier（T）

| Tier | 何时 | 命令上限 | 禁止默认 |
| --- | --- | --- | --- |
| T0 | 注释/typo，非高风险路径 | `pnpm fix:changed` | slice、verify |
| T1 | 单 app 小改 | + `pnpm check:slice` | exec-plan、verify、全仓 test |
| T2 | 契约/佣金/seed/跨 app 切片 | slice + 域行为测试（见 verification-gates） | `pnpm verify` |
| T3 | 大改（exec-plan 硬触发） | 每 Phase slice；收口 `eval:phase` | 同会话全仓扫描 |
| PR | 用户明确「合并前」 | `pnpm verify` 或 `verify:pre-push:full` | — |

日常 `git push` 默认只跑 `pnpm check:slice`（见根 `package.json` `pre-push`）。

## 2. 删除 Tier（D）

| Tier | 条件 | 行为 |
| --- | --- | --- |
| D0 | 用户消息含**明确路径** + **原因**；非 prisma migration/seed/生产数据 | 直接删；**禁止**二次确认 |
| D1 | 批量或跨 app，无 D2 | **一次**清单确认 |
| D2 | migration、改已有 migration、生产/批量回填 | `HIGH_RISK_REGISTRY.md` 停手 |

模块退役：先 `pnpm harness:impact`，再 [module-retirement.md](./module-retirement.md)。

## 3. 高风险 vs 文案

| 场景 | 分级 |
| --- | --- |
| `system/dict`、dictType、seed 字典 | T2 + 停手（字典治理） |
| `store/distribution` 等页面改 label，无 dictType | T1 |
| 改佣金公式、订单状态机 | T2 + L3 行为测试 |

## 4. 输出（T0/T1 短交付）

交付须含：`tier`、`commands_run`、`commands_skipped_and_why`、已完成/未验证/残余风险。勿套模板 28 全文。
