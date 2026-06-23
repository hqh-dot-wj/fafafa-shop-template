---
title: 后端领域治理需求对齐与分批落地清单
status: draft
doc_type: architecture
last_verified: 2026-05-06
---

# 后端领域治理需求对齐与分批落地清单

## 1. 文档范围

本文用于对齐本轮“整体模块划分治理”的需求边界、事实源、接口归属、状态写入方、菜单路由映射和分批落地状态。

本文不是新的全局规范，不替代 `docs/domain/`、`docs/adr/` 或各模块设计文档。后续若某个决策变成长期约束，应迁移到对应 ADR、领域文档或模块运行规格。

## 2. 防漂移规则

后续治理必须遵守以下口径：

| 规则                       | 说明                                                                  |
| -------------------------- | --------------------------------------------------------------------- |
| 不把入口当领域             | `admin`、`client`、`worker` 是入口层，不是业务事实源。                |
| 不把菜单当领域             | 后台菜单按运营场景组织，可以跨域聚合，但不能决定后端写入权。          |
| 一个状态只有一个目标写入方 | 其他域只能通过端口或事件请求变更，不能直接写别人的状态。              |
| 旧入口兼容迁移             | 旧 API、旧路由、旧权限码先兼容，不在同批次硬删。                      |
| 已完成必须有证据           | 状态只能根据代码路径、提交、测试或命令结果更新，不能按意图标完成。    |
| 跨域优先端口和事件         | 能用 Port 或 Domain Event 表达的跨域动作，不继续扩大 Service 互注入。 |

## 3. 当前提交证据

| 提交       | 主题                                   | 作用                                                                                                                                                        |
| ---------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `77a6e972` | 完成营销治理与多端适配                 | 提交用户选择前已有工作区，作为本轮基线之一。                                                                                                                |
| `abf2c838` | 收口服务履约派单入口                   | 新增履约派单 API、后台履约菜单、旧订单派单兼容转调。                                                                                                        |
| `9cf7ff5d` | 拆分订单创建应用编排                   | `OrderService.createOrder` 降级为委托，新增订单创建应用服务与端口。                                                                                         |
| `3fe92e36` | 收口财务查询端口                       | 外部查询佣金/提现改走 `CommissionQueryPort`、`WithdrawalQueryPort`。                                                                                        |
| `56db0d95` | 事件化订单支付营销处理                 | 支付成功发布 `order.paid`，营销监听处理券、积分、玩法。                                                                                                     |
| `4046ddfc` | 事件化订单退款营销回滚                 | 后台退款发布 `order.refunded`，营销监听回滚券和积分。                                                                                                       |
| `6786340d` | 清理重复入口模块注册                   | `AppModule` 不再重复注册 `StoreOrderModule`、`StoreFinanceModule`、`ClientFinanceModule`。                                                                  |
| `e59e19e4` | 事件化订单创建取消营销处理             | 下单发布 `order.created`，取消发布 `order.cancelled`，营销监听处理券和积分冻结/释放。                                                                       |
| `6fa5a30e` | 端口化订单优惠预览入口                 | `/client/order/calculate-discount` 改为调用订单侧 `OrderMarketingPort`。                                                                                    |
| `b8a464aa` | 收口库存名额资源边界                   | 订单 SKU 库存改走库存服务，营销库存语义改为名额，服务时间段补资源锁检查。                                                                                   |
| `274199c2` | 收口财务写入端口边界                   | 新增 `FinanceCommandPort`、`WalletQueryPort`；支付成功财务处理监听 `order.paid`；外部退款、提现、履约结算时间、营销入账改走财务端口。                       |
| `b191b45c` | 调整门店运营菜单路由                   | admin-web 静态/动态路由统一门店运营菜单归类；商品菜单聚合门店选品、门店商品、库存；旧商品、订单派单、财务分销配置路径兼容跳转。                             |
| `a370cec8` | 新增服务人员管理规划占位入口           | admin-web 增加 `/worker` 规划占位页和静态/动态路由，明确 Worker 事实源与状态边界，暂不接入未规划的后端写接口。                                              |
| `0972f043` | 调整已有能力治理顺序                   | 暂停 Worker 真实能力，后续优先修已有订单、营销、库存、履约、财务、租户、权限、契约和审计闭环。                                                              |
| `9b9d62ea` | 记录后端运行时验证结果                 | B14 明确完成 backend 类型检查、构建、短时启动和 `/api/health` 运行态验证。                                                                                  |
| `d0fa9961` | 记录租户权限盘点结果                   | B15 初扫确认订单活动审计、履约内部读取、财务关联读回和权限 seed 缺口为需修复点。                                                                            |
| 本批待提交 | 修复订单补偿、退款幂等、契约残留和审计 | B16-B19 已落代码：下单先库存/购物车后营销冻结；退款使用稳定退款单号并阻止无退款台账下的重复部分退款；履约前端 API 标记兼容；履约写接口补系统/业务操作日志。 |

## 4. 四轮目标状态

| 原计划轮次                 | 目标                                                                                            | 当前状态                       | 证据                                                                                                                                                                                                                                          | 下一步                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 第一轮：盘点，不改业务     | 产出事实源表、接口归属表、状态事实源表、菜单路由映射表                                          | 部分完成，本文件提供 V0 对齐表 | 本文第 5-8 节                                                                                                                                                                                                                                 | 按代码继续补齐未覆盖接口和状态字段。                                             |
| 第二轮：后端止血           | 订单编排拆分、派单/核销收口、营销订单依赖收口、库存端口、财务 Repository 外部禁用、模块注册清理 | 已完成本轮目标                 | `abf2c838`、`9cf7ff5d`、`3fe92e36`、`56db0d95`、`4046ddfc`、`6786340d`、`e59e19e4`、`6fa5a30e`、`b8a464aa`、`274199c2`；B16/B17 定向测试通过。                                                                                                | 后续只继续收玩法实例等未闭合细项，不再阻塞本轮既有能力修复。                     |
| 第三轮：后台菜单和路由调整 | 新增履约管理，移动派单/核销，订单保留交易视角，商品/财务/Worker 菜单再调整                      | 已完成本轮目标                 | `b191b45c`、`a370cec8`、`apps/admin-web/src/router/routes/store-ops.ts`、`apps/admin-web/src/router/legacy-store-routes.ts`、`apps/admin-web/src/views/store/fulfillment/**`、`apps/admin-web/src/views/worker/index.vue`；B18 路由测试通过。 | Worker 已有规划占位入口；真实后台 API 和 worker 端动作待规划确认后进入后续批次。 |
| 第四轮：事件化和端口化     | 跨域调用改为事件和端口，形成订单、营销、库存、财务、履约等 Port/Event                           | 部分完成                       | `OrderDomainEventPublisher`、营销订单事件监听器、财务 `order.paid` 监听器、财务 Query/Command Port、订单创建 Port、`OrderMarketingPort`、`OrderInventoryPort`；退款事件与审计链路已补。                                                       | 补履约事件，继续细化玩法实例。                                                   |

## 5. 业务域事实源表 V0

| 业务事实                      | 目标唯一事实源                 | 当前代码依据                                                                                                       | 当前状态 | 后续收口要求                                                                                                                                                                                              |
| ----------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 平台商品基础信息              | PMS / Catalog                  | `apps/backend/src/module/pms/**`                                                                                   | 待盘点   | 门店商品只能引用或覆盖门店级经营字段。                                                                                                                                                                    |
| 门店商品与门店价格            | Store Product / Store Pricing  | `apps/backend/src/module/store/product/**`                                                                         | 待盘点   | 订单保存下单快照，不回读历史价格。                                                                                                                                                                        |
| SKU 商品库存                  | Inventory / Stock              | `apps/backend/src/module/store/stock/**`、`OrderInventoryPort`                                                     | 部分完成 | 订单扣减/释放已由 `OrderInventoryPort -> StockService` 承接并写库存流水；独立 inventory 目录暂不强迁。                                                                                                    |
| 营销活动、券、积分、玩法实例  | Marketing                      | `apps/backend/src/module/marketing/**`                                                                             | 部分完成 | 创建、支付、取消、退款营销处理已走订单事件；活动名额已用 quota 方法表达，玩法实例仍需继续细化。                                                                                                           |
| 服务预约时间资源              | Service Resource / Fulfillment | `apps/backend/src/module/client/service/**`                                                                        | 部分完成 | C 端时间段已补资源锁检查和释放方法；后续 worker 排班、履约审计仍需接入资源事实源。                                                                                                                        |
| 订单交易事实                  | Order                          | `apps/backend/src/module/client/order/**`、`apps/backend/src/module/store/order/**`                                | 部分完成 | 订单域只负责交易状态、金额和订单项快照；下单失败顺序已调整为库存/购物车成功后再产生营销冻结副作用。                                                                                                       |
| 履约事实                      | Fulfillment                    | `apps/backend/src/module/fulfillment/**`                                                                           | 部分完成 | 派单、核销、服务进度、履约时间线归履约域。                                                                                                                                                                |
| 支付事实                      | Payment                        | `apps/backend/src/module/payment/**`、`apps/backend/src/module/client/payment/**`                                  | 部分完成 | 支付确认后发布订单领域事件，避免直接写营销和财务内部状态。                                                                                                                                                |
| 钱包、佣金、提现、结算        | Finance                        | `apps/backend/src/module/finance/**`                                                                               | 部分完成 | 外部写入已收口到 `FinanceCommandPort` 或 `order.paid` 事件监听；退款佣金处理继续通过 `FinanceCommandPort`，订单域不直接写财务表。后台财务入口仍作为 Finance 管理面调用 Finance Admin/Settlement Service。 |
| 分销配置与资格                | Distribution                   | `apps/backend/src/module/store/distribution/**`                                                                    | 待盘点   | 财务/订单读取规则或快照，避免跨域写分销事实。                                                                                                                                                             |
| 会员事实                      | Member                         | `apps/backend/src/module/admin/member/**`、`apps/backend/src/module/client/user/**`                                | 待盘点   | 营销积分、分销关系、订单归因只能引用会员身份事实。                                                                                                                                                        |
| Worker 人员、资质、技能、排班 | Worker / Service Resource      | `apps/backend/prisma/models/20-member-worker.prisma`、`apps/backend/src/module/fulfillment/fulfillment.service.ts` | 规划占位 | 当前只有 `SrvWorker*` schema 和履约候选技师读取；后台 `/worker` 只展示规划边界，不新增写接口。后续须先确认 Worker、履约、订单、财务的状态写入权再落真实接口。                                             |
| 租户事实                      | Tenant                         | `apps/backend/src/common/tenant/**`、`apps/backend/src/module/admin/system/tenant/**`                              | 待盘点   | 任何跨租户查询或租户豁免必须单独审查。                                                                                                                                                                    |
| LBS 与服务范围                | LBS                            | `apps/backend/src/module/lbs/**`                                                                                   | 待盘点   | 下单只调用准入判断，不把 LBS 规则写入订单入口层。                                                                                                                                                         |
| 风控裁决                      | Risk                           | `apps/backend/src/module/risk/**`、`OrderRiskPort`                                                                 | 部分完成 | 风控只返回裁决，不拥有订单交易状态。                                                                                                                                                                      |

## 6. 接口归属表 V0

| 接口                                               | 当前入口     | 目标业务域                            | 写状态 | 当前状态                                                                                                                                 |
| -------------------------------------------------- | ------------ | ------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /client/order/create`                        | C 端订单     | OrderCreationApplication / Order      | 是     | 已拆出 `OrderCreationApplicationService`；库存扣减、购物车消费成功后才发布 `order.created` 触发券/积分冻结，避免后置失败产生营销副作用。 |
| `POST /client/order/cancel`                        | C 端订单     | Order                                 | 是     | 已通过 `order.cancelled` 事件触发营销释放，取消流程保留失败不阻断语义。                                                                  |
| `POST /client/payment/notify`                      | C 端支付     | Payment                               | 是     | 支付成功后已改为发布 `order.paid`。                                                                                                      |
| `POST /client/payment/mock-success`                | C 端支付     | Payment                               | 是     | 与真实支付成功共用事件化链路。                                                                                                           |
| `POST /client/order/calculate-discount`            | C 端订单入口 | Marketing / Checkout                  | 否     | 已由 Controller 直接注入营销 Service 改为调用 `OrderMarketingPort`，URL 和 DTO/VO 不变。                                                 |
| `GET /client/service/time-slots`                   | C 端服务预约 | Service Resource                      | 否     | 已读取服务时间段 Redis 资源锁，锁定时间段返回不可用。                                                                                    |
| `POST /client/service/lock-slot`                   | C 端服务预约 | Service Resource                      | 是     | 已由 `ServiceSlotService` 统一锁定服务资源，锁失败返回业务异常。                                                                         |
| `GET /store/order/dispatch/list`                   | 旧订单后台   | Fulfillment                           | 否     | 旧接口保留，内部转调履约服务。                                                                                                           |
| `GET /store/order/dispatch/worker-candidates`      | 旧订单后台   | Fulfillment / Worker                  | 否     | 旧接口保留，内部转调履约服务。                                                                                                           |
| `POST /store/order/reassign`                       | 旧订单后台   | Fulfillment                           | 是     | 旧接口保留，内部转调履约服务。                                                                                                           |
| `POST /store/order/verify`                         | 旧订单后台   | Fulfillment                           | 是     | 旧接口保留，内部转调履约服务，并补系统操作日志。                                                                                         |
| `GET /store/fulfillment/service/dispatch/list`     | 履约后台     | Fulfillment                           | 否     | 已新增。                                                                                                                                 |
| `GET /store/fulfillment/service/worker-candidates` | 履约后台     | Fulfillment / Worker                  | 否     | 已新增。                                                                                                                                 |
| `POST /store/fulfillment/service/assign`           | 履约后台     | Fulfillment                           | 是     | 已存在并补系统操作日志 + 业务操作日志，权限码迁移期继续复用 `store:order:dispatch`。                                                     |
| `POST /store/fulfillment/service/verify`           | 履约后台     | Fulfillment                           | 是     | 已存在并补系统操作日志 + 业务操作日志，权限码迁移期继续复用 `store:order:verify`。                                                       |
| `POST /store/fulfillment/product/ship`             | 履约后台     | Fulfillment                           | 是     | 已补系统操作日志 + 业务操作日志，商品发货归履约状态机。                                                                                  |
| `POST /store/fulfillment/product/receive`          | 履约后台     | Fulfillment                           | 是     | 已补系统操作日志 + 业务操作日志，确认收货归履约状态机并同步订单聚合状态。                                                                |
| `POST /store/order/refund`                         | 门店订单后台 | Order / Payment / Finance / Marketing | 是     | 退款后营销回滚已改为 `order.refunded` 事件；退款单号稳定为整单维度，存在部分退款标记时禁止直接整单退款。                                 |
| `POST /store/order/refund/partial`                 | 门店订单后台 | Order / Payment / Finance / Marketing | 是     | 部分退款营销回滚已改为 `order.refunded` 事件；退款单号按订单号、订单项、金额稳定生成，重复同一部分退款直接幂等返回。                     |
| `GET /store/finance/commission/list`               | 门店财务后台 | Finance                               | 否     | 已改为 `CommissionQueryPort`。                                                                                                           |
| `GET /store/finance/dashboard`                     | 门店财务后台 | Finance 聚合查询                      | 否     | 佣金/提现读取已改为 Finance Query Port。                                                                                                 |
| `POST /client/finance/withdrawal/apply`            | C 端财务入口 | Finance                               | 是     | 提现申请已改为 `ClientFinanceService -> FinanceCommandPort.requestWithdrawal`。                                                          |
| `GET /client/finance/wallet`                       | C 端财务入口 | Finance                               | 是     | 保留首次查看懒建钱包兼容行为，写入由 `FinanceCommandPort.ensureWallet` 承接。                                                            |
| `GET /client/finance/withdrawal/list`              | C 端财务入口 | Finance                               | 否     | 已改为 `WithdrawalQueryPort.findPage`。                                                                                                  |
| `GET /client/finance/commission/list`              | C 端财务入口 | Finance                               | 否     | 已改为 `CommissionQueryPort.findPage`。                                                                                                  |
| `GET /client/finance/transaction/list`             | C 端财务入口 | Finance                               | 否     | 已改为 `WalletQueryPort.findTransactionsPage`。                                                                                          |

## 7. 状态写入方表 V0

| 状态或字段                                          | 目标写入方                | 当前状态 | 后续要求                                                                                                                                   |
| --------------------------------------------------- | ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `order.status`                                      | Order                     | 部分完成 | 履约完成、退款、取消对订单状态的影响需走订单域方法或事件聚合，避免其他域直接散写；退款入口已增加无退款台账条件下的重复退款保护。           |
| `order.payStatus`、`order.payTime`、`transactionId` | Payment / Order 事务边界  | 部分完成 | 支付确认仍在支付服务内推进订单支付字段，后续可收为 Order Payment Port。                                                                    |
| `fulfillment.status`                                | Fulfillment               | 部分完成 | 派单、核销、商品发货/收货继续归履约状态机。                                                                                                |
| `commission.status`                                 | Finance                   | 部分完成 | 全额退款、部分退款和履约结算时间已走 `FinanceCommandPort`；退款单号作为部分退款财务关联 ID，佣金 Processor / Admin 仍在 Finance 内部写入。 |
| `withdrawal.status`                                 | Finance                   | 部分完成 | C 端申请和门店审核已走 `FinanceCommandPort`；审核、打款、对账仍只归 Finance 内部服务。                                                     |
| `coupon.status`                                     | Marketing                 | 部分完成 | 创建、支付、取消、退款已通过订单事件触发营销处理；结算前裁决仍走营销端口。                                                                 |
| `points.status` / 积分流水                          | Marketing                 | 部分完成 | 积分冻结、结算、取消释放、退款回退由 Marketing 统一处理，订单只发布事件。                                                                  |
| `playInstance.status`                               | Marketing                 | 部分完成 | 订单项创建玩法实例仍在订单营销端口内，后续需要进一步事件化或端口细化。                                                                     |
| `stock.lockedQty` / 库存数量                        | Inventory / Stock         | 部分完成 | 订单不再直接写 `pmsTenantSku`，库存变更通过库存服务和流水记录承接。                                                                        |
| `service:lock:*` / 服务时间资源锁                   | Service Resource          | 部分完成 | C 端时间段锁由 `ServiceSlotService` 管理；后续接入 worker 排班与履约资源审计。                                                             |
| `worker.auditStatus` / 资质审核状态                 | Worker                    | 规划占位 | 后台只先展示规划占位；真实审核接口须由 Worker 域拥有，履约、订单、财务不能直接写。                                                         |
| `worker.status` / 工作状态                          | Worker                    | 规划占位 | 冻结、休息、离职等人员状态归 Worker 域；履约只读取可派候选或通过端口请求变更。                                                             |
| `worker.isOnline` / 接单开关                        | Worker / worker 端入口    | 规划占位 | 后台可作为运营管理入口，未来 worker 端可作为个人接单开关入口；二者都不能改履约状态或订单状态。                                             |
| `worker.schedule` / 排班与服务资源                  | Worker / Service Resource | 规划占位 | 排班不等于商品库存；后续要与服务时间资源锁对齐，避免和履约派单状态混写。                                                                   |

## 8. 菜单路由映射表 V0

| 菜单或路由            | 当前前端路径                                   | 当前 API                                       | 目标业务域                            | 当前状态                                                                              |
| --------------------- | ---------------------------------------------- | ---------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| 待派单旧入口          | `/store/order/dispatch`                        | 旧 `GET /store/order/dispatch/list`            | Fulfillment                           | 已保留兼容，前端跳转新履约派单页。                                                    |
| 履约管理 / 服务派单   | `/store/fulfillment/service-dispatch`          | `GET /store/fulfillment/service/dispatch/list` | Fulfillment                           | 已新增；路由测试锁定新履约入口及旧派单入口跳转。                                      |
| 订单详情派单按钮      | `/store/order/detail/:id`                      | 新履约候选技师 API + 新履约指派 API            | Fulfillment                           | 已改为履约 API，订单详情只作为聚合入口；旧订单派单 API 在前端标记为兼容保留。         |
| 订单列表/订单详情退款 | `/store/order/list`、`/store/order/detail/:id` | `/store/order/refund*`                         | Order / Payment / Finance / Marketing | 部分完成，营销回滚已事件化。                                                          |
| 平台商品库            | `/pms/**`                                      | `/pms/**`                                      | PMS / Catalog                         | 已按平台商品事实源命名，仍保留原路由。                                                |
| 商品管理              | `/store/product/**`、`/store/stock`            | `/store/product/**`、`/store/stock/**`         | Store Product / Inventory             | 已按门店运营场景聚合；库存在菜单中归入商品管理，URL 保持兼容。                        |
| 门店选品旧入口        | `/store/product-market`                        | 无直接 API                                     | Store Product / PMS                   | 已前端兼容跳转到 `/store/product/market`。                                            |
| 门店财务              | `/store/finance/**`                            | `/store/finance/**`                            | Finance                               | 已按财务管理命名；佣金审计隐藏为佣金记录钻取页。                                      |
| 财务分销配置旧入口    | `/store/finance/distribution-config`           | `/store/distribution/config`                   | Distribution                          | 已前端兼容跳转到 `/store/distribution/distribution`，避免分销配置继续挂在财务菜单下。 |
| Worker 管理           | `/worker`                                      | 无真实数据接口                                 | Worker / Service Resource             | 已新增规划占位页；只展示事实源、状态写入方和跨域边界，不提供未确认的数据写入入口。    |

## 9. 逻辑矫正记录

| 发现                                                                                                                                         | 矫正结果                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 原计划把 Worker 管理与技师/老师列表、资质、技能、排班一起落地，但仓库只有 `SrvWorker*` schema 和履约候选技师读取，没有完整 Worker 业务规划。 | B13 不做真实 CRUD，不新增后端写接口；先加 `/worker` 规划占位页和文档边界，避免提前固化审核、排班、结算、worker 端动作。                        |
| 派单、接单、服务中、完成、核销容易被误放进 Worker 管理。                                                                                     | 仍归 Fulfillment；Worker 只拥有人员、资质、技能、工作状态、在线状态、服务范围、排班等人员/资源事实。                                           |
| 工资、佣金、提现、结算容易被 Worker 页面直接写入。                                                                                           | 资金事实仍归 Finance；Worker 后续只能展示或通过财务端口/事件请求。                                                                             |
| 用户确认当前不推进 Worker 真实能力。                                                                                                         | Worker 真实后台 API、真实页面、权限种子和 worker 端动作暂停；后续先修已有订单、营销、履约、财务、库存、租户、权限闭环。                        |
| 无独立退款台账时继续开放多次部分退款会造成支付、财务、营销重复或漏处理。                                                                     | B17 先做可证据闭环：同一部分退款按稳定退款单号幂等；若订单备注已有其他退款单标记，则禁止发起新的部分退款或直接整单退款，避免超出当前模型能力。 |
| 履约动作迁移后只补业务操作日志不够。                                                                                                         | B19 对履约写接口同时补 `@Operlog` 和 `@LogOperation`；系统操作日志用于后台审计，业务操作日志用于订单/会员详情时间线。                          |

## 10. 后续分批落地清单

| 批次                      | 目标                                                               | 进入条件 | 验收证据                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B7 运行时验证             | 验证 Nest DI、事件监听器、队列和模块初始化                         | 历史批次 | 已由后续批次分段验证覆盖；当前新增 B14 做一次明确运行时验证。                                                                                                 |
| B8 订单创建/取消事件化    | 补 `order.created`、`order.cancelled`，减少订单与营销 `forwardRef` | 已完成   | `e59e19e4`；订单创建、取消单测通过；backend typecheck、lint、build 通过。                                                                                     |
| B9 结算预览与营销裁决端口 | `calculate-discount` 不再由订单 Controller 直接注入营销 Service    | 已完成   | `6fa5a30e`；OpenAPI 不变，Controller 只调用订单侧 `OrderMarketingPort`。                                                                                      |
| B10 库存域收口            | 区分商品库存、营销名额、服务资源锁                                 | 已完成   | `b8a464aa`；订单不直接扣库存表，营销名额不叫商品库存，服务时间段检查资源锁。                                                                                  |
| B11 财务写入边界          | 查并收口外部佣金、钱包、提现写入点                                 | 已完成   | `274199c2`；外部写入走 `FinanceCommandPort` 或 `order.paid` 财务监听器，后台财务管理入口除外。                                                                |
| B12 菜单第二轮            | 商品、财务、既有履约入口按运营场景整理，旧路径兼容跳转             | 已完成   | `b191b45c`；静态/动态路由共用 `normalizeStoreOperationsRoutes`，旧路径由 `resolveLegacyStoreRouteLocation` 兼容。                                             |
| B13 Worker 管理规划占位   | 先补 Worker 事实源、状态边界和后台占位入口，不落未规划写接口       | 已完成   | `a370cec8`；`/worker` 规划占位页；静态/动态路由均可注册；无新增后端 API、无 Prisma/seed 改动。                                                                |
| B14 后端运行时验证        | 验证 Nest DI、事件监听器、队列和模块初始化                         | 已完成   | `pnpm typecheck:backend`、`pnpm build:backend`、短时启动 `start:prod`、`GET /api/health` 200。                                                                |
| B15 租户隔离与权限码盘点  | 盘点订单、财务、营销、商品、库存的租户过滤和菜单/API 权限码        | 已完成   | 订单活动审计、履约内部读取、财务结算关联读回已加租户边界；Controller 与平台 seed 权限差异复扫 `missing=0`；相关单测、backend typecheck、backend lint 已执行。 |
| B16 订单/营销/库存补偿    | 查订单创建、营销冻结、库存扣减、购物车消费的失败顺序和补偿链路     | 已完成   | `OrderCreationApplicationService` 调整顺序；新增库存/购物车失败时不发布营销创建事件的单测。                                                                   |
| B17 退款/财务一致性       | 查全额退款、部分退款、佣金冲正、钱包流水、提现审核一致性           | 已完成   | 稳定退款单号、部分退款幂等标记、无退款台账下重复部分/整单退款拦截；`store-order.service.spec.ts` 覆盖。                                                       |
| B18 契约与菜单残留收口    | 查后端 DTO/VO、生成类型、admin-web 手写类型和旧菜单/路由残留       | 已完成   | 旧订单派单 API 标记兼容；旧路由跳转与菜单规整测试通过；前端 API 不新增仅断言 request 配置的低价值测试。                                                       |
| B19 审计日志补齐          | 补派单、核销、退款、提现审核、商品审核等已有关键操作审计           | 已完成   | 履约发货/收货/派单/核销补 `@Operlog` + `@LogOperation`；旧订单核销补 `@Operlog`；Controller 元数据单测通过。                                                  |
| 暂停项：Worker 真实能力   | 后台 Worker API、真实页面、权限 seed、worker 端动作                | 暂停     | 等 Worker 业务规划确认后另起批次，不混入已有能力修复。                                                                                                        |

## 11. B14 验证记录

| 验证项           | 结果 | 证据                                                                                         |
| ---------------- | ---- | -------------------------------------------------------------------------------------------- |
| backend 类型检查 | 通过 | `pnpm typecheck:backend`，3 个任务成功。                                                     |
| backend 构建     | 通过 | `pnpm build:backend`，TSC 0 issues，SWC 编译 1447 个文件。                                   |
| backend 短时启动 | 通过 | `pnpm --filter @apps/backend start:prod`，日志出现 `Nest application successfully started`。 |
| 健康检查         | 通过 | `GET http://127.0.0.1:8080/api/health` 返回 200，database 与 redis 均为 up。                 |
| 进程清理         | 通过 | 启动探测产生的 backend `node dist/main.js` 相关进程已停止，8080 端口无残留监听。             |
| 非阻断警告       | 记录 | 启动日志提示微信支付配置未完整提供，属于当前环境配置缺省，SDK 初始化被跳过。                 |

## 12. B15 租户隔离与权限码盘点记录

### 12.1 扫描命令与范围

| 项目              | 结果                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Prisma 租户读扫描 | `pnpm --filter @apps/backend scan:tenant-prisma-reads`，生成本地忽略文件 `apps/backend/reports/tenant-prisma-read-scan.json`。 |
| 命中数量          | 172 条启发式命中，涉及 `findMany` 62、`findFirst` 60、`findUnique` 28、`count` 17、`aggregate` 4、`groupBy` 1。                |
| 权限码差异扫描    | 初扫：Controller 297 个、seed 268 个、缺 29 个；修复后复扫：Controller 297 个、seed 297 个、`missing=0`。                      |
| 前端权限差异扫描  | admin-web `hasAuth` 共 76 个去重权限码，其中 12 个未在 seed 和后端 Controller 中找到。                                         |

扫描脚本是启发式：只检查 Prisma 读调用附近是否出现 `readWhereForDelegate`、`scopeReadWhere`、`applyTenantFilter`、`scopedWhere` 等关键字。它会命中“远处 helper 已经注入租户”的代码，因此 B15 不能按命中数直接改代码，必须按真实调用链分类。

### 12.2 证实需要修复的现有能力点

| 范围             | 代码位置                                                                                                        | 发现                                                                                                                                                                                                                                                                                                                           | 修复结果                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 订单活动审计     | `apps/backend/src/module/store/order/store-order.service.ts`                                                    | `/store/order/:id/activity-audit` 先用 `omsOrder.findUnique({ id })` 取订单，再用订单租户查营销审计。后台门店入口未先套租户条件，订单 ID 被猜到时存在跨租户读取订单项活动快照的风险。                                                                                                                                          | 已改为 `findFirst` + `TenantHelper.readWhereForDelegate('omsOrder', { id })`，先按后台租户边界读取订单。                           |
| 履约内部订单读取 | `apps/backend/src/module/fulfillment/fulfillment.service.ts`                                                    | `ensureForPaidOrder`、履约项加载、主订单状态同步存在按 `orderId` / `id` 直接读取或更新的内部路径。部分入口已先 `scopedStoreWhere`，但内部 helper 本身不表达租户边界，后续复用容易绕过门店隔离。                                                                                                                                | `ensureForPaidOrder`、`getOrderFulfillment`、`findFulfillments`、`syncMainOrderStatus` 均可承接订单租户；履约/订单更新带租户条件。 |
| 财务结算关联读回 | `apps/backend/src/module/finance/settlement-core/settlement-core.service.ts`                                    | 对账异常列表/详情、结算单生成和执行单处理先对主对象做租户过滤，但后续按关联 ID 回读 bill、execution、order、payRecord 时未显式带租户。部分字段有全局唯一约束，仍缺少“读取结果必须属于同一租户”的代码表达。                                                                                                                     | 列表、详情、结算单同步、渠道回查和异常同步的关联读回/更新已补同租户约束，并补财务单测。                                            |
| 权限码 seed 缺口 | `apps/backend/src/module/**.controller.ts` 与 `apps/backend/prisma/seeds/00-platform/sys-menu-and-role-menu.ts` | 后端 Controller 有 29 个权限码没有平台 seed。直接影响权限菜单分配后的可见/可操作能力，特别是 `finance:settlement:trigger`、`finance:settlement:reconciliation:list`、`finance:withdrawal:export`、`finance:withdrawal:notify`、`store:distribution:commission:query`、分销分享策略/口令、营销导航/权益/玩法、LBS、租户审计等。 | 已按“补 seed 权限”处理，新增 29 个平台权限 seed，复扫 Controller vs seed 权限码 `missing=0`。                                      |

### 12.3 已核对为兼容保留或扫描误报的点

| 范围             | 代码位置                                                                                                                           | 结论                                                                                                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 分销资格仓储     | `apps/backend/src/module/store/distribution/qualification/qualification.repository.ts`                                             | 扫描命中 29 条，但该仓储通过 `scopedOrderWhere`、`scopedServicePolicyWhere`、`scopedEvidenceWhere`、`scopedRuleWhere`、`scopedApplicationWhere`、`scopedProfileWhere`、`scopedRelationWhere`、`scopedPendingRewardWhere` 统一调用 `TenantHelper.readWhereForDelegate`。 |
| 门店商品幂等     | `apps/backend/src/module/store/product/product.service.ts`                                                                         | 幂等记录使用 `tenantId ?? TenantContext.getTenantId() ?? '000000'` 解析租户，并按 `tenantId + operationId + action` 查询，符合 `biz_idempotency_record` 的唯一约束语义。                                                                                                |
| 履约候选技师列表 | `apps/backend/src/module/fulfillment/fulfillment.service.ts`                                                                       | 候选技师查询构造 `baseWhere` 时已写入 `tenantId`，分页 `count` 命中是启发式误报。                                                                                                                                                                                       |
| 分销分享口令     | `apps/backend/src/module/store/distribution/services/share-token.service.ts`                                                       | `sid` 是全局唯一公开分享口令，C 端解析不能简单按当前租户过滤；但成员绑定、跨租户绑定策略、循环关系检查仍应在后续分销安全复核中明确注释，防止被误改成门店后台普通读模型。                                                                                                |
| 履约新菜单权限码 | `apps/backend/src/module/fulfillment/fulfillment.controller.ts`、`apps/backend/prisma/seeds/00-platform/sys-menu-and-role-menu.ts` | 新履约派单入口继续使用旧 `store:order:dispatch` / `store:order:verify`，这是旧路由兼容策略。是否新增 `store:fulfillment:*` 需要权限迁移方案，不能在 B15 无迁移计划时直接替换。                                                                                          |

### 12.4 逻辑矫正

| 发现                                         | 矫正结果                                                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 租户读扫描不能直接等同于 172 个缺陷。        | B15 只修复代码证据可闭合的订单、履约、财务关联读回；分销资格和商品幂等标记为误报或已显式带租户。                                    |
| 权限码不能只看前端菜单。                     | 以后以 Controller `@RequirePermission`、平台 seed、admin-web `hasAuth` 三方一致作为验收标准；菜单路由只是运营入口，不是权限事实源。 |
| 新履约菜单是否要新权限码不能靠命名偏好决定。 | 旧权限码先兼容；只有在 seed、角色授权、旧路由、前端按钮、后端 Controller 一起迁移时，才新增 `store:fulfillment:*`。                 |

### 12.5 注释审查与注释方案

| 范围            | 注释处理                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| 租户过滤 helper | 已在订单活动审计和履约订单读取 helper 补短注释，说明后台审计/履约内部补建不能使用裸 ID 读取。                |
| 分销分享口令    | 保留 `sid` 全局解析时，应补注释说明它是公开分享口令，不按当前租户头过滤；绑定动作再按 token 租户和策略校验。 |
| 履约旧权限码    | 继续复用 `store:order:dispatch` 时，应在 Controller 或文档中注明这是迁移兼容，不代表派单仍归订单域。         |

### 12.6 B15 验证记录

| 验证项           | 结果 | 证据                                                                                                                                        |
| ---------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 权限码复扫       | 通过 | Controller 297 个去重权限码，平台 seed 297 个去重权限码，`missing=0`。                                                                      |
| 菜单孤儿校验     | 通过 | `pnpm --filter @apps/backend check:menu-orphans`，共 459 条有效菜单，孤儿校验通过。                                                         |
| 相关单测         | 通过 | `pnpm --filter @apps/backend test -- --runInBand store-order.service.spec.ts fulfillment.service.spec.ts settlement-core.service.spec.ts`。 |
| backend 类型检查 | 通过 | `pnpm typecheck:backend`，3 个任务成功。                                                                                                    |
| backend lint     | 通过 | `pnpm --filter @apps/backend lint`，0 errors，447 warnings；warnings 为仓库既有 unused/any/duplicate-import 类警告。                        |

## 13. B16-B19 验证记录

| 验证项              | 结果 | 证据                                                                                                                                                                                          |
| ------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 订单创建补偿单测    | 通过 | `pnpm --filter @apps/backend test -- --runInBand order.service.spec.ts store-order.service.spec.ts fulfillment.controller.spec.ts fulfillment.service.spec.ts`，4 个 suite 通过。             |
| 退款一致性单测      | 通过 | 同上；覆盖库存失败不冻结营销、购物车失败不冻结营销、稳定退款单号、部分退款幂等和重复退款拦截。                                                                                                |
| 履约审计元数据单测  | 通过 | 同上；`fulfillment.controller.spec.ts` 验证履约发货/收货/派单/核销和旧订单核销的操作日志元数据。                                                                                              |
| admin-web 契约/路由 | 通过 | `pnpm --filter @apps/admin-web test -- src/router/routes/store-ops.spec.ts src/router/legacy-store-routes.spec.ts --run` 通过；`pnpm verify` 中 admin-web 全量 73 个测试文件 474 个测试通过。 |

## 14. 本轮未完成项

以下事项不能标为已完成：

- 未完成全量事实源表和全量接口归属表，只完成 V0。
- 未完全消除订单与营销之间的 `forwardRef`。
- `OrderCreated`、`OrderCancelled` 已完成券/积分营销处理事件化；订单项玩法实例仍在订单营销端口内。
- 未正式重命名为独立 `inventory/` 目录；本轮先完成库存事实写入收口。
- 后台财务管理入口仍直接注入 Finance Admin/Settlement Service，当前按“Finance 管理面入口”保留，不视为跨域写入。
- 未完成 Worker 真实后台管理 API、权限种子、真实列表/详情/操作页和未来 worker 端边界；B13 只完成规划占位入口。
- Worker 真实能力已暂停；后续优先修已有订单、营销、库存、履约、财务、租户、权限、契约和审计闭环。
- 未形成 ADR；当前文档仍是设计对齐草案。

## 15. 更新规则

后续每一批代码提交后，必须同步更新本文：

- 更新第 3 节提交证据。
- 更新第 4 节四轮状态。
- 对第 5-8 节只改有证据的行。
- 新增接口、状态、菜单时，必须补一行归属。
- 如果发现原需求不符合仓库事实，先在本文新增“逻辑矫正”说明，再改代码。
