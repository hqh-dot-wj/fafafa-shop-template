# 核心接口 SLO 落地记录

> 更新时间：2026-03-17

## 1. SLO 统一标准

| 分类      | `@sloLatency` | `@sloAvailability` | 适用场景                             |
| --------- | ------------- | ------------------ | ------------------------------------ |
| `payment` | P99 < 200ms   | 99.99%             | 支付、退款、到账通知、提现审核       |
| `core`    | P99 < 500ms   | 99.9%              | 订单创建、关键状态流转、核心业务动作 |
| `list`    | P99 < 1000ms  | 99.5%              | 列表、详情、统计查询                 |
| `admin`   | P99 < 2000ms  | 99%                | 管理后台查询、导出、运维管理         |

## 2. 已落地范围

已补充 `@sloCategory` / `@sloLatency` / `@sloAvailability` 三元组：

- 第一批（核心链路）：
- `apps/backend/src/module/client/payment/payment.controller.ts`
- `apps/backend/src/module/client/order/order.controller.ts`
- `apps/backend/src/module/client/order/order-integration.controller.ts`
- `apps/backend/src/module/client/product/product.controller.ts`
- `apps/backend/src/module/client/finance/client-finance.controller.ts`
- `apps/backend/src/module/finance/withdrawal/withdrawal.controller.ts`
- `apps/backend/src/module/finance/settlement/settlement.controller.ts`
- `apps/backend/src/module/store/order/store-order.controller.ts`
- `apps/backend/src/module/store/finance/store-finance.controller.ts`
- `apps/backend/src/module/admin/finance/admin-finance.controller.ts`
- `apps/backend/src/module/admin/system/user/user.controller.ts`
- `apps/backend/src/module/admin/system/tenant-audit/tenant-audit.controller.ts`
- `apps/backend/src/module/marketing/play/play.controller.ts`

- 第二批（登录与核心入口补齐）：
- `apps/backend/src/module/admin/auth/auth.controller.ts`
- `apps/backend/src/module/client/address/address.controller.ts`
- `apps/backend/src/module/client/auth/auth.controller.ts`
- `apps/backend/src/module/client/cart/cart.controller.ts`
- `apps/backend/src/module/client/user/user.controller.ts`
- `apps/backend/src/module/pms/product.controller.ts`
- `apps/backend/src/module/store/product/product.controller.ts`

- 第三批（admin/system + pms 收口）：
- `apps/backend/src/module/admin/system/config/config.controller.ts`
- `apps/backend/src/module/admin/system/dept/dept.controller.ts`
- `apps/backend/src/module/admin/system/dict/dict.controller.ts`
- `apps/backend/src/module/admin/system/file-manager/file-manager.controller.ts`
- `apps/backend/src/module/admin/system/menu/menu.controller.ts`
- `apps/backend/src/module/admin/system/message/message.controller.ts`
- `apps/backend/src/module/admin/system/notice/notice.controller.ts`
- `apps/backend/src/module/admin/system/post/post.controller.ts`
- `apps/backend/src/module/admin/system/role/role.controller.ts`
- `apps/backend/src/module/admin/system/tenant/tenant.controller.ts`
- `apps/backend/src/module/admin/system/tenant-package/tenant-package.controller.ts`
- `apps/backend/src/module/admin/system/tool/tool.controller.ts`
- `apps/backend/src/module/pms/attribute/attribute.controller.ts`
- `apps/backend/src/module/pms/brand/brand.controller.ts`
- `apps/backend/src/module/pms/category/category.controller.ts`

- 第四批（全量收口）：
- `apps/backend/src/module/admin/member/*`
- `apps/backend/src/module/admin/monitor/*`
- `apps/backend/src/module/admin/resource/sse.controller.ts`
- `apps/backend/src/module/admin/upgrade/admin-upgrade.controller.ts`
- `apps/backend/src/module/admin/upload/upload.controller.ts`
- `apps/backend/src/module/client/auth/worker-auth.controller.ts`
- `apps/backend/src/module/client/location/location.controller.ts`
- `apps/backend/src/module/client/marketing/*`
- `apps/backend/src/module/client/service/service-slot.controller.ts`
- `apps/backend/src/module/client/upgrade/upgrade.controller.ts`
- `apps/backend/src/module/lbs/*`
- `apps/backend/src/module/main/main.controller.ts`
- `apps/backend/src/module/marketing/*`
- `apps/backend/src/module/notification/notification.controller.ts`
- `apps/backend/src/module/store/distribution/distribution.controller.ts`
- `apps/backend/src/module/store/stock/stock.controller.ts`

## 3. 补充统计

- 第一批：73 处
- 第二批：44 处
- 第三批：152 处
- 第四批：193 处
- 累计：
- `@sloCategory`：462 处
- `@sloLatency`：462 处
- `@sloAvailability`：462 处

## 4. 质量约束说明

- 本次变更仅涉及 Controller 注释，不改业务逻辑。
- 本次改动文件中未新增 `any`，也未通过 `unknown` 规避类型约束。

## 5. 下一步建议

- 按同样标准覆盖剩余核心入口（如 `admin/monitor/*`、`marketing/*`、`store/*` 其余控制器）。
- 将 SLO 注释扫描加入 CI（例如：校验核心 Controller 是否包含 SLO 三元组）。
