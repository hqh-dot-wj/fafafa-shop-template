---
title: Admin-Web Conventions
status: active
doc_type: agent-supplement
owner: engineering-governance
last_verified: 2026-05-15
---

# Admin-Web Conventions

承接 admin-web AGENTS 中提交体、Naive UI hooks、列名等约定。规则正文以 `apps/admin-web/AGENTS.md` 为准。

## 1. API 类型与提交体

- `src/service/api/*` 的请求/响应类型优先来自 `@libs/common-types`。
- 本地类型只允许用于 view-model、组件内部状态或临时兼容层；禁止在 `src/service/api/*` 手写与 backend 含义相同但字段漂移的重复类型。
- 创建 DTO 与更新 DTO 不同的时候，必须分别声明 `SaveXxxPayload` / `UpdateXxxPayload`。
- 不要把列表 VO、详情对象、整表 row 直接 POST；提交体必须显式映射到后端 DTO 白名单字段。

## 2. Naive UI 与 hooks

- `useTable` 的 `apiFn` 成功体必须是 `Api.Common.PaginatingQueryRecord<T>`。
- `NSelect` 只用稳定标量作 value；空值语义用 `''` 或明确标量，提交时转回业务值。
- `watch(visible)` 中重置表单时，要同时调用 `restoreValidation()`。
- `rules` 的 key 必须与 `path` 对齐；空 `rules` 不会自动产生校验。
- 组件声明顺序建议：`defineProps -> defineModel -> defineEmits`。
- Naive 组件未解析时，先依赖 `unplugin-vue-components`；仍爆红再显式导入。

## 3. 搜索子组件

- 父子共用同一 `Api.*SearchParams` 类型。
- `reset`：先 `restoreValidation()`，再 `emit('reset')`。
- `search`：先 `await validate()`，再 `emit('search')`。

## 4. 通用列名规范表

新增页面列定义时，以下高频字段的中文列名须与此表保持一致，禁止自造或缩写。参考范本：`system/role`、`marketing/asset`。

| 字段语义           | 规范列名                            | 禁止写法举例                     |
| ------------------ | ----------------------------------- | -------------------------------- |
| 序号               | 序号（或 `$t('common.index')`）     | index、编号                      |
| 用户 / 操作人      | 用户 / 申请人（同页选一个，不混用） | user、用户名、userName           |
| 创建时间           | 创建时间                            | create_time、createdAt、创建日期 |
| 更新时间           | 更新时间                            | update_time、修改时间            |
| 操作（按钮列）     | 操作（固定放最后一列）              | action、operate                  |
| 状态列             | 状态（同页只用一种写法）            | status、当前状态                 |
| 所属租户           | 所属租户                            | 租户、商户、tenantId             |
| 支付通道           | 支付通道                            | 渠道、channel                    |
| 结算方式           | 结算方式                            | 打款方式                         |
| 订单编号           | 订单号                              | orderId、order_no                |
| 批次编号           | 批次号                              | batchId                          |
| 金额（带业务前缀） | XX金额（如"申请金额"、"结算金额"）  | amount、XX_amount                |
| 备注               | 备注                                | remark、note                     |

列名若无对应条目，须先与同模块现有页面保持一致，再落代码；若同模块也没有先例，与用户确认后再写。
