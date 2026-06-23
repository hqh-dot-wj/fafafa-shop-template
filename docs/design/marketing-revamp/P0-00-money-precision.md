# P0-00 金额精度规约（全链路 Decimal）

**owner**: 待指派 / 后端 + admin-web
**status**: draft（待评审 → 待实施）
**last_verified**: 2026-05-15
**related**: P0-02 / P1-05 / P2-12（这三份是金额泄漏最严重的地方）

---

## 1. 目标与范围

### 1.1 目标

确立营销改造（marketing-revamp）系列设计的金额表示与运算硬规约，消除当前散落在各份设计稿与代码里的"用 JS number 表达金额"隐患：

- `P2-12 §3.1` invariant 写 `Math.abs(payAmount - expected) >= 0.01`——用 1 分阈值掩盖 IEEE-754 浮点误差，是承认问题不是修问题。
- `P0-02` outbox `OrderPaidDomainEvent.payAmount: number`——payment.service 把 `Decimal.toNumber()` 后塞进 payload，worker 端再用 number 写回 `fin_commission.amount`（Decimal 列），产生"99.999 → 99.99"的累积偏差。
- `P1-05` `PolicyEvaluator.effect.discountValue: number`——5 类 POLICY 活动结算金额走 JS number；FULL_REDUCTION 减 30.05 元、PROMOTION_PRICE 固定价 99.99 元都可能算成 ...4999999。
- `P0-04` 退款冲销不涉及金额（OK），但 admin-web 报表 VO 接受 `Decimal | number` 混合输入也未受约束。

### 1.2 范围

- ✅ 写出"金额字段"白名单（命名后缀规约）；写出哪一层允许什么类型。
- ✅ 写出运算硬规约：Decimal 入 / Decimal 出，仅 VO 序列化点允许 toNumber。
- ✅ 给 backend 加 ESLint 规则雏形（lint 真实现留 TODO），禁止业务模块对金额字段做 JS 加减乘除。
- ✅ 给 admin-web / miniapp-client 前端的金额展示口径（仅展示用 number，不参与任何运算）。
- ✅ 所有上游设计文档（P0-02 / P1-05 / P2-12 等）在自己实施 PR 中遵循本规约。
- ❌ 不替换 `@prisma/client/runtime/library` 的 Decimal（沿用 Prisma 自带）。
- ❌ 不引入 bignumber.js / decimal.js 三方库（Prisma Decimal 已基于 decimal.js，二次包装是多余）。
- ❌ 不重写积分（Int）字段——积分是整数，不在 Decimal 规约范围。

### 1.3 DoD

1. backend `apps/backend/src/module/**/*.service.ts` 内不存在"`*Amount` / `*Discount` / `*Price` / `*Fee` 字段做 JS `+ - * /` 运算"的可执行代码（用 lint + grep 兜底）。
2. 所有跨服务方法签名传金额参数时类型为 `Decimal`（含 outbox payload、dispatcher payload、handler 接口入参）。
3. VO（返回前端的 DTO 序列化点）允许 `Decimal.toNumber()`，但**只在一个位置**做转换，不允许中间层"先转 number 再算再转回 Decimal"。
4. `apps/admin-web` / `apps/miniapp-client` 收到 VO 内 number 后**仅用于展示**，不再参与累加（前端要算总价交后端 API）。
5. 已实施的 outbox / policy-evaluator / order-creation 在 review 时按本规约 hard-block 任何 number 金额传参。

---

## 2. 现状取证

### 2.1 Prisma Decimal 现状

`@prisma/client/runtime/library` 导出 `Decimal`，底层是 decimal.js，精度 28-29 位，营销/财务 5-10 位已远超需求。各表对应字段：

```prisma
// 50-order.prisma
totalAmount    Decimal @db.Decimal(10, 2)
freightAmount  Decimal @default(0) @db.Decimal(10, 2)
discountAmount Decimal @default(0) @db.Decimal(10, 2)
payAmount      Decimal @db.Decimal(10, 2)
couponDiscount Decimal @default(0) @db.Decimal(10, 2)
pointsDiscount Decimal @default(0) @db.Decimal(10, 2)

// 60-finance.prisma
fin_commission.amount             Decimal @db.Decimal(10, 2)
fin_settlement_bill.totalAmount   Decimal @db.Decimal(10, 2)
fin_wallet.balance                Decimal @db.Decimal(10, 2)

// 80-marketing.prisma
mkt_coupon_template.discountAmount   Decimal? @db.Decimal(10, 2)
mkt_user_coupon.discountAmount       Decimal? @db.Decimal(10, 2)
```

Prisma 读出来全是 Decimal 实例（`.toNumber()` / `.add()` / `.mul()` API）。**问题在中间层**：很多 service 把 Decimal 强转 number 做算术后再写回，精度从此丢失。

### 2.2 真实泄漏点

```ts
// apps/backend/src/module/client/order/services/order-checkout.service.ts:174
const payAmount = totalAmount.toNumber() + freightAmount - discountAmount;
//                              ^^^^^^^^ Decimal 转 number
//                                       ^^^^^^^^^^^^^^ ^^^^^^^^^^^^^^ number 加减
```

```ts
// apps/backend/src/module/marketing/integration/integration.service.ts:73
const originalAmount = dto.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
//                                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                          item.price 是 number（从 DTO），但参与累加得到 number 总价
```

```ts
// apps/backend/src/module/client/order/services/order-creation-application.service.ts:73
await this.marketingPort.calculateOrderDiscount(memberId, dto, preview);
// 返回 { couponDiscount: number, pointsDiscount: number, finalPayAmount: number }
// 整段 marketingPort 接口用 number 表达金额
```

### 2.3 现有金额运算的"隐患矩阵"

| 路径                   | 输入                               | 运算                               | 输出                   | 隐患                |
| ---------------------- | ---------------------------------- | ---------------------------------- | ---------------------- | ------------------- |
| order-checkout preview | Decimal sku.price                  | number `* quantity + freight`      | number payAmount       | 高                  |
| order discount 计算    | number coupon/points               | number `originalAmount - discount` | number finalPay        | 高                  |
| order creation 写入    | number finalPayAmount              | 直写 DB Decimal 列                 | DB Decimal             | 中（Prisma 自动转） |
| commission 计算        | DB Decimal payAmount               | ？（commission service 未深入审）  | DB Decimal commission  | 待查                |
| outbox payload         | DB Decimal payAmount               | Decimal.toNumber()                 | number 进 outbox json  | 高（worker 端再用） |
| coupon discount        | DB Decimal template.discountAmount | usageService 算抵扣                | number coupon discount | 高                  |
| points discount        | Int pointsUsed                     | 比率换算                           | number pointsDiscount  | 中                  |

---

## 3. 规约方案

### 3.1 类型规约（命名后缀 + 强制类型）

任何字段命名以下后缀都视为"金额字段"，必须 Decimal：

```
*Amount / *Price / *Discount / *Fee / *Commission / *Balance / *Subsidy / *Tax / *Refund
*amount / *price / ... 同上（snake_case 与 camelCase 都算）
```

例外：

- 名字含 `pointsUsed / pointsEarned` 等"积分"概念的，类型 `Int`，不在本规约范围。
- 名字含 `quantity / count / num / size` 的，类型 `Int`，不在本规约。
- 名字含 `*Ratio / *Rate / *Percent` 的（如 `commissionRate`），仍是 Decimal（比例精度同样要求）。

### 3.2 接口签名规约

| 层                             | 金额字段类型                   | 说明                                                                                       |
| ------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------ |
| Prisma model                   | `Decimal`                      | DB 表已固定                                                                                |
| Repository 出参                | `Decimal`                      | 不要 toNumber 后返回                                                                       |
| Service / Port / Handler 内部  | `Decimal`                      | 算术必须用 `.add()/.sub()/.mul()/.div()`                                                   |
| Service 之间方法签名           | `Decimal`                      | 包括 marketingPort / inventoryPort / OrderDomainEventPublisher / dispatcher.dispatch 等    |
| **Outbox payload JSON**        | `string`（Decimal.toString()） | 经过 JSON 持久化，序列化为 string 保留全精度；worker 端 `new Decimal(payload.amount)` 还原 |
| **Event payload（in-memory）** | `Decimal`                      | 直接传 Decimal 实例                                                                        |
| VO（返回前端）                 | `number`（最后一步 toNumber）  | 仅 1 处转换；展示用                                                                        |
| DTO（前端传后端）              | `string \| number`             | 后端入口 `new Decimal(input)` 立即包裹                                                     |
| Admin-web / Miniapp 内部       | `number`                       | 仅展示；任何前端累加必须改为后端 API                                                       |

### 3.3 outbox / 跨进程 payload 的金额表达

```ts
// ❌ 错：number 序列化进 JSON 有精度损失（IEEE-754）
{
  payAmount: 99.999;
} // JSON.stringify 出来正确，但运算时丢精度

// ✅ 对：用 string 序列化
{
  payAmount: '99.99';
} // worker 端 new Decimal(payload.payAmount) 还原
```

具体改 P0-02 §3.1 `OrderPaidDomainEvent`：

```ts
export interface OrderPaidDomainEvent {
  type: OrderDomainEventType.PAID;
  orderId: string;
  orderSn: string;
  tenantId: string;
  memberId: string;
  payAmount: string; // ← 改为 string；构造时 .toString()，消费时 new Decimal(...)
  transactionId: string;
  paidAt: Date;
}
```

并加一对工具函数：

```ts
// apps/backend/src/common/decimal/decimal-codec.ts
export function decimalToWire(d: Decimal): string {
  return d.toFixed();
}
export function wireToDecimal(s: string): Decimal {
  return new Decimal(s);
}
```

dispatcher 写 outbox 时 `payAmount: decimalToWire(order.payAmount)`；worker 端读出 `const payAmount = wireToDecimal(job.data.payAmount);`。

### 3.4 VO 序列化（唯一允许 toNumber 的位置）

```ts
// apps/backend/src/common/decimal/decimal-vo.ts
export function decimalToVo(d: Decimal | null | undefined): number | null {
  if (d == null) return null;
  return Number(d.toFixed(2)); // VO 层固定 2 位精度
}
```

所有 VO 构造点统一用 `decimalToVo`，**禁止裸调 `.toNumber()`**。Grep `\.toNumber\(\)` 应仅在 `decimal-vo.ts` / `decimal-codec.ts` 命中。

### 3.5 PolicyEvaluator effect 修正（P1-05 配套）

```ts
// 原 P1-05 §3.2
interface CampaignPolicy {
  effect: { discountType: 'AMOUNT' | 'PERCENT' | 'FIXED_PRICE'; discountValue: number; ... };
}

// 改为
interface CampaignPolicy {
  effect: {
    discountType: 'AMOUNT' | 'PERCENT' | 'FIXED_PRICE';
    /** discountValue 在 policyJson 内以 string 持久化（如 "30.05"），运行时 new Decimal */
    discountValue: string;
    ...
  };
}

// PolicyEvaluator.evaluate 内部
const value = new Decimal(policy.effect.discountValue);
const computedPrice = sku.price.sub(value);   // Decimal 运算
```

JSON 列里以 string 存放金额是 industry-standard pattern（Stripe API、PayPal API 也都这么做）。

### 3.6 ESLint 规则雏形（实施期落地）

需要禁止"业务模块内对带金额后缀的 number 做算术"。Lint 实现思路（不强求第一版完成）：

```js
// eslint-plugin-money-precision/no-number-money.js
{
  meta: { type: 'problem' },
  create(context) {
    return {
      BinaryExpression(node) {
        if (!['+','-','*','/'].includes(node.operator)) return;
        const left = getName(node.left);
        const right = getName(node.right);
        if (isMoneyName(left) || isMoneyName(right)) {
          // 排除 .add() .sub() .mul() .div()
          context.report({ node, message: `金额字段 ${left}/${right} 必须用 Decimal 运算，参见 P0-00。` });
        }
      },
    };
  },
};
```

第一版可以先用 `pnpm verify:scripts` 加一个 grep 检查替代：

```bash
# scripts/checks/check-money-precision.mjs（建议路径）
# 简单 regex 找 `(amount|price|discount|fee).*\s*[+\-*/]\s*` 在 backend service 内的使用
```

### 3.7 漸進改造路径

不立即一刀切改所有调用方，按改造 PR 推进，每份上游 PR 在 review 时 hard-block：

| 上游 PR | 涉及金额改 Decimal 的范围                                                                                                  |
| ------- | -------------------------------------------------------------------------------------------------------------------------- |
| P0-02   | OrderXxxDomainEvent payload `payAmount/refundPointsAmount` 改 string；outbox writer / dispatcher / worker 端 wireToDecimal |
| P1-05   | PolicyEvaluator effect/discountValue 改 string；computedPrice 全程 Decimal                                                 |
| P2-12   | order-checkout / order-creation 路径全部 Decimal；移除 `Math.abs(... - ...) >= 0.01` invariant                             |
| P1-10   | 积分本来就 Int，无影响；transaction balance Int 也无影响                                                                   |
| P0-04   | 不涉及金额（sid orderCount 是 Int）                                                                                        |

### 3.8 前端约束

- admin-web 收到 VO 的 number 字段后，不在 vue computed 内做累加（如"列表合计"）；改调后端 summary API。
- miniapp-client 同上。
- 现有"前端 reduce 求和"代码点（grep `\.reduce.*[+\-]` 在 amount 周边）作为 cleanup TODO，本设计不强行清。

---

## 4. 决策依据

### 4.1 Q1 引入 bignumber.js / decimal.js vs 复用 Prisma Decimal

| 选项                       | 优                     | 劣                                          | 选择 |
| -------------------------- | ---------------------- | ------------------------------------------- | ---- |
| **A. 复用 Prisma Decimal** | 0 依赖；与 DB 类型一致 | 业务代码只能用 `.add()` API                 | ✅   |
| B. 引入 decimal.js         | 与 Prisma 底层同一库   | 重复依赖；引入版本不一致风险                |      |
| C. number + 单位放大（分） | 简单；常见做法         | 与 Prisma 表 schema 不匹配；改 DB cost 巨大 |      |

### 4.2 Q2 outbox JSON 金额表达：string vs number

| 选项                                                 | 优                                  | 劣                                | 选择 |
| ---------------------------------------------------- | ----------------------------------- | --------------------------------- | ---- |
| **A. string**                                        | 全精度无损；Stripe / PayPal pattern | 调用方多一步转换                  | ✅   |
| B. number                                            | 直接                                | JSON 反序列化精度丢失（IEEE-754） |      |
| C. Decimal 序列化对象 `{value: "...", precision: 2}` | 完整                                | 体积大；过度工程                  |      |

### 4.3 Q3 lint 第一版强度

| 选项                         | 优       | 劣                        | 选择 |
| ---------------------------- | -------- | ------------------------- | ---- |
| **A. grep 检查（脚本兜底）** | 快上线   | 误报多；不在 IDE 即时反馈 | ✅   |
| B. ESLint plugin 完整版      | IDE 即时 | 写 AST 规则成本高         | 二期 |

### 4.4 Q4 VO toNumber 精度

| 选项                           | 优                         | 劣                                     | 选择 |
| ------------------------------ | -------------------------- | -------------------------------------- | ---- |
| **A. 2 位（`toFixed(2)`）**    | 与 DB `Decimal(10,2)` 对齐 | 比例类（rate）需要更高位 → 单独 helper | ✅   |
| B. 不固定精度（`.toNumber()`） | 灵活                       | 偶发尾数显示 `99.99000000000001`       |      |

`*Rate / *Percent` 用 `decimalRateToVo(d) → Number(d.toFixed(4))`。

---

## 5. 迁移与回滚

### 5.1 部署顺序

1. **D1**：引入 `apps/backend/src/common/decimal/{decimal-codec,decimal-vo}.ts` + 单测；不改业务。
2. **D2**：grep 脚本 `scripts/checks/check-money-precision.mjs` 加入 `pnpm check:slice`，warn-only。
3. **D3**：随上游 PR（P0-02 / P1-05 / P2-12）逐个推进金额改 Decimal。
4. **D4**：grep 脚本警告清零后升级为 fail。
5. **D5**：ESLint plugin 二期落地。

### 5.2 回滚

D1-D2 安全；D3-D4 按上游 PR 各自回滚；D5 独立。

---

## 6. 验证矩阵

| 层   | 用例                                                                                                                         | 工具      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | --------- |
| 静态 | grep `\.toNumber\(\)` in `apps/backend/src/module/**/*.service.ts` 只在 `decimal-vo.ts/decimal-codec.ts` 命中                | rg        |
| 静态 | grep `amount.*[\+\-\*\/].*\d` / `discount.*[\+\-\*\/]` 在 service 文件 0 命中                                                | rg        |
| Spec | decimalToWire(new Decimal('99.99')) → "99.99" ; wireToDecimal("99.99").equals(new Decimal('99.99'))                          | vitest    |
| Spec | decimalToVo(new Decimal('99.999')) → 100.00（toFixed(2) 四舍五入）<br/>decimalToVo(new Decimal('99.994')) → 99.99            | vitest    |
| Spec | PolicyEvaluator.evaluate 给定 discountValue="30.05" 返回 Decimal effect                                                      | vitest    |
| 集成 | E2E：下单 → outbox payload 内 payAmount 是 string → worker 端 commission 写入与订单 payAmount 严格相等（Decimal.equals）     | supertest |
| 监控 | drift query：`SELECT COUNT(*) FROM oms_order WHERE pay_amount != total_amount + freight_amount - discount_amount` 24h 内 = 0 | Grafana   |

---

## 7. 风险与未决

### 7.1 TODO（留给实施者）

1. **TODO-1**：commission.service 内是否真有 number 金额运算？P2-13 没深入审，**实施期 grep `apps/backend/src/module/finance` 内 number 金额运算**。
2. **TODO-2**：admin-web / miniapp-client 前端"合计行"如何过渡？短期保留前端累加（已损精度但仅展示），长期改后端 summary API。
3. **TODO-3**：lint 规则上线节奏——warn 期多长后升 fail？建议 4 周静默期。
4. **TODO-4**：`policyJson` 内 string 形式的金额在 admin 编辑器中如何展示？schema-form 自定义 `MoneyInput` widget，UI 输入数字，存档前 `String(value)`。

### 7.2 已知风险

| 风险                                                                               | 等级 | 缓解                                                                                                           |
| ---------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------- |
| `JSON.parse` 后端读 outbox payload 时 string 形式金额未还原成 Decimal 直接传到下游 | 中   | wireToDecimal helper + worker handler 入口统一封装                                                             |
| 旧 outbox payload（已发布）格式不一致                                              | 低   | P0-00 是新加规约，旧 outbox 数据由 P0-02 上线时一次性切换；ramp 期同时支持 number/string 由 wireToDecimal 兼容 |
| ESLint 误报 / 漏报                                                                 | 中   | grep 兜底；review 守住                                                                                         |
| 前端展示尾数偏差（如 `99.99000000001`）                                            | 低   | `decimalToVo` toFixed(2) 强制 2 位；前端不二次累加                                                             |
| commission / settlement 等已存在的 Decimal 链路被本规约改坏                        | 低   | grep 现有 finance service 已用 `.add() .sub()` 的处保留；本规约只补未规范的地方                                |

### 7.3 不在本规约范围

- 货币多币种（CNY/USD）：当前仓库单一 CNY，本规约不涉及。
- 财务报表的舍入规则（向上/向下/银行家舍入）：留 P2 阶段单独设计。
- 跨服务（如调用第三方支付）的金额单位（元/分）：当前微信支付路径已用分作整数，与本规约 Decimal 不冲突。

---

## 8. 实施清单

### 8.1 backend

- [ ] `apps/backend/src/common/decimal/decimal-codec.ts` 新增（decimalToWire / wireToDecimal）。
- [ ] `apps/backend/src/common/decimal/decimal-vo.ts` 新增（decimalToVo / decimalRateToVo）。
- [ ] 单测覆盖 4 个 helper。
- [ ] 在 `apps/backend/AGENTS.md` 加一节"金额精度规约"引用本文档。
- [ ] `scripts/checks/check-money-precision.mjs` 新增（grep 兜底）。
- [ ] `pnpm check:slice` 接入新检查（warn-only）。

### 8.2 上游 PR 配套改造（不属于本 PR 范围，但本规约强制要求）

- [ ] P0-02 `OrderXxxDomainEvent.payAmount/refundPointsAmount` 改 string；outbox writer/dispatcher 用 wireToDecimal。
- [ ] P1-05 `PolicyEvaluator.effect.discountValue` 改 string；evaluator 内 Decimal 运算。
- [ ] P2-12 order-checkout / order-creation 路径全 Decimal；删 `Math.abs(... - ...) >= 0.01`。
- [ ] 14 份设计文档顶部统一加："**金额字段全链路 Decimal，参见 [[P0-00-money-precision]]**"。

### 8.3 验证

- [ ] `pnpm typecheck:backend && pnpm lint:backend`
- [ ] `pnpm test:backend -- decimal`
- [ ] `pnpm check:slice`
- [ ] PR 前完整 verify。

### 8.4 PR 标题

`chore(backend): 金额精度规约（全链路 Decimal）+ grep 兜底检查`
