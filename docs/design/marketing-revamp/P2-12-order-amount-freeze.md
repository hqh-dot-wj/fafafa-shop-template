# P2-12 omsOrder 金额口径冻结（新订单 discountAmount = 三段之和；旧订单视图层补）

**owner**: 待指派 / 后端
**status**: draft
**last_verified**: 2026-05-15
**related**: [[P0-02-order-outbox]]、[[P1-08-clean-fake-events]]

---

> **跨文档硬约束**：本设计是 [[P0-00-money-precision]] 的**最关键消费方**——全链路 Decimal 规约 + decimalToVo 序列化必须先在本设计实施前就位；`Math.abs(... - ...) >= 0.01` invariant 上线后改为 `Decimal.eq()` 严格相等。幂等键格式遵循 [[P2-14-idempotency-key-convention]]。

## 1. 目标与范围

### 1.1 目标

当前 `oms_order` 的金额字段三组并存且语义不一致：

- `totalAmount`：商品原价合计（preview.totalAmount，[[P0-02 §3]] 中订单创建路径写入）；
- `freightAmount` / `discountAmount`：运费 / "平台直降+商家补贴"（注释 `50-order.prisma:142`：「当前未实现故恒为0」）；
- `couponDiscount` / `pointsDiscount`：券、积分各自抵扣金额；
- `payAmount`：最终应付（= totalAmount + freightAmount - discountAmount - couponDiscount - pointsDiscount，但代码里实际写入 `discount.finalPayAmount`，与三段口径并未对账）。

落差：

1. `discountAmount` 字段名暗示"总优惠"，但**只承载非券非积分的优惠**——运营对账时常误读为"总优惠"。
2. 报表查询 `SUM(discountAmount + couponDiscount + pointsDiscount)` 与实际 `totalAmount - payAmount + freightAmount` 应当相等，但因历史订单中 `discountAmount=0` 而 `payAmount` 直接由业务层写入，对账偶尔偏离。
3. 没有任何字段约束保证 `payAmount = totalAmount + freightAmount - couponDiscount - pointsDiscount - discountAmount` 恒成立。

修复方式：

- **新订单**：写入时强制 `discountAmount = couponDiscount + pointsDiscount + 其他直降`（三段之和）；保留 `couponDiscount` / `pointsDiscount` 明细字段（不删，便于报表细分）。
- **旧订单**：不回填数据库，在**视图层**（API 返回前）补算 `discountAmount = couponDiscount + pointsDiscount + (legacy discountAmount)`，确保前端展示一致。
- **新加 invariant 校验**：`payAmount = totalAmount + freightAmount - discountAmount`（不再扣 coupon/points，因 discountAmount 已含）；订单创建时 assert。

### 1.2 范围

- ✅ `order-creation-application.service.ts:106-115` 写订单时，`discountAmount = couponDiscount + pointsDiscount + 其他直降`。
- ✅ 新增订单 invariant assert：`Math.abs(payAmount - (totalAmount + freightAmount - discountAmount)) < 0.01`。
- ✅ 视图层（OrderVo 构造方法）补算逻辑：若是旧订单（按 `createTime < CUTOFF` 或 `discountAmount = 0 && (couponDiscount > 0 || pointsDiscount > 0)`）则补算。
- ✅ admin 端报表 SQL 改用统一口径。
- ❌ 不动 `couponDiscount` / `pointsDiscount` 字段语义。
- ❌ 不做历史数据迁移（保留旧 discountAmount=0 行不动）。

### 1.3 DoD

1. 新订单创建后，`discountAmount = couponDiscount + pointsDiscount` 在所有路径恒等。
2. 视图层把旧订单的 `discountAmount` 在 VO 上覆盖为补算值（数据库行不变）。
3. admin "订单详情"页面"总优惠"字段口径统一；运营对账 SQL 简化为 `SUM(discountAmount)`。
4. 集成测试覆盖：旧订单返回与新订单返回的 `discountAmount` 字段在 VO 上一致。

---

## 2. 现状取证

### 2.1 `oms_order` 字段（50-order.prisma:130-206）

```prisma
totalAmount    Decimal  @db.Decimal(10, 2)   // 商品原价合计
freightAmount  Decimal  @default(0)
discountAmount Decimal  @default(0)          // 平台直降/商家补贴等非券非积分折扣，当前未实现故恒为0
payAmount      Decimal

userCouponId   String?
couponDiscount Decimal  @default(0)          // 券抵扣

pointsUsed     Int      @default(0)
pointsDiscount Decimal  @default(0)          // 积分抵扣
```

### 2.2 订单创建写入

```ts
// order-creation-application.service.ts:111-115
totalAmount: preview.totalAmount,
freightAmount: preview.freightAmount,
discountAmount: preview.discountAmount,       // ← preview 当前给的是 0
payAmount: params.finalPayAmount,             // ← 业务层算出来的最终金额
```

```ts
// order-checkout.service.ts:172
// 平台直降/商家补贴等折扣预留；优惠券抵扣在 OrderCreationApplicationService 下单时计算，积分抵扣同理
const discountAmount = 0;
const payAmount = totalAmount.toNumber() + freightAmount - discountAmount;
```

Preview 阶段还没扣券/积分，结果在订单创建时 `discountAmount` 仍 0；券/积分抵扣的总额只能从 `couponDiscount + pointsDiscount` 推。

### 2.3 报表 / VO 路径

`order.vo.ts` 直接返回各字段，admin 列表页 / 详情页"总优惠"目前是前端用 `couponDiscount + pointsDiscount` 拼接（grep `couponDiscount + pointsDiscount` 在 admin-web 应能命中）。新增 `discountAmount = 三段` 后，前端拼接逻辑可删（VO 层负责）。

---

## 3. 设计方案

### 3.1 新订单：discountAmount = 三段之和

```ts
// order-creation-application.service.ts createOrderInTransaction 内
const totalDiscount = couponDiscount + pointsDiscount + preview.discountAmount; // preview.discountAmount 当前=0，预留
const order = await this.prisma.omsOrder.create({
  data: {
    totalAmount: preview.totalAmount,
    freightAmount: preview.freightAmount,
    discountAmount: totalDiscount, // ← 改：三段之和
    payAmount: params.finalPayAmount,
    couponDiscount,
    pointsDiscount,
    // ...
  },
});

// invariant assert（开发期 fail-fast）
const expectedPay = preview.totalAmount + preview.freightAmount - totalDiscount;
if (Math.abs(params.finalPayAmount - expectedPay) >= 0.01) {
  this.logger.error({
    msg: 'Order amount invariant broken',
    totalAmount: preview.totalAmount,
    freightAmount: preview.freightAmount,
    discountAmount: totalDiscount,
    finalPayAmount: params.finalPayAmount,
    expectedPay,
  });
  throw new BusinessException('订单金额计算异常，请联系客服');
}
```

### 3.2 视图层补算（旧订单兼容）

```ts
// order.service.ts buildOrderVo / order-detail.service.ts 等 VO 构造点

/**
 * 口径冻结分界时间 = D3（写订单改 discountAmount=三段之和）部署日。
 * 实施期把 D3 实际部署的 UTC 时间填这里；之前的订单走 legacy 补算路径。
 * 不能仅靠"discountAmount=0 + coupon/points>0"的金额特征判断 —— 新订单若因 bug 写成
 * discountAmount=0 时会被误识别为 legacy，被 projector 覆盖。时间分界是 single source of truth。
 */
const AMOUNT_FREEZE_CUTOFF = new Date('2026-XX-XXT00:00:00Z');

function projectAmounts(order: OmsOrder): OrderAmountVo {
  // 严格按 createTime 分界：D3 之后的订单视为"新口径"，dbDiscount 直接返回；
  // D3 之前的订单走 legacy 补算（dbDiscount 多数为 0，coupon/points 才是真实抵扣）。
  const dbDiscount = decimalToVo(order.discountAmount) ?? 0; // 参见 [[P0-00-money-precision]]
  const couponDiscount = decimalToVo(order.couponDiscount) ?? 0;
  const pointsDiscount = decimalToVo(order.pointsDiscount) ?? 0;
  const isLegacy = order.createTime < AMOUNT_FREEZE_CUTOFF;
  const projected = isLegacy ? new Decimal(couponDiscount).add(pointsDiscount).toNumber() : dbDiscount;
  return {
    totalAmount: Number(order.totalAmount),
    freightAmount: Number(order.freightAmount),
    discountAmount: projected,
    couponDiscount,
    pointsDiscount,
    payAmount: Number(order.payAmount),
  };
}
```

`OrderAmountVo` 在 `apps/backend/src/module/client/order/vo/order.vo.ts` / admin 同等 VO 处统一使用 projector。

### 3.3 报表 SQL 简化

```sql
-- 之前：SUM(coupon_discount) + SUM(points_discount) + SUM(discount_amount)
-- 新口径：
SELECT
  SUM(discount_amount) AS total_discount,
  SUM(coupon_discount) AS coupon_discount,
  SUM(points_discount) AS points_discount
FROM oms_order
WHERE create_time >= $CUTOFF;
```

对于旧订单的 SUM 需要 `SUM(GREATEST(discount_amount, coupon_discount + points_discount))`（防止旧订单 discount_amount=0 时低估）。报表 SQL 不在本 PR 范围，**留 TODO** 给运营 BI 团队。

### 3.4 invariant 监控

新增一条 Grafana panel：`oms_order_amount_drift = count(*) where abs(pay_amount - (total_amount + freight_amount - discount_amount)) > 0.01 AND create_time >= '<cutoff>'`，应恒为 0。

---

## 4. 决策依据

### 4.1 Q1 数据回填 vs 视图补算

| 选项                      | 优             | 劣                                             | 选择 |
| ------------------------- | -------------- | ---------------------------------------------- | ---- |
| **A. 不回填，视图层补算** | 0 写库；可回滚 | VO 层永远要 if (isLegacy)                      | ✅   |
| B. 一次性 UPDATE 历史订单 | 数据干净       | 已发出账单与历史报表对不齐；运营审计要重新解释 |      |

### 4.2 Q2 `discountAmount` 字段语义重定义 vs 改名

| 选项                                                             | 优                | 劣                         | 选择 |
| ---------------------------------------------------------------- | ----------------- | -------------------------- | ---- |
| **A. 重定义，不改名**                                            | 0 schema/契约改动 | 字段名歧义短期内由注释解释 | ✅   |
| B. 改名 `totalDiscountAmount` + 新字段 `platformSubsidyDiscount` | 语义清晰          | 全仓 / 前端契约大改        |      |

### 4.3 Q3 invariant 校验失败行为

| 选项                    | 优       | 劣                     | 选择 |
| ----------------------- | -------- | ---------------------- | ---- |
| **A. throw + 拒绝下单** | 强一致   | 偶发误判会让用户买不了 | ✅   |
| B. 仅 log warn          | 用户无感 | 数据脏永远发现不了     |      |

---

## 5. 迁移与回滚

### 5.1 部署顺序

1. **D1**：VO 层 projector 上线（兼容旧订单）。
2. **D2**：订单创建路径改写 `discountAmount = 三段` + invariant assert。
3. **D3**：admin-web 删前端拼接代码，改读 VO 的 `discountAmount`。

### 5.2 回滚

D2 git revert 即可；D1/D3 安全。

---

## 6. 验证矩阵

| 层   | 用例                                                                              | 工具      |
| ---- | --------------------------------------------------------------------------------- | --------- |
| Spec | 新订单 discountAmount == couponDiscount + pointsDiscount + preview.discountAmount | unit      |
| Spec | invariant break → BusinessException                                               | unit      |
| Spec | 旧订单 VO projector：dbDiscount=0 + couponDiscount=5 → projected=5                | unit      |
| Spec | 新订单 VO projector：直接返回 dbDiscount                                          | unit      |
| 集成 | E2E：下单（用券+用积分）→ DB discountAmount 三段之和；VO 一致                     | supertest |
| 监控 | drift count 24h 内 = 0                                                            | Grafana   |

---

## 7. 风险与未决

### 7.1 TODO

1. **TODO-1**：admin-web 中"总优惠"展示位是否全部走同一 VO？grep `couponDiscount + pointsDiscount` 在 admin-web。
2. **TODO-2**：报表 BI 团队的 SQL 更新单独跟进；本 PR 写一个 README 段落给数据组。
3. **TODO-3**：是否要给 `discountAmount` 添加 DB CHECK CONSTRAINT（`discount_amount >= coupon_discount + points_discount`）？Postgres 支持，但旧数据会全部不满足，需要先 NOT VALID 加再 VALIDATE；本设计暂不做。

### 7.2 风险

| 风险                                                                 | 等级         | 缓解                                                                      |
| -------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------- |
| 视图层 isLegacy 判断误把新订单识别成 legacy（dbDiscount=0 是合法值） | 低（已修正） | 改用 `order.createTime < AMOUNT_FREEZE_CUTOFF` 时间分界，不再依赖金额特征 |
| invariant 误判拒绝下单                                               | 中           | staging 跑 1 周观察 drift；assert 改为 warn-only 灰度 1 周                |
| 报表对账暂时双口径                                                   | 低           | TODO-2 跟进                                                               |

---

## 8. 实施清单

### 8.1 backend

- [ ] `order/services/order-creation-application.service.ts`：写订单时改 discountAmount + assert。
- [ ] `order/vo/order.vo.ts` 新增 `projectAmounts`；list/detail/admin VO 全部经过。
- [ ] `store/order/store-order.service.ts` 等其它构造 VO 的位置同步。

### 8.2 admin-web

- [ ] 订单详情 / 列表中"总优惠"字段改读 VO 的 `discountAmount`。

### 8.3 验证

- [ ] `pnpm typecheck:backend && pnpm test:backend -- order`
- [ ] `pnpm check:slice`
- [ ] `pnpm verify:admin-view-types`
- [ ] PR 前完整 verify。

### 8.4 PR 标题

`feat(backend): 订单金额口径冻结，discountAmount = 三段之和 + 视图补算旧订单`
