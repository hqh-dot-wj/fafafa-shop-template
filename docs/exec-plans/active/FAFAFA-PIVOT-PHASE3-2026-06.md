---
task_id: FAFAFA-PIVOT-PHASE3-2026-06
status: implemented
current_phase: 3.5
task_mode: new-feature
path_type: cross-app
high_risk: false
created: 2026-06-23
last_updated: 2026-06-23
related_plan: c:/Users/13415/.cursor/plans/fafafa-template-pivot_4dd42921.plan.md
prev_phase_plan: docs/exec-plans/active/FAFAFA-PIVOT-PHASE2-2026-06.md
next_phase_plan: docs/exec-plans/active/FAFAFA-PIVOT-PHASE4-2026-06.md
phase_status:
  '3.0': done
  '3.1': implemented
  '3.2': implemented
  '3.3': implemented
  '3.4': implemented
  '3.5': implemented
---

# Exec Plan: FAFAFA-PIVOT-PHASE3-2026-06

父 plan **Phase 3「新 C 端响应式 Web」**。`apps/c-web`（**Vite 7 + Vue 3 SPA**，对齐 admin-web 工程栈 + Vant 4）已替代 miniapp H5 为生产 C 端（Phase 4 已下线 `/h5/`）。

> **2026-06-23 栈迁移**：Nuxt 3 已全量替换为 Vite SPA；详见 `apps/c-web/AGENTS.md`。

## 1. 目标 / 非目标

**目标**

- 新建 `apps/c-web/`（**Vite 7 + Vue 3 + vue-router + Pinia + Vant 4** + TypeScript），PC + H5 响应式
- 接口走同源 `/api`，类型来自 `@libs/common-types`
- 部署子路径 `/shop/`
- 按 `multi_templates` 战略预留 `FEATURE_*` 运行时开关
- 功能对齐 miniapp：商品 / 购物车 / 下单 / 支付 / 会员 / 订单 / 优惠券 / 收货地址等

**非目标**

- **不**再维护 `apps/miniapp-client` 运行时链路（Phase 4 已退役）
- **不**实施父 plan Phase 5 多模板分拆（仅 feature flag 显隐）

## 2. ADR：技术选型

（同前，略 — 见 git 历史 3.0 版本）

| 决策项     | 选择                      |
| ---------- | ------------------------- |
| 框架       | Vite 7 + Vue 3 SPA        |
| UI         | Vant 4（移动端）          |
| 部署路径   | `/shop/`                  |
| 构建产物   | `dist/`                   |
| API 契约   | `@libs/common-types`      |
| 多模板预留 | `VITE_FEATURE_*` 环境变量 |

## 3. Phase 列表与交付状态

### Phase 3.0 — exec-plan + 脚手架 + 部署骨架 [done]

- `apps/c-web/**` 脚手架、`deploy/docker/c-web.Dockerfile`、`gateway.conf`、`docker-compose.tpl.yml`
- **DoD**：`pnpm --filter @apps/c-web build` exit 0 ✓

### Phase 3.1 — HTTP 层 + 认证 + 布局壳 [implemented]

| 交付物                                         | 路径                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| axios 拦截器（租户头 / Bearer / 401 刷新队列） | `plugins/api.client.ts`                                                   |
| token 刷新与持久化                             | `stores/token.ts`                                                         |
| 登录中间件（黑名单受保护路由）                 | `middleware/auth.global.ts`、`utils/auth-routes.ts`                       |
| 布局壳                                         | `layouts/default.vue`、`components/layout/AppHeader.vue`、`AppTabBar.vue` |
| 登录页                                         | `pages/login.vue`                                                         |

- **DoD（代码）**：登录拿 token；未登录访问 `/cart` 等跳转 `/login` ✓
- **未验证（L3）**：与真实 backend 联调刷新 token 队列

### Phase 3.2 — 商品与分类 [implemented]

| 交付物       | 路径                                                              |
| ------------ | ----------------------------------------------------------------- |
| 首页商品列表 | `pages/index.vue`                                                 |
| 分类页       | `pages/category/index.vue`、`composables/use-category-catalog.ts` |
| 商品详情     | `pages/product/[id].vue`                                          |
| API          | `services/api/product.ts`                                         |

- **DoD（代码）**：调用 `/client/product/*` ✓
- **未验证（L3）**：真实数据联调

### Phase 3.3 — 购物车 + 下单 + 支付 [implemented]

| 交付物   | 路径                                                      |
| -------- | --------------------------------------------------------- |
| 购物车   | `pages/cart/index.vue`、`stores/cart.ts`                  |
| 下单     | `pages/order/create.vue`                                  |
| 支付结果 | `pages/pay/result.vue`、`composables/use-checkout-pay.ts` |
| API      | `services/api/cart.ts`、`order.ts`、`payment.ts`          |

- **DoD（代码）**：下单预览 → 提交 → 支付结果页链路已实现 ✓
- **未验证（L3，高风险）**：微信支付 / 支付宝回跳须测试环境人工验

### Phase 3.4 — 会员 / 订单 / 优惠券 / 地址 [implemented]

| 交付物          | 路径                                                |
| --------------- | --------------------------------------------------- |
| 订单列表 / 详情 | `pages/order/index.vue`、`pages/order/[id].vue`     |
| 我的            | `pages/me/index.vue`                                |
| 优惠券          | `pages/coupon/index.vue`                            |
| 地址 CRUD       | `pages/address/index.vue`、`pages/address/edit.vue` |

- **DoD（代码）**：主流程页面与 API 齐备 ✓
- **未验证（L3）**：端到端人工冒烟（见 §8）

### Phase 3.5 — 多模板差异化预留 [implemented]

| 交付物                         | 路径                                                      |
| ------------------------------ | --------------------------------------------------------- |
| feature 读取                   | `composables/use-features.ts`                             |
| 路由门禁                       | `middleware/feature.global.ts`、`utils/feature-routes.ts` |
| Tab / 我的菜单过滤             | `composables/use-feature-nav.ts`                          |
| O2O / 分销 / 钱包 / LBS 占位页 | `pages/service/`、`distribution/`、`wallet/`、`stores/`   |

- **DoD（代码）**：`FEATURE_O2O=false` 时 `/service` 重定向 `/`；底栏无「服务」Tab ✓
- **验证**：`VITE_FEATURE_O2O=false pnpm dev:c-web` 人工确认

### Phase 3.6 — 店铺品牌接入（Phase 4.5 延伸）[implemented]

| 交付物                | 路径                                                         |
| --------------------- | ------------------------------------------------------------ |
| C 端品牌 API          | backend `GET /client/shop/branding`                          |
| 品牌 store + 主题 CSS | `stores/shop-branding.ts`、`plugins/shop-branding.client.ts` |

## 4. 当前状态

| 字段               | 值                                                    |
| ------------------ | ----------------------------------------------------- |
| **current_phase**  | `3.5`（代码交付完成）                                 |
| **phase_status**   | `implemented`（3.0–3.5 + 3.6 品牌）                   |
| **blocked_reason** | —                                                     |
| **残余风险**       | 支付回跳 L3 未验；`check:slice` 受 admin 预存失败影响 |

## 5. 已执行验证（命令 + 退出码）

| Phase   | 命令                                  | exit | 时间       | 结果                                                               |
| ------- | ------------------------------------- | ---- | ---------- | ------------------------------------------------------------------ |
| 3.0–3.5 | `pnpm --filter @apps/c-web typecheck` | 0    | 2026-06-23 | vue-tsc 全过                                                       |
| 3.0–3.5 | `pnpm --filter @apps/c-web lint`      | 0    | 2026-06-23 | 仅 html-self-closing 等 warning                                    |
| 3.0–3.5 | `pnpm --filter @apps/c-web build`     | 0    | 2026-06-23 | 产物 `dist/`                                                       |
| 3.0–3.5 | `pnpm verify:scripts`                 | 0    | 2026-06-23 | 含 dev/build/check:c-web                                           |
| —       | `pnpm check:slice`                    | 1    | 2026-06-23 | admin `scene-placement-text.spec.ts` 3 例预存失败（与 c-web 无关） |

未跑：`pnpm dev:c-web` + `pnpm dev:backend` 全链路人工冒烟；Docker `c-web` 镜像构建。

## 6. C 端主流程冒烟清单（人工，L3）

**前置**：`pnpm prisma migrate deploy`（含店铺品牌字段）→ `pnpm dev:backend` + `pnpm dev:c-web`（http://localhost:5175/shop/）

| #   | 场景        | 步骤                                                       | 预期                                      |
| --- | ----------- | ---------------------------------------------------------- | ----------------------------------------- |
| S1  | 品牌展示    | admin 店铺设置改店名/Logo/主题色 → 刷新 c-web 首页与登录页 | 顶栏/登录区显示新品牌；Tab/按钮主题色变化 |
| S2  | 匿名浏览    | 未登录访问 `/`、`/category`、商品详情                      | 可浏览；不调受保护 API 不 401 弹窗        |
| S3  | 登录        | `/login` 验证码或密码登录                                  | 拿 token；跳转 redirect 或首页            |
| S4  | 鉴权拦截    | 未登录直接访问 `/cart`                                     | 跳转 `/login?redirect=...`                |
| S5  | 商品        | 首页列表 → 分类 → 详情                                     | 真实 `/client/product/*` 有数据           |
| S6  | 购物车      | 详情加购 → `/cart` 改数量                                  | 列表与角标更新                            |
| S7  | 下单        | `/order/create`（购物车或直购）                            | 预览金额与地址；提交生成订单              |
| S8  | 支付        | 提交后支付流程 → `/pay/result`                             | **高风险**：测试环境验回跳与订单状态      |
| S9  | 订单        | `/order` 列表 → 详情                                       | 状态中文展示正确                          |
| S10 | 地址        | `/address` 增删改；下单默认地址                            | CRUD 成功                                 |
| S11 | 优惠券      | `/coupon` 列表                                             | 未使用数量与 me 页角标一致                |
| S12 | feature off | `VITE_FEATURE_O2O=false` 重启 c-web                        | 底栏无「服务」；访问 `/service` 回首页    |
| S13 | 登出        | 我的 → 退出                                                | token 清除；受保护页需重新登录            |

**通过标准**：S1–S7、S9–S11、S13 全绿；S8 在具备支付沙箱时必验，否则标为「未验证残余风险」。

## 7. 开发者下一步

1. 按 §6 跑一遍冒烟，记录 S8 支付结论
2. 可选：`pnpm generate-types` 同步 `shop-settings` / `client/shop` 契约
3. 父 plan **Phase 5**（`FEATURE_*` 注入 fafafa 模板变量）待产品排期

## 8. 下一会话 Prompt（Phase 5 或契约同步）

```text
父 plan Phase 3/4 代码已交付。优先二选一：
A) pnpm generate-types + admin/c-web 契约对齐 shop API
B) 父 plan Phase 5：fafafa ProductDeployTemplate 注入 FEATURE_* + backend 条件模块 import 评估
任务模式：contract-change 或 new-feature | 路径：cross-app
```
