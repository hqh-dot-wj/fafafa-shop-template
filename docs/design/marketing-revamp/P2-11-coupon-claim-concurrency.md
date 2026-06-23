# P2-11 优惠券领取并发修复（UNIQUE 约束 + INSERT WHERE COUNT < limit）

**owner**: 待指派 / 后端
**status**: draft
**last_verified**: 2026-05-15
**related**: [[P1-10-points-deduction-retry-fix]]

---

> **跨文档硬约束**：本设计涉及金额字段（discountAmount / maxDiscountAmount / minOrderAmount）全链路遵循 [[P0-00-money-precision]]。幂等键格式遵循 [[P2-14-idempotency-key-convention]]，`per_user_ord` 是 DB L1 防线，与 P2-14 的 L1 层对齐。

## 1. 目标与范围

### 1.1 目标

`apps/backend/src/module/marketing/coupon/distribution/distribution.service.ts:156-260` 的 `claimCouponInternal` 用"Redis 双层锁（user-claim + stock）+ 乐观锁 `updateMany WHERE remainingStock>0`"组合保护并发。这套防御实质问题：

- **Redis 锁是协调器，不是真相**：锁失效 / Redis 抖动 / 跨实例 clock skew 都可能让 `countUserCoupons + limitPerUser` 这条 check-then-act 出现 TOCTOU 间隙。
- **嵌套两层锁 + 内层 finally** 复杂度高：当前 5000ms TTL + 3 次重试，在突发流量下易出现"前一个请求还没释放，后续请求超时失败"的运营投诉。
- **stock 库存乐观锁有保护**（`updateMany WHERE remainingStock>0`）—— 这一段是健壮的；
- **用户领取上限没有数据库保护**：`countUserCoupons` 是 SELECT，然后业务层比较 `< limitPerUser`，并发请求穿透限制是真实可能。

修复方式（业务层尽量去锁，靠 DB 一致性约束）：

- 用户领取上限：通过 `INSERT … SELECT … WHERE (SELECT COUNT(*) FROM mkt_user_coupon WHERE member_id=? AND template_id=? AND status != 'EXPIRED') < ?` 单 SQL 完成 check + insert（原子）。
- 单用户单 template 总量约束：补 partial unique index `UNIQUE (member_id, template_id, ord)`，其中 `ord` 是按时间递增的领取序号，由 INSERT SQL 自身派生。
- Redis 双层锁全部删除；只保留库存乐观锁的 `updateMany WHERE remainingStock>0`。
- `countUserCoupons` 仅用于"预检查 + UI 提示"（[[2.1 节]] 现状代码），不作为领取门槛。

### 1.2 范围

- ✅ 重写 `claimCouponInternal`：单事务、单 INSERT 控制限领，无 Redis 锁。
- ✅ 新增 partial unique 约束（migration）。
- ✅ 删除 `redisLock.executeWithLock` 在该路径的两次调用。
- ✅ 与 [[P1-08]] 协同：emit COUPON_CLAIMED 改为 dispatcher 直调。
- ❌ 不动 coupon template 表的字段。
- ❌ 不动 distribution channel 上游逻辑（活动赠券、签到送券等仍调本方法）。

### 1.3 DoD

1. `claimCouponInternal` 不再调用 `redisLock.executeWithLock`。
2. DB 中 `mkt_user_coupon` 增加 partial unique index 保障"同用户同 template 不超 limitPerUser"。
3. 1000 并发同用户领同 template（limit=3）→ 终态 3 张，无超领；无 lock 超时错误。
4. 现有 spec 全过；新增并发 spec。

---

## 2. 现状取证

### 2.1 user-claim 锁是补丁

```ts
// distribution.service.ts:156-260
const userLockKey = this.redisLock.getUserClaimLockKey(memberId, templateId);
const stockLockKey = this.redisLock.getCouponStockLockKey(templateId);

return await this.redisLock.executeWithLock(userLockKey, async () =>
  this.redisLock.executeWithLock(
    stockLockKey,
    async () => {
      // ...
      const userClaimedCount = await this.userCouponRepo.countUserCoupons(memberId, templateId);
      BusinessException.throwIf(
        userClaimedCount >= template.limitPerUser,
        CouponErrorMessages[CouponErrorCode.CLAIM_LIMIT_EXCEEDED],
      );
      // ... 后续 insert
    },
    5000,
    3,
  ),
);
```

- 两层锁嵌套 + 5s TTL + 3 次重试。
- 注释里写"问题 9"曾经线上出过事，于是加锁，但锁是补丁。

### 2.2 库存乐观锁是健壮的

```ts
// distribution.service.ts:194-209
const updated = await tx.mktCouponTemplate.updateMany({
  where: { id: templateId, remainingStock: { gt: 0 } },
  data: { remainingStock: { decrement: 1 } },
});
if (updated.count === 0) throw new BusinessException(STOCK_INSUFFICIENT);
```

`updateMany WHERE remainingStock>0` 是 atomic，无 TOCTOU。这段不需要 Redis stock 锁。

---

## 3. 设计方案

### 3.1 partial unique index（不可行直接 unique，因为 limitPerUser 不同）

由于 `limitPerUser` 是每个 template 自己定义的（可以是 1、3、99），无法用静态 `UNIQUE(member_id, template_id)`。改用**应用层派生 ord 字段** + `UNIQUE(member_id, template_id, ord)` + `INSERT ... WHERE` 条件式：

```prisma
// 80-marketing.prisma  MktUserCoupon 追加
model MktUserCoupon {
  // ... 既有字段
  /// 同 (memberId, templateId) 维度的领取序号，从 1 开始单调递增；INSERT 时由 SQL 派生
  perUserOrd Int @map("per_user_ord")

  @@unique([memberId, templateId, perUserOrd], name: "uk_user_coupon_per_user_ord")
}
```

### 3.2 INSERT WHERE COUNT < limit 单 SQL

```sql
-- claim：原子完成"检查 + 派生 ord + insert"
INSERT INTO mkt_user_coupon (
  tenant_id, member_id, template_id, coupon_name, coupon_type, discount_amount,
  discount_percent, max_discount_amount, min_order_amount, start_time, end_time,
  status, distribution_type, per_user_ord, create_time, update_time
)
SELECT
  $tenantId, $memberId, $templateId, $name, $type, $da, $dp, $mda, $moa,
  $startTime, $endTime, 'UNUSED', $distributionType,
  COALESCE(MAX(per_user_ord), 0) + 1, NOW(), NOW()
FROM mkt_user_coupon
WHERE member_id = $memberId AND template_id = $templateId
HAVING COALESCE(MAX(per_user_ord), 0) + 1 <= $limitPerUser
RETURNING *;
```

若返回 0 行 → 该用户已达上限。

```ts
// distribution.repository.ts
async tryClaim(input: TryClaimInput): Promise<MktUserCoupon | null> {
  const rows = await this.client.$queryRaw<MktUserCoupon[]>`
    INSERT INTO mkt_user_coupon (...)
    SELECT ..., COALESCE(MAX(per_user_ord), 0) + 1, NOW(), NOW()
    FROM mkt_user_coupon
    WHERE member_id = ${input.memberId} AND template_id = ${input.templateId}
    HAVING COALESCE(MAX(per_user_ord), 0) + 1 <= ${input.limitPerUser}
    RETURNING *
  `;
  return rows[0] ?? null;
}
```

并发场景：

- 两个并发 INSERT 同时计算出 `MAX(...) + 1 = 1`，都试图 insert ord=1 → unique 约束让第二个抛 `P2002` → catch + 视作"领取失败，请重试"或在应用层重试 1 次。
- 重试 1 次后下个 `MAX(...) + 1 = 2`；若 limitPerUser=1 则 HAVING 过滤掉 → 返回 0 行。

### 3.3 改造后的 claimCouponInternal

```ts
private async claimCouponInternal(memberId: string, templateId: string, distributionType: CouponDistributionType) {
  return await this.prisma.$transaction(async (tx) => {
    const template = await this.templateRepo.findById(templateId, tx);
    BusinessException.throwIfNull(template, TEMPLATE_NOT_FOUND);
    BusinessException.throwIf(template.status !== CouponStatus.ACTIVE, TEMPLATE_INACTIVE);

    // 1) 库存原子扣减（保留）
    const stockUpdated = await tx.mktCouponTemplate.updateMany({
      where: { id: templateId, remainingStock: { gt: 0 } },
      data: { remainingStock: { decrement: 1 } },
    });
    if (stockUpdated.count === 0) BusinessException.throw(STOCK_INSUFFICIENT);

    // 2) 用户限领原子 INSERT
    const { startTime, endTime } = this.calculateValidity(template);
    let userCoupon: MktUserCoupon | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        userCoupon = await this.userCouponRepo.tryClaim({
          tenantId: template.tenantId, memberId, templateId,
          couponName: template.name, couponType: template.type,
          discountAmount: template.discountAmount, discountPercent: template.discountPercent,
          maxDiscountAmount: template.maxDiscountAmount, minOrderAmount: template.minOrderAmount,
          startTime, endTime, distributionType, limitPerUser: template.limitPerUser,
        });
        break;
      } catch (error) {
        if (isPrismaUniqueViolation(error) && attempt === 0) continue; // ord 竞争，再算一遍
        throw error;
      }
    }

    if (!userCoupon) {
      // INSERT 返回 0 行 = 用户达上限；回滚库存
      throw new BusinessException(CLAIM_LIMIT_EXCEEDED);
    }
    return userCoupon;
  });

  // 事件 emit 改 dispatcher 直调（[[P1-08]]）
}
```

注意：上层 try/catch 抛 `BusinessException` 时 `$transaction` 自动 rollback，库存扣减自动恢复。这是"用 DB 约束代替 Redis 锁"的关键收益。

---

## 4. 决策依据

### 4.1 Q1 unique 约束方案

| 选项                                                         | 优                              | 劣                       | 选择 |
| ------------------------------------------------------------ | ------------------------------- | ------------------------ | ---- |
| **A. `UNIQUE(member_id, template_id, ord)` + INSERT SELECT** | 单 SQL 原子；并发竞争由 DB 仲裁 | 需要新列 + migration     | ✅   |
| B. Postgres ADVISORY LOCK                                    | 无 schema 改动                  | 跨实例锁；持锁时间不确定 |      |
| C. SELECT FOR UPDATE 全表                                    | 简单                            | 极差性能                 |      |

### 4.2 Q2 Redis 锁完全删除 vs 保留 stock 锁

| 选项             | 优                      | 劣                                                | 选择 |
| ---------------- | ----------------------- | ------------------------------------------------- | ---- |
| **A. 全删**      | 心智简单；少 Redis 依赖 | 突发流量下大量请求一起命中乐观锁竞争（DB 端排队） | ✅   |
| B. 保留 stock 锁 | 减少 DB 竞争            | 现有锁补丁不必要；DB 乐观锁已能处理               |      |

### 4.3 Q3 应用层重试次数

| 选项                            | 优                            | 劣          | 选择 |
| ------------------------------- | ----------------------------- | ----------- | ---- |
| **A. 1 次重试**                 | 覆盖 ord 竞争极小概率连环冲突 | —           | ✅   |
| B. 0 次（直接抛错让用户重新点） | 极简                          | 用户体验差  |      |
| C. 5 次                         | 友好                          | 长时占用 tx |      |

---

## 5. 迁移与回滚

### 5.1 部署顺序

1. **D1**：migration 新增 `per_user_ord` 列 + partial unique；初始历史数据 `per_user_ord` 按 (memberId, templateId, createTime ASC) 编号回填。
2. **D2**：上线新 `tryClaim` SQL；保留旧 `claimCouponInternal` 逻辑作 fallback（feature flag `coupon.atomic-claim` = false）。
3. **D3**：staging 跑 1 周；flag 切到 true。
4. **D4**：删旧 Redis 锁路径与 flag。

### 5.2 回滚

D2-D4 flag 切回 false 即用旧路径；D4 真删之前可随时切回。

---

## 6. 验证矩阵

| 层   | 用例                                                               | 工具      |
| ---- | ------------------------------------------------------------------ | --------- |
| 静态 | `grep -r "redisLock.executeWithLock\(.*coupon" apps/backend/src` 0 | rg        |
| Spec | tryClaim(limit=3, current=2) → ok ord=3                            | unit      |
| Spec | tryClaim(limit=3, current=3) → null                                | unit      |
| Spec | 并发 unique 冲突 → 应用层重试 1 次 → 第二次 HAVING 拒绝            | unit      |
| 并发 | 1000 并发同用户同 template(limit=3) → 终态 3 行                    | k6        |
| 并发 | 1000 并发不同用户同 template(stock=500) → 终态 500 张；每用户 1 张 | k6        |
| 集成 | E2E：claim → list → 验证 ord                                       | supertest |

---

## 7. 风险与未决

### 7.1 TODO

1. **TODO-1**：partial unique 在 Prisma 中只能 `@@unique`，无法 partial（即"仅 status != EXPIRED"）。本设计选择"按 ord 区分"，避免 partial。**实施期确认 Prisma 版本支持 `@@unique` 在 raw SQL migration 中创建 partial 索引；如不支持，按现方案。**
2. **TODO-2**：历史数据回填 `per_user_ord` 在大表上耗时；建议在 staging 实测后决定是否分批回填。
3. **TODO-3**：`isPrismaUniqueViolation` 工具函数仓库内是否已有？grep `P2002` 找现有 helper 复用。

### 7.2 风险

| 风险                                                        | 等级 | 缓解                                                             |
| ----------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| 历史 `mkt_user_coupon` 数据中 (member, template) 已超 limit | 中   | 回填前对账；超限行不写 ord（保持 null），新约束仅约束有 ord 的行 |
| 极端突发流量下 DB 乐观锁竞争耗 CPU                          | 低   | DB 监控；必要时加 PgBouncer                                      |
| `$queryRaw` 类型注解维护                                    | 低   | 用 Prisma sql template tag 严格类型                              |

---

## 8. 实施清单

### 8.1 backend

- [ ] Prisma：`MktUserCoupon.perUserOrd Int`，`@@unique([memberId, templateId, perUserOrd])`；migration + 回填脚本。
- [ ] `coupon/user-coupon.repository.ts`：`tryClaim` SQL 实现。
- [ ] `coupon/distribution/distribution.service.ts:156-260`：重写 `claimCouponInternal`；删 Redis 锁调用。
- [ ] `coupon/distribution/distribution.service.spec.ts`：并发用例。

### 8.2 验证

- [ ] `pnpm typecheck:backend && pnpm test:backend -- coupon`
- [ ] `pnpm check:slice`
- [ ] PR 前完整 verify。

### 8.3 PR 标题

`fix(backend): 优惠券领取改原子 INSERT，删 Redis 双层锁`
