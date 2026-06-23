# P1-10 修复积分扣减/冻结的事务内重试 bug（单 SQL 原子扣减 + lot ledger 同步）

**owner**: 待指派 / 后端
**status**: draft
**last_verified**: 2026-05-15
**related**: [[P0-02-order-outbox]]、[[P1-08-clean-fake-events]]

---

> **跨文档硬约束**：积分字段为 `Int`（非金额），不在 [[P0-00-money-precision]] 范围内；但本设计提供的 `freezePointsInTx` 被 [[P0-02-order-outbox]] / [[P0-04-cart-bind-sid]] 在订单 tx 内调用，调用方传入的金额参数仍受 P0-00 约束。幂等键格式遵循 [[P2-14-idempotency-key-convention]]。

## 1. 目标与范围

### 1.1 目标

`apps/backend/src/module/marketing/points/account/account.service.ts:195-281` 的 `deductPoints` 与同文件 `freezePoints` / `unfreezePoints` / `settleFrozenPoints` 共用同样的"`@Transactional()` + `for (...) { 乐观锁 + try/catch continue }`"重试模式。这里有两个互相加剧的 bug：

1. **事务内重试 = 假重试**：方法已经被 `@Transactional()` 包裹，整个 `for` 循环跑在同一个 Postgres 事务里。第 1 次乐观锁冲突时如果有任何**非 SELECT** 语句已执行（哪怕只是 LOG 写入用的 transaction repo 操作），Postgres 会把 tx 标记为 aborted → 后续重试 SQL 全部 `25P02 current transaction is aborted`。重试逻辑实际只在"第一次就成功"的 happy path 跑得通。
2. **乐观锁冲突 vs 业务异常无法区分**：`catch (error)` 用 `instanceof BusinessException` 区分，但乐观锁冲突走的是 `if (!updated) continue` 路径（不抛错），而 `consumeAvailableLots` 内部抛的"批次不足"也是 BusinessException —— 即使 happy path 跑通了乐观锁，lot ledger 跨多批次扣减也可能因 ledger 行被并发占用抛错。

修复方式：

- **删 for-loop + 乐观锁 + version**：改用单条 `UPDATE … WHERE id=? AND available_points >= ? RETURNING ...` 原子 SQL 完成"余额校验 + 扣减"。
- **lot ledger 同步在同 tx 内**：原 `consumeAvailableLots` 调用保留，但其内部"批次不足"由原子 SQL 已经保证不会触发（先扣账户余额成功才允许扣 ledger；ledger 总额与账户余额由 invariant 维持）。
- **统一改造**：`deductPoints` / `freezePoints` / `unfreezePoints` / `settleFrozenPoints` / `addPoints`（addPoints 的 retry 同样不必要，但风险低，本设计一并清理）。

### 1.2 范围

- ✅ `account.service.ts` 5 个核心方法重写。
- ✅ `accountRepo` 新增 `atomicDeduct(memberId, amount, type)` / `atomicFreeze(...)` / `atomicUnfreeze(...)` / `atomicSettle(...)`。
- ✅ 单元测试覆盖：余额不足、并发扣减、负数、零金额边界。
- ✅ 与 [[P0-02]] 协作：`OrderCreationApplicationService.createOrderInTransaction` 在订单 tx 内调用 `freezePointsInTx`（本设计提供）。
- ❌ 不重做 `lot_ledger` 表 schema。
- ❌ 不动 `PointsTransaction` 表的字段。
- ❌ 不动 `points` 模块对外 emit 的事件（[[P1-08]] 处理）。

### 1.3 DoD

1. `account.service.ts` 内不再有 `for (let attempt = 0; attempt < maxRetries; attempt++)` 模式。
2. `accountRepo.updateWithOptimisticLock` 仅在乐观锁仍有意义的场景（如 admin 调整余额）保留；扣减路径不再使用。
3. `deductPoints` / `freezePoints` 等方法单事务、单 SQL（外加 lot ledger 一次 INSERT），无重试。
4. 高并发测试：1000 并发扣减同账户 100 次 → 最终余额一致；无 `25P02` 错误日志。
5. P0-04 / P0-02 对 `freezePointsInTx` 的依赖落地（本设计提供方法）。

---

## 2. 现状取证

### 2.1 deductPoints 关键缺陷

```ts
// account.service.ts:195-281
@Transactional()
async deductPoints(dto: DeductPointsDto) {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const account = await this.accountRepo.findByMemberId(dto.memberId);     // SELECT
      if (account.availablePoints < dto.amount) BusinessException.throw(...);
      const updated = await this.accountRepo.updateWithOptimisticLock(...);    // UPDATE WHERE version=?
      if (!updated) {
        this.logger.warn('乐观锁冲突，重试');
        continue;                                                              // ❌ tx 已开始；continue 后再 SELECT 时 tx 可能已 abort
      }
      const transaction = await this.transactionRepo.create(...);              // INSERT into points_transaction
      await this.lotLedgerService.consumeAvailableLots(...);                   // INSERT/UPDATE lot_ledger 多行
      await this.eventEmitter.emitAsync(...);
      return Result.ok(...);
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      if (attempt === maxRetries - 1) throw error;
      // ❌ 进入下一轮，但 tx 状态已不可恢复
    }
  }
  BusinessException.throw(500, CONCURRENT_OPERATION_FAILED);                   // ❌ 出循环说明所有重试都"没 return"，但实际上 first attempt 已经写入了部分行
}
```

### 2.2 真实失败路径

并发场景：

- T0 A: `findByMemberId` → version=5, avail=100
- T0 B: `findByMemberId` → version=5, avail=100
- T1 A: `updateWithOptimisticLock(version=5)` → ok, version→6, avail=50
- T1 B: `updateWithOptimisticLock(version=5)` → returns null
- T2 B: `continue` → 进入第二轮 → `findByMemberId` → Postgres 实测 B 仍在原 tx：若 tx 已 SELECT 到 schema 锁 / `BusinessException.throw` 等抛出过，且事务 isolation = read committed，tx 不一定 abort——所以**实测有时能跑通**。这是"bug 不稳定复现"的原因。

但只要 throw 出过 `BusinessException` 又被 catch 吃掉，tx 状态就脏了；或者 lot ledger 的 INSERT 触发 unique 冲突也会让 tx abort。生产日志已有 `current transaction is aborted` 偶发。

### 2.3 lot ledger 现状

`consumeAvailableLots(...)` 内按 FIFO 选 active lot 行扣减；这是正向逻辑，本设计不改。问题在于：**账户余额扣减失败 → 不进入 lot ledger**（OK）；账户余额扣减成功但 lot ledger 内某行被并发占用 → 当前会抛错 → tx rollback → 账户余额恢复。原子 SQL 改造后这个 invariant 仍然成立（同 tx 内单 SELECT FOR UPDATE on lot rows）。

---

## 3. 设计方案

### 3.1 atomicDeduct 单 SQL

```ts
// apps/backend/src/module/marketing/points/account/account.repository.ts

async atomicDeduct(memberId: string, amount: number): Promise<{ id: string; balanceBefore: number; balanceAfter: number } | null> {
  // PG: UPDATE points_account
  //     SET available_points = available_points - $2,
  //         used_points      = used_points + $2,
  //         version          = version + 1,
  //         update_time      = NOW()
  //     WHERE member_id = $1
  //       AND tenant_id = (SELECT current_setting(...) ...)
  //       AND available_points >= $2
  //     RETURNING id, (available_points + $2) AS balance_before, available_points AS balance_after;
  const rows = await this.client.$queryRaw<Array<{ id: string; balance_before: number; balance_after: number }>>`
    UPDATE points_account
    SET available_points = available_points - ${amount}::int,
        used_points = used_points + ${amount}::int,
        version = version + 1,
        update_time = NOW()
    WHERE member_id = ${memberId} AND tenant_id = ${this.tenantId}
      AND available_points >= ${amount}::int
    RETURNING id, (available_points + ${amount}::int)::int AS balance_before, available_points::int AS balance_after
  `;
  if (rows.length === 0) return null;       // 余额不足或账户不存在
  const row = rows[0];
  return { id: row.id, balanceBefore: row.balance_before, balanceAfter: row.balance_after };
}
```

### 3.2 改造后的 deductPoints

```ts
@Transactional()
async deductPoints(dto: DeductPointsDto) {
  const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;

  const result = await this.accountRepo.atomicDeduct(dto.memberId, dto.amount);
  if (!result) {
    // 余额不足 / 账户不存在 —— 用 SELECT 区分
    const account = await this.accountRepo.findByMemberId(dto.memberId);
    if (!account) BusinessException.throw(400, ACCOUNT_NOT_FOUND);
    BusinessException.throw(400, INSUFFICIENT_BALANCE);
  }

  const transaction = await this.transactionRepo.create({
    tenantId,
    accountId: result.id,
    memberId: dto.memberId,
    type: dto.type,
    amount: -dto.amount,
    balanceBefore: result.balanceBefore,
    balanceAfter: result.balanceAfter,
    status: PointsTransactionStatus.COMPLETED,
    relatedId: dto.relatedId,
    remark: dto.remark,
    expireTime: null,
  });

  await this.lotLedgerService.consumeAvailableLots({
    tenantId,
    accountId: result.id,
    memberId: dto.memberId,
    amount: dto.amount,
    spendTransactionId: transaction.id,
    relatedId: dto.relatedId,
  });
  // 注：lot ledger 行级 FOR UPDATE 在 consumeAvailableLots 内部处理；并发同账户多笔扣减此处会按行锁排队，不会冲突。

  // 事件 emit 按 [[P1-08]] 改为直调 dispatcher
  await this.messageTouchpointDispatcher.dispatch({
    type: MarketingEventType.POINTS_USED,
    tenantId,
    instanceId: transaction.id,
    configId: result.id,
    memberId: dto.memberId,
    payload: { amount: dto.amount, transactionType: dto.type, relatedId: dto.relatedId },
    timestamp: new Date(),
  });

  return Result.ok(FormatDateFields(transaction));
}
```

### 3.3 atomicFreeze / atomicUnfreeze / atomicSettle

类似 atomicDeduct：

- `atomicFreeze`：`UPDATE … WHERE available_points >= ? SET available_points -= ?, frozen_points += ?`
- `atomicUnfreeze`：`UPDATE … WHERE frozen_points >= ? SET frozen_points -= ?, available_points += ?`
- `atomicSettle`：`UPDATE … WHERE frozen_points >= ? SET frozen_points -= ?, used_points += ?`

每个 UPDATE 都在 RETURNING 子句里返回 balanceBefore/balanceAfter，避免再 SELECT。

### 3.4 freezePointsInTx（[[P0-02]] / [[P0-04]] 依赖项）

```ts
/** 给 OrderCreationApplicationService.createOrderInTransaction 直调 */
async freezePointsInTx(memberId: string, amount: number, relatedId: string) {
  const result = await this.accountRepo.atomicFreeze(memberId, amount);
  if (!result) {
    const account = await this.accountRepo.findByMemberId(memberId);
    if (!account) BusinessException.throw(400, ACCOUNT_NOT_FOUND);
    BusinessException.throw(400, INSUFFICIENT_BALANCE);
  }
  // 记录冻结 transaction（积分流水分类 = FROZEN）
  await this.transactionRepo.create({ ... });
}
```

注意：该方法不带 `@Transactional()`，因为它**必须**在 caller 的 tx 内执行（caller 是 createOrderInTransaction 的 @Transactional）。caller 与 callee 共享 ALS tx。

---

## 4. 决策依据

### 4.1 Q1 乐观锁 vs 原子 SQL

| 选项                                         | 优                                 | 劣                                           | 选择 |
| -------------------------------------------- | ---------------------------------- | -------------------------------------------- | ---- |
| **A. 原子 SQL（UPDATE WHERE balance >= n）** | 单往返；不需要 retry；并发自然排队 | 失去"乐观锁"语义（但本场景不需要）           | ✅   |
| B. 乐观锁 + 事务外 retry                     | 重试逻辑标准                       | 必须把 retry 搬出 @Transactional；改动面更大 |      |
| C. 悲观锁 SELECT FOR UPDATE                  | 简单                               | 锁持有时间长，热点账户会形成串行             |      |

### 4.2 Q2 transactionRepo.create 失败的处理

| 选项                           | 优       | 劣                                                                | 选择 |
| ------------------------------ | -------- | ----------------------------------------------------------------- | ---- |
| **A. 同 tx，失败回滚账户扣减** | 一致性强 | tx 范围略大                                                       | ✅   |
| B. transaction 异步写          | 性能     | 报表/审计延迟，[[feedback_no_compensating_complexity]] 反 pattern |      |

### 4.3 Q3 兼容 `addPoints` 重试

| 选项              | 优       | 劣         | 选择 |
| ----------------- | -------- | ---------- | ---- |
| **A. 一并清理**   | 风格统一 | 改动面增加 | ✅   |
| B. 仅清理扣减路径 | 工作量小 | 双标       |      |

---

## 5. 迁移与回滚

### 5.1 部署顺序

1. **D1**：account.repository 新增 atomic\* 方法；service 改造；保留 `updateWithOptimisticLock` 给 admin 余额调整路径。
2. **D2**：[[P0-02]] / [[P0-04]] 切流前确认 P1-10 已在 prod 跑 ≥3 天。

### 5.2 回滚

git revert PR；旧 retry 逻辑回归。

---

## 6. 验证矩阵

| 层   | 用例                                                                                         | 工具          |
| ---- | -------------------------------------------------------------------------------------------- | ------------- |
| Spec | atomicDeduct(amount=100, balance=100) → ok, balanceAfter=0                                   | unit          |
| Spec | atomicDeduct(amount=101, balance=100) → null                                                 | unit          |
| Spec | atomicFreeze + atomicSettle 之后 frozen=0 used+=amount                                       | unit          |
| Spec | deductPoints 抛 INSUFFICIENT_BALANCE 时 transaction 表 0 行写入                              | unit          |
| 并发 | 1000 goroutines 并发扣 1 分，初始 1000 → 终态 0；transaction 表 1000 行；lot ledger 总额对账 | k6 + 事后 SQL |
| 并发 | 1000 并发扣 10 分，初始 5000 → 终态 0，剩余 500 笔抛 INSUFFICIENT_BALANCE                    | k6            |
| 集成 | 下单 → freezePointsInTx → 订单 paid → settleFrozenPoints；frozen=0, used 正确                | supertest     |
| 静态 | `grep -r "for.*maxRetries" apps/backend/src/module/marketing/points` 0                       | rg            |

---

## 7. 风险与未决

### 7.1 TODO

1. **TODO-1**：`tenant_id` 在原子 SQL 中如何注入？当前 prisma 多租户走 `tenantHelper.readWhereForDelegate`；`$queryRaw` 需手动拼。建议从 `TenantContext.getTenantId()` 取并参数化，**实施期 grep `prisma.$queryRaw` 看现有最佳实践**。
2. **TODO-2**：`consumeAvailableLots` 内部如果在并发场景下确实抛"lot 锁占用"业务异常，需要确认账户余额已扣减但 lot 失败是否会导致 tx 回滚（应该会，因为同 tx）。实施期 e2e 覆盖。
3. **TODO-3**：`updateWithOptimisticLock` 保留给 admin 调整：是否要在 admin 调整路径上加 audit log？本设计不强求。

### 7.2 风险

| 风险                                                | 等级 | 缓解                                         |
| --------------------------------------------------- | ---- | -------------------------------------------- |
| 原子 SQL 跨 prisma 多租户拦截层失效                 | 中   | 手动注入 tenant_id 条件；spec 覆盖跨租户隔离 |
| 原子 SQL 在 Prisma migration / type 检查上需要 .raw | 低   | `$queryRaw` 类型注解严格                     |
| addPoints 改造引入回归                              | 低   | spec 覆盖；prod 灰度时关注积分账户对账日报   |

---

## 8. 实施清单

### 8.1 backend

- [ ] `points/account/account.repository.ts`：新增 `atomicDeduct / atomicFreeze / atomicUnfreeze / atomicSettle / atomicAdd`。
- [ ] `points/account/account.service.ts`：5 个核心方法重写；删 `for (...) attempt` 模式。
- [ ] 新增 `freezePointsInTx(memberId, amount, relatedId)` 公开方法供 [[P0-02]] / [[P0-04]] 调用。
- [ ] 单测 `account.service.spec.ts` 增并发 case。

### 8.2 验证

- [ ] `pnpm typecheck:backend && pnpm lint:backend`
- [ ] `pnpm test:backend -- account`
- [ ] `pnpm check:slice`
- [ ] PR 前完整 verify。

### 8.3 PR 标题

`fix(backend): 积分扣减改原子 SQL，消除事务内乐观锁重试隐患`
