---
title: 金额精度治理规范
status: active
owner: finance-domain
audience: backend, admin-web, miniapp-client
last_verified: 2026-05-19
scope: 涉及金钱的一切链路（订单实付、优惠抵扣、退款、提现、佣金、积分→金额换算、钱包、结算、对账、看板）
related:
  - docs/governance/AGENT_OUTPUT_PROTOCOL.md
  - docs/governance/ENGINEERING_CONSTITUTION.md
  - docs/governance/TEST_SPEC_PROTOCOL.md
---

# 金额精度治理规范

本文档锁定一次端到端的精度审计结论，并把"治本方案"沉淀为长期规范，防止后续会话与子代理重写时漂移。

任何 PR 调整以下三类内容前必须重读本文档：

1. 微信支付 / 退款 / 商家转账的入参与回执处理；
2. 订单实付、退款、佣金、积分→金额、结算、对账等任意金额计算；
3. 后端 API 出口的金额字段类型，或前端对金额做加减乘除。

## 0. 摘要

### 0.1 核心结论

| 维度          | 状态                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| 数据库        | 所有金额字段统一 `Decimal(10, 2)` 或 `Decimal(12, 2)`；DB round 是"事实上的"兜底，但不应作为正确性的依赖。 |
| 后端内存运算  | Decimal 与 number 混用，跨服务/跨函数边界普遍 `toNumber()` → `Number()`，存在 **15 处** 已确认精度风险。   |
| 后端 API 出口 | `FormatDateFields` 统一 `.toNumber()`，所有 VO 暴露的金额都是 number。前端拿到的就是浮点。                 |
| 前端          | admin-web、miniapp-client **均未引入** decimal.js / big.js / bignumber.js；任何加减乘除立即引入浮点垃圾。  |
| 微信支付层    | `convertToFen` 不取整、不校验整数分；调用方不读 `refundResult.status`，是用户"系统说成功微信没退"的根因。  |
| 账务闭环      | 平台清结算、门店财务、微信退款/手续费缺少同一退款事实源；退款、手续费、结算调整不能继续混在单个 `amount`。 |

### 0.2 用户原始问题对照

用户口述："用户支付 19.9 元，过几天退款，系统显示退款成功但用户没收到钱"。

经过 5 轮代码审计 + 微信官方文档比对，最可能的根因排名：

| 排名 | 根因 ID   | 简述                                                                                                                               |
| ---- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 🥇   | R-1       | 调用方不读 `refundResult.status`，微信返回 `PROCESSING` / `ABNORMAL` / `CLOSED` 都被当作成功，订单直接落 `OrderStatus.REFUNDED`。  |
| 🥈   | P-4       | 部分退款 `refundAmount` 用商品原价累加，`totalAmount` 用实付金额，口径不一致；可能导致 `amount.refund > amount.total` 被微信拒绝。 |
| 🥉   | R-2 + R-3 | 微信退款异步通知端点 + 退款查询补偿 Scheduler 是防止 `PROCESSING` 长期悬挂的必要闭环；P1-A 已在工作区补齐，仍需后续提交与联调。    |
| 4    | P-3       | `convertToFen` 不取整，接受 `number` 入参，可能产生非整数分。                                                                      |
| 5    | P-1       | 优惠计算（券+积分）全链路 number 浮点。                                                                                            |

### 0.3 方案边界

本轮治理目标不是"最小止血"，而是一次性把退款、手续费、平台对账、门店账务、结算调整串成可审计闭环；同时不重建全量复式总账，不改写既有 migration，不在同一 PR 做历史真实回填。

必须进入方案的内容：

1. `FinRefund` 作为退款唯一事实源，承载同步响应、异步回调、查询补偿和人工处理。
2. `FinRefundEvent` 保留退款状态流转历史，避免 `rawPayload` 覆盖审计证据。
3. 平台对账新增 `REFUND` scope，退款本地数据源只能来自 `FinRefund`，不能来自订单状态。
4. 渠道账单金额拆口径，至少区分用户退款、商户结算退款、手续费、净额。
5. 已锁定结算单退款后生成结算调整单，不直接篡改历史结算单。
6. 门店看板和流水展示 `paidGMV / refundAmount / netGMV` 等净经营口径。

暂不进入本轮的内容：

1. 全量复式总账 / 会计科目体系 / 借贷双分录。
2. 对历史数据的真实批量回填；历史回补需单独 dry-run、幂等脚本和验账方案。
3. 直接修改已有 migration。

### 0.4 微信官方依据（2026-05-18 复核）

- 普通商户 v3 退款接口为 [`POST /v3/refund/domestic/refunds`](https://pay.wechatpay.cn/doc/v3/merchant/4013071036)，退款金额和原订单金额以整数分传递。
- `notify_url` 是退款结果回调地址；微信退款同步返回不能被当成本地业务成功，应以退款结果通知或查询结果驱动本地 finalizer。
- `funds_account` 是普通商户 v3 的可选字段，不应默认写死；是否传入以及传什么值必须以当前商户资金流配置和产品场景为准。
- 微信退款回执金额字段包含 `payer_refund`、`settlement_refund`、`discount_refund`、`refund_fee` 等口径，平台账务和门店账务必须拆字段保存，不能继续混成单个 `amount`。
- 微信支付退款最佳实践要求发起退款后通过[回调通知或主动查询](https://pay.wechatpay.cn/doc/v3/merchant/4014959631)确认退款状态；未收到回调时应按退避策略查询单笔退款。

## 1. 适用范围与术语

### 1.1 "金额"的定义（笼统口径）

本文档所讲"金额"涵盖所有以人民币/可货币化资产为单位的数值：

- 订单金额：`totalAmount`（商品原价总和）、`payAmount`（用户实付）、`discountAmount`、`freightAmount`、`couponDiscount`、`pointsDiscount`、`orderItemFinalPaid`、`orderItemOriginalAmount`、`activityPriceSnapshot`。
- 商品金额：`price`、`guidePrice`、`costPrice`、`originalPrice`、`activityPrice`。
- 钱包：`balance`、`frozen`、`totalIncome`、`pendingRecovery`、`balanceAfter`。
- 佣金：`amount`、`commissionBase`、`activityPool`、`level1Rate`、`level2Rate`、`commissionPoolSnapshot`、`crossTenantRate`、`maxCommissionRate`。
- 提现：`amount`、`fee`、`actualAmount`、`approvedAmount`。
- 结算/对账：`platformAmount`、`storeAmount`、`crossTenantAmount`、`channelAmount`、`localAmount`、`diffAmount`、`grossAmount`、`payerAmount`、`settlementAmount`、`feeAmount`、`netAmount`。
- 退款：`requestedAmount`、`payerRefundAmount`、`settlementRefundAmount`、`refundFeeAmount`、`discountRefundAmount`、`payerTotalAmount`、`settlementTotalAmount`、`refundAmount`、`totalAmount`、`refundRatio`、`refundPointsAmount`、`refundCommissionAmount`。
- 结算调整：`storeAmountDelta`、`commissionAmountDelta`、`platformAmountDelta`、`feeAmountDelta`。
- 积分→金额换算：`orderPointsBase`、`pointsRedemptionBase`、`orderPointsRatio`（积分本身是整数，但与金额的换算环节有精度风险）。
- 利润/校验类：`profit`、`commission`（profit 校验中的中间量）、`amountDiff`（支付回调金额校验差值）。
- 看板/统计聚合：所有 `_sum.amount`、`reduce(sum + ...)`、`channelAmount - localAmount` 类汇总。

> 不在本文档范围：纯展示性 `.toFixed(2)`（前后端只读、不参与后续运算的最后一公里展示），但展示位置如果再次做了加减乘除则纳入。

### 1.2 严重度分级

| 等级    | 含义                                                                           |
| ------- | ------------------------------------------------------------------------------ |
| 🔴 致命 | 直接导致资金损失、订单错位、支付/退款失败、商户/用户账面不一致；必须 P0 修复。 |
| 🟠 高   | 边界场景可触发误判、阻断合法业务（如亏损保护误拒）、对账误报警；P1 修复。      |
| 🟡 中   | 内存与 DB 不一致但被 DB round 兜底，存在治理债；P2 修复。                      |
| 🟢 低   | 仅展示侧浮点，单点 toFixed 收尾不外泄；P3 跟进。                               |

### 1.3 证据等级（沿用 AGENTS.md §5）

本文所列 finding 均为 L3（源码直接阅读 + 微信官方文档比对）。未跑沙箱 / 未跑全量测试 / 未抓生产日志确认的均在末尾标 `⚠️ 未验证`。

## 2. Findings 全集

按编号前缀分四组：

- **R-\***：退款/支付链路相关（v2/v3 报告）
- **P-\***：后端精度（v4 报告）
- **F-\***：前端精度（v5 报告）
- **B-\***：本轮新增的后端附加 bug

每条 finding 含：严重度 / 位置 / 现象 / 根因 / 状态 / 修复方向。

### 2.1 R 系列：退款 / 支付链路

#### R-1 🔴 调用方不读 `refundResult.status`

- **位置**：`apps/backend/src/module/store/order/store-order.service.ts:469-481, 669-680`
- **现象**：`paymentGateway.refund(...)` 返回后只读 `refundSn`、`refundId`，不判断 `status`；微信返回 `SUCCESS` / `PROCESSING` / `CLOSED` / `ABNORMAL` 都进 `finalizeFullRefundOrder` 标 `REFUNDED`。
- **状态**：已修复 @ `cc4ebcdb`：`PROCESSING` 不再 finalizer，失败终态不再取消佣金。
- **修复方向**：退款申请先写 `FinRefund`，仅 `FinRefund.status = SUCCESS` 的统一 finalizer 才能落 `REFUNDED` / 佣金回滚 / 结算调整；`PROCESSING` 等回调或 Scheduler，失败终态进入人工处理。

#### R-2 🔴 没有微信退款异步通知端点

- **位置**：`apps/backend/src/module/payment/wechat-pay.service.ts:75, 252`（配置了 `refundNotifyUrl` 但全代码无 Controller）
- **现象**：`POST /client/payment/notify` 是支付回调，不处理退款；微信按 15s/15s/30s/3m/.../6h 共 15 次重试推送，最终放弃，系统永不感知真实退款结果。
- **状态**：已修复 @ `cc4ebcdb`：新增 `POST /client/payment/refund-notify`，回调验签解密后写 `FinRefundEvent(NOTIFY)`；只有 `SUCCESS` 进入统一 finalizer。
- **修复方向**：新增 `POST /client/payment/refund-notify` + `WechatPayService.parseRefundCallback`（复用支付回调验签 + GCM 解密）；务必 HTTP 200/204 应答。

#### R-3 🔴 没有 `FinRefund` 表与对账 Scheduler

- **位置**：原缺口为全后端无 `FinRefund` Prisma 模型、无 `RefundReconciliationScheduler`。
- **现象**：退款只有"`OmsOrder.status = REFUNDED`"一个单态字段，无中间态、无 retry 次数、无失败原因；微信 CLOSED 在 7~8 天后才发生，无 Scheduler 在此窗口主动查询。
- **状态**：已修复 @ `cc4ebcdb`：P0-A 新增 `FinRefund` / `FinRefundEvent` 与同步响应状态机；P1-A 新增 `RefundReconciliationScheduler`，扫描 `CREATED / PROCESSING` 并查询退款终态。
- **修复方向**：新增 `FinRefund` + `FinRefundEvent` + `RefundReconciliationScheduler`，退款单承载 `refundSn/refundId/orderId/orderSn/tenantId/status/refundType/requestedAmount/payerRefundAmount/settlementRefundAmount/refundFeeAmount/discountRefundAmount/fundsAccount/failReason/successTime/rawPayload/retryCount` 等字段；持续轮询直到终态或超过处理窗口。

#### R-4 🟠 退款 DB 写入与外呼分两段事务

- **位置**：`store-order.service.ts:459-499`
- **现象**：`paymentGateway.refund` 与 `finalizeFullRefundOrder` 不在同一事务；DB 写入失败时已发起的退款没有补偿入口。
- **状态**：已修复 @ `cc4ebcdb`：退款申请先落 `FinRefund`，同步返回非成功不收口；P1-A 用回调和 Scheduler 查询兜底外部成功、本地未收口。
- **修复方向**：依赖 R-3 的 `FinRefund` 状态机做 Saga 补偿。

#### R-5 🟠 `refundCancelledOrderPayment` 死信

- **位置**：`apps/backend/src/module/client/payment/payment.service.ts:198-216`
- **现象**：取消订单收到延迟支付回调时，调 `paymentGateway.refund` 失败只 `logger.warn` 然后返回 `'REFUND_PENDING'` 字符串，不写库、不入队、不可被 Scheduler 接管。
- **状态**：已修复 @ `cc4ebcdb`：P0-A 已写 `FinRefund(refundType=AUTO_CANCEL)`；P1-A 已让同步成功 / 后续查询成功进入统一 finalizer，超过处理窗口升级 `ABNORMAL` 人工异常，并为主动外呼异常补 Bull 退避重试。
- **修复方向**：写入 `FinRefund(refundType=AUTO_CANCEL)` + Bull 队列重试，与 R-3 协同，禁止只返回字符串状态。

#### R-6 🟠 提现 `paymentNo` 未预占导致 reconciliation 误判

- **位置**：`apps/backend/src/module/finance/withdrawal/withdrawal-audit.service.ts:56-71` + `withdrawal-reconciliation.scheduler.ts:108-121`
- **现象**：`transfer` 已发起、`markProcessing` 未写入时 reconciliation 误判 `!paymentNo` → `auto-reject + unfreezeBalance`，造成钱包退冻同时用户已收款；微信侧 `out_batch_no` 幂等期 5 年，重复打款风险被官方幂等兜底但本地账面错。
- **状态**：已修复 @ `cc4ebcdb`：提现审核与重试在外部打款前预占 `paymentNo`，对账可用预占键查询通道状态。
- **修复方向**：调 `transfer` **之前**就把 `out_batch_no`/`out_detail_no` 预占到 `paymentNo` 字段，让 reconciliation 始终能拿到 `paymentNo` 主动查询。

#### R-7 🟠 reconciliation 周期 30 分钟过长

- **位置**：`withdrawal-reconciliation.scheduler.ts:33` (`TIMEOUT_MINUTES = 30`) + `:48`（每 10 分钟）
- **现象**：打款失败到余额解冻最长 30+ 分钟，用户体验差。
- **状态**：待优化（P2）。
- **修复方向**：失败立刻入 Bull 触发对账查询，把"等待 30 分钟"降到 1~3 分钟。

#### R-8 🟡 提现手续费写在 remark 而非独立流水

- **位置**：`withdrawal-audit.service.ts:200-213`
- **现象**：`transactionRepo.create` 的 `amount = -actualAmount`，手续费仅在 `remark` 里以字符串提示；对账"用户实扣 = 流水 amount sum"和"手续费收益 = ?"无法直接 SQL 出账。
- **状态**：治理债（P3）。
- **修复方向**：新增 `TransType.WITHDRAW_FEE` 独立流水。

#### R-9 🟡 钱包方法事务装饰不一致

- **位置**：`apps/backend/src/module/finance/wallet/wallet.service.ts:330-376`
- **现象**：`freezeBalance` / `unfreezeBalance` / `deductFrozen` 用单 SQL 原子更新，未加 `@Transactional`；当 caller 不在事务上下文中时无回滚保护。
- **状态**：已修复 @ `cc4ebcdb`：`freezeBalance` / `unfreezeBalance` / `deductFrozen` 已补齐 `@Transactional()`，并补事务元数据测试。
- **修复方向**：统一加 `@Transactional`，让事务边界与其他钱包方法一致。

#### R-10 🟡 部分退款互斥锁导致用户无法多次部分退款

- **位置**：`store-order.service.ts:655-657`
- **现象**：`partialRefundSn != null` 时直接拒绝继续部分退款；与微信"单笔订单最多 50 次部分退款"的官方规则不一致。
- **状态**：业务诉求待定（P2）。
- **修复方向**：取消单值字段作为幂等事实源；多次部分退款全部落 `FinRefund`，按订单累计 `SUCCESS + PROCESSING` 金额校验不超过实付。

#### R-11 🔴 `mapRefundStatus` 枚举不全（同步 vs 异步差异）

- **位置**：`apps/backend/src/module/payment/wechat-pay.service.ts:277-286`
- **现象**：同步退款响应里 `CLOSED`（有 D），异步退款回调里 `CLOSE`（无 D）。当前 map 只匹配 `CLOSED`；将来接入 R-2 的回调端点时 `CLOSE` 落 fallback `PROCESSING`，永远不进入失败终态。
- **状态**：已在 P0-A 工作区修复：`CLOSE/CLOSED` 映射 `CLOSED`，`ABNORMAL` 独立保留，未知状态抛错。
- **修复方向**：map 同时收 `CLOSE` 与 `CLOSED`；未命中改为抛错，不要 fallback PROCESSING。

#### R-12 🟠 未传退款资金来源参数

- **位置**：`wechat-pay.service.ts:248-262`
- **现象**：退款资金来源没有建模，既没有记录请求侧 `funds_account` / `amount.from`，也没有把微信回执里的资金账户沉淀到本地；遇 `NOT_ENOUGH`、资金账户不匹配或产品场景差异时不可诊断。反向把 `UNSETTLED` 写成通用补丁也不正确。
- **状态**：部分实施：P0-A 已在 `FinRefund.fundsAccount` 建模；具体微信请求入参策略仍需按商户产品形态确认后接入。
- **修复方向**：不要默认硬编码退款资金来源。普通商户 v3 的 `funds_account` 是可选字段，且 `UNSETTLED` 有特定适用场景；平台收付通 / v2 接口才可能出现不同语义的 `refund_account`。实现前必须以当前接入的微信 API 路径、商户资金流配置和产品形态为准，把资金来源记录到 `FinRefund.fundsAccount`，不得把 v2 / v3 / 平台收付通字段名混用。

#### R-13 🟡 商家转账失败类型未细分

- **位置**：`withdrawal-audit.service.ts:80-129`
- **现象**：`retryPayment` 不区分错误码；只有 `SYSTEM_ERROR` 适合用原 `out_batch_no` 重试（官方明确要求），其他业务错误（`OPENID_ERROR` / 金额超限）用同号重试只会被微信幂等返回原错误。
- **状态**：待优化（P2）。
- **修复方向**：在 `WithdrawalPaymentService.transfer` 的 catch 块读出 `err_code` 写到 `failReason`，retryPayment 按错误码白名单决定重试。

#### R-14 🟡 没有 `FREQUENCY_LIMITED` 限流防护

- **位置**：`withdrawal-payment.service.ts` 全文
- **现象**：商家转账接口 50 QPS，批量审核可能触发 `FREQUENCY_LIMITED`。
- **状态**：待治理（P3）。
- **修复方向**：Bull 队列 `limiter: { max: 40, duration: 1000 }`。

### 2.2 P 系列：后端精度

#### P-1 🔴 优惠计算全链路 number 浮点

- **位置**：`apps/backend/src/module/marketing/integration/integration.service.ts:71-150`
- **现象**：
  ```ts
  const originalAmount = dto.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0, // 浮点累加
  );
  let finalAmount = originalAmount;
  finalAmount -= couponDiscount; // number 减法
  finalAmount -= pointsDiscount; // number 减法
  ```
- **影响**：`finalAmount` 透传到 `OmsOrder.payAmount`（DB round 兜底），但中间值会被 `OrderMarketingPort.calculateOrderDiscount` 用 `Number()` 反复包裹后再传下游。
- **状态**：已修复 @ `cc4ebcdb`：核心算术改为 Prisma `Decimal`；出口仍保持既有 number 契约。

#### P-2 🔴 `payAmount = totalAmount.toNumber() + freightAmount - discountAmount`

- **位置**：`apps/backend/src/module/client/order/services/order-checkout.service.ts:174`
- **现象**：Decimal 出来立即 `.toNumber()` 后做加减；当前 freight/discount 是 0 不暴露问题，一旦未来支持非零值立即引入浮点。
- **状态**：已修复 @ `cc4ebcdb`：`payAmount` 由 Decimal 链式计算后再出口展示。

#### P-3 🔴 `convertToFen` 不取整 + 接收 number

- **位置**：`apps/backend/src/module/payment/wechat-pay.service.ts:544-546`
- **现象**：
  ```ts
  private convertToFen(amount: Decimal | string | number): number {
    return new Decimal(amount).mul(100).toNumber();  // 不取整
  }
  ```
- **影响**：调用方传 `number` 类型 + 浮点垃圾 → 微信收到非整数分 → `PARAM_ERROR` → SDK 可能不抛错 → 走 R-1 链路 → 系统显示成功。
- **状态**：已修复 @ `cc4ebcdb`：微信主动外呼金额入参收紧为 `Decimal | string`，统一经 `Money.toFen()` 整数分校验。
- **修复方向**：后续新增支付 / 退款 / 分账 / 转账入口时继续禁止裸 `number` 金额进入网关层。

#### P-4 🔴 部分退款 `refundAmount` 与 `totalAmount` 口径不一致

- **位置**：`apps/backend/src/module/store/order/store-order.service.ts:624, 634, 669-675`
- **现象**：
  ```ts
  const itemRefundAmount = new Prisma.Decimal(orderItem.price).mul(refundItem.quantity).toDecimalPlaces(2);
  // ...
  refundAmount: refundAmount.toString(),   // 商品原价 sum
  totalAmount: validOrder.payAmount,        // 实付（已扣券+积分）
  ```
- **影响**：用户用券/积分时 `refundAmount > totalAmount`，微信报 `amount.refund > amount.total` 直接拒绝。
- **状态**：已在 P0-A 工作区修复：部分退款优先按 `orderItemFinalPaid` 计算，历史缺失时回退订单项总额 / 单价口径。
- **修复方向**：用 `orderItem.orderItemFinalPaid`（字段已存在于 schema）做实付分摊；全单退款也保持口径一致。

#### P-5 🟠 支付回调金额校验用浮点减法 + 容差

- **位置**：`apps/backend/src/module/client/payment/payment.service.ts:107-115`
- **现象**：
  ```ts
  const amountDiff = Math.abs(callbackPayAmount - orderPayAmount);
  BusinessException.throwIf(amountDiff > 0.01, ...);
  ```
- **影响**：`0.3 - 0.29 = 0.010000000000000009 > 0.01` → 抛错；合法支付被误判，微信回调重试连续失败。
- **状态**：已修复 @ `cc4ebcdb`：支付回调金额校验改为 Decimal 严格相等，不再使用浮点容差。
- **修复方向**：保持 Decimal，`orderPayAmount.sub(callbackPayAmount).abs().lte(Decimal('0'))` 严格相等。

#### P-6 🟠 `calculateFee` 未截位到 2 位

- **位置**：`apps/backend/src/module/finance/withdrawal/withdrawal.service.ts:124-130, 161-162`
- **现象**：`fee = amount.mul(FEE_RATE)` 不 `.toDecimalPlaces(2)`；`actualAmount = amount - fee` 同样不截位。
- **影响**：内存值如 `33.13002`、`0.19998`，DB 落库被 round 成 2 位，内存 vs DB 不一致；当前下游全部走 DB 读所以不爆，但有人改成读内存值就会爆。
- **状态**：已修复 @ `cc4ebcdb`：手续费与实付金额统一截位到 2 位并补回归测试。

#### P-7 🟠 对账差异判定用 number 减法

- **位置**：`apps/backend/src/module/finance/settlement-core/settlement-reconciliation-center.service.ts:271-273`
- **现象**：`Number(line.amount) - Number(local.amount)`，toFixed 兜底但口径污染。
- **状态**：已修复 @ `cc4ebcdb`：对账差异改为 Decimal 计算，出口显示前再转 number。
- **修复方向**：全 Decimal。

#### P-8 ~ P-15 🟡 / 🟢 其他

| ID   | 位置                                                           | 简述                                                                             |
| ---- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| P-8  | `marketing/coupon/usage/usage.service.ts:172`                  | `Number(discount.toFixed(2))` 返回 number 给上游继续 number 算术。               |
| P-9  | `marketing/course-group/services/commission.service.ts:35`     | `Number((amount * view.commissionRate).toFixed(2))`，number 乘法 + toFixed。     |
| P-10 | `marketing/course-group/course-group.service.ts:1007`          | `reduce((sum, value) => sum + value, 0).toFixed(2)`，number 累加。               |
| P-11 | `common/utils/index.ts:136, 146`                               | `FormatDateFields` 把所有 Decimal 字段 `.toNumber()`，是出口精度污染的中央枢纽。 |
| P-12 | `client/order/services/order-checkout.service.ts:144-147, 197` | preview 出口把 Decimal 全部 `.toNumber()`。                                      |
| P-13 | `client/order/ports/order-marketing.port.ts:53-76`             | discount 决策环节反复 `Number()` 包裹。                                          |
| P-14 | `payment/adapters/mock-payment-gateway.adapter.ts:75`          | `Number(params.refundAmount) * 100`，Mock 同样不取整。                           |
| P-15 | `store/finance/ledger.service.ts:138-158` 等                   | 看板查询展示侧 `Number(r.amount)`，纯只读。                                      |

### 2.3 F 系列：前端精度

#### F-1 🔴 拼团佣金看板 reduce 浮点

- **位置**：`apps/admin-web/src/views/marketing/course-group/commission/index.vue:80-88`
- **现象**：`list.reduce((sum, row) => sum + Number(row.commissionAmount || 0), 0)` 最后 `Number(x.toFixed(2))`；运营汇总指标可能差 1~2 分。

#### F-2 🔴 SKU 利润亏损保护用浮点判断

- **位置**：`apps/admin-web/src/views/store/product/list/modules/product-operate-drawer.vue:89-104`
- **现象**：`profit = price - cost - price * distRate`；`if (profit < 0) message.error('亏本风险')`。profit 应为 0 时 JS 可能算出 `-4.44e-16` → 误判亏本 → 阻断提交。

#### F-3 🔴 商品导入 SKU 利润同上

- **位置**：`apps/admin-web/src/views/store/product_market/components/ImportDialog.vue:166-184`
- **现象**：与 F-2 同源。

#### F-4 🔴 小程序购物车合计浮点 reduce

- **位置**：`apps/miniapp-client/src/store/cart.ts:58-60`
- **现象**：`selectedTotal = selectedItems.reduce((sum, i) => sum + i.currentPrice * i.quantity, 0)`。
- **影响**：用户感知"选中合计 ¥19.91" vs 订单确认页"实付 ¥19.90"，信任崩塌。

#### F-5 ~ F-12 🟠 / 🟡

| ID   | 位置                                                                                      | 简述                                                                                     |
| ---- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| F-5  | `admin-web/src/views/store/order/list/index.vue:169, 182`                                 | Number fallback，展示无害但口径不一致。                                                  |
| F-6  | `admin-web/src/views/finance/settlement/reconciliation/result/index.vue:130-131, 288-294` | 对账详情页展示 `diffAmount`（已被 P-7 污染）。                                           |
| F-7  | `admin-web/src/views/pms/global-product-create/components/Step3Sku.vue:306`               | `sku.costPrice = Number((Number(sku.guidePrice \|\| 0) * ratio).toFixed(2))`，浮点乘法。 |
| F-8  | `admin-web/src/views/marketing/activity/modules/activity-commission-budget-panel.vue:31`  | 预算使用率浮点除法。                                                                     |
| F-9  | `apps/miniapp-client/src/pages/product/detail.vue:337`                                    | `(Number(displayPrice.value) * rate).toFixed(2)`。                                       |
| F-10 | `apps/miniapp-client/src/pages/preview/card.vue:124`                                      | `(Number(displayPrice) * 1.5).toFixed(2)`。                                              |
| F-11 | `apps/miniapp-client/src/pages/{me,wallet,withdraw}/`                                     | C 端无提现 / 钱包页（业务缺失）。                                                        |
| F-12 | `apps/miniapp-client/src/pages/order/{list,detail,create}.vue` 各自的 `formatPrice`       | 重复 3 份相同逻辑，无统一金额工具。                                                      |

### 2.4 B 系列：新增后端附加缺陷

#### B-X 🟠 积分规则计算 Number 浮点除法

- **位置**：`apps/backend/src/module/marketing/points/rule/rule.service.ts:144, 190, 219`
- **现象**：
  ```ts
  const points = Math.floor(Number(orderAmount) / Number(rules.orderPointsBase)) * Number(rules.orderPointsRatio);
  ```
- **影响**：`0.7 / 0.1 = 6.999999999999999` → `Math.floor` → 6（应是 7）；用户少得积分。当 `orderPointsBase` 是非整数（如 0.1）且金额是 base 倍数时必现。如果生产环境 base 永远是整数（1/10/100）则不暴露。
- **状态**：已修复 @ `cc4ebcdb`：积分计算改为 Decimal 除法与 floor，覆盖 `0.7 / 0.1` 边界。
- **修复方向**：全部用 `new Decimal(orderAmount).div(base).floor().mul(ratio).toNumber()`。

#### B-Y 🟠 佣金部分退款双向 round 守恒缺失

- **位置**：`apps/backend/src/module/finance/commission/services/commission-settler.service.ts:145-146`
- **现象**：
  ```ts
  const refundCommissionAmount = new Decimal(commission.amount).mul(refundRatio).toDecimalPlaces(2);
  const remainingAmount = new Decimal(commission.amount).minus(refundCommissionAmount).toDecimalPlaces(2);
  ```
- **影响**：双向各自独立 round 到 2 位，`refundCommissionAmount + remainingAmount` 不一定等于 `commission.amount`。例：amount=0.05, ratio=0.5 → refund=0.03（HALF_UP）+ remaining=0.02 = 0.05 ✓；但 amount=0.05, ratio=0.5 在 ROUND_DOWN 下 → refund=0.02 + remaining=0.03 也是 0.05 ✓；真正风险是涉及更复杂 ratio 的场景，Decimal 默认 ROUND_HALF_EVEN 可能让 refund=0.025→0.02、remaining=0.025→0.02，**合计 0.04 ≠ 0.05**，账面 1 分凭空消失。
- **状态**：已修复 @ `cc4ebcdb`：佣金部分退款改用 `splitByRatio`，只 round 一侧并保证守恒。
- **修复方向**：只 round 一方，另一方用 `commission.amount.minus(roundedOne)` 保证守恒。

#### B-Z 🟡 退款返还积分 `Math.floor` 系统性少给

- **位置**：`apps/backend/src/module/store/order/store-order.service.ts:762`
- **现象**：`refundPointsAmount = Math.floor(Number(order.pointsUsed || 0) * Number(refundRatio))`；多次部分退款累计后用户少拿 1~N 个积分。
- **状态**：待治理（P2）。

#### B-W 🟡 钱包总资产用 number 加法

- **位置**：`apps/backend/src/module/client/finance/client-finance.service.ts:40`
- **现象**：`totalAssets: Number(wallet.balance) + Number(wallet.frozen)`。
- **状态**：治理债（P3）。

## 3. 不在治理范围内（明确豁免）

以下场景**不**视为精度风险，避免后续审计反复重提：

1. 纯展示侧的 `.toFixed(2)`，只要不参与后续运算。
2. DB 列已定义为 `Decimal(10,2)` / `Decimal(12,2)` 的字段在落库时的 round（这是兜底，不是 bug）。
3. 服务器监控指标（CPU、内存、磁盘使用率）的 `.toFixed(2)`，不是金额。
4. LBS 距离 `.toFixed(1) km` 等非金额数值。
5. 测试用例里 `expect(...).toBe(N)` 或 `toBeCloseTo` 的断言。
6. 积分自身的整数运算（`number` 类型本就够用，没有小数）；但**积分↔金额的换算环节**纳入。

## 4. 治本方案 1：端到端 Decimal + 跨端金额工具库

### 4.1 设计目标

1. **后端**：金额字段在内存中始终是 `Decimal`；仅在 API 出口最终序列化时 `.toNumber()` 或 `.toFixed(2)`。
2. **前端**：引入 `decimal.js`（或 `big.js`，二选一），封装统一 `Money` 工具；所有需要做加减乘除的金额走该工具。
3. **跨端契约**：API 出口字段类型保持 `number`（不打破现有契约），但**值约束为最多 2 位小数**；前端再用 `new Decimal(value)` 重建。
4. **微信支付层**：`convertToFen` 100% 整数分校验，拒绝非整数。
5. **DB**：保持现有 `Decimal(10,2)` / `Decimal(12,2)` 字段不变，作为最终兜底。

### 4.2 后端架构

#### 4.2.1 新增共享工具：`libs/common-utils/src/money/`

> 按根 `AGENTS.md` §1.2，`libs/common-utils` 不得依赖 Prisma；但 Decimal 类型来自 `@prisma/client/runtime/library` 严格说违反此边界。两个选项：

| 方案                                                                                      | 优点           | 缺点                        |
| ----------------------------------------------------------------------------------------- | -------------- | --------------------------- |
| A. 在 `libs/common-utils` 引入 `decimal.js`（独立库，与 Prisma 的 Decimal 同源但解耦）    | 跨端可共享     | 同进程内有两个 Decimal 实例 |
| B. 仅后端用 `@prisma/client/runtime/library` Decimal；前端用 `decimal.js`；契约层用字符串 | 后端零增加依赖 | 前后端工具签名不一致        |

**推荐 A**：libs/common-utils 引入 `decimal.js`，后端把 Prisma Decimal 与之互转（构造函数都接受字符串）。

```ts
// libs/common-utils/src/money/money.ts
import Decimal from 'decimal.js';

export type MoneyInput = Decimal | number | string;

export class Money {
  private readonly value: Decimal;

  constructor(input: MoneyInput) {
    this.value = new Decimal(typeof input === 'number' ? input.toString() : (input as string));
    if (!this.value.isFinite()) throw new Error(`Invalid money input: ${input}`);
  }

  add(other: MoneyInput): Money {
    return new Money(this.value.plus(new Money(other).value));
  }
  sub(other: MoneyInput): Money {
    return new Money(this.value.minus(new Money(other).value));
  }
  mul(other: MoneyInput): Money {
    return new Money(this.value.times(new Money(other).value));
  }
  div(other: MoneyInput): Money {
    return new Money(this.value.div(new Money(other).value));
  }

  eq(other: MoneyInput): boolean {
    return this.value.eq(new Money(other).value);
  }
  lt(other: MoneyInput): boolean {
    return this.value.lt(new Money(other).value);
  }
  gt(other: MoneyInput): boolean {
    return this.value.gt(new Money(other).value);
  }

  /** 始终保留 2 位小数（HALF_UP），用于落库 / 出口 */
  toAmount(): string {
    return this.value.toFixed(2);
  }
  /** 始终向下取整到整数分，用于微信支付 */
  toFen(): number {
    const fen = this.value.times(100).toDecimalPlaces(0, Decimal.ROUND_DOWN);
    if (!fen.isInteger()) throw new Error(`Money.toFen produced non-integer: ${fen}`);
    return fen.toNumber();
  }
  /** 显式转回 number，仅用于 API 出口 */
  toNumber(): number {
    return Number(this.value.toFixed(2));
  }
}

/** 求和工具：reduce 替代品，强制 Decimal 通路 */
export function sumMoney(values: MoneyInput[]): Money {
  return values.reduce((acc, v) => acc.add(v), new Money(0));
}

/** 按比例守恒拆分：first + second === total */
export function splitByRatio(total: MoneyInput, ratio: MoneyInput): { first: Money; second: Money } {
  const t = new Money(total);
  const first = t.mul(ratio); // 不 round
  const firstRounded = new Money(first.toAmount()); // 单方向 round
  const second = t.sub(firstRounded); // 用差值保证守恒
  return { first: firstRounded, second };
}
```

#### 4.2.2 后端集成约定

| 场景            | 约定                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Service 层内部  | 全部 `Money` 或 Prisma `Decimal`；禁止 `.toNumber()` 后再做算术                                           |
| Repository 写入 | 接受 `Money` / `Decimal`，调 `.toAmount()` / `.toFixed(2)` 后传 Prisma                                    |
| API 出口        | 改造 `FormatDateFields` 增加 `formatAmount` 钩子；金额字段统一 `.toFixed(2)` 后 `Number()`，保证最多 2 位 |
| 微信支付        | `convertToFen` 内部用 `Money.toFen()`，签名收紧不接受裸 `number`                                          |
| 支付校验        | `Decimal.eq` 严格相等，禁止 `Math.abs(a-b) > 0.01`                                                        |
| 比例守恒        | 用 `splitByRatio` 替代双向 `.toDecimalPlaces(2)`（直接修 B-Y）                                            |

#### 4.2.3 必改的 12 处后端点位

| 位置                                                                          | 改动                                                                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `payment/wechat-pay.service.ts:544-546` `convertToFen`                        | 用 `Money.toFen()`，签名去 `number`                                                                                |
| `payment/wechat-pay.service.ts:277-286` `mapRefundStatus`                     | 加 `CLOSE` 映射，未命中抛错                                                                                        |
| `payment/wechat-pay.service.ts:248-262` `refund`                              | `funds_account` / `refund_account` 按当前微信 API 产品形态显式传入或留空；显式判 `result.status`，不得把受理当成功 |
| `store/order/store-order.service.ts:469-499 / 659-720`                        | 部分退款改 `orderItem.orderItemFinalPaid` 分摊；显式判 `refundResult.status === SUCCESS`                           |
| `client/payment/payment.service.ts:107-115`                                   | 浮点比较改 Decimal `.eq`                                                                                           |
| `marketing/integration/integration.service.ts:71-150`                         | 优惠计算全程 `Money`                                                                                               |
| `client/order/services/order-checkout.service.ts:174`                         | `payAmount = totalAmount.add(freight).sub(discount).toAmount()`                                                    |
| `client/order/ports/order-marketing.port.ts:50-83`                            | discount 决策全程 `Money`                                                                                          |
| `marketing/points/rule/rule.service.ts:144, 190, 219`                         | 用 `Decimal.div().floor().mul()`                                                                                   |
| `finance/commission/services/commission-settler.service.ts:145-146`           | 用 `splitByRatio` 守恒                                                                                             |
| `finance/withdrawal/withdrawal.service.ts:124-130`                            | `calculateFee` 内 `.toDecimalPlaces(2)`                                                                            |
| `finance/settlement-core/settlement-reconciliation-center.service.ts:271-273` | 用 Decimal 减                                                                                                      |

### 4.3 前端架构

#### 4.3.1 新增前端工具：`apps/admin-web/src/utils/money.ts` 与 `apps/miniapp-client/src/utils/money.ts`

两端结构一致（复制即可，避免 cross-app 依赖）：

```ts
import Decimal from 'decimal.js';

export class Money {
  private readonly value: Decimal;
  constructor(input: Decimal.Value) {
    this.value = new Decimal(input ?? 0);
  }
  add(other: Decimal.Value): Money {
    return new Money(this.value.plus(other));
  }
  sub(other: Decimal.Value): Money {
    return new Money(this.value.minus(other));
  }
  mul(other: Decimal.Value): Money {
    return new Money(this.value.times(other));
  }
  div(other: Decimal.Value): Money {
    return new Money(this.value.div(other));
  }
  format(): string {
    return this.value.toFixed(2);
  }
  toNumber(): number {
    return Number(this.value.toFixed(2));
  }
}

export function sumMoney(values: Decimal.Value[]): Money {
  return values.reduce<Money>((acc, v) => acc.add(v), new Money(0));
}

export function formatPrice(value: Decimal.Value): string {
  return new Money(value).format();
}
```

依赖：`pnpm --filter @apps/admin-web add decimal.js`、`pnpm --filter @apps/miniapp-client add decimal.js`（包大小 ~12KB gzipped，可接受）。

#### 4.3.2 前端必改的 12 处

| 位置                                                                                     | 改动                                                                                                                 |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `admin-web/src/views/marketing/course-group/commission/index.vue:80-88`                  | `sumMoney(list.map(r => r.commissionAmount))`                                                                        |
| `admin-web/src/views/store/product/list/modules/product-operate-drawer.vue:89-104`       | `profit = new Money(price).sub(cost).sub(new Money(price).mul(distRate))`                                            |
| `admin-web/src/views/store/product_market/components/ImportDialog.vue:166-184`           | 同上                                                                                                                 |
| `admin-web/src/views/pms/global-product-create/components/Step3Sku.vue:306`              | `new Money(sku.guidePrice).mul(ratio).format()`                                                                      |
| `admin-web/src/views/marketing/activity/modules/activity-commission-budget-panel.vue:31` | `new Money(consumed).div(total).mul(100).format()`                                                                   |
| `admin-web/src/views/finance/settlement/reconciliation/result/index.vue:130-131`         | 直接展示后端 `diffAmount`，不再 `Number().toFixed(2)`（后端定型后）                                                  |
| `miniapp-client/src/store/cart.ts:58-60`                                                 | `selectedTotal = sumMoney(selectedItems.flatMap(i => Array(i.quantity).fill(i.currentPrice)))` 或更高效的 `mul` 写法 |
| `miniapp-client/src/pages/order/{list,detail,create}.vue`                                | 抽到 `utils/money.ts` 的 `formatPrice`，删除 3 份重复                                                                |
| `miniapp-client/src/pages/product/detail.vue:337`                                        | `new Money(displayPrice).mul(rate).format()`                                                                         |
| `miniapp-client/src/pages/preview/card.vue:124`                                          | `new Money(displayPrice).mul(1.5).format()`                                                                          |
| `miniapp-client/src/components/product-card/senior-product-card.vue:21, 26`              | `formatPrice(item.currentPrice)`                                                                                     |
| `miniapp-client/src/pages/me` 或新增 `pages/wallet/`                                     | F-11 业务缺失，是否补由业务方决定，不在精度治理范围                                                                  |

### 4.4 治本方案 2：退款、平台对账、门店账务、结算调整闭环

#### 4.4.1 总体链路

退款链路必须从"订单状态驱动"调整为"退款事实驱动"：

```text
创建 FinRefund(CREATED)
  -> 调用微信退款
  -> 同步响应写 FinRefundEvent(SYNC_RESPONSE)
  -> SUCCESS: 统一 finalizer 更新订单 / 佣金 / 钱包 / 结算调整 / 门店流水
  -> PROCESSING: 等退款回调或 Scheduler 查询
  -> CLOSED / ABNORMAL / FAILED: 进入失败待处理，不允许显示退款成功
```

核心不变式：

1. 微信同步受理不等于退款成功。
2. 只有 `FinRefund.status = SUCCESS` 能驱动订单 `REFUNDED`、佣金回滚、结算调整和门店退款流水。
3. 同一订单累计 `SUCCESS + PROCESSING` 退款金额不得超过订单实付金额。
4. 用户退款金额、商户结算退款金额、手续费、净额必须分字段保存，不能混成一个 `amount`。

#### 4.4.2 新增 `FinRefund`

`FinRefund` 是退款唯一事实源，替代 `OmsOrder.status = REFUNDED` / `partialRefundSn` 作为退款事实。

建议字段：

| 字段                        | 说明                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `id`                        | 主键                                                          |
| `tenantId`                  | 租户 / 门店                                                   |
| `orderId` / `orderSn`       | 订单关联                                                      |
| `refundSn`                  | 我方退款单号，幂等键                                          |
| `refundId`                  | 微信退款单号                                                  |
| `channelType`               | 支付渠道                                                      |
| `status`                    | `CREATED / PROCESSING / SUCCESS / FAILED / CLOSED / ABNORMAL` |
| `refundType`                | `FULL / PARTIAL / AUTO_CANCEL`                                |
| `requestedAmount`           | 系统申请退款金额                                              |
| `payerRefundAmount`         | 用户实际收到退款金额                                          |
| `settlementRefundAmount`    | 微信结算口径退款金额                                          |
| `refundFeeAmount`           | 手续费退还 / 冲减金额                                         |
| `discountRefundAmount`      | 优惠退款金额                                                  |
| `payerTotalAmount`          | 用户侧原支付金额                                              |
| `settlementTotalAmount`     | 商户结算原金额                                                |
| `fundsAccount`              | 退款资金来源                                                  |
| `reason`                    | 退款原因                                                      |
| `failReason`                | 失败原因                                                      |
| `successTime`               | 微信退款成功时间                                              |
| `lastQueryTime`             | 最近查询时间                                                  |
| `retryCount`                | 查询 / 重试次数                                               |
| `rawPayload`                | 最近一次微信原始回执                                          |
| `finalizePayload`           | 订单 / 佣金 / 积分收口所需的退款上下文快照                    |
| `finalizedAt`               | 统一 finalizer 完成时间，用于回调 / Scheduler 幂等            |
| `createTime` / `updateTime` | 创建 / 更新时间                                               |

约束：

- `refundSn` 全局唯一，或至少 `(tenantId, refundSn)` 唯一。
- `refundId` 可空但终态成功后应有值；若微信未返回，必须保留原始响应证据。
- 退款金额字段使用 `Decimal(10,2)` 或与订单金额一致的精度。
- 新流程不再依赖 `partialRefundSn` 限制部分退款次数；旧字段只保留兼容和查询展示。

#### 4.4.3 新增 `FinRefundEvent`

`FinRefundEvent` 保留退款状态流转历史，避免 `rawPayload` 覆盖证据。

建议字段：

| 字段                      | 说明                                                |
| ------------------------- | --------------------------------------------------- |
| `id`                      | 主键                                                |
| `refundId`                | 关联 `FinRefund.id`                                 |
| `eventType`               | `REQUEST / SYNC_RESPONSE / NOTIFY / QUERY / MANUAL` |
| `fromStatus` / `toStatus` | 状态迁移                                            |
| `payload`                 | 原始事件载荷                                        |
| `operator`                | 操作人或系统任务名                                  |
| `createTime`              | 事件时间                                            |

要求：

- 所有同步响应、异步回调、Scheduler 查询、人工处理都必须追加事件。
- finalizer 必须基于 `FinRefund` 当前状态幂等执行，不以事件重复次数为准。

#### 4.4.4 退款回调与查询补偿

必须补齐：

1. `POST /client/payment/refund-notify` 或 payment notify 下的明确退款回调路由。
2. `WechatPayService.parseRefundCallback`，复用支付回调验签 + GCM 解密能力。
3. `RefundReconciliationScheduler`，扫描 `CREATED / PROCESSING` 退款单并查询微信。

P1-A 工作区已实现上述 3 项，并把 `PaymentGatewayPort.queryRefund` / `handleRefundCallback` 纳入稳定端口。

Scheduler 规则：

- 查询成功终态后更新 `FinRefund` 并追加 `FinRefundEvent(QUERY)`。
- `SUCCESS` 触发统一 finalizer。
- `CLOSED / ABNORMAL / FAILED` 进入失败待处理，不触发成功账务。
- 超过处理窗口仍非终态时升级人工异常。
- 自动取消支付防线退款必须写 `FinRefund(refundType=AUTO_CANCEL)`，不能只记录日志和返回 `REFUND_PENDING`。

当前 P1-A 已完成回调、查询、成功 finalizer、超过处理窗口升级人工异常和主动退款外呼失败后的 Bull 退避重试。

#### 4.4.5 退款金额口径

部分退款金额必须从实付口径计算：

1. 优先使用 `OmsOrderItem.orderItemFinalPaid`。
2. 历史订单缺失 `orderItemFinalPaid` 时，按订单 `payAmount` 在订单项间做守恒分摊。
3. 禁止继续用 `orderItem.price * quantity` 直接作为微信退款金额。
4. 退款比例只用于积分 / 佣金回滚推导，不作为微信退款金额事实。
5. 所有微信入参以整数分传递，禁止浮点容差判断。

#### 4.4.6 平台对账增加 `REFUND`

`ReconciliationBizScope` 从：

```text
PAYMENT / SETTLEMENT / WITHDRAWAL
```

扩展为：

```text
PAYMENT / REFUND / SETTLEMENT / WITHDRAWAL
```

规则：

- `REFUND` 本地数据源为 `FinRefund`，仅纳入终态或待对账状态，不能从 `OmsOrder.status` 反推。
- `PAYMENT` 对账支付收款。
- `REFUND` 对账用户退款、结算退款、手续费退还 / 冲减。
- `SETTLEMENT` 对账平台向门店 / 会员的结算执行。
- `WITHDRAWAL` 对账提现打款。

#### 4.4.7 渠道账单金额拆口径

扩展 `FinChannelStatementLine`，避免单字段 `amount` 同时承载退款、手续费、净额。

建议字段：

| 字段               | 说明                                               |
| ------------------ | -------------------------------------------------- |
| `amountKind`       | `PAYMENT / REFUND / FEE / SETTLEMENT / WITHDRAWAL` |
| `grossAmount`      | 业务总金额                                         |
| `payerAmount`      | 用户支付或用户退款金额                             |
| `settlementAmount` | 商户结算口径金额                                   |
| `feeAmount`        | 手续费                                             |
| `refundFeeAmount`  | 退款手续费退还 / 冲减                              |
| `discountAmount`   | 优惠相关金额                                       |
| `netAmount`        | 平台净入账 / 净出账                                |
| `currency`         | 币种                                               |
| `rawPayload`       | 渠道原始行                                         |

映射原则：

- 用户退款看 `payerRefundAmount` / `payerAmount`。
- 商户结算退款看 `settlementRefundAmount` / `settlementAmount`。
- 手续费看 `refundFeeAmount` / `feeAmount`。
- 平台净额看 `netAmount`。
- `19.90`、`19.88`、`0.02` 必须能在平台对账页拆开解释。

#### 4.4.8 新增 `FinSettlementAdjustment`

退款不能直接改已经审核、执行中、成功、失败、关闭的历史结算单。新增结算调整单表达 delta。

建议字段：

| 字段                        | 说明                                               |
| --------------------------- | -------------------------------------------------- |
| `id`                        | 主键                                               |
| `adjustmentNo`              | 调整单号                                           |
| `tenantId`                  | 租户 / 门店                                        |
| `orderId`                   | 订单                                               |
| `refundId`                  | 退款单                                             |
| `settlementBillId`          | 原结算单，可空                                     |
| `adjustmentType`            | `REFUND_DEDUCT / COMMISSION_ROLLBACK / FEE_ADJUST` |
| `storeAmountDelta`          | 门店应收调整                                       |
| `commissionAmountDelta`     | 佣金调整                                           |
| `platformAmountDelta`       | 平台收入调整                                       |
| `feeAmountDelta`            | 手续费调整                                         |
| `status`                    | `PENDING / CONFIRMED / SETTLED / CLOSED`           |
| `reason`                    | 调整原因                                           |
| `rawPayload`                | 证据                                               |
| `createTime` / `updateTime` | 创建 / 更新时间                                    |

规则：

- 结算单未锁定时可以刷新应结算金额。
- 结算单已审核、执行中、成功、失败或关闭时，不改原单，生成调整单。
- 调整单必须能反查 `FinRefund` 和原结算单，满足财务审计。

#### 4.4.9 门店财务口径调整

门店看板从"订单收入"升级为"净经营口径"。

建议新增 / 展示字段：

| 字段                     | 说明                     |
| ------------------------ | ------------------------ |
| `paidGMV`                | 支付总额                 |
| `refundAmount`           | 成功退款金额             |
| `netGMV`                 | `paidGMV - refundAmount` |
| `refundFeeAmount`        | 退款相关手续费           |
| `commissionAmount`       | 佣金金额                 |
| `commissionRollback`     | 退款导致的佣金回滚       |
| `settlementAdjustAmount` | 门店结算调整             |
| `pendingRecovery`        | 待回收金额               |
| `withdrawalAmount`       | 提现金额                 |
| `netIncome`              | 净收入                   |

门店流水新增类型：

- `REFUND_OUT`：用户退款出账。
- `REFUND_FEE_ADJUST`：退款手续费调整。
- `SETTLEMENT_ADJUST`：结算调整。
- 保留 `REFUND_DEDUCT` 表示佣金 / 钱包回收，禁止与用户退款混同。

### 4.5 阶段拆分（不实施，仅作排期参考）

| 阶段                                      | 范围                                                                                | PR 数              | 前置                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------- | ------------------ | --------------------- |
| **P0-A 退款事实源与状态机**               | `FinRefund` + `FinRefundEvent` + 退款 finalizer；R-1/R-3/R-4/R-5/R-11/R-12/P-3/P-4  | 1 大 PR 或 2 小 PR | 无                    |
| **P0-B 后端金额精度底座**                 | 4.2.3 全部 12 处；新增 `libs/common-utils/money`；支付回调金额严格校验              | 1 大 PR 或 3 小 PR | P0-A 可并行小范围拆分 |
| **P1-A 退款回调与 Scheduler**             | R-2；`parseRefundCallback`；`RefundReconciliationScheduler`；人工异常升级           | 1 PR               | P0-A                  |
| **P1-B 平台 REFUND 对账与渠道金额拆口径** | `ReconciliationBizScope.REFUND`；扩展 `FinChannelStatementLine`；对账结果拆口径展示 | 1 大 PR            | P0-A + P1-A           |
| **P1-C 结算调整单**                       | `FinSettlementAdjustment`；已锁定结算单退款生成调整单；后台列表展示                 | 1 PR               | P0-A                  |
| **P1-D 门店财务净额化**                   | 门店看板 / 流水新增 `paidGMV/refundAmount/netGMV` 等字段和流水类型                  | 1 PR               | P0-A + P1-C           |
| **P1-E 前端金额工具**                     | 4.3.2 全部 12 处；admin-web + miniapp-client 各加 `decimal.js`                      | 1 PR/端            | P0-B                  |
| **P2**                                    | R-6 + R-7 + R-10 + R-13 + P-5 + P-6 + P-7 + B-X + B-Y + B-Z                         | 拆 4-5 PR          | P1 完成               |
| **P3 治理债**                             | R-8 + R-9 + R-14 + P-8~P-15 + F-5~F-12 + B-W                                        | 滚动跟进           | —                     |

### 4.6 验证矩阵

| 阶段 | 必跑命令                                                                                                        | 必加测试                                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| P0-A | `pnpm typecheck:backend` + `pnpm --filter @apps/backend test -- payment/ store/order/ client/payment/ finance/` | `PROCESSING` 不改 `REFUNDED`；`SUCCESS` finalizer 幂等；`CLOSED/ABNORMAL` 不取消佣金；自动取消退款写 `FinRefund`；部分退款实付分摊 |
| P0-B | `pnpm typecheck:backend` + `pnpm verify-monorepo` + `pnpm --filter @apps/backend test`                          | property-based test for `Money.add/sub/mul/div`；`sumMoney` 守恒；`toFen` 整数分断言                                               |
| P1-A | 全 backend gate；新增 e2e 覆盖回调 + Scheduler                                                                  | 模拟微信回调 `SUCCESS/CLOSE/ABNORMAL`；模拟回调缺失下 Scheduler 兜底；重复回调不重复执行账务                                       |
| P1-B | `pnpm typecheck:backend` + admin typecheck                                                                      | `19.90` 用户退款、`0.02` 手续费、结算退款、净额能拆字段对账；`REFUND` scope 本地源只读 `FinRefund`                                 |
| P1-C | `pnpm typecheck:backend` + 结算核心测试                                                                         | 未锁定结算单可刷新；已锁定结算单生成调整单；调整单 delta 可反查退款和原结算单                                                      |
| P1-D | `pnpm typecheck:backend` + `pnpm typecheck:admin` + `pnpm verify:admin-view-types`                              | 门店 `paidGMV / refundAmount / netGMV` 对上平台 `PAYMENT / REFUND`；`REFUND_DEDUCT` 不等同用户退款                                 |
| P1-E | `pnpm typecheck:admin` + `pnpm verify:admin-view-types` + `pnpm typecheck:h5`                                   | Vitest：购物车合计性质测试；profit &lt; 0 边界测试                                                                                 |
| P2   | 对应模块 typecheck + 单测                                                                                       | `0.7 / 0.1 = 7`；`splitByRatio` 守恒；多次部分退款累计不超过订单实付；已结算佣金退款进入 `pendingRecovery`                         |

## 5. 维护与防漂移

### 5.1 文档更新规则

- 任何 PR 修复某个 finding 时，同步在本文档把该 finding 的 `状态` 从"待修复"改成"已修复 @ `<commit-sha>`"。
- 新发现的 finding 必须按既有命名规则编号（R/P/F/B-N+1），并在 §2 末追加，不得插入或重排已编号项。
- 治本方案 1 的 `4.2.1`、`4.3.1` 工具签名为 API 契约；改签名需要在本文档同步并明确为破坏性变更。
- 治本方案 2 的 `FinRefund` / `FinRefundEvent` / `FinSettlementAdjustment`、退款状态机、`REFUND` 对账 scope、渠道金额拆口径是账务契约；字段增删、状态语义变化和对账口径变化必须同步本文档。
- `last_verified` 字段每次重审时更新；超过 3 个月未审视为"可能漂移"。

### 5.2 PR 检查清单

以下清单是金额相关 PR 的完整审查源。`.github/PULL_REQUEST_TEMPLATE.md` 维护精简版入口；若两者语义漂移，以本文档为准，并在同一 PR 同步修正模板。

- [ ] 本 PR 是否新增任何金额相关的加减乘除？若是，是否走 `Money` / Prisma `Decimal`？
- [ ] 本 PR 是否新增 API 出口字段为 number 类型的金额？若是，是否最多 2 位小数？
- [ ] 本 PR 是否调用微信支付 API？若是，金额参数是否经过 `Money.toFen()`？
- [ ] 本 PR 是否新增或修改退款链路？若是，是否写入 `FinRefund` 并只在 `SUCCESS` finalizer 后更新订单、佣金、结算和门店账务？
- [ ] 本 PR 是否读取微信退款返回金额？若是，是否区分 `refund/payer_refund/settlement_refund/refund_fee/discount_refund`，没有把手续费或券退款混成用户退款？
- [ ] 本 PR 是否修改平台对账？若是，是否覆盖 `PAYMENT/REFUND/SETTLEMENT/WITHDRAWAL` 对账 scope 和渠道金额拆口径？
- [ ] 本 PR 是否修改门店财务或结算？若是，是否区分 `paidGMV/refundAmount/netGMV/commissionRefund/platformFeeRefund/settlementAdjustment`？
- [ ] 本 PR 是否在前端做了 `Number(x) + Number(y)` / `reduce((s, v) => s + v.amount, 0)`？若是，是否改用 `Money` / `sumMoney`？
- [ ] 本 PR 是否引入"双向独立 round"？若是，是否用 `splitByRatio` 守恒？
- [ ] 本 PR 是否影响 §2 任何一条 finding 的状态？若是，是否同步更新本文档？

### 5.3 子代理派发硬约束

派发任何金额相关的子任务时（review / refactor / new-feature），子代理 prompt 必须包含：

1. 任务模式、路径类型、是否 high-risk / cross-app。
2. **必读 `docs/governance/MONEY_PRECISION_PROTOCOL.md`**。
3. 不允许引入新的 `Number(x) + Number(y)` 形式的金额运算。
4. 不允许调微信支付 API 时绕过 `Money.toFen()`。
5. 退款相关改动必须以 `FinRefund` 为事实源，不能把微信退款申请受理当作业务退款成功。
6. 平台对账和门店财务必须分别说明 `PAYMENT`、`REFUND`、结算调整和手续费 / 退款手续费口径。
7. 修复某个 finding 时必须更新本文档对应条目的 `状态` 字段。

## 6. 未验证 / 推断（保留风险）

按 AGENTS.md §5 标注以下结论为推断或未直接验证，需要后续覆盖：

- ⚠️ `wechatpay-node-v3` SDK 对"接收到非整数 amount.refund"的具体行为（抛错 vs 不抛错）未直接验证，依赖第三轮推断。
- ⚠️ 用户报告的具体那笔订单的 `payAmount` / 是否用券 / 微信侧 `out_refund_no` 的真实 status 未拉取，根因排序为可能性而非确凿。
- ⚠️ 部分退款双向 round 守恒缺失（B-Y）只在特定 `commission.amount × refundRatio` 组合下复现，property-based test 未跑。
- ⚠️ B-X 积分浮点 bug 必现，但生产 `orderPointsBase` 当前取值未确认；若一直是整数（1 / 10 / 100）则不暴露。
- ⚠️ F-2 / F-3 的"profit &lt; 0 误判"在浮点边界下可触发但概率低，未在测试中复现。
- ⚠️ 前端引入 `decimal.js` 后包体积影响（admin-web 约 +12KB gzipped；miniapp 受微信小程序 2MB 主包限制约束，需要核实小程序构建产物影响）。

## 7. 跨文档链接

- `AGENT_OUTPUT_PROTOCOL.md` §"高风险"：金额相关任务一律高风险，需要按高风险模板停手确认。
- `TEST_SPEC_PROTOCOL.md`：本文档 §4.6 验证矩阵的新增测试遵循该规范产出 spec。
- `ERROR_OBSERVABILITY_STANDARD.md`：R-2/R-3 涉及的退款回调与对账 Scheduler 必须接入错误观测标准。
- `apps/backend/AGENTS.md` §高风险模块：`finance/` / `payment/` 与本文档强绑定。
