# ADR: ESLint 分层策略

**日期**：2026-03-25
**状态**：accepted

## 背景

本 monorepo 包含三个应用（backend、admin-web、miniapp-client），各自使用不同的 ESLint 配置体系：

- **根配置** (`eslint.config.mjs`)：`@eslint/js` + `typescript-eslint` + `eslint-config-prettier`，定义 TS 基础规则（`no-explicit-any: warn`、`no-unused-vars: warn`、`prefer-const`、`eqeqeq` 等）和全局 ignores
- **backend** (`apps/backend/eslint.config.mjs`)：通过 `import rootConfig from '../../eslint.config.mjs'` 继承根配置，放宽 NestJS 装饰器和依赖注入相关规则（`no-empty-object-type: off`、`no-useless-constructor: off`），并对测试文件、脚本文件、Prisma seed 分别放宽
- **admin-web** (`apps/admin-web/eslint.config.js`)：使用 `@soybeanjs/eslint-config`（`defineConfig({ vue: true, unocss: true })`），独立体系，内含 Vue3 + UnoCSS + elegant-router 规则
- **miniapp** (`apps/miniapp-client/eslint.config.mjs`)：使用 `@uni-helper/eslint-config`（`uniHelper({ unocss: true, vue: true })`），独立体系，内含 uni-app + Vue3 + UnoCSS 规则，并配置 CSS/HTML formatter

三套前端/后端框架生态差异显著，ESLint 规则需求完全不同。

## 决策

保持当前分层结构，不强行统一为单一配置。原因：

1. **框架生态最佳实践**：admin-web 的 `@soybeanjs/eslint-config` 和 miniapp 的 `@uni-helper/eslint-config` 分别是 SoybeanJS 和 uni-helper 社区维护的最佳实践配置，包含大量框架特定规则（Vue SFC block order、UnoCSS attributify、uni_modules 忽略等），这些规则无法用通用配置替代
2. **强行统一的代价**：统一配置意味着要手动复刻两个社区配置的全部规则，后续社区更新时需要逐条同步，维护成本远高于分层
3. **backend 已正确继承**：backend 通过 `...rootConfig` 展开继承根配置，仅在此基础上放宽 NestJS 特有的装饰器和 DI 规则，符合"继承 + 覆盖"的标准模式
4. **职责清晰**：每层配置只关注自己框架的规则，不存在规则冲突或覆盖歧义

## 分层规则

| 层级      | 配置文件                                | 配置来源                                                      | 职责                                            |
| --------- | --------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| 根        | `eslint.config.mjs`                     | `@eslint/js` + `typescript-eslint` + `eslint-config-prettier` | TS 基础规则 + prettier 格式化兼容               |
| backend   | `apps/backend/eslint.config.mjs`        | 继承根配置 + NestJS 放宽                                      | 装饰器、DI 构造函数、测试文件、Prisma seed 放宽 |
| admin-web | `apps/admin-web/eslint.config.js`       | `@soybeanjs/eslint-config`                                    | Vue3 + UnoCSS + elegant-router + Naive UI       |
| miniapp   | `apps/miniapp-client/eslint.config.mjs` | `@uni-helper/eslint-config`                                   | uni-app + Vue3 + UnoCSS + CSS/HTML formatter    |

## 影响

- **正面**：各应用享受各自框架社区的规则更新，无需手动同步；新成员按框架文档即可理解 lint 规则
- **负面**：根配置的规则变更不会自动传播到 admin-web 和 miniapp（它们是独立体系）
- **缓解**：通过 `pnpm lint` 统一入口执行所有应用的 lint，CI 中确保全部通过；根配置仅影响 backend 和共享库
