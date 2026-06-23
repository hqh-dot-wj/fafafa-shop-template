# C-Web 商城 C 端指引

## 1. 速览

- 技术栈：Vue 3 + Vite 7 + vue-router + Pinia + Vant 4 + TypeScript
- 与 admin-web 对齐：Vite SPA、`src/` 目录、`VITE_*` 环境变量、`pnpm typecheck` / `pnpm build`
- 与 miniapp 对齐：业务能力、路由鉴权黑名单、`/client/*` API、`@libs/common-types` 契约
- 先读顺序：
  1. 根 `AGENTS.md`
  2. 本文件
  3. `.codex/playbooks/miniapp-page-change.md`（C 端页面语义与 miniapp 同源）
  4. 涉及验证再看 `.codex/playbooks/verification-gates.md`
- 涉及页面梳理、方案设计或交付说明时，再读 `docs/governance/AGENT_OUTPUT_PROTOCOL.md`。
- 根 `AGENTS.md` 已覆盖：任务决策树、通用高风险、跨 app 契约、统一验证要求。

## 2. 目录结构

```text
apps/c-web/
  index.html
  vite.config.ts
  src/
    main.ts              # 入口：Pinia → API → Router → 品牌加载
    App.vue
    router/              # routes.ts + guards.ts（auth / feature）
    layouts/             # default（Header+TabBar）、blank（登录/支付结果）
    views/               # 页面（原 Nuxt pages/）
    components/          # layout、product 等
    stores/              # token、user、cart、shop-branding
    service/api/         # HTTP 封装（类型来自 common-types）
    hooks/               # useApi、useFeatures、useCheckoutPay 等
    plugins/             # pinia、axios 单例
    utils/               # auth-routes、toast、env、product-display
    styles/
    typings/
```

## 3. 环境与命令

- 开发：`pnpm dev:c-web` → `http://localhost:5175/shop/`（Vite 代理 `/api` → backend）
- 构建：`pnpm build:c-web` → `dist/`
- 预览：`pnpm --filter @apps/c-web preview`
- 类型检查：`pnpm typecheck:c-web`
- Lint：`pnpm --filter @apps/c-web lint`

环境变量（`.env.development` / `.env.production`）：

| 变量             | 说明                                                                |
| ---------------- | ------------------------------------------------------------------- |
| `VITE_BASE_URL`  | 子路径，生产默认 `/shop/`                                           |
| `VITE_API_BASE`  | API 根路径，生产 `/api`（nginx 反代）；本地 dev 可用 `/api` + proxy |
| `VITE_TENANT_ID` | 租户 ID                                                             |
| `VITE_FEATURE_*` | O2O / 分销 / LBS / 钱包等模板开关                                   |

默认规则：

- 页面与接口联调优先 `pnpm dev:c-web` + `pnpm dev:backend`。
- backend 契约变更后：`pnpm generate-types` → 再改 `src/service/api/*` 或 views。
- 禁止手写 backend DTO/VO，类型以 `@libs/common-types` 为准。
- 用户提示统一用 `src/utils/toast.ts`（Vant Toast），禁止 `window.alert`。
- 构建产物目录为 `dist/`，Docker 见 `deploy/docker/c-web.Dockerfile`。

## 4. c-web 特有反模式

- 在 views 内手写 axios 或重复定义 API 类型
- 绕过 `useApi()` / `getApiClient()` 另建 HTTP 实例
- 受保护路由未走 `router/guards.ts` 黑名单策略
- 使用 Naive UI（本 app 为 Vant + 移动自研样式）
- 用 `nuxt dev` / `.output` 等已退役 Nuxt 路径与命令

## 5. 路由与鉴权

- 登录页：`/login`；黑名单前缀见 `src/utils/auth-routes.ts`
- Feature 门控：`VITE_FEATURE_*` + `src/utils/feature-routes.ts` + `hooks/use-feature-nav.ts`
- 店铺品牌：`stores/shop-branding` + `GET /client/shop/branding`

## 6. 验证矩阵（切片）

| 改动范围        | 建议命令                                       |
| --------------- | ---------------------------------------------- |
| 单页 / 组件     | `pnpm fix:changed`                             |
| c-web 任意改动  | `pnpm --filter @apps/c-web typecheck` + `lint` |
| 构建 / 部署相关 | + `pnpm --filter @apps/c-web build`            |
| 契约变更        | `pnpm generate-types` + typecheck              |

## 7. 部署

- 镜像：`deploy/docker/c-web.Dockerfile`
- 网关：`deploy/nginx/gateway.conf` → `/shop/` → c-web 容器
- 构建参数：`VITE_BASE_URL`、`VITE_API_BASE`、`VITE_TENANT_ID`、`VITE_FEATURE_*`
