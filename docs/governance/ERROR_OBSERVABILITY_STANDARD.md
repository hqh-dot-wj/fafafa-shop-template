---
title: 错误监控与步骤级错误提示标准
status: active
doc_type: governance
last_verified: 2026-05-10
---

# 错误监控与步骤级错误提示标准

## 1. 目标

本标准约束 backend、admin-web、miniapp-client 的错误捕获、错误上报、用户提示与排查链路。目标不是让所有代码都包一层 `try/catch`，而是让每个关键错误都能回答：

- 谁触发：`tenantId`、`userId`、客户端、页面或接口。
- 哪条链路：`requestId`、`traceId`、`errorId`。
- 哪个业务：`operationCode`。
- 哪一步失败：`stepCode`、`stepName`。
- 怎么处理：用户安全提示、开发排查信息、重试或降级策略。

完整错误监控必须同时覆盖用户提示、开发排查、客服查询、聚合告警和治理扫描。只有接口日志或 `catch` 日志不算完整错误监控。

## 2. 适用范围

| 范围                     | 要求                                                                      |
| ------------------------ | ------------------------------------------------------------------------- |
| `apps/backend/**`        | 统一错误模型、链路 ID、步骤级业务事件、异常 cause 保留、指标与日志聚合    |
| `apps/admin-web/**`      | 请求错误归一化、页面 action 步骤提示、全局运行时错误与未处理 Promise 上报 |
| `apps/miniapp-client/**` | 请求错误归一化、端侧 trace 传递、页面步骤提示、uni 生命周期错误上报       |
| `libs/**`                | 只放跨端纯类型或纯工具；不得依赖任一 app 源码                             |
| `scripts/**`             | 只放可机械检查的治理脚本；新增脚本前先确认没有既有能力可扩展              |

涉及错误响应 DTO、OpenAPI、Prisma schema、migration、支付、认证、租户、资金、退款、字典、任务调度时，按根 `AGENTS.md` 高风险流程先停手确认。

## 3. 统一术语

| 字段               | 含义                        | 生成与传播规则                                             |
| ------------------ | --------------------------- | ---------------------------------------------------------- |
| `requestId`        | 单次 HTTP 请求 ID           | 前端传入则后端复用；没有才由后端生成                       |
| `traceId`          | 一次用户动作或跨接口链路 ID | 前端 action 开始时生成；后端透传到日志、错误响应和下游调用 |
| `errorId`          | 单个错误事件 ID             | 错误发生点生成；用于用户报障和客服定位                     |
| `operationCode`    | 业务动作编码                | 例如 `order.refund`、`tenant.create`、`cart.load`          |
| `stepCode`         | 业务步骤编码                | 例如 `order.refund.callPaymentProvider`                    |
| `stepName`         | 用户或客服可理解的步骤名    | 例如 `调用支付渠道退款`                                    |
| `errorCode`        | 稳定错误码                  | 用于聚合、告警、测试断言和前端分支                         |
| `safeMessage`      | 可展示给用户的安全文案      | 不包含堆栈、SQL、密钥、内部服务地址                        |
| `technicalMessage` | 开发排查信息                | 只进日志和监控，不直接给用户                               |

命名规则：

- `operationCode` 与 `stepCode` 使用小写英文和点号分层。
- 禁止使用 `step1`、`fooError`、`failed` 这类不可维护名称。
- `stepName` 可以中文，但不能泄露内部实现或敏感信息。

## 4. 错误事件结构

后端日志、前端上报和后续错误事件表应向同一结构收敛：

```ts
interface ErrorEventPayload {
  app: 'backend' | 'admin-web' | 'miniapp-client';
  env: string;
  level: 'warn' | 'error' | 'fatal';
  requestId?: string;
  traceId?: string;
  errorId: string;
  tenantId?: string | number;
  userId?: string | number;
  route?: string;
  method?: string;
  module?: string;
  operationCode?: string;
  stepCode?: string;
  stepName?: string;
  errorCode: string;
  safeMessage: string;
  technicalMessage?: string;
  stack?: string;
  cause?: unknown;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
```

`metadata` 必须脱敏。禁止写入密码、token、完整手机号、身份证、支付密钥、完整银行卡号、生产连接串、租户敏感配置。

## 5. 后端标准

### 5.1 链路 ID

- 后端必须优先复用前端传入的 `X-Request-Id` 与 `X-Trace-Id`。
- 若请求未携带，后端生成并写入响应头。
- 全局异常过滤器、Pino 日志、业务错误、HTTP 指标和步骤事件必须读取同一份链路上下文。
- 禁止同一请求中 CLS、异常过滤器、日志系统各自生成互不相干的 ID。

### 5.2 错误响应

对外错误响应必须至少包含：

```ts
{
  code: 'ORDER_REFUND_FAILED',
  msg: '退款失败，请稍后重试',
  requestId: 'req_xxx',
  traceId: 'trace_xxx',
  errorId: 'err_xxx',
  operationCode: 'order.refund',
  stepCode: 'order.refund.callPaymentProvider',
  stepName: '调用支付渠道退款'
}
```

面向前端的 `msg` 只放安全文案。堆栈、SQL、第三方原始响应、内部服务地址只能进入日志或监控。

### 5.3 cause 保留

包装错误时必须保留原始错误：

```ts
throw new BusinessException('退款失败，请稍后重试', {
  code: 'ORDER_REFUND_FAILED',
  cause: error,
  operationCode: 'order.refund',
  stepCode: 'order.refund.callPaymentProvider',
  stepName: '调用支付渠道退款',
});
```

禁止：

```ts
throw new Error('refund failed');
```

若确实需要屏蔽原始错误，也必须先上报并说明屏蔽原因。

### 5.4 步骤包装

关键业务流程必须用步骤语义包裹，而不是只在最外层 catch：

```ts
await runStep(
  {
    operationCode: 'order.refund',
    stepCode: 'order.refund.callPaymentProvider',
    stepName: '调用支付渠道退款',
  },
  () => paymentService.refund(order),
);
```

`runStep` 的职责：

- 记录开始、成功、失败、耗时。
- 将 `operationCode`、`stepCode`、`stepName` 注入日志上下文。
- 失败时生成 `errorId`，上报错误事件，并保留 `cause`。
- 不自行吞掉主流程错误，除非调用方明确声明该步骤是附属步骤。

### 5.5 附属步骤

刷新日志、埋点、非关键通知、缓存清理等附属步骤失败时，可以不阻断主流程，但必须记录为 `warn` 或 `debug` 事件，并给出原因：

```ts
await runStep(
  {
    operationCode: 'order.refund',
    stepCode: 'order.refund.refreshOperationLog',
    stepName: '刷新操作日志',
    optional: true,
  },
  () => refreshOperationLog(),
);
```

附属步骤失败的用户提示应区分主流程结果，例如：`退款已提交，但刷新操作日志失败。追踪号：trace_xxx`。

## 6. 前端标准

### 6.1 请求错误归一化

admin-web 和 miniapp-client 的请求层必须把不同来源错误归一化为统一结构：

```ts
interface AppError {
  message: string;
  code?: string;
  requestId?: string;
  traceId?: string;
  errorId?: string;
  operationCode?: string;
  stepCode?: string;
  stepName?: string;
  raw?: unknown;
}
```

页面层不得直接依赖 AxiosError、uni request 原始失败结构或后端临时字段。

### 6.2 全局错误上报

admin-web 至少覆盖：

- `app.config.errorHandler`
- `window.onerror`
- `window.onunhandledrejection`
- 请求错误统一上报
- 页面 action 错误统一上报

miniapp-client 至少覆盖：

- app 生命周期错误
- 未处理 Promise
- 请求错误统一上报
- 页面 action 错误统一上报

全局上报必须带页面路径、用户动作、traceId、requestId 和脱敏后的上下文。

### 6.3 页面 action 步骤提示

多步骤页面动作必须明确主流程和附属流程：

```ts
await withActionSteps({
  operationCode: 'order.refund',
  steps: [
    { stepCode: 'order.refund.validateForm', stepName: '校验退款信息' },
    { stepCode: 'order.refund.submit', stepName: '提交退款申请' },
    { stepCode: 'order.refund.refreshDetail', stepName: '刷新订单详情', optional: true },
    { stepCode: 'order.refund.refreshOperationLog', stepName: '刷新操作日志', optional: true },
  ],
});
```

用户提示必须能区分：

- 主流程失败：`退款失败：提交退款申请失败。追踪号：trace_xxx`
- 附属流程失败：`退款已提交，但刷新操作日志失败。追踪号：trace_xxx`
- 网络失败：`网络异常，退款结果暂未确认。请稍后刷新订单。追踪号：trace_xxx`
- 权限失败：`当前账号无权执行退款。`
- 数据状态失败：`当前订单状态不允许退款。`

### 6.4 用户提示边界

用户提示应告诉用户发生了什么、是否需要重试、如何提供追踪号。禁止直接展示：

- 堆栈。
- SQL。
- 第三方完整原始错误。
- 内部服务名和内网地址。
- 密钥、token、租户敏感信息。

## 7. catch 归类规则

每个 `catch` 必须归入以下一种类型：

| 类型                   | 用法                           | 必须动作                                |
| ---------------------- | ------------------------------ | --------------------------------------- |
| `report + rethrow`     | 当前层只补上下文，交给上层处理 | 上报、保留 cause、重新抛出              |
| `report + user prompt` | 当前层负责用户提示             | 上报、提示、返回明确状态                |
| `fallback + report`    | 使用降级值继续                 | 上报降级原因、标记 fallback             |
| `optional step fail`   | 附属步骤失败不阻断主流程       | 记录 warn/debug、提示附属失败或静默标记 |
| `safe ignore`          | 确认无业务影响                 | 写明原因，至少保留 debug 入口           |

禁止：

```ts
catch {}
```

```ts
.catch(() => {})
```

```ts
catch {
  throw new Error('xxx failed');
}
```

```ts
catch (error) {
  return null;
}
```

返回 `null`、`false`、空数组或默认对象前，必须说明这是业务降级还是错误兜底，并上报上下文。

## 8. 步骤级提示示例

| 场景               | 不合格提示 | 合格提示                                                |
| ------------------ | ---------- | ------------------------------------------------------- |
| 退款主流程失败     | 操作失败   | 退款失败：支付渠道暂时不可用。追踪号：trace_xxx         |
| 退款后刷新日志失败 | 操作失败   | 退款已提交，但刷新操作日志失败。追踪号：trace_xxx       |
| 购物车加载失败     | 加载失败   | 购物车加载失败：网络异常，请稍后重试。追踪号：trace_xxx |
| 活动不存在         | 请求错误   | 活动信息加载失败：活动不存在或已下架。                  |
| 权限不足           | 系统错误   | 当前账号无权执行此操作。                                |

## 9. 当前仓库优先收敛点

以下是落地本标准时的优先入口，不代表只允许修改这些文件：

| 问题                             | 优先入口                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 后端链路 ID 不统一               | `apps/backend/src/common/cls/cls.module.ts`、`apps/backend/src/common/filters/global-exception.filter.ts`、`apps/backend/src/main.ts` |
| admin-web 请求 ID 与错误归一化   | `apps/admin-web/packages/axios/src/index.ts`、`apps/admin-web/src/service/request/index.ts`                                           |
| admin-web 全局错误处理未统一接入 | `apps/admin-web/src/plugins/app.ts`、`apps/admin-web/src/main.ts`                                                                     |
| miniapp 请求未统一传递 trace     | `apps/miniapp-client/src/http/http.ts`、`apps/miniapp-client/src/http/interceptor.ts`                                                 |
| 订单退款与批量操作步骤提示不足   | `apps/backend/src/module/store/order/store-order.service.ts`、`apps/admin-web/src/views/store/order/**`                               |
| 租户创建和同步错误上下文不足     | `apps/backend/src/module/admin/system/tenant/**`                                                                                      |
| 静默 catch 与固定错误文案        | 全仓 `catch {}`、`.catch(() => {})`、`throw new Error('xxx failed')`                                                                  |

## 10. 分阶段落地

### Phase 0：治理标准

- 落地本文档。
- 梳理现有空 catch、固定错误文案、trace 断点。
- 不改接口契约，不改 Prisma，不改业务流程。

### Phase 1：链路 ID 与前端全局上报

- 统一 `requestId`、`traceId`、`errorId` 生成与透传。
- admin-web 接入全局错误和未处理 Promise 上报。
- miniapp-client 接入请求 trace 和全局错误上报。
- 不新增错误事件表时，可先落日志与外部监控 sink。

### Phase 2：后端错误模型与步骤包装

- 增强 `BusinessException` / `AppError` 对 `cause`、`operationCode`、`stepCode` 的支持。
- 引入 `runStep`，优先覆盖订单、退款、租户、消息、购物车、活动等高价值流程。
- HTTP 指标增加 `errorCode`、`operationCode`、`stepCode` 维度时必须控制 cardinality。

### Phase 3：错误事件存储与后台查询

- 如需新增错误事件表、诊断接口或后台错误查询页，先走高风险确认。
- 需要改 backend DTO / OpenAPI / 前端类型时，按跨 app 契约链路执行 `pnpm generate-types` 和受影响前端验证。

### Phase 4：治理脚本与门禁

- 增加或扩展脚本检查空 catch、裸 `.catch(() => {})`、丢 cause 的固定错误。
- 只把稳定、低误报规则接入门禁；探索性扫描先做 report，不阻断 CI。

## 11. 验收门禁

| 改动类型                            | 验证要求                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| 仅本文档或相关治理文档              | 检查路径、链接、命令和文档归属                                               |
| backend 错误模型或链路 ID           | `pnpm typecheck:backend`，必要时补对应单测                                   |
| admin-web 请求层或全局错误处理      | `pnpm typecheck:admin`；若改 views，补 `pnpm verify:admin-view-types`        |
| miniapp-client 请求层或全局错误处理 | `pnpm lint:h5` + `pnpm typecheck:h5`                                         |
| 跨 app 契约变更                     | `pnpm typecheck:backend` + `pnpm generate-types` + 受影响前端 typecheck/lint |
| Prisma / migration / 错误事件表     | 先走高风险确认，再按 Prisma 与跨 app 链路验证                                |

## 12. DoD

一次错误监控改造交付前必须确认：

- 用户能看到安全错误提示和追踪号。
- 开发能用 traceId 或 errorId 查到前端错误、后端接口、业务步骤、原始 cause。
- 关键流程能看到每一步成功、失败和耗时。
- catch 没有静默吞错；允许忽略的地方写明原因。
- 包装错误没有丢失原始 cause。
- 前端全局运行时错误和未处理 Promise 能上报。
- miniapp 请求能串到后端日志。
- 监控能按 `errorCode`、`operationCode`、`stepCode`、`tenantId`、`route` 聚合。
- 已执行验证写清；未执行验证和残余风险写清。
