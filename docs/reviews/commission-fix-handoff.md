# 分佣修复交接文档

## 已完成（本会话）

| #   | 问题                                         | 文件                                                                                  | 状态 |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------- | ---- |
| 7   | 退款竞态：计算前检查订单状态                 | `order-query.port.ts` / `order-query.adapter.ts` / `commission-calculator.service.ts` | ✅   |
| 1   | C2 全拿丢佣：`hasL2` 验证 parent 是否真为 C2 | `l1-calculator.service.ts`                                                            | ✅   |
| 2   | `rateSnapshot` C2 全拿失真：合并 L1+L2 费率  | `l1-calculator.service.ts`                                                            | ✅   |
| 6   | 补偿扫描：防队列丢失漏佣                     | `commission-compensation.scheduler.ts` / `finance.module.ts`                          | ✅   |
| 3   | 日限额原子化：事务 CAS 替换两步操作          | `commission-validator.service.ts`                                                     | ✅   |

---

## 待完成（下次会话）

### 问题 4：`totalIncome` 与流水对账不一致

**根因**：`settlement.scheduler.ts` `settleOne` 方法在存在 `pendingRecovery` 时，
`totalIncome` 累加原始佣金金额，但流水只记录扣除抵扣后的净额，导致对账公式
`totalIncome - sum(finTransaction.amount)` 不等于 0。

**实现方案**：在 `settleOne` 的事务内把一次结算拆成两条流水：

```ts
// settlement.scheduler.ts settleOne() 内

// 流水 1：佣金到账（净额，可为 0）
if (actualIncome.gt(0)) {
  await tx.finTransaction.create({
    data: {
      walletId: wallet.id,
      tenantId: commission.tenantId,
      type: 'COMMISSION_IN',
      amount: actualIncome,
      balanceAfter: updatedWallet.balance,
      relatedId: commission.orderId,
      remark: `订单${commission.orderId}佣金结算`,
    },
  });
}

// 流水 2：欠款回收（若有）
if (recoveryAmount.gt(0)) {
  await tx.finTransaction.create({
    data: {
      walletId: wallet.id,
      tenantId: commission.tenantId,
      type: 'DEBT_RECOVERY', // 需在 TransType enum 新增此值
      amount: recoveryAmount.negated(),
      balanceAfter: updatedWallet.balance,
      relatedId: commission.orderId,
      remark: `订单${commission.orderId}佣金结算（抵扣历史欠款）`,
    },
  });
}

// totalIncome 语义保持"应得总收益"（含抵扣前），符合业务展示需求
// 对账公式改为：totalIncome - totalRecovered = sum(COMMISSION_IN 流水)
```

**需要的 schema 变更**：

```prisma
// prisma/models/60-finance-payment.prisma
enum TransType {
  COMMISSION_IN
  WITHDRAW_OUT
  REFUND_DEDUCT
  DEBT_RECOVERY   // 新增：欠款抵扣回收
}
```

**历史数据迁移脚本**（需在 migration 后单独执行）：

- 找出所有 `totalIncome` 与 `sum(COMMISSION_IN 流水)` 不一致的钱包记录
- 补写 `DEBT_RECOVERY` 流水，金额 = `totalIncome - sum(COMMISSION_IN)`
- 验证脚本：`scripts/migrations/fix-wallet-income-mismatch.mjs`（待写）

**影响范围**：

- `settlement.scheduler.ts` `settleOne()`
- `TransType` enum（schema migration）
- 前端"收益明细"需过滤或展示 `DEBT_RECOVERY` 类型流水
- 下游 BI 管道需感知新的流水类型

**风险提示**：

- schema migration 需停机或在线迁移，上线前在 staging 验证对账公式
- 历史数据补写脚本需幂等（重复执行结果一致）

---

### 问题 5：部分退款 100% 取消冻结佣金

**根因**：`cancelCommissionsForPartialRefund` 对冻结佣金直接改为 `CANCELLED`，
不考虑退款比例，导致 10% 退款消灭 100% 冻结佣金。注释承认
"当前数据模型没有部分保留佣金的独立状态"。

**实现方案（商品粒度拆分，长期方案）**：

#### Step 1：Schema 变更

```prisma
// 佣金唯一键从 (orderId, beneficiaryId, level)
// 改为 (orderId, orderItemId, beneficiaryId, level)
model FinCommission {
  // ...
  orderItemId Int?  // 已有字段，升为必填（历史数据填 0 作默认）
  // @@unique([orderId, beneficiaryId, level])  ← 删除
  @@unique([orderId, orderItemId, beneficiaryId, level])  // 新增
}
```

#### Step 2：计算写入改为按商品粒度

```ts
// commission-calculator.service.ts
// 循环 orderItems，每个 item 独立写一条 FinCommission
// upsert where 改为 { orderId_orderItemId_beneficiaryId_level: {...} }
```

#### Step 3：退款取消改为按比例

```ts
// commission-settler.service.ts cancelSinglePartialRefundCommission
// FROZEN 佣金：按 refundRatio 比例 CANCEL，剩余保留 FROZEN（需新增 PARTIAL_CANCELLED 状态，或直接按比例缩减 amount）
```

**推荐的最小可行方案（短期，不改 schema）**：

- 对 FROZEN 佣金，按 `refundRatio` 缩减 `amount`，状态改为 `PARTIALLY_REFUNDED`（新增枚举值）
- 结算调度按实际 amount 结算，金额已经是折后值

**影响范围**：

- `FinCommission` schema + migration
- `CommissionStatus` enum 新增状态
- `commission-calculator.service.ts` 写入逻辑全改
- `commission-settler.service.ts` 退款取消逻辑
- 所有 commission 相关单测和 E2E 测试
- 结算调度的批量大小需重新评估（记录数量 O(2) → O(2n)）

**风险提示**：

- 这是本次修复中唯一需要 schema migration 的改动，工作量最大
- 建议单独开一个 PR，配合完整的 E2E 回归
- 上线前需评估生产环境 `fin_commission` 表数据量，决定在线迁移策略

---

## 验证命令

```bash
# 本会话改动验证
pnpm typecheck:backend          # ✅ 已通过

# 下次会话完成后执行
pnpm test --filter=@apps/backend -- --testPathPattern=commission
pnpm check:slice
pnpm verify-monorepo
```

## 关键文件速查

| 文件                                                                                   | 相关问题                 |
| -------------------------------------------------------------------------------------- | ------------------------ |
| `apps/backend/src/module/finance/commission/services/commission-calculator.service.ts` | 问题 7                   |
| `apps/backend/src/module/finance/commission/services/l1-calculator.service.ts`         | 问题 1、2                |
| `apps/backend/src/module/finance/commission/services/commission-validator.service.ts`  | 问题 3                   |
| `apps/backend/src/module/finance/commission/commission-compensation.scheduler.ts`      | 问题 6                   |
| `apps/backend/src/module/finance/settlement/settlement.scheduler.ts`                   | 问题 4（待改）           |
| `apps/backend/src/module/finance/commission/services/commission-settler.service.ts`    | 问题 5（待改）           |
| `apps/backend/prisma/models/60-finance-payment.prisma`                                 | 问题 4、5（schema 变更） |
