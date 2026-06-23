---
title: 工程宪章（骨架）
status: draft
doc_type: governance
last_verified: 2026-05-07
---

# 工程宪章（Engineering Constitution）

> 本文档为**单一工程治理入口**的骨架，后续随团队共识迭代填充正文。

## 1. 目的

- 规定本 monorepo 的**不可协商底线**（安全、租户隔离、类型与包边界等）
- 与 `.cursor/rules/`、`AGENTS.md`、CI 门禁对齐，避免「口头规范」与「机器检查」脱节

## 2. 权威来源（当前）

| 主题                            | 事实来源                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| Monorepo 包边界、workspace 约定 | `scripts/verify-monorepo.mjs`、`.cursor/rules/common/monorepo.mdc`、根目录 `AGENTS.md` |
| 编码规范（按应用）              | `.cursor/rules/`                                                                       |
| AI 与提交约定                   | 根目录 `AGENTS.md`                                                                     |
| 架构决策记录                    | `docs/adr/`                                                                            |
| 业务术语                        | `docs/domain/glossary.md`                                                              |
| 文档如何写、如何归类            | `docs/governance/DOCUMENT_POLICY.md`                                                   |

## 3. Package Scripts Governance

root `package.json` scripts 是公共命令 API，不是脚本实现收纳处。

允许保留的 root scripts 类型：

- repo-level 通用入口：`dev`、`build`、`lint`、`typecheck`、`test`、`check`、`verify`
- 常用 app scope 入口：`dev:*`、`build:*`、稳定的 `lint:*` / `typecheck:*` / `check:*`
- 跨 app 契约入口：`generate-types`、`contracts:*`
- 治理入口：`fix:changed`、`check:slice`、`report:strict`、`verify:scripts`、`verify:*`
- Git hook 必需入口：`prepare`、`commitlint`

禁止继续放进 root scripts：

- 具体业务域命令、营销/财务/库存/任务/监控容器命令
- seed / reset / flush / destructive 命令
- 一次性排查命令、loadtest 命令、超长组合命令
- 只是为了 AI 调用而新增的每个小命令

复杂逻辑必须放在 `scripts/tasks/*.mjs`，新增或调整 root scripts 后运行 `pnpm verify:scripts`。

## 4. Verification Layers

完整层级定义、命令矩阵、证据等级见根 `AGENTS.md` §4-§6 + `.codex/playbooks/verification-gates.md`。本节只保留宪章层面的约束：`pnpm report:strict` 默认非阻塞，不进入 pre-commit / pre-push / 默认 CI。

## 5. 权威索引（不重复正文）

本宪章 **不** 作为第二套 AGENTS。细则以下列文件为准：

| 主题                 | Canonical                                                         |
| -------------------- | ----------------------------------------------------------------- |
| 硬规则 / 验证矩阵    | 根 `AGENTS.md`                                                    |
| Harness 检查项注册表 | `scripts/harness-manifest.mjs`（`pnpm harness:manifest`）         |
| 高风险清单           | `docs/governance/HIGH_RISK_REGISTRY.md`                           |
| 资金精度             | `docs/governance/MONEY_PRECISION_PROTOCOL.md`                     |
| 输出与模板           | `docs/governance/AGENT_OUTPUT_PROTOCOL.md`                        |
| 多会话编排           | `docs/governance/HARNESS_ROADMAP.md`、`docs/exec-plans/README.md` |

**待 ADR 或专题文档补齐**（勿在此复制全文）：安全与合规、多租户数据层、发布回滚、技术债例外流程。

## 6. 修订

- 重大变更应配套 ADR 或更新本文件并 bump `last_verified`
- Review：变更 `docs/governance/` 时 PR 应经 CODEOWNERS 中 `docs/` 路径负责人审核
