---
title: Harness 摩擦登记表
status: active
doc_type: governance
last_verified: 2026-05-21
owner: engineering-governance
---

# Harness 摩擦登记表

**用途**：减法清单，不是新规范全集。每条标注建议处理与目标波次。默认工作流见 [`.codex/playbooks/harness-workflow.md`](../../.codex/playbooks/harness-workflow.md)。

| 类 | 含义 |
| --- | --- |
| C | 确认摩擦 |
| R | 阅读/上下文摩擦 |
| V | 验证摩擦 |
| A | 应自动化仍人工 |
| D | 技术债/兼容未退役 |

| 波次 | 含义 |
| --- | --- |
| W1 | 流程入口 + 登记表 |
| W2 | Tier + 交付/pre-push 文档 |
| W3 | pr:land / impact / cutover-due |
| BH | baseline-hardening 另立项 |

## C — 确认

| ID | 证据 | 误报 | 处理 | 波次 |
| --- | --- | --- | --- | --- |
| C-01 | `AGENTS.md` §0 #9 未确认不做删除 | 用户已写明路径+原因仍二问 | Tier D0；协议禁止二次确认 | W2 |
| C-02 | `HIGH_RISK_REGISTRY` 删除/批量一行 | 删 Vue/文档等同删库 | risk-tiering 路径级 | W2 |
| C-03 | `backend/AGENTS.md` schema/seed 须确认 | 合理保留 D2 | 仅 D2 停手 | W2 |
| C-04 | 新增 `.md` 须用户确认 | 治理 md 重复确认 | 用户发起 harness 任务视为已确认 | W2 |
| C-05 | `DOCUMENT_POLICY` 鼓励删过程稿 vs #9 冲突 | 交付后删文档被拦 | D0 删 docs 过程稿 | W2 |
| C-06 | Agent 保守默认「再确认一次」 | 无规则条文 | workflow 反模式 | W1 |

## R — 阅读

| ID | 证据 | 误报 | 处理 | 波次 |
| --- | --- | --- | --- | --- |
| R-01 | `.claude/CLAUDE.md` 4 条平铺必读 | 小任务也读 plan/teams | 改条件表 → workflow | W1 |
| R-02 | 子 AGENTS + 13 playbook 链 | 通读 | 仅 T1 一条 + 触发打开 | W1 |
| R-03 | `HARNESS_ENGINEERING.md` 626 行 | 当流程入口 | 仅索引；入口改 workflow | W1 |
| R-04 | `AGENT_OUTPUT_TEMPLATES` 全模板 | T1 也模板 28 | T1 短交付字段 | W2 |
| R-05 | `docs/design/marketing-revamp/**` | 改营销必读全文 | 默认 out-of-scope；点名再读 | W1 |
| R-06 | `context-scan` 9 问未触发也扫 | 扩大上下文 | T2+ 才 L2 | W1 |
| R-07 | 三端 `.cursor`/`.claude`/`.codex` 重复 | 规则冲突感 | canonical 顺序不变；入口收敛 | W1 |

## V — 验证

| ID | 证据 | 误报 | 处理 | 波次 |
| --- | --- | --- | --- | --- |
| V-01 | `pre-push` → `verify:pre-push` 重型 | 每次 push 近 PR 全量 | 文档：日常 slice；合并前 verify | W2 |
| V-02 | Agent 默认 `pnpm verify` | 小改也全量 | MSV 禁止默认 | W1 |
| V-03 | `check:slice` 不启 Nest（`HARNESS_AUDIT` §1.4） | typecheck 绿但 dev 挂 | boot smoke；`HARNESS` §14.7 | BH |
| V-04 | eslint 全局 warn（`HARNESS_AUDIT` §1.1） | lint 不阻断 | 基线 error 化 | BH |
| V-05 | `strictNullChecks: false` backend | NPE 运行时爆 | 基线开启 | BH |
| V-06 | smoke/字符串测试冒充 L3 | 假绿 | verification-gates 已有；执行 Tier | W1 |
| V-07 | `co-evolution` 倾向全 backend test | 小 service 改也全量 | T1 slice 域测试即可 | W2 |
| V-08 | `TEST_SPEC` 小改也完整 Phase 0–5 | 修 assert 过重 | T1 简化规格（待写） | W2 |

## A — 自动化

| ID | 证据 | 误报 | 处理 | 波次 |
| --- | --- | --- | --- | --- |
| A-01 | 无 merge+删分支脚本 | PR 绿后人工 merge | `pnpm pr:land` | W3 |
| A-02 | `.cursor/commands/create-pr.md` 空壳 | 无 gh 封装 | 链 AGENTS + 可选补 command | W3 |
| A-03 | `eval:phase` 存在但 Agent 手写 exit 0 | 假 PhaseDone | workflow 强调重跑 | W1 |
| A-04 | `harness:plan-stale` 无习惯跑 | active plan 烂尾 | L6 运营提示（E 可选） | W3 |
| A-05 | 模块删除无关联扫描 | 漏 seed/文档 | `pnpm harness:impact` | W3 |

## D — 技术债 / 兼容

| ID | 证据 | 误报 | 处理 | 波次 |
| --- | --- | --- | --- | --- |
| D-01 | `cutover-registry.ts` dropAfter 已过/临近 | 路由仍在 | `harness:cutover-due` warn | W3 |
| D-02 | `activity-center-route.spec` 锁 legacy hideInMenu | 删路由先红测 | 专项 PR：先测后删 | W3 |
| D-03 | `marketing-aggregate-traffic` compat Redis | 零流量仍保留 | 退役 playbook 节 | W3 |
| D-04 | `activity-item.controller` 仅兼容注释 | 死代码 | 随 cutover 专项删 | W3 |
| D-05 | `approval.service` 双字段 configId | API 债 | 契约变更另 PR | BH |
| D-06 | 分销/门店多域 alignment 与 seed 分散 | 删页面漏 seed | `harness:impact` + module-retirement | W3 |
| D-07 | `forwardRef+require` 营销模块（`HARNESS_AUDIT`） | 环检测盲 | 架构 BH | BH |
| D-08 | spec 漂移检查可 mock 改绿（`HARNESS_AUDIT` §1.3） | 测试无信号 | check-spec-drift 强化 | BH |

## 验收样例（用户举的三例）

| 样例 | 登记 ID | 波次 |
| --- | --- | --- |
| 删文件仍确认 | C-01, C-06 | W1–W2 |
| 营销兼容堆版本 | D-01–D-05 | W3 |
| PR 后人工 merge/删分支 | A-01 | W3 |

## 维护

- 新增摩擦：先登记本表，再改 workflow/manifest；避免只加长文 AGENTS。
- 本表 ≥6 个月无更新：合并已关闭项进 `HARNESS_AUDIT` 或归档，勿无限扩表。
