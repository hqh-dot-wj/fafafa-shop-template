# Nest-Admin-Soybean（Copilot 指针）

Canonical 规则：**根 `AGENTS.md`**（硬规则、任务路由、验证索引）。

| App        | 路径                   | 栈                      |
| ---------- | ---------------------- | ----------------------- |
| Backend    | `apps/backend/`        | NestJS + Prisma，多租户 |
| Admin      | `apps/admin-web/`      | Vue3 + Naive UI + Vite  |
| Miniapp/H5 | `apps/miniapp-client/` | uniapp + Vue3           |

跨 app 类型：`backend` OpenAPI → `pnpm generate-types` → `@libs/common-types` → 前端。**禁止**手写与 backend 同义 DTO。

常用：`pnpm dev:backend` / `dev:admin`；切片验证 `pnpm check:slice`；治理 `pnpm harness:doctor`、`pnpm harness:manifest`。

高风险 / 金额 / Harness 详表：见 `docs/governance/HIGH_RISK_REGISTRY.md`、`MONEY_PRECISION_PROTOCOL.md`、`HARNESS_ENGINEERING.md`。
