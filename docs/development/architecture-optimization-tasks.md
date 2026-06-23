---
title: 架构优化任务索引
status: active
doc_type: development
last_verified: 2026-05-10
---

# 架构优化任务索引

本文档只保留架构优化的长期索引和未关闭事项。已完成任务的执行细节、阶段性总结和一次性方案不在这里长期堆叠；可维护结论应沉淀到 ADR、治理文档、process-spec 或对应模块设计。

## 已收敛事项

| 主题 | 状态 | 长期落点 |
| ---- | ---- | -------- |
| Monorepo 基线治理 | 已完成基础治理，包边界、工作区依赖、脚本治理由自动化检查兜底 | [Monorepo 架构审计报告](./monorepo-architecture-audit.md)、[verify-monorepo](../../scripts/verify-monorepo.mjs) |
| CODEOWNERS 与审查规则 | 已建立代码所有权和高风险区域审查入口 | [CODEOWNERS 使用指南](./codeowners-guide.md)、[GitHub 配置指南](./github-setup.md) |
| 依赖版本统一 | 已通过 pnpm workspace 与 catalog 约束依赖入口 | [依赖管理规范](./dependency-management.md) |
| TypeScript `any` 治理 | 核心模块已完成一轮治理；长期策略以 ADR 为准 | [ADR-0001](../adr/ADR-0001-typescript-strictness.md) |
| CommissionService 拆分 | 已从单体服务拆为门面、配置、校验、计算、结算等职责 | [佣金计算流程规格](../../apps/backend/docs/process-specs/finance/commission-calculate.process-spec.md) |
| 财务对账与结算语义 | 已把过程方案收敛为运行规格 | [对账中心流程规格](../../apps/backend/docs/process-specs/finance/reconciliation-center.process-spec.md) |
| 商品卡展示边界 | 已把营销标签和商品陈列边界收敛为 ADR 与投影规格 | [ADR-0006](../adr/ADR-0006-product-card-display-boundary.md)、[商品展示投影规格](../../apps/backend/docs/process-specs/marketing/product-display-projection.process-spec.md) |
| Harness 与测试治理 | 测试文件、mock、覆盖率和验证门禁已沉淀到治理文档 | [Harness Engineering](../governance/HARNESS_ENGINEERING.md) |

## 历史完成项摘要

| 日期 | 完成项 | 保留结论 |
| ---- | ------ | -------- |
| 2026-02-23 | 修复佣金计算 N+1 查询 | 批量查询和内存索引是佣金计算默认实现方向；不要恢复逐项查询。 |
| 2026-02-23 | 添加 CODEOWNERS、PR/Issue 模板与 GitHub 配置说明 | 高风险路径需要明确审查责任，规则以 `.github/CODEOWNERS` 与开发指南为准。 |
| 2026-02-23 | 统一依赖版本与工作区管理 | 新增依赖优先使用 workspace/catalog 现有模式，不在子包单独漂移。 |
| 2026-02-23 | 添加租户访问审计日志 | 租户访问、安全审计和异常访问排查属于高风险面，后续改动需按根 `AGENTS.md` 高风险流程确认。 |
| 2026-02-24 | 拆分 CommissionService | `CommissionService` 仅保留门面职责，新增佣金能力优先落到对应子服务。 |
| 2026-02-24 | 跨店限额并发安全修复 | 涉及营销/分销并发扣减时，必须优先确认事务、锁或幂等策略。 |
| 2026-02-24 | `AUDIT_SERVICE` 完整实现 | 审计能力作为安全闭环的一部分，后续不要用空实现或临时 provider 绕过。 |
| 2026-02-24 | 部分退款按比例回收佣金 | 退款链路需按退款项、退款比例和幂等语义处理，不做全量粗暴回收。 |
| 2026-02-24 | Finance、Store、PMS、Marketing 核心模块 `any` 治理 | 类型策略以 ADR-0001 为准，必要 `any` 需有局部说明和替代计划。 |

## 未关闭事项

| 事项 | 当前状态 | 下一步 |
| ---- | -------- | ------ |
| Client / Admin 模块 `any` 治理 | 未确认已完成 | 按 ADR-0001 分批治理，不用一次性扩大到全仓。 |
| 核心接口 SLO | 有 rollout 文档，需按接口风险逐步落地 | 继续维护 [core-api-slo-rollout](./core-api-slo-rollout.md)。 |
| 技术债标记 | 未形成统一执行入口 | 先确认标记规范，再决定是否进入 lint / report 工具。 |
| 模块间事件通信 | 仍属于架构演进项 | 只有在模块耦合成为真实阻塞时再设计，不提前抽象。 |

## 维护规则

1. 新增完成项时，只写一行摘要和权威落点。
2. 若产生可复用决策，优先新增或更新 ADR；若是业务流程，优先更新 process-spec。
3. 不把执行计划、复盘长文、代码片段和阶段性汇报继续追加到本文档。
4. 对应功能验收关闭后，按 [DOCUMENT_POLICY](../governance/DOCUMENT_POLICY.md) 删除过程稿。
