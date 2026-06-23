---
title: Backend TypeScript strictness and any governance
status: accepted
doc_type: adr
last_verified: 2026-05-10
---

# ADR: Backend TypeScript 严格度与 any 治理策略

**日期**：2026-03-25
**状态**：accepted

## 背景

根 `tsconfig.base.json` 启用了 `strict: true` 和 `strictNullChecks: true`。
Backend `tsconfig.json` 覆盖为 `strictNullChecks: false`，原因是 NestJS + Prisma
生态中大量模式（依赖注入、装饰器、ORM 返回值）在 `strictNullChecks` 下需要额外的
null 处理代码，当前代码量较大，一次性开启会产生大量类型错误。

2026-02-23 已完成核心模块的 `any` 渐进治理：Store VO、Repository、Finance Service 等核心路径已大幅减少显式 `any`，并补充了通用类型与测试辅助类型。测试文件和部分历史声明仍可能保留 `any`，后续按低风险、分模块方式继续收敛。

## 决策

短期保持 backend 根配置 `strictNullChecks: false`，中期按模块逐步开启：

1. 新模块默认开启（通过模块级 tsconfig 继承）
2. 存量模块在重构时逐步开启
3. 不设硬性时间线，跟随业务迭代自然推进

`any` 治理遵循以下长期规则：

1. 新增业务代码默认禁止引入无边界的显式 `any`。
2. Prisma 查询、Repository 参数、DTO / VO / ViewModel 优先使用 Prisma 生成类型、领域类型或共享契约类型。
3. 外部输入、JSON 字段、第三方 SDK 返回值等边界可使用 `unknown`、`Record<string, unknown>` 或明确的 JSON 类型，再通过解析、类型守卫或转换函数收窄。
4. 测试 mock 可以使用集中维护的 typed helper；历史测试中的 `any` 不作为功能开发的阻塞项，但在触碰对应测试时顺手收敛。
5. 不为消除类型告警引入大范围重构；核心业务路径优先，测试和低风险历史代码渐进处理。

## 影响

- 正面：不阻塞当前开发进度
- 负面：backend 代码中可能存在运行时 null 引用错误
- 缓解：通过 E2E 测试、类型守卫、集中 mock helper 和 Code Review 覆盖高风险路径
- 约束：完成型开发过程稿不再长期保留，类型治理结论沉淀在本 ADR；若未来调整严格度，应更新本 ADR，而不是新增一次性实施计划
