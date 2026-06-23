---
title: Harness 与代码质量审计
status: active
doc_type: governance
last_verified: 2026-05-18
---

# Harness 与代码质量审计（2026-05-18 启动）

本文是对仓库 Harness 工程与业务代码质量的**结构性审计**。它不替代根 `AGENTS.md`、`HARNESS_ENGINEERING.md` 或各子目录 `AGENTS.md`，而是把"为什么每次都绕过"这件事拆到证据级别，给出按模块的化石清单和整改顺序。

读这份文档的人应当先理解：**很多反复出现的业务 bug 不是 Agent 失职，是仓库基线 + lint 装备 + 门禁口径三层结构性允许它们存在。** 想根治，必须从基线层入手，单点修 service 治标不治本。

## 0. 审计背景

2026-05-18 用户复盘"每次都绕过"的体感，提出 4 个并列质疑：

1. Harness 工程实际没生效。
2. 写出的代码看着能跑、实际跑不起来。
3. 改代码就绕过，规范变摆设。
4. 错误没明显打印，逻辑明显有问题。

本文对每一条都给出具体证据。每条结论后面附文件路径和行号，可以直接 `Ctrl+G` 跳转复核。

## 1. 共性根因（4 类）

### 1.1 A 类：基线自残

仓库基线主动放弃了几条**最基本的静态防御**，导致下游所有"通过 typecheck/lint"的信号都是低保真信号。

| 位置                                                                  | 配置                                                   | 后果                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `apps/backend/tsconfig.json:14`                                       | `"strictNullChecks": false`                            | 整个 backend typecheck 不查 null/undefined。`obj.foo.bar`、`array.find(...).id` 等运行期 NPE 静默通过 |
| `apps/backend/eslint.config.mjs:17-23`                                | spec 文件 `no-explicit-any: 'off'`                     | spec 里 `as any` 任开（实测 754 处，见 §2.7）                                                         |
| `apps/backend/eslint.config.mjs:17-23`                                | spec 文件 `ban-ts-comment: 'off'`                      | spec 里 `@ts-ignore`/`@ts-nocheck` 任开（实测 99 处分布在 53 spec）                                   |
| 根 `eslint.config.mjs`                                                | 整体规则全部 `warn`，仅 `no-var` 是 `error`            | warn 级别在 lint-staged + pre-commit 都不阻断                                                         |
| 根 `eslint.config.mjs`                                                | **完全没有** `import/no-cycle`                         | 循环依赖零静态防御                                                                                    |
| 根 `eslint.config.mjs`                                                | **完全没有** `@typescript-eslint/no-floating-promises` | 漏 await 的 Promise 零检测（化石见 §2.1）                                                             |
| 根 `eslint.config.mjs`                                                | **完全没有** `@typescript-eslint/no-misused-promises`  | Promise 用作 boolean / 传给 forEach 零检测                                                            |
| 根 `eslint.config.mjs`                                                | **完全没有** `@typescript-eslint/no-unsafe-*`          | `as any` 流转到业务代码零检测                                                                         |
| 根 `eslint.config.mjs`                                                | **完全没有** `no-restricted-syntax`                    | 无法定制规则禁 `setInterval` in service、`catch return null`、`forwardRef + require()`                |
| 根 `eslint.config.mjs`                                                | **完全没有** boundary 规则                             | marketing/client/store 跨模块脏调零防御                                                               |
| 根 `eslint.config.mjs` `no-console: 'warn', allow: ['warn', 'error']` | warn 和 error 同时允许                                 | 业务代码 `logger.warn` 报错误不算违规（化石见 §2.4）                                                  |

### 1.2 B 类：绕过工具沉淀

绕过手段一旦被一个 Agent 写出来，被 commit、被沉淀进生成器，后续所有 Agent 都默认用它。

| 位置                                                      | 沉淀的绕过                                                             | 影响范围                                                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `apps/admin-web/scripts/generate-elegant-routes.ts:53-61` | 每次生成路由后**自动注入 `// @ts-nocheck`**                            | `routes.ts` 任何类型错误永远不会暴露；commit `48a6fb93` 标题写"彻底消除类型检查漂移"     |
| `scripts/check-admin-view-types.mjs:52-61`                | 兜底注入同样 `@ts-nocheck`                                             | 门禁脚本本身**给自己**消除信号                                                           |
| `apps/backend/src/module/marketing/**/*.module.ts` ×8     | `forwardRef(() => require('../play/play.module').MarketingPlayModule)` | `require()` 让 TS 看不见这条 import 边，`import/no-cycle` / `madge` 等静态环检测全部盲眼 |

### 1.3 C 类：门禁口径自残

| 位置                                  | 缺陷                                              | 后果                                                                                                  |
| ------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `scripts/check-spec-drift.mjs:191`    | 漂移判定仅看 spec 文件名是否在 `changedSet` 中    | service 改行为 → 把 spec 里 mock 值改一改 → drift 消失。git log 中 5 个独立分支命名"修复测试规范漂移" |
| `scripts/check-forwardref-reason.mjs` | 只查注释是否解释 `forwardRef`，不查真实 import 图 | `forwardRef + require()` 模式让图不可见，本脚本对此完全无效                                           |
| `HARNESS_ENGINEERING.md` §11 表       | 5 个静态扫描中 3 个 warn-only                     | warn 不阻断 = Agent 可视而不见                                                                        |

### 1.4 D 类：缺运行期评估者

参见 `HARNESS_ENGINEERING.md` §14.6 / §14.7。整个验证链路 `pnpm fix:changed → pnpm check:slice → pnpm typecheck:backend` **全程不启动 NestApplication**。以下错误全部静态可过、运行必爆：

- seed 文件存在但 bootstrap 未调用（§14.7 历史事故）
- forwardRef 链路在 typecheck 合法、DI 解析期死锁
- ConfigService 校验缺 key、Prisma client 单例顺序
- 启动期 fail-fast 校验失败（如 `play_definition active rows is empty`）

## 2. 反模式扫描清单（7 类）

### 2.1 A. floating Promise / Promise 副作用 + race condition

**ESLint 规则**：`@typescript-eslint/no-floating-promises: error`（**未配置**）

最关键化石：

#### A.1 `admin/auth/auth.service.ts` 登录链路 race condition（复制 3 份）

`apps/backend/src/module/admin/auth/auth.service.ts:128-143`：

```ts
this.axiosService
  .getIpAddress(clientInfo.ipaddr)
  .then((loginLocation) => {
    loginLog.loginLocation = loginLocation;
  })
  .catch(() => {
    loginLog.loginLocation = '未知';
  });

const loginRes = await this.userService.login(user, loginLog);
loginLog.status = loginRes.code === SUCCESS_CODE ? StatusEnum.NORMAL : StatusEnum.STOP;
loginLog.msg = loginRes.msg;
this.loginlogService.create(loginLog); // ← floating
```

两个错误叠加：

1. `getIpAddress` 异步写回 `loginLog.loginLocation`，紧接着 `await userService.login()`——多数情况 login 比 IP 查询快，到 `loginlogService.create(loginLog)` 时 `loginLocation` 还是 undefined。
2. `loginlogService.create()` 不 await，fire-and-forget。

后果：登录日志的 `loginLocation` 字段**几乎一定是错的或空的**，但代码看着像在工作。同样模式重复 3 次：

- `auth.service.ts:131-143`（`login`）
- `auth.service.ts:159-168`（`logout`）
- `auth.service.ts:228-240`（`loginBySms`）

#### A.2 同文件 `auth.service.ts:265` 异步断言不 await

```ts
this.passwordResetService.assertNewPasswordPlain(dto.newPassword);
```

如果 `assertNewPasswordPlain` 是 async 抛错，这里直接吞——弱密码可能绕过校验。**需要验证 `assertNewPasswordPlain` 是否真为 async**（已记为待验证项）。

#### A.3 字典/配置缓存 floating set

| 位置                                                                | 代码                                  | 后果                                             |
| ------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------ |
| `apps/backend/src/module/admin/system/dict/dict.service.ts:337`     | `this.redisService.set(...)` 不 await | 字典写库成功 → Redis set 失败被吞 → 业务读老缓存 |
| `apps/backend/src/module/admin/system/config/config.service.ts:267` | `this.redisService.set(...)` 不 await | 同上，配置层                                     |

字典是 `AGENTS.md` §3.1 的高风险域。

#### A.4 SSE 推送 floating

`apps/backend/src/module/admin/resource/sse.controller.ts:62, 67, 112`：

```ts
this.sseService.removeClient(uniqueClientId);
this.sseService.sendToUser(userId, 'SSE连接成功');
this.sseService.sendToUser(targetUserId, normalizedMessage);
```

如果 `sendToUser` 是 async（涉及 Redis pub/sub），推送失败完全无感。

#### A.5 client/order port token 校验 floating

`apps/backend/src/module/client/order/ports/order-cart.port.ts:39`：

```ts
this.tokenService.verify(token, { tenantId, memberId }, { allowAnonymousMember: true });
```

如果 `verify` 是 async 抛错——**鉴权直接失效**。属于高风险域（`order` + 鉴权），需立即核对 `verify` 是否同步。

### 2.2 B. forwardRef + require() 反模式

**ESLint 规则**：`no-restricted-syntax`（**未配置**）

共 25 处 `forwardRef`，其中 **8 处套了 `require()`**（让 TS 看不见 import 边）：

```
apps/backend/src/module/marketing/marketing.module.ts:68,98
apps/backend/src/module/marketing/activity/activity.module.ts:25
apps/backend/src/module/marketing/config/config.module.ts:14
apps/backend/src/module/marketing/rule/rule.module.ts:21
apps/backend/src/module/marketing/instance/instance.module.ts:24
apps/backend/src/module/marketing/scheduler/scheduler.module.ts:29
apps/backend/src/module/marketing/course-group/course-group.module.ts:25
```

其余 17 处虽然是合法 `forwardRef(() => XxxService/Module)`，但密集出现在以下高风险域，表明**模块边界设计普遍出问题**：

- `admin/system/user/user.service.ts:60,62,64`（UserAuth / UserProfile / UserRole 互相依赖）
- `admin/system/post/post.service.ts:16` + `post.module.ts:8`（Post ↔ Dept）
- `admin/system/tenant/tenant.service.ts:50`（Tenant ↔ UserAuth）
- `marketing/play/play.module.ts:31,37`（Play ↔ PlayInstance ↔ MarketingConfig）
- `marketing/play/flash-sale.service.ts:29`、`course-group-buy.service.ts:37`
- `marketing/instance/instance.service.ts:43`（PlayDispatcher）
- `marketing/integration/integration.service.ts:72` + `integration.module.ts:31`
- `marketing/course-group/course-group.module.ts:22`
- `client/order/ports/order-marketing.port.ts:35,37`（OrderIntegration + PlayInstance）

§14.9 已记录 2026-05-18 启动期 DI 死锁（`ClientOrderModule ↔ Marketing/Coupon/Integration/Play`）正是这一坨。`scripts/check-forwardref-reason.mjs` 只看注释，对 require() 完全无效。

### 2.3 C. catch swallow（return null/0/false/'' 或 logger.warn 报 error）

**ESLint 规则**：`no-restricted-syntax` 可定制（**未配置**）

#### C.1 catch return null/0/false/[]/''

| 文件                                                                    | 行号                    | 返回    | 后果                                                                                                                                                     |
| ----------------------------------------------------------------------- | ----------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `module/client/common/service/wechat.service.ts`                        | 76-78, 151-153, 209-211 | `null`  | **3 处**：微信 AccessToken / 手机号解码 / 二维码生成失败全吞，调用方收到 null 误认为"未授权"。微信侧网络抖一下 → 用户登录失败但日志只看到"null returned" |
| `module/store/product/tenant-sku.repository.ts`                         | 223-226, 367-368        | `null`  | 上一轮提过。注释"版本号不匹配"——但**所有错误**都进这条分支，连接断 / 超时 / 权限错都返回 null，调用方误认为"未找到"                                      |
| `module/admin/monitor/server/server.service.ts`                         | 44-45                   | `[]`    | 监控读失败返回空数组，告警面板看着正常                                                                                                                   |
| `module/admin/monitor/operlog/operlog.service.ts`                       | 169-170                 | `''`    | 操作日志写入失败返回空字符串，调用方无感                                                                                                                 |
| `module/admin/system/user/services/user-auth.service.ts`                | 178-179                 | `null`  | **用户认证**关键路径！所有错误都当"未找到用户"返回 null                                                                                                  |
| `module/lbs/admission/admission.service.ts`                             | 93-94                   | `false` | **LBS 准入校验**失败返回 false（fail-open or fail-closed 视调用方决定，本身没有 explicit 标注）                                                          |
| `module/lbs/monitoring/lbs-metrics.service.ts`                          | 160-161                 | `0`     | 指标读失败返回 0，监控面板看不到"读失败"和"真的 0"的区别                                                                                                 |
| `module/finance/settlement/settlement.scheduler.ts`                     | 469-471                 | `false` | 结算锁获取失败返回 false（这一条至少 `logger.error` 了，相对合理）                                                                                       |
| `module/finance/withdrawal/withdrawal-reconciliation.scheduler.ts`      | 179-181                 | `false` | 同上                                                                                                                                                     |
| `module/finance/settlement-core/settlement-reconciliation.scheduler.ts` | 103-105                 | `false` | 同上                                                                                                                                                     |

最严重的是 `wechat.service.ts` × 3、`tenant-sku.repository.ts` × 2、`user-auth.service.ts`、`admission.service.ts` —— 都在高风险域，且**没有 explicit 的"什么场景该 null/false"说明**。

#### C.2 logger.warn 报错误（应该 error）

| 位置                                                                                 | 级别错误的原因                                                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/module/admin/auth/auth.service.ts:108-110`                         | "SysTenant table may not exist yet"——**关键的"租户表不存在"用 warn**，并且 catch 后**伪造一个"默认租户"返回**给前端 |
| `apps/backend/src/common/observability/error-event.service.ts:156, 241, 335, 345`    | **错误观测器**自己写入失败用 warn——观测器二级故障应当 error+触发降级告警                                            |
| `apps/backend/src/config/index.ts:44-45`                                             | 配置 JSON parse 失败用 warn + fallback——配置错误应当 fail-fast                                                      |
| `apps/backend/src/module/auth-core/services/sms-code.service.ts:73`                  | 短信验证码 **Redis 回滚未完全成功**用 warn——可能导致鉴权状态不一致                                                  |
| `apps/backend/src/module/marketing/coupon/distribution/redis-lock.service.ts:56`     | **优惠券分发锁获取失败**用 warn——并发关键路径                                                                       |
| `apps/backend/src/module/lbs/monitoring/lbs-metrics.service.ts:42, 60, 73, 126, 151` | LBS 指标采集失败 ×5 用 warn                                                                                         |
| `apps/backend/src/module/admin/system/tenant/tenant.service.ts:692, 1264`            | 租户字典/配置同步失败用 warn                                                                                        |
| `apps/backend/src/module/client/cart/cart.service.ts:336`                            | 购物车同步 Redis 失败用 warn                                                                                        |
| `apps/backend/src/module/payment/adapters/wechat-pay.adapter.ts:60`                  | 支付回调验签失败开发环境用 warn 回退                                                                                |

#### C.3 环境分支吞错

`apps/backend/src/module/payment/adapters/wechat-pay.adapter.ts:55-58`：

```ts
} catch (error) {
  if (isProd) {
    throw error;
  }
}
```

**非生产**环境直接吞——开发本地永远跑得起，上线首发就炸。

#### C.4 fail-open 伪造数据

`apps/backend/src/module/admin/auth/auth.service.ts:100-111`：

```ts
} catch (error) {
  this.logger.warn('SysTenant table may not exist yet:', getErrorMessage(error));
  result.voList = [{ tenantId: TenantContext.SUPER_TENANT_ID, companyName: '默认租户', domain: '' }];
}
```

DB 挂掉 → catch → **伪造一个"默认租户"返回前端** → 用户进入"默认租户" → 后续业务全错。fail-open + 数据捏造，warn 级别。

### 2.4 D. setInterval / setTimeout 业务用法

**ESLint 规则**：`no-restricted-syntax`（**未配置**）

13 个文件有 `setInterval/setTimeout`，分类如下：

**合理**（锁续租 / sleep helper / abort timeout）：

- `module/marketing/integration/integration.service.ts:704` 心跳锁续租 ✓
- `module/finance/settlement/settlement.scheduler.ts:487` 看门狗续期 ✓
- `module/marketing/play/play.dispatcher.ts:188` sleep helper ✓
- `module/marketing/resolution/resolution.service.ts:473` withTimeout 实现 ✓
- `module/admin/auth/services/social-auth.service.ts:268` AbortController timeout ✓
- `module/common/redis/cache-manager.service.ts`、`module/marketing/coupon/distribution/redis-lock.service.ts` 同类 ✓

**可疑/补偿型**（这一类都应当迁移到 `@Cron` + `SchedulerRegistry` 或 Bull）：

- `apps/backend/src/module/client/order/events/order-outbox.dispatcher.ts:65-66`：

  ```ts
  onModuleInit() {
    this.timer = setInterval(() => void this.tickSafe(), this.tickIntervalMs);
  }
  ```

  Outbox dispatcher **没用 `@Cron`、没用 BullProcessor、没用 SchedulerRegistry**。后果：每个 backend 实例自跑一个 setInterval，**多副本部署时 outbox events 被并发消费**，没有分布式锁兜底。`AGENTS.md` `feedback_no_compensating_complexity` 警示的"用定时器代替正确架构"的典型实例。

- `apps/backend/src/module/admin/resource/sse.service.ts:25, 28` —— Service `constructor` 内直接 `setInterval` 每 5 分钟跑 `cleanupStaleClients()`，多副本部署下每实例独立 cleanup。
- `apps/backend/src/module/admin/resource/sse.controller.ts:66-68` —— `setTimeout(..., 100)` 等待 SSE 连接建立，race condition workaround，应换连接钩子。

### 2.5 E. 重复同名 Service / 同名 Module

| 名称                 | 实际位置                 | 行数 | async 方法 |
| -------------------- | ------------------------ | ---: | ---------: |
| `product.service.ts` | `module/client/product/` |  764 |          8 |
| `product.service.ts` | `module/pms/`            |  875 |          9 |
| `product.service.ts` | `module/store/product/`  | 1444 |         26 |

三套"商品"逻辑跨 3 个模块各自演化（client 给前端 / pms 给后台编辑 / store 给门店运营）。共同写 `product` 表和 `tenantSku` 表。改其中一个 → IDE 跳转/grep 出 3 个结果 → **漏改某一个的成本**：

- 测试假绿——每个 spec 用 80+ mock 自玩，互不验证一致性（见 §2.7）
- 三套缓存策略可能不一致（实测：`client/product/product.service.ts:499-698` 7 处 cache fallback warn；`store/product/store-product-query-fallback.service.ts:113-275` 5 处 cache fallback warn——两套独立的"陈旧缓存兜底"逻辑）

类似情况已确认（`find -name '*.service.ts' | sort | uniq -c`）：

| 重名 service              |  数量 | 实际位置                                                         |
| ------------------------- | ----: | ---------------------------------------------------------------- |
| `product.service.ts`      | **3** | `module/client/product/`、`module/pms/`、`module/store/product/` |
| `auth.service.ts`         |     2 | `module/admin/auth/`、`module/client/auth/`                      |
| `user.service.ts`         |     2 | （admin/system/user + client/user）                              |
| `template.service.ts`     |     2 | `marketing/template/` + `marketing/coupon/template/`             |
| `task.service.ts`         |     2 | （admin/monitor/job + marketing/points/task）                    |
| `stock.service.ts`        |     2 | `store/stock/` + `marketing/stock/`                              |
| `statistics.service.ts`   |     2 | `marketing/coupon/statistics/` + `marketing/points/statistics/`  |
| `scheduler.service.ts`    |     2 | `marketing/coupon/scheduler/` + `marketing/points/scheduler/`    |
| `member.service.ts`       |     2 | `admin/member/` + （client/member 间接）                         |
| `distribution.service.ts` |     2 | `client/distribution/` + `store/distribution/`                   |
| `dashboard.service.ts`    |     2 | `marketing/...` + `store/distribution/services/`                 |
| `config.service.ts`       |     2 | `admin/system/config/` + `marketing/config/`                     |
| `commission.service.ts`   |     2 | `finance/commission/` + （另一处）                               |

`find -name '*.module.ts' | sort | uniq -c` 重复 module：

| 重名 module              |  数量 | 实际位置                                                                        |
| ------------------------ | ----: | ------------------------------------------------------------------------------- |
| `distribution.module.ts` | **3** | `client/distribution/`、`marketing/coupon/distribution/`、`store/distribution/` |
| `auth.module.ts`         | **3** | `admin/auth/`、`admin/system/auth/`、`client/auth/`                             |
| `user.module.ts`         |     2 | （admin + client）                                                              |
| `template.module.ts`     |     2 | （marketing/template + marketing/coupon/template）                              |
| `stock.module.ts`        |     2 | （store + marketing）                                                           |
| `rule.module.ts`         |     2 | （marketing/rule + marketing/points/rule）                                      |
| `product.module.ts`      |     2 | （pms + store）                                                                 |
| `payment.module.ts`      |     2 | （payment 顶层 + client/payment）                                               |
| `management.module.ts`   |     2 | （未确认位置）                                                                  |
| `config.module.ts`       |     2 | （admin/system + marketing）                                                    |
| `client.module.ts`       |     2 | （admin/system/client + client 顶层）                                           |

重名陷阱：

- **`auth.service.ts` 在 admin 和 client 各一份** —— §3.1.1 列出 admin/auth 的登录链路 race condition 复制 3 份，**`client/auth/auth.service.ts` 必须立即核对是否复制了同一份反模式**。
- **`distribution.module.ts` 3 处** —— 分销 / 优惠券分发 / 门店分销 三个语义不同但同名，跨域 PR 时极易关联错。
- **`auth.module.ts` 3 处** —— 后台用户认证 / 管理端 OAuth / 客户端登录三套独立 module，互相 forwardRef 时若误连接会触发启动期 DI 死锁（见 §2.2）。

### 2.6 F. async 函数 Promise 副作用 + 不 await

参见 §2.1 A.1 `auth.service.ts` 范例。这是 floating Promise 的进阶模式——不只是漏 await，而是**用 `.then(...)` 修改外部变量，紧接着同步使用该变量**。属于 `@typescript-eslint/no-floating-promises` 拦不住的 race condition（需要 `no-misused-promises` + 人工 review）。

实测仅在 `auth.service.ts` 这一处发现 6 次（3 个 method × 2 次副作用 + create），不排除其他模块也有，但 grep 模式难以系统化扫。

### 2.7 G. `as any` / `@ts-(no)check` 在 spec 与生成文件

业务代码（`apps/backend/src` 非 spec）扫到 `@ts-(nocheck|ignore)`：**0**，good。
Spec 与 test fixture 中 `as any`：**754 处**，跨 100+ spec 文件。
Spec 中 `@ts-(ignore|nocheck|expect-error)`：**99 处** 跨 53 文件。

实测 Top 5 mock 密度：

```
module/store/order/store-order.service.spec.ts                98 处 mock*
module/client/order/order.service.spec.ts                     85 处
module/store/product/product.service.spec.ts                  82 处
module/admin/system/menu/menu.service.spec.ts                 73 处
module/pms/product.service.spec.ts                            69 处
```

`toHaveBeenCalled()`（不带参数）**1019 处** 跨 207 spec 文件 —— 比 `toHaveBeenCalledWith` 高得多，说明大量"调过就行"断言。

### 2.8 H. 源文件中文编码错乱

`apps/backend/src/module/client/marketing/aggregate/client-aggregate.service.ts:100, 167`：

```ts
this.logger.warn(`璁板綍鑱氬悎鎺ュ彛娴侀噺澶辫触 tenant=${...}`);
this.logger.warn(`鑱氬悎椤典富娲诲姩瑁佸喅澶辫触 productId=${...}`);
```

这是 **GBK 字节流被当 UTF-8 解码**了。运行时这些日志会输出乱码字符——监控系统看到的是 garbled 字符串，搜不到、对不上。源文件可能是 BOM/编码不一致引入的。需要查全仓还有多少类似文件。

## 3. 按顶层模块分布

### 3.1 admin

#### 3.1.1 admin/auth + admin/auth/services

| 化石                             | 位置                                        | 严重度                   |
| -------------------------------- | ------------------------------------------- | ------------------------ |
| 登录日志 race condition × 3      | `auth.service.ts:128-143, 159-168, 220-240` | **高**                   |
| 异步断言不 await                 | `auth.service.ts:265`                       | 待验证                   |
| SysTenant 表查询失败伪造默认租户 | `auth.service.ts:100-111`                   | **高**（fail-open）      |
| 账号锁日志用 warn                | `services/account-lock.service.ts:76`       | 低（事件性 warn 可接受） |

#### 3.1.2 admin/system/\*

| 化石                                   | 位置                                                | 严重度             |
| -------------------------------------- | --------------------------------------------------- | ------------------ |
| 字典缓存 floating set                  | `dict/dict.service.ts:337`                          | **高**             |
| 配置缓存 floating set                  | `config/config.service.ts:267`                      | **高**             |
| User/Auth/Profile/Role forwardRef 互依 | `user/user.service.ts:60,62,64`                     | **中**             |
| Post ↔ Dept forwardRef                 | `post/post.service.ts:16` + `post/post.module.ts:8` | **中**             |
| Tenant ↔ UserAuth forwardRef           | `tenant/tenant.service.ts:50`                       | **中**             |
| 租户字典同步失败用 warn                | `tenant/tenant.service.ts:692, 1264`                | 中                 |
| user-auth catch return null            | `user/services/user-auth.service.ts:178-179`        | **高**（认证路径） |

#### 3.1.3 admin/monitor/\*

| 化石                          | 位置                                                             | 严重度 |
| ----------------------------- | ---------------------------------------------------------------- | ------ |
| server 读失败返回 `[]`        | `server/server.service.ts:44-45`                                 | 中     |
| operlog 写入失败返回 `''`     | `operlog/operlog.service.ts:169-170`                             | 中     |
| **观测器自身二级故障用 warn** | `common/observability/error-event.service.ts:156, 241, 335, 345` | **高** |

#### 3.1.4 admin/resource (SSE)

| 化石                                       | 位置                            | 严重度                            |
| ------------------------------------------ | ------------------------------- | --------------------------------- |
| `sendToUser` floating × 3                  | `sse.controller.ts:62, 67, 112` | 中                                |
| **constructor 内 setInterval 跑 cleanup**  | `sse.service.ts:25, 28`         | **高**（多副本重复 cleanup）      |
| **`setTimeout(..., 100)` workaround race** | `sse.controller.ts:66-68`       | **中**（连接建立 race，应换钩子） |

`sse.service.ts:28`：

```ts
constructor() {
  this.cleanupTimer = setInterval(() => this.cleanupStaleClients(), 5 * 60 * 1000);
}
```

在 Service 构造函数里直接 `setInterval`，跟 `order-outbox.dispatcher.ts` 是同类反模式：多副本部署时每个实例独立跑一个 cleanup，没有分布式协调。应用 `@Cron` + `SchedulerRegistry`。

`sse.controller.ts:66-68`：

```ts
setTimeout(() => {
  this.sseService.sendToUser(userId, 'SSE连接成功');
}, 100);
```

100ms 硬编码延迟是为了"等连接建立"——典型 race condition workaround。连接慢于 100ms 消息直接丢；快于 100ms 浪费时间。应该用 SSE 连接建立钩子（`Subject.next` after subscribe）替代。

#### 3.1.5 admin/member、admin/upgrade、admin/upload、admin/worker、admin/finance、admin/system 子模块

经第二批反模式系统扫描（catch swallow / floating / setInterval / warn 报 error）：

- `admin/finance` 仅 controller，service 在 `module/finance/*`（已记 §3.5）。
- `admin/member`、`admin/worker`、`admin/upload/services`、`admin/upgrade` 反模式扫描**未命中新化石**（不代表无问题，仅说明 7 类模式不在此命中；业务逻辑层 race / 状态机 / tenant 越权需要人工 review）。
- `admin/system/{auth, client, file-manager, menu, message, notice, role, system-config, tenant-audit, tenant-package, tool, upload}` 反模式扫描**未命中新化石**。`admin/system/menu/menu.service.spec.ts` 是 mock 密度 Top 5（73 处），实际 service 逻辑需配合 §6 待验证项审计。

### 3.2 auth-core

| 化石                             | 位置                              | 严重度               |
| -------------------------------- | --------------------------------- | -------------------- |
| 短信验证码 Redis 回滚失败用 warn | `services/sms-code.service.ts:73` | **高**（鉴权一致性） |

### 3.3 client

#### 3.3.1 client/auth

| 化石                                      | 位置                        | 严重度                         |
| ----------------------------------------- | --------------------------- | ------------------------------ |
| **客户端登录链路完全没有 login log 写入** | `auth.service.ts`（548 行） | **中**（审计能力缺失，待确认） |

经扫描，`client/auth/auth.service.ts` 中 `grep loginlog\|getIpAddress\|loginLocation\|axiosService` 全部**无命中**。也就是说：

- admin 端登录有日志（即使是 race 写错的）
- client 端登录连日志都没有

这可能是设计选择（移动端走 metrics / OpenTelemetry / 三方 audit），也可能是早期遗漏。需要维护者确认：

- 客户端登录的失败次数、可疑登录、风控触发是否有其他 audit trail？
- 是否依赖 `ErrorEventService` 或 `BizOperationLog` 取代 LoginLog？

`auth.service.ts` 主体（含短信 / 微信 / 邮箱登录）未深读，admin/auth 的 race 模式**没有**被复制（grep 反向证明）。

#### 3.3.2 client/order

| 化石                                       | 位置                                      | 严重度                   |
| ------------------------------------------ | ----------------------------------------- | ------------------------ |
| `tokenService.verify` floating             | `ports/order-cart.port.ts:39`             | **高**（鉴权）           |
| OrderIntegration + PlayInstance forwardRef | `ports/order-marketing.port.ts:35,37`     | **中**（启动期死锁来源） |
| **outbox dispatcher 用 setInterval**       | `events/order-outbox.dispatcher.ts:65-66` | **高**（多副本重复消费） |
| 订单事件锁续租失败 warn                    | `(已记 §2.4 setInterval 合理)`            | 低                       |

#### 3.3.3 client/product

| 化石                                            | 位置                                                   | 严重度                    |
| ----------------------------------------------- | ------------------------------------------------------ | ------------------------- |
| 3 个 `product.service.ts` 之一                  | `product.service.ts` 764 行                            | **中**（重复化石）        |
| 大量 cache fallback warn × 7                    | `product.service.ts:499, 554, 589, 601, 643, 652, 698` | 低（fallback 本身是设计） |
| `product-query-fallback.service.ts:85, 98` warn | 同上                                                   | 低                        |

#### 3.3.4 client/marketing/aggregate

| 化石               | 位置                                   | 严重度               |
| ------------------ | -------------------------------------- | -------------------- |
| 源文件中文乱码 × 2 | `client-aggregate.service.ts:100, 167` | **中**（日志可读性） |

#### 3.3.5 其他 client/\*

`client/cart`、`client/common/service/wechat`、`client/payment`、`client/finance`、`client/user`、`client/address`、`client/location`、`client/upgrade`、`client/upload`、`client/distribution`、`client/ai-content`、`client/service`、`client/marketing/{coupon,points,scene,navigation,zone,instance,activity}` 未深读。已知化石：

| 化石                                | 位置                                                              | 严重度              |
| ----------------------------------- | ----------------------------------------------------------------- | ------------------- |
| **微信 SDK 3 处 catch return null** | `client/common/service/wechat.service.ts:76-78, 151-153, 209-211` | **高**（鉴权/通信） |
| 购物车 Redis 同步失败 warn          | `cart/cart.service.ts:336`                                        | 中                  |

### 3.4 marketing

`marketing` 是 `forwardRef + require()` 反模式重灾区，8/8 处全部在此。子模块：

- `marketing.module.ts:68, 98`、`activity/activity.module.ts:25`、`config/config.module.ts:14`、`rule/rule.module.ts:21`、`instance/instance.module.ts:24`、`scheduler/scheduler.module.ts:29`、`course-group/course-group.module.ts:25`
- `integration/integration.module.ts:31`（forwardRef 但没 require）
- `play/play.module.ts:31, 37`

业务路径化石：

| 化石                                    | 位置                                                  | 严重度                     |
| --------------------------------------- | ----------------------------------------------------- | -------------------------- |
| 优惠券分发锁获取失败用 warn             | `coupon/distribution/redis-lock.service.ts:56`        | **高**（并发）             |
| 优惠券调度释放锁失败 warn × 2           | `coupon/scheduler/scheduler.service.ts:95, 168`       | 低                         |
| lifecycle scheduler 释放锁失败 warn × 5 | `scheduler/lifecycle.scheduler.ts:144, 232, 299, 373` | 低                         |
| 业务逻辑校验失败用 warn                 | `rule/rule-validator.service.ts:335`                  | **中**（业务校验语义模糊） |
| 缓存读写失败 warn ×3                    | `common/cache.interceptor.ts:82, 97, 120`             | 低（设计）                 |

子模块未深读：`activity-item`、`approval`、`campaign`、`campaign-shell`、`coupon/{management,template,statistics,usage}`、`course-group/*`、`entitlement`、`events`、`gray`、`integration` 服务层、`navigation`、`points/*`、`policy`、`product-activity-view`、`resolution`、`schema`、`scene`、`stock`、`template`、`dynamics`。

#### 3.4.1 marketing-revamp seed 链路断层（高）

**这一项与 `HARNESS_ENGINEERING.md` §14.7 同类，但未爆发**。背景：`docs/design/marketing-revamp/P1-06-merge-play-strategy-handler.md` 与 `P1-07-scene-templates.md` 等设计文档要求营销改造同时落地 schema、handler、seed。`play_definition` 的 seed 已经被修复（`seed-pipeline.ts:45` 已调用 `seedPlayDefinitions`），但**marketing scene/policy/template/module/release 这 5 类默认 seed 没有进默认 pipeline**。

证据链：

1. **`apps/backend/prisma/seeds/06-marketing-scenes/index.ts:10-18`** 暴露聚合函数 `seedMarketingScenes`，内部按顺序调 6 个子 seed：

   ```ts
   await seedDefaultPolicies(prisma); // 写 mkt_policy 平台默认行
   await seedSceneTemplates(prisma); // 写 mkt_scene_template 默认模板
   await seedDefaultScenes(prisma); // 写 mkt_scene 默认场景 + SYS_DEFAULT_CARD_SIMPLE / SYS_DEFAULT_RESOLVER
   await seedDefaultModules(prisma); // 写 mkt_module 默认模块
   await seedDefaultReleases(prisma); // 写 mkt_release 默认发布
   await seedHunanScenes(prisma); // 写湖南租户场景
   ```

2. **`grep -rn 'seedMarketingScenes'` 全仓只有 2 处命中**：

   ```
   apps/backend/prisma/seeds/06-marketing-scenes/index.ts:10  ← 定义
   apps/backend/prisma/seeds/run-phases.ts:21                 ← 唯一调用
   ```

3. **`run-phases.ts` 是 legacy phases**，仅在 `--with-legacy-phases` 或 `SEED_INCLUDE_LEGACY_PHASES=true` 时执行（`seed-pipeline.ts:19-21, 52-62`）。默认部署/本地 reset 都**不会跑**它。

4. **默认 pipeline 路径走 `seedHunanFullScenario`**（`seed-pipeline.ts:49`），而 `apps/backend/prisma/seeds/hunan-full/index.ts:14, 30` **只 import 和调用了 `seedHunanScenes` 一个子 seed**：

   ```ts
   import { seedHunanScenes } from '../06-marketing-scenes/hunan-scenes';
   // ...
   await seedHunanScenes(prisma);
   ```

   `seedDefaultPolicies/SceneTemplates/Scenes/Modules/Releases` **5 个全部漏调**。

5. **`policies.ts:5-30` 内容明确是"平台默认 / 系统级 / TenantId=000000"**，不是 hunan 租户特定：`DEFAULT_SOURCE` / `DEFAULT_RESOLVER` / `DEFAULT_AUDIENCE_ALL` / `NEWCOMER_AUDIENCE` / `SYS_DEFAULT_CARD_SIMPLE` / `SYS_DEFAULT_RESOLVER` ——这些都是营销裁决和场景渲染的**全局基线数据**，不归任何业务租户独有。

6. **git log 命中"seed"相关 commit 9 条，没有任何一条标题涉及"接入 06-marketing-scenes 默认 seed"**。说明此漏接从来没人补过（不像 §14.7 的 `seedPlayDefinitions` 后续被补到 pipeline 第 45 行）。

为什么这是"未爆发版本"：

- `play_definition` 当前**有 fail-fast 校验**（`play.dispatcher.ts` grep 命中 `active rows is empty` / `fail-fast`），所以 seed 漏接 → 启动直接崩 → 一次部署就发现。
- 但 `mkt_policy` / `mkt_scene_template` / `mkt_scene` / `mkt_module` / `mkt_release` 的**默认行**目前没有同类启动期校验。所以 seed 漏接 → 启动正常 → 运营第一次用"裁决"、第一次进"场景列表"才出问题：
  - `PolicyEvaluator` 找 `DEFAULT_RESOLVER` 找不到 → 走 fallback 或抛 BusinessException
  - 运营页打开 scene_template 列表 → 空
  - 裁决日志找 `SYS_DEFAULT_CARD_SIMPLE` → 走 fallback 渲染

也就是：**这是一个"运行时才暴露"的 seed 链路断层**，等同于 §14.7 的同类化石，但当前还没有任何业务触发到它。一旦有人在 service 里加一行 `findFirstOrThrow({ where: { policyCode: 'DEFAULT_RESOLVER' } })`，立刻变成线上故障。

待用户决策：

- 选项 A：把 `seedDefaultPolicies/SceneTemplates/Scenes/Modules/Releases` 加到 `seed-pipeline.ts` 默认路径（紧跟 `seedPlayDefinitions` 之后），或者加到 `hunan-full/index.ts` 在 `seedHunanScenes` 之前。这是最对齐 P1-06/P1-07 设计意图的做法。
- 选项 B：直接在默认 pipeline 调 `seedMarketingScenes()` 聚合函数（注意 `seedHunanScenes` 会被跑 2 次，需要确保所有写入幂等——`scenes.ts` 用 `upsert`，应该 OK，需 6 个文件全部核对）。
- 选项 C：加启动期 fail-fast：`PlayDispatcher` 已有先例，把"`mkt_policy` 中 `DEFAULT_RESOLVER` 必须存在"等校验也加到 dispatcher onModuleInit。**但这会让现状立刻爆发**，必须先选 A 或 B。

推荐 A——补 5 行 import + 5 行 await，最小改动，对齐设计文档 §1.2 "平台默认数据通过 seed 维护"的意图。

### 3.5 finance

| 化石                                            | 位置                                                             | 严重度         |
| ----------------------------------------------- | ---------------------------------------------------------------- | -------------- |
| settlement 锁获取失败 logger.error+return false | `settlement/settlement.scheduler.ts:469-471`                     | 低（已 error） |
| withdrawal 锁获取失败 logger.error+return false | `withdrawal/withdrawal-reconciliation.scheduler.ts:179-181`      | 低             |
| settlement-core 锁同                            | `settlement-core/settlement-reconciliation.scheduler.ts:103-105` | 低             |

`finance/{commission, wallet, withdrawal, settlement, settlement-core, events, adapters}` 子模块未深读。Settlement / Wallet / Commission 是 §3.1 高风险域，待重点扫。

### 3.6 store

| 化石                                                              | 位置                                               | 严重度     |
| ----------------------------------------------------------------- | -------------------------------------------------- | ---------- |
| `tenant-sku.repository.ts` 2 处 catch return null                 | `:223-226, 367-368`                                | **高**     |
| 3 个 `product.service.ts` 之一                                    | `module/store/product/product.service.ts` 1444 行  | **中**     |
| `store-product-query-fallback.service.ts` cache fallback warn × 5 | `:113, 124, 251, 262, 275`                         | 低（设计） |
| 分销分享事件写入失败用 warn                                       | `distribution/services/share-token.service.ts:734` | 中         |

`store/{order, finance, distribution/*, stock}` 子模块未深读。

### 3.7 pms

| 化石                           | 位置                                   | 严重度 |
| ------------------------------ | -------------------------------------- | ------ |
| 3 个 `product.service.ts` 之一 | `module/pms/product.service.ts` 875 行 | **中** |

`pms/{brand, category, attribute, product/repository}` 未深读。

### 3.8 payment

| 化石                                            | 位置                                   | 严重度 |
| ----------------------------------------------- | -------------------------------------- | ------ |
| **环境分支吞错**                                | `adapters/wechat-pay.adapter.ts:55-58` | **高** |
| 验签失败开发环境 warn 回退                      | `adapters/wechat-pay.adapter.ts:60`    | **高** |
| `wechat-pay.service.ts:57, 134, 325` catch 模式 | （已审，逻辑相对合理）                 | 中     |

`payment/{wechat-pay-callback, mock-payment-gateway, adapters/*}` 未全部深读。

### 3.9 fulfillment

| 化石                                                                                              | 位置                          | 严重度               |
| ------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------- |
| `fulfillment.service.ts:881-884` catch 后 `isPrismaUniqueError(error)` 判断后 return / else throw | `:881-884`                    | 低（合理 narrowing） |
| spec 40 处 `as any`                                                                               | `fulfillment.service.spec.ts` | 中（基线允许）       |

`fulfillment/services/legacy-fulfillment-backfill.runner.ts` 含 setTimeout，未读上下文。

### 3.10 notification

未深读。`notification/{channels, processor, service}` 等。

### 3.11 lbs

| 化石                              | 位置                                                              | 严重度                   |
| --------------------------------- | ----------------------------------------------------------------- | ------------------------ |
| admission 校验失败 return false   | `admission/admission.service.ts:93-94`                            | **中**（fail-open 风险） |
| 5 处 metrics 失败 warn + return 0 | `monitoring/lbs-metrics.service.ts:42, 60, 73, 126, 151, 160-161` | 中                       |
| 地理编码请求失败 warn × 3         | `geocoding/geocoding.service.ts:107, 146, 231`                    | 中                       |
| Region seed lock 释放失败 warn    | `region/region.service.ts:88`                                     | 低                       |

### 3.12 ai-content

未深读。`ai-content/{ai-platform-prompt, openai}` 等。

### 3.13 module/common（模块层）

| 化石                                | 位置                                                                                  | 严重度             |
| ----------------------------------- | ------------------------------------------------------------------------------------- | ------------------ |
| 限流降级失败 warn × 2               | `common/guards/throttle.guard.ts:86, 107`                                             | 低（已是降级路径） |
| Redis 限流存储异常降级内存 warn × 2 | `common/guards/redis-throttler.storage.ts:96`、`redis-express-rate-limit.store.ts:40` | 低                 |
| IP 地理位置查询失败 warn            | `common/axios/axios.service.ts:81`                                                    | 低                 |

### 3.14 src/common（工具层）

| 化石                                   | 位置                                                             | 严重度                         |
| -------------------------------------- | ---------------------------------------------------------------- | ------------------------------ |
| **error-event 观测器 4 处 warn**       | `common/observability/error-event.service.ts:156, 241, 335, 345` | **高**（已记 §3.1.3）          |
| config JSON parse 失败 warn + fallback | `config/index.ts:44-45`                                          | **高**（配置错误应 fail-fast） |
| tenant cache 4 处 logger.error catch   | `common/cache/tenant-cache.service.ts:152, 179, 202, 240`        | 中（已 error，可接受）         |
| Redis cache-manager catch logger.error | `module/common/redis/cache-manager.service.ts:145`               | 中（已 error）                 |

### 3.15 backup / risk / main

未深读，规模小。

## 4. 高风险路径警报（按 AGENTS.md §3.1）

按高风险域横切，**最需立即处理**的化石：

### 4.1 鉴权 / 支付 / 资金

- `client/order/ports/order-cart.port.ts:39` token verify floating
- `auth-core/sms-code.service.ts:73` 短信验证码 Redis 回滚失败用 warn
- `payment/adapters/wechat-pay.adapter.ts:55-58` 非生产吞错
- `payment/adapters/wechat-pay.adapter.ts:60` 验签失败用 warn 回退
- `admin/auth/auth.service.ts:100-111` SysTenant 失败伪造默认租户

### 4.2 订单 / 退款 / 库存

- `client/order/events/order-outbox.dispatcher.ts:65-66` setInterval 替代调度器
- `store/product/tenant-sku.repository.ts:223-226, 367-368` 库存仓储 catch return null
- `client/order/ports/order-marketing.port.ts:35,37` 启动期 DI 死锁源头之一

### 4.3 多租户隔离

- `admin/auth/auth.service.ts:100-111` 默认租户伪造（破坏租户语义）
- `admin/system/tenant/tenant.service.ts:692, 1264` 字典/配置同步失败 warn

### 4.4 字典治理

- `admin/system/dict/dict.service.ts:337` 缓存 floating set

### 4.5 定时任务和后台任务

- 全 marketing scheduler 5 处释放锁 warn 可接受（锁会到期），但建议升 error 监控
- `client/order/events/order-outbox.dispatcher.ts` 没用 SchedulerRegistry

## 5. 整改路线图

按 ROI 排序。每一阶段都可独立验证，不依赖后续阶段。

### 阶段 1 — 装备 lint 防御套件（最大 ROI）

**改动范围**：仅 `eslint.config.mjs` + `apps/backend/eslint.config.mjs`，**不动业务代码**。

新增规则一次到位（先全部 `warn` 跑一遍出报告，看违规数量决定哪些直接 `error`）：

```js
// 根 eslint.config.mjs 业务规则区
'@typescript-eslint/no-floating-promises': 'error',
'@typescript-eslint/no-misused-promises': 'error',
'@typescript-eslint/await-thenable': 'error',
'@typescript-eslint/require-await': 'warn',
'@typescript-eslint/no-unsafe-assignment': 'warn',
'@typescript-eslint/no-unsafe-call': 'warn',
'@typescript-eslint/no-unsafe-member-access': 'warn',
'@typescript-eslint/no-unsafe-return': 'warn',
'import/no-cycle': ['error', { maxDepth: 10 }],
'consistent-return': 'warn',
'no-restricted-syntax': ['error',
  { selector: "CallExpression[callee.name='setInterval'] > :first-child", message: '在 Nest service 中使用 setInterval 通常是补偿机制；改用 @Cron/SchedulerRegistry 或 Bull' },
  { selector: "CallExpression[callee.name='require']", message: '禁止动态 require()——typescript 看不见 import 边，会绕过 import/no-cycle 检测' },
],
// 自定义错误处理规则需要配合 eslint-plugin-no-only-tests 或自写 plugin
```

apps/backend/eslint.config.mjs spec 覆盖块至少**改为 warn**而不是完全 `off`：

```js
'@typescript-eslint/no-explicit-any': 'warn',
'@typescript-eslint/ban-ts-comment': ['warn', { 'ts-ignore': 'allow-with-description' }],
```

**预期反馈**：跑 `pnpm lint:backend` 会出几百到几千违规。按以下分桶处理：

- **桶 A**：floating promise / misused promise（预期 50-200 处）—— 业务静默错误最大来源，**先清**
- **桶 B**：import/no-cycle（预期 10-30 处）—— 启动期 DI 死锁来源，**先清**
- **桶 C**：unsafe any（预期 1000+ 处）—— 长期治理
- **桶 D**：no-restricted-syntax（预期个位数）—— 立即清

桶 A、B 清理完后两条规则升 `error`。

### 阶段 2 — 修 B 类绕过沉淀

| 化石                                                                             | 整改                                                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `apps/admin-web/scripts/generate-elegant-routes.ts:53-61` 自动注入 `@ts-nocheck` | 删除注入逻辑；修复 `routes.ts` 真实类型问题（用 type assertion 或修 `elegant-router.d.ts` 的 discriminated union） |
| `scripts/check-admin-view-types.mjs:52-61` 同样注入                              | 删除                                                                                                               |
| 8 处 `forwardRef + require()`                                                    | 改用 Port / ContractModule / 类型仅引用——commit `85666de5` 已示范"类型仅引用打破启动期循环依赖"的正确做法          |

### 阶段 3 — 升级门禁口径

| 化石                                                     | 整改                                                |
| -------------------------------------------------------- | --------------------------------------------------- |
| `check-spec-drift.mjs:191` 只看文件被 touch              | 加判定：spec diff 中 expect/it 调用差异、断言行数差 |
| `check-forwardref-reason.mjs` 只查注释                   | 替换为基于 madge 或自建 AST 的真实 import 环检测    |
| 5 个 warn-only 静态扫描（`check-test-spec-coverage` 等） | 误报率稳定后升 `error`                              |

### 阶段 4 — 补运行期评估（§14.6 / §14.7）

| 缺口                  | 整改                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 无 backend boot smoke | 实现 `pnpm harness:boot:backend`：spawn `pnpm dev:backend` → 等 `Nest application successfully started` 或健康端点 200 → 超时 kill。接入 `pnpm check:slice` backend 路径 |
| 无独立 Evaluator      | 长期项；可先在 `PostToolUse` hook 加 prompt 类型 hook，对 backend service 写入触发独立 Agent 按 §3.3/§4/§5 review                                                        |

### 阶段 5 — 业务代码批量清理（按本文 §3 模块清单）

按 §4 高风险域优先级清理。每个模块的化石都标了行号，可独立提 PR。

### 阶段 6 — tsconfig strictNullChecks: true

最大破坏性改动，放最后。先开 `report` 模式（不阻断 CI）统计存量违规，分批清。strict null 一旦打开，§3 中很多 `as any` 处会立刻露馅。

## 6. 不确定 / 待用户决策

| 项                                                        | 待确认                           |
| --------------------------------------------------------- | -------------------------------- |
| `auth.service.ts:265` `assertNewPasswordPlain` 是否 async | 需读 `passwordResetService` 实现 |
| `order-cart.port.ts:39` `tokenService.verify` 是否 async  | 需读 `tokenService` 实现         |
| `sse.controller.ts:62,67,112` `sseService` 方法是否 async | 需读 `sseService` 实现           |
| §3 未深读模块的具体化石数量                               | 需要分批继续扫描                 |
| 阶段 1 lint 规则是否分批 warn→error，每批多久间隔         | 维护者拍板                       |
| 阶段 6 strict null 是否分包/分目录逐步开启                | 维护者拍板                       |
| §2.8 中文乱码影响范围                                     | 需要全仓 grep 类似 GBK 字符      |

## 7. 维护说明

### 7.1 本轮扫描完成度（2026-05-18）

7 类反模式（§2.1 ~ §2.8）已对 **`apps/backend/src` 全量代码**完成 grep 扫描，所有命中均记录到 §3 对应模块。当前文档反映 2026-05-18 时点的化石分布。

按模块覆盖：

| 模块                                                                                                                                                                                                                                                 | 反模式 grep 扫描 |       关键文件深读       |          业务语义人工 review           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------: | :----------------------: | :------------------------------------: |
| `admin/auth` + `admin/auth/services`                                                                                                                                                                                                                 |        ✓         |            ✓             |     ✓（race × 3 + fail-open 已记）     |
| `admin/system/{dict,config,user,post,tenant}`                                                                                                                                                                                                        |        ✓         |            ✓             |                   ✓                    |
| `admin/system/{auth,client,file-manager,menu,message,notice,role,system-config,tenant-audit,tenant-package,tool,upload}`                                                                                                                             |        ✓         |         仅文件名         |                   ⬜                   |
| `admin/monitor/*`                                                                                                                                                                                                                                    |        ✓         |            ✓             |                  部分                  |
| `admin/{member,upgrade,upload,worker,resource,finance}`                                                                                                                                                                                              |        ✓         |            ✓             |                   ⬜                   |
| `auth-core`                                                                                                                                                                                                                                          |        ✓         |            ✓             |                  部分                  |
| `client/auth`                                                                                                                                                                                                                                        |        ✓         |    ✓（仅 grep 反向）     |      ⬜（auth.service 主体未读）       |
| `client/order` + `client/order/{services,ports,events,contract}`                                                                                                                                                                                     |        ✓         |            ✓             | 部分（outbox / port / marketing 已记） |
| `client/product` + `client/product/*`                                                                                                                                                                                                                |        ✓         |            ✓             |                  部分                  |
| `client/marketing/aggregate`                                                                                                                                                                                                                         |        ✓         |            ✓             |           ✓（中文乱码已记）            |
| `client/marketing/{coupon,points,scene,navigation,zone,instance,activity}`                                                                                                                                                                           |        ✓         |            ⬜            |                   ⬜                   |
| `client/{cart,payment,finance,user,address,location,upgrade,upload,distribution,ai-content,service}`                                                                                                                                                 |        ✓         |            ⬜            |                   ⬜                   |
| `client/common/service`                                                                                                                                                                                                                              |        ✓         |   ✓（wechat × 3 已记）   |                   ✓                    |
| `marketing` 顶层 + 8 处 `forwardRef+require` 模块                                                                                                                                                                                                    |        ✓         |            ✓             |                   ✓                    |
| `marketing/{integration,play,instance,course-group,resolution,scheduler,coupon/distribution,coupon/scheduler,rule}`                                                                                                                                  |        ✓         |           部分           |                  部分                  |
| `marketing/{activity,activity-item,approval,campaign,campaign-shell,coupon/management,coupon/template,coupon/statistics,coupon/usage,entitlement,events,gray,navigation,points/*,policy,product-activity-view,schema,scene,stock,template,dynamics}` |        ✓         |            ⬜            |                   ⬜                   |
| `finance/{settlement,settlement-core,withdrawal}` 调度器                                                                                                                                                                                             |        ✓         |            ✓             |                  部分                  |
| `finance/{commission,wallet,events,adapters,withdrawal 子服务}`                                                                                                                                                                                      |        ✓         |            ⬜            |                   ⬜                   |
| `store/product` + `store-product-query-fallback`                                                                                                                                                                                                     |        ✓         |            ✓             |                  部分                  |
| `store/{order,finance,distribution/*,stock}`                                                                                                                                                                                                         |        ✓         |            ⬜            |                   ⬜                   |
| `pms/product`                                                                                                                                                                                                                                        |        ✓         |     ✓（行数/方法数）     |                   ⬜                   |
| `pms/{brand,category,attribute,product/repository}`                                                                                                                                                                                                  |        ✓         |            ⬜            |                   ⬜                   |
| `payment` + `payment/adapters`                                                                                                                                                                                                                       |        ✓         | ✓（wechat-pay × 3 已记） |                  部分                  |
| `fulfillment` + `fulfillment/services`                                                                                                                                                                                                               |        ✓         |           部分           |                   ⬜                   |
| `notification` + `notification/{channels,policy,processor}`                                                                                                                                                                                          |        ✓         |            ⬜            |                   ⬜                   |
| `lbs/{admission,monitoring,geocoding,region,station,geo}`                                                                                                                                                                                            |        ✓         |            ✓             |                  部分                  |
| `ai-content` + `ai-content/openai`                                                                                                                                                                                                                   |        ✓         |            ⬜            |                   ⬜                   |
| `backup`、`risk`、`main`                                                                                                                                                                                                                             |        ✓         |            ⬜            |                   ⬜                   |
| `module/common/{redis,axios,bull,error-event}`                                                                                                                                                                                                       |        ✓         |           部分           |                  部分                  |
| `src/common/{observability,cache,config,guards,interceptors,filters,decorators,exceptions,utils,validators,tenant,cls,idempotency,logger,repository,scheduler,audit,response,prisma}`                                                                |        ✓         |           部分           |                   ⬜                   |

「反模式 grep ✓」表示 §2 的 7 类反模式已覆盖；「关键文件深读 ⬜」表示主 service 文件还未逐行读过；「业务语义人工 review ⬜」表示**漏 await 之外**的业务级问题（状态机、tenant 越权、事务边界、并发幂等）未做。

### 7.2 grep 扫描覆盖不了的化石类型

以下问题**必须人工 review**，本轮审计未涵盖：

- 业务状态机走错分支（订单 / 优惠券 / 支付 / 退款 / 履约）
- 跨租户越权读 / 写（缺少 `tenantHelper.readWhereForDelegate` 或对应 scope）
- 事务边界错误（`$transaction` 内部 await 缺失 / 嵌套事务 / 跨连接 transaction）
- 并发幂等不足（订单创建 / 优惠券锁定 / 库存扣减没有幂等键或唯一索引兜底）
- Service 层重复实现（3 个 `product.service` 之间逻辑漂移）
- 业务规则被埋在 controller 而非 service（违反 §4.1 "Controller 只受理"）
- 接口返回数据捏造（如 §2.3 C.4 列的 fail-open 伪造默认租户，可能还有同类）

§5 阶段 5 "业务代码批量清理"应当先把上面这几类做人工 review，文档中按 §3 模块章节追加发现。

### 7.3 维护流程

- 每次新增反模式扫描发现时，把化石追加到对应模块章节。
- 化石被修复后，把对应条目改为 `~~ 已修复 commit-hash ~~`（保留历史）；季度归档时移到附录。
- §7.1 表中标 ⬜ 的模块在下次审计推进时优先扫。
- §5 整改路线图随阶段推进更新进度。

文档不替代 `HARNESS_ENGINEERING.md` §14 的"已知债务"清单——前者描述**仓库设计的已知盲区**，本文描述**当前代码状态下化石的具体分布**。两者交叉引用。

## 8. 附录：扫描方法

本审计使用的 grep 模式与判定标准：

| 反模式                       | grep 模式                                                                                                     | 误判注意                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A floating promise           | `^\s{2,}(this\.\w+(?:Service\|Repo\|Repository\|Client\|Queue\|Manager\|Bus\|Emitter)\.\w+\([^)]*\)\s*;)\s*$` | 仅匹配 `this.xxxService.method()` 单行调用，会漏掉链式 / 多行；用 `void ` 显式标记的不算 floating |
| B forwardRef+require         | `forwardRef\s*\(\s*\(\s*\)\s*=>\s*require\(`                                                                  | 完整覆盖                                                                                          |
| C catch swallow              | `catch\s*\([^)]*\)\s*\{[^}]*return\s+(null\|undefined\|\[\]\|\{\s*\}\|false\|0\|'')`                          | multiline，可能漏多行 catch                                                                       |
| D setInterval 业务用         | `setInterval\|setTimeout` + 人工分类合理性                                                                    | 高误判，需读上下文                                                                                |
| E 重复 service               | `find -name '*.service.ts' \| sort \| uniq -c`                                                                | 同名但语义不同也会被列出                                                                          |
| F logger.warn 报 error       | `\.logger\.(warn\|info\|debug)\s*\([^)]*(?:fail\|error\|失败\|错误\|异常\|crash)` 大小写不敏感                | 容易漏掉变量化的消息                                                                              |
| G `as any` / `@ts-(no)check` | 直接字符串搜                                                                                                  | 已在 spec 显式 off，需手动核对生产代码出现                                                        |
