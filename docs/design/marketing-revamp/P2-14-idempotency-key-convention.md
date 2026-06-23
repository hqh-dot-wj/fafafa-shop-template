# P2-14 幂等键统一规约

**owner**: 待指派 / 后端
**status**: draft（待评审 → 待实施）
**last_verified**: 2026-05-15
**related**: [[P0-02-order-outbox]]、[[P0-04-cart-bind-sid]]、[[P1-10-points-deduction-retry-fix]]、[[P2-11-coupon-claim-concurrency]]、[[P2-13-eligibility-share-commission-chain]]

---

> **跨文档硬约束**：本设计是幂等键自身规约，下游 P0-02 / P0-04 / P2-11 / P2-13 等已在各自文档顶部声明遵循本规约；金额字段精度遵循 [[P0-00-money-precision]]。

## 1. 目标与范围

### 1.1 目标

营销改造系列设计稿里有 **5 套互不相同的幂等机制**，各自工作但格式不统一，跨路径 retry 或事件重投时容易出现"我以为去重了，实际没去重"的隐患：

| 来源                             | 键 / 机制                                                                               | 形式                        |
| -------------------------------- | --------------------------------------------------------------------------------------- | --------------------------- |
| P0-02 outbox dedupeKey           | `${eventType}:${orderId}[:${refundReferenceId}]`                                        | string，写 outbox 表 unique |
| P0-02 worker Redis 幂等键        | `mkt:idem:${eventType}:${orderId}` 类（OrderIntegrationService.executeWithIdempotency） | Redis SET NX EX 600s        |
| P0-04 sid event log              | 无去重（注释明确"日志表不去重"）                                                        | 多写允许                    |
| P1-10 积分 transaction.relatedId | 各调用方自传（订单号 / 退款号 / 任意 string）                                           | 无 unique 约束              |
| P2-11 coupon per_user_ord        | `UNIQUE(member, template, ord)`                                                         | DB 约束                     |
| P2-13 share event AGGREGATE      | `sid='AGGREGATE'` 占位字面值                                                            | hack                        |

落差：

- **格式不统一**：outbox 用 `:` 分隔，Redis 用前缀 `mkt:idem:`，coupon 用 ord 数字，三个不能互相 reuse。
- **作用域不统一**：outbox 是跨节点幂等，Redis 是单节点跨请求幂等，DB unique 是写入幂等；同一业务事实可能跨 3 层但每层各算各的。
- **重试 vs 重投不区分**：Bull 自动 retry（同 jobId）与运营手动 replay（人工触发同 outbox 行）是两种语义；当前 worker 把它们都吃在 Redis SET NX 兜底。
- **审计缺**：哪些幂等命中、哪些是重复请求被拒？只有 logger.warn 没有持久审计。

本设计统一规约：

- **键格式**：`<domain>:<action>:<entityId>[:<subId>]` 单一形式。
- **作用域分层**：DB 约束 > outbox/queue dedupe > Redis SET NX > worker 内 transaction relatedId。各层职责互不替代。
- **命名空间常量化**：`apps/backend/src/common/idempotency/keys.ts` 提供 builder，禁止业务模块手写字符串。
- **审计**：所有 Redis SET NX 命中（重复请求）写一行 `sys_idempotency_audit`（轻量表，仅查询用，30 天 TTL）。

### 1.2 范围

- ✅ 定义键格式 BNF + 命名空间常量。
- ✅ 定义"4 层幂等防线"分工。
- ✅ 提供 `IdempotencyKeyBuilder` 工具 + 现有 5 处调用点改造。
- ✅ 新增 `sys_idempotency_audit` 表（可选，决策见 §4 Q3）。
- ❌ 不重做 P2-11 的 `per_user_ord` unique（DB 约束是底线，已合规）。
- ❌ 不动 Bull 内部去重（按 jobId）。

### 1.3 DoD

1. 所有调用点用 `IdempotencyKeyBuilder` 生成键；grep `mkt:idem:` / `outbox.*dedupe.*\$\{` 等手写字面值在业务代码 0 命中。
2. `OrderIntegrationService.executeWithIdempotency` 入参从"业务方拼字符串"改为"传 domain + action + entityId"。
3. 5 处现有调用点（outbox / coupon claim / 积分 transaction / share event / commission trigger）键格式统一可读。
4. 审计表上线后，每天 Grafana 看到"幂等命中次数 / 总请求数 < 0.1%"（健康基线）。

---

## 2. 现状取证

### 2.1 outbox dedupeKey 现状

```ts
// P0-02 设计稿
dedupeKey: `${eventType}:${orderId}[:${refundReferenceId}]`;
// 实际示例：
// "order.paid:ord_123"
// "order.refunded:ord_123:refund_456"
```

### 2.2 OrderIntegrationService.executeWithIdempotency

```ts
// apps/backend/src/module/marketing/integration/integration.service.ts:165
return this.executeWithIdempotency('created', orderId, async () => { ... });
//                                  ^^^^^^^^^ ^^^^^^^^
//                                  scope     entityId
// 内部 Redis key：mkt:idem:<scope>:<entityId>，TTL 600s
```

调用点散落业务代码各处，scope 用 string 自由命名（`'created' / 'paid' / 'cancelled' / 'refunded'`）。

### 2.3 coupon claim per_user_ord

```sql
UNIQUE(member_id, template_id, per_user_ord)
```

这是 DB 约束级幂等，没有 string 键概念。但**业务事实**等同于"member X 在 template Y 上的第 N 次领取"，与 outbox 不同 namespace。

### 2.4 share event 现状

```ts
// P0-04 注释
'日志表不去重，可加 [orderId, sid, eventType] unique 防 Bull replay';
```

留 TODO 未确定。

### 2.5 P2-13 `sid='AGGREGATE'`

```ts
await tx.sysDistShareEvent.create({
  data: { sid: 'AGGREGATE', ... }
});
```

`sid` 列是 NOT NULL VARCHAR(64) 业务字段，用作"标记此条不是真 sid 触发"是 hack。

---

## 3. 设计方案

### 3.1 键格式 BNF

```
<key>      ::= <domain> ":" <action> ":" <entityId> [ ":" <subId> ]
<domain>   ::= "order" | "coupon" | "points" | "play" | "commission" | "share"
<action>   ::= "created" | "paid" | "cancelled" | "refunded" | "claimed" | "used"
                | "freeze" | "settle" | "deduct" | "lockToken" | "applyOrderCount"
                | "trigger" | "disableShareUser" | ...
<entityId> ::= <对应主实体 id 字符串，禁止包含 ":">
<subId>    ::= <可选区分子事件的字符串，如 refundReferenceId / lotId>
```

**约束**：

- `:` 是保留分隔符，键内部不允许其它 `:`
- 长度 ≤ 160 字符（与 outbox `dedupeKey VARCHAR(160)` 对齐）
- 实体 id 包含 `:` 时（极少）需先 base64url 编码

### 3.2 `IdempotencyKeyBuilder`

```ts
// apps/backend/src/common/idempotency/keys.ts

export type IdempotencyDomain = 'order' | 'coupon' | 'points' | 'play' | 'commission' | 'share';

export type IdempotencyKey = string & { readonly __brand: 'IdempotencyKey' };

export function buildIdempotencyKey(
  domain: IdempotencyDomain,
  action: string,
  entityId: string,
  subId?: string,
): IdempotencyKey {
  if (entityId.includes(':')) {
    throw new Error(`entityId cannot contain ':': ${entityId}`);
  }
  if (subId && subId.includes(':')) {
    throw new Error(`subId cannot contain ':': ${subId}`);
  }
  const base = `${domain}:${action}:${entityId}`;
  const full = subId ? `${base}:${subId}` : base;
  if (full.length > 160) {
    throw new Error(`Idempotency key too long: ${full.length}`);
  }
  return full as IdempotencyKey;
}

/** Redis namespace 前缀，区别于 outbox 的裸键 */
export function redisIdempotencyKey(key: IdempotencyKey): string {
  return `mkt:idem:${key}`;
}
```

业务调用点示例：

```ts
// outbox writer
const dedupeKey = buildIdempotencyKey('order', 'paid', orderId);
const refundKey = buildIdempotencyKey('order', 'refunded', orderId, refundReferenceId);

// integration service Redis 幂等
const key = buildIdempotencyKey('order', 'created', orderId);
const redisKey = redisIdempotencyKey(key);
await this.redis.set(redisKey, '1', 600 * 1000); // 600s

// commission trigger（[[P2-13]]）
const key = buildIdempotencyKey('commission', 'trigger', orderId);

// share event 联动 disable（替代 sid='AGGREGATE' hack）
const key = buildIdempotencyKey('share', 'disableShareUser', shareUserId);
```

### 3.3 4 层幂等防线分工

```
┌─────────────────────────────────────────────────────────────┐
│ L1：DB unique 约束（强一致，写入失败即拒）                  │
│   - oms_order_event_outbox.dedupe_key                       │
│   - mkt_user_coupon UNIQUE(member, template, per_user_ord)  │
│   - sys_dist_share_event 可选 UNIQUE(orderId, sid, type)    │
├─────────────────────────────────────────────────────────────┤
│ L2：Bull jobId 队列去重（同 jobId 队列内不重复消费）         │
│   - outbox dispatcher 用 dedupeKey 作 jobId                 │
├─────────────────────────────────────────────────────────────┤
│ L3：Redis SET NX 幂等键（短窗口防重复请求）                  │
│   - mkt:idem:<key> TTL 600s                                 │
│   - 命中即跳过执行 + 写审计                                 │
├─────────────────────────────────────────────────────────────┤
│ L4：transaction relatedId（业务追溯，非去重）                │
│   - points_transaction.related_id = <orderId / refundId>    │
│   - 不带 unique 约束；用于追溯，不是防线                    │
└─────────────────────────────────────────────────────────────┘
```

**职责互不替代**：

- L1 是底线，保证最终状态一致；
- L2 是 worker 调度优化（同 jobId 不重复入队），节约 L3/L4 调用次数；
- L3 是请求级短窗口防 retry 风暴；
- L4 仅审计追溯，**不当幂等机制**。

调用方按需选择层级，**至少有 L1 或 L3**。新建路径默认 L1 + L3 双保险。

### 3.4 share event 去重决策

P0-04 留的 TODO 现在拍板：**新增 `UNIQUE(orderId, sid, eventType) WHERE event_type='ORDER_ATTRIBUTED' OR 'ORDER_REFUND_REVERSED'` partial unique**（Prisma 不支持 partial unique，要走 raw SQL migration），避免 Bull replay 双计 orderCount。

`sid='AGGREGATE'` hack 由本设计正式废弃：联动 disable 事件改写 `sid=null`（schema 改为 nullable）+ `eventType='MANUAL_DISABLE'`，去重键为 `(shareUserId, eventType, DATE(createTime))` 单日同 user 只一条。

### 3.5 审计表（可选）

```prisma
model SysIdempotencyAudit {
  id          BigInt   @id @default(autoincrement())
  tenantId    String   @map("tenant_id") @db.VarChar(20)
  /// 命中的 idempotency key 原文
  idemKey     String   @map("idem_key") @db.VarChar(160)
  /// 命中层级：L1_DB / L2_BULL / L3_REDIS
  layer       String   @db.VarChar(20)
  /// 命中场景：retry / replay / unknown
  category    String   @db.VarChar(20)
  metadata    Json?
  createTime  DateTime @default(now()) @map("create_time")

  @@index([idemKey, createTime])
  @@index([tenantId, createTime])
  @@map("sys_idempotency_audit")
}
```

写入时机：L3 Redis SET NX 返回 0（已存在）时同步写一条。L1 / L2 不写（命中由 DB / Bull 内部完成，业务代码无感）。

保留期 30 天，由独立 retention job 删除（不在本 PR）。

### 3.6 调用点改造清单

| 文件                                                                                                 | 改前                                          | 改后                                                                                                                       |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `client/order/events/order-outbox.dedupe.ts`                                                         | 手写 `${eventType}:${orderId}`                | `buildIdempotencyKey('order', eventType.replace('order.',''), orderId, subId)`                                             |
| `marketing/integration/integration.service.ts:165` `executeWithIdempotency('created', orderId, ...)` | scope=string                                  | scope 改 typed action                                                                                                      |
| `marketing/coupon/distribution/distribution.service.ts` Redis lock key                               | `coupon:claim:lock:${memberId}:${templateId}` | 用 `buildIdempotencyKey('coupon','claimLock',memberId,templateId)`（**注意：本设计 [[P2-11]] 已删 lock，仅保留审计用键**） |
| `marketing/integration/integration.service.ts` `emitIntegrationEvent` 相关                           | scope 多处自由命名                            | typed action                                                                                                               |
| `store/distribution/services/share-token.service.ts` `applySidOrderCountIncrement`                   | sid event log                                 | 加 partial unique；buildIdempotencyKey 用于 audit                                                                          |
| `marketing/commission/commission.service.ts` trigger                                                 | 现状假设无                                    | 新增 `buildIdempotencyKey('commission','trigger',orderId)` + Redis SET NX                                                  |

---

## 4. 决策依据

### 4.1 Q1 单格式 vs 多格式

| 选项                                                 | 优                      | 劣                 | 选择 |
| ---------------------------------------------------- | ----------------------- | ------------------ | ---- |
| **A. 统一 `<domain>:<action>:<entityId>[:<subId>]`** | 一眼读懂 + 跨路径可对账 | 现有调用点全要改   | ✅   |
| B. 各路径自由                                        | 0 改                    | 永远在猜对方的格式 |      |

### 4.2 Q2 typed action vs string action

| 选项                                           | 优                  | 劣                     | 选择 |
| ---------------------------------------------- | ------------------- | ---------------------- | ---- |
| **A. action 是 string，但通过 const 枚举集中** | 灵活；ts 严格度足够 | 加新 action 要改 const | ✅   |
| B. action 是 union literal type                | 严格                | 加新 action 改 5+ 地方 |      |

const 集中在 `apps/backend/src/common/idempotency/actions.ts`。

### 4.3 Q3 审计表上线时机

| 选项                                     | 优       | 劣               | 选择 |
| ---------------------------------------- | -------- | ---------------- | ---- |
| **A. 与本 PR 同 schema + 写入**          | 一次到位 | 加 schema        | ✅   |
| B. 仅 logger.warn 输出，后续单独 PR 加表 | 渐进     | 日志大；查询困难 |      |

### 4.4 Q4 share event sid 列改 nullable

| 选项                                    | 优          | 劣                                                             | 选择 |
| --------------------------------------- | ----------- | -------------------------------------------------------------- | ---- |
| **A. sid nullable + partial unique**    | 干净        | migration 改 NOT NULL → nullable，要先确认无 NOT NULL 兜底字段 | ✅   |
| B. 保留 NOT NULL，用 'AGGREGATE' 字面值 | 0 migration | hack；查询语义混乱                                             |      |

---

## 5. 迁移与回滚

### 5.1 部署顺序

1. **D1**：`buildIdempotencyKey` + `redisIdempotencyKey` 工具 + 单测；不动业务。
2. **D2**：`sys_idempotency_audit` 表 + retention job 占位。
3. **D3**：批量替换调用点；每个调用点是独立 PR，作用域单文件。
4. **D4**：`sid` 列改 nullable + partial unique；删 'AGGREGATE' 字面值。
5. **D5**：观察 1 周审计数据；调整 Redis TTL。

### 5.2 回滚

D1-D2 安全。D3 按调用点单独 revert。D4 涉及 schema，回滚需把 sid 列加 NOT NULL 兜底（用 'LEGACY' 字面值填充），不可逆部分仅是 partial unique 已生效——可单独 DROP INDEX。

---

## 6. 验证矩阵

| 层   | 用例                                                                 | 工具      |
| ---- | -------------------------------------------------------------------- | --------- |
| 静态 | grep `mkt:idem:` 在 backend service 仅出现在 `keys.ts`               | rg        |
| 静态 | grep `\$\{eventType\}:\$\{orderId\}` 在业务代码 0 命中               | rg        |
| 静态 | grep `sid: ['"]AGGREGATE['"]` 全仓 0                                 | rg        |
| Spec | buildIdempotencyKey 4 元参数完整组合                                 | vitest    |
| Spec | buildIdempotencyKey 长度 > 160 抛错                                  | vitest    |
| Spec | entityId / subId 包含 ":" 抛错                                       | vitest    |
| 集成 | outbox 同 dedupeKey 写入第二次抛 P2002（DB unique）                  | supertest |
| 集成 | Redis L3 SET NX 命中 → 写一行 audit                                  | supertest |
| 集成 | partial unique 阻挡 Bull replay 双计 orderCount                      | supertest |
| 监控 | `idempotency_hit_rate = audit 命中数 / API 总请求数` 24h 平均 < 0.1% | Grafana   |

---

## 7. 风险与未决

### 7.1 TODO

1. **TODO-1**：现有 `mkt_user_coupon` 是否考虑加 L3 Redis 兜底？P2-11 已用 DB unique（L1），第一版可以不补 L3。若高并发下 DB 排队成本高再补。
2. **TODO-2**：`actions.ts` 常量集中维护，但跨模块导入；是否放 `libs/common-constants`？P0-00 暂留 backend 内部，未来按需迁移。
3. **TODO-3**：`SysIdempotencyAudit` 表 retention job 由 P1 阶段 batch job 框架统一做（如果有），否则 P2 阶段独立 PR；本设计**不写**这个 job。

### 7.2 风险

| 风险                                                   | 等级 | 缓解                                              |
| ------------------------------------------------------ | ---- | ------------------------------------------------- |
| 调用点改造遗漏，新旧格式并存                           | 中   | grep 静态检查 + PR review                         |
| `sys_idempotency_audit` 写入频率高 → DB 压力           | 中   | 仅 L3 命中才写（命中率应 < 0.1%）；命中率高即报警 |
| `partial unique` 在 Prisma 中需 raw migration，CI 兼容 | 低   | 走 prisma migrate dev 验证后 commit               |
| `sid` 列改 nullable 后旧代码假定 NOT NULL 失败         | 中   | grep 旧 sid 读取点，加 `?? 'UNKNOWN'` 兜底显示    |

### 7.3 不在本设计范围

- 跨服务（如微信支付回调）的 idempotency-token：另一层，本规约只管内部。
- 分布式 tracing 与 idempotency 的关联（traceId 是不是天然幂等键？）：留 P2 监控规划。

---

## 8. 实施清单

### 8.1 backend

- [ ] `apps/backend/src/common/idempotency/keys.ts`：buildIdempotencyKey / redisIdempotencyKey
- [ ] `apps/backend/src/common/idempotency/actions.ts`：常量集中
- [ ] `apps/backend/src/common/idempotency/audit.service.ts`：L3 命中写 audit
- [ ] Prisma：`SysIdempotencyAudit` 模型 + migration
- [ ] outbox writer / dispatcher 改用 buildIdempotencyKey
- [ ] OrderIntegrationService.executeWithIdempotency 入参重构
- [ ] coupon / commission / share event 调用点替换
- [ ] `sys_dist_share_event.sid` 改 nullable + partial unique（raw SQL migration）

### 8.2 验证

- [ ] `pnpm typecheck:backend && pnpm lint:backend`
- [ ] `pnpm test:backend -- idempotency`
- [ ] `pnpm test:backend -- outbox`
- [ ] `pnpm check:slice`
- [ ] PR 前完整 verify。

### 8.3 PR 分批

- PR1: keys.ts + actions.ts + audit 表
- PR2: outbox / integration.service 调用点改造
- PR3: coupon / commission / share event 改造 + sid 列 schema 改造

### 8.4 PR 标题

PR1: `feat(backend): 幂等键统一规约 + 审计表`
PR2: `refactor(backend): outbox/integration 调用点接入 IdempotencyKeyBuilder`
PR3: `refactor(backend): coupon/commission/share-event 接入幂等规约，删 'AGGREGATE' hack`
