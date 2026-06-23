# P0-02 订单领域事件 Outbox 化

**owner**: 待指派 / 后端
**status**: draft（待评审 → 待实施）
**last_verified**: 2026-05-15（仅取证，未执行任何代码改动）
**related**: [[P0-01-attribution-config]]、[[P0-04-cart-bind-sid]]、[[P1-08-clean-fake-events]]

---

> **跨文档硬约束**：本设计涉及金额字段全链路遵循 [[P0-00-money-precision]]（禁止业务模块对 `*Amount/*Price/*Discount/*Fee` 做 JS 原生算术）；幂等键格式遵循 [[P2-14-idempotency-key-convention]]（禁止业务模块手写 `domain:action:id` 字面值）。

## 1. 目标与范围

### 1.1 目标

把订单四类领域事件（`order.created` / `order.paid` / `order.cancelled` / `order.refunded`）从"事务内 emitAsync"或"事务后 queue.add"两条不可靠路径，**全部**改为"事务内写 outbox 表 → 独立 dispatcher 入 Bull 队列"的 transactional outbox 模式。消除以下两类裂缝：

- **正向裂缝**：订单状态已落库（PAID / CANCELLED / REFUNDED），但因 Redis / Bull 抖动 `queue.add` 抛错，营销侧 useCoupon / unlockCoupon / refundPoints 永远不发生 → 优惠券永久 LOCKED、积分永久 FROZEN。
- **逆向裂缝**：`order.created` 监听器同步在订单事务内锁券/冻积分，若订单事务在监听器**之后**因任何原因失败（DB 抖动、唯一键冲突、级联校验），listener 已写入的 Redis idempotency key（TTL 10 分钟）会让随后重试也短路。

### 1.2 范围

- ✅ 替换 `OrderDomainEventPublisher`：4 个 `publishXxx` 方法不再直连 EventEmitter2 / Bull，改为写 `OmsOrderEventOutbox` 行。
- ✅ 新建 `OmsOrderEventOutbox` Prisma model + migration。
- ✅ 新建 `OrderOutboxDispatcher`（节点内调度，单实例锁，独立于业务请求线）。
- ✅ 改造 `OrderDomainEventListener` 与 `OrderFinanceEventListener` 的触发口径：listener 由 dispatcher 在确认入队成功后调用，业务路径不再直接 emit。
- ✅ `order.created` 业务语义重写：锁券/冻积分从"listener 内"前移到"订单事务内 SQL 原子操作"，不依赖事件回调。
- ❌ 不在本文档动 `commission` / `settlementCore` / `playInstance` 业务逻辑（属各自模块的契约）。
- ❌ 不引入 Debezium / CDC / Kafka，保持 Postgres 内闭环（决策见 §3.4 Q1）。
- ❌ 不做灰度 / feature flag（决策见 §3.4 Q2，一刀切）。

### 1.3 DoD（Definition of Done）

1. `apps/backend/src` 全局 `grep -r 'this.eventEmitter.emitAsync' apps/backend/src/module/client/order` 仅剩 0 处。
2. `apps/backend/src` 全局 `grep -r 'orderEventPublisher.publish' --include='*.ts' | grep -v spec` 命中的所有调用点都在 `@Transactional` 边界内、且当前 tx 写了 outbox 行。
3. 所有 `marketingQueue.add` 调用收敛到 `OrderOutboxDispatcher` 一处，业务代码内 0 处直调。
4. `OrderIntegrationService.handleOrderCreated` 整体删除，锁券/冻积分以 `applyOrderCouponLock` / `applyOrderPointsFreeze` 形式由 `OrderCreationApplicationService` 在事务内直接调用。
5. 新增集成测试覆盖：订单 tx commit 后 dispatcher 5s 内必能把对应 outbox 行投递并标记 `DISPATCHED`；模拟 Bull `add` 抛错时，outbox 行保持 `PENDING` 且 dispatcher 下一轮重试。
6. P0-02 不引入新增定时器或新表外的"补丁式补偿"逻辑（遵循 [[feedback_no_compensating_complexity]]：dispatcher 是唯一新机制，覆盖所有失败语义）。

---

## 2. 现状取证

> 所有引用位置基于 2026-05-15 主干 commit `02537317`。

### 2.1 当前事件链路

| 事件              | 发布点                                                                          | 在 tx 内？           | 落地方式                                    | 风险                                                                     |
| ----------------- | ------------------------------------------------------------------------------- | -------------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| `order.created`   | `order-creation-application.service.ts:178` (`publishOrderCreatedForMarketing`) | **是**（外层 tx 内） | `emitAsync` → 同步调用 `handleOrderCreated` | listener 在 tx 内做锁券/冻积分，若 listener 后 tx 回滚，Redis 幂等键已写 |
| `order.paid`      | `payment.service.ts:151` (`publishPaidEvent`)                                   | 否（tx 已 commit）   | `emitAsync` → listener `marketingQueue.add` | 入队失败抛错回业务，业务侧没有补偿，订单已 PAID 但券永远 LOCKED          |
| `order.cancelled` | `order.service.ts:187` / `:247`                                                 | 否                   | 同上                                        | 同上，券永远 LOCKED + 积分永远 FROZEN                                    |
| `order.refunded`  | `store-order.service.ts:503` / `:711`                                           | 否                   | 同上                                        | 同上，但还叠加退款侧资金/库存已动                                        |

### 2.2 关键证据

**外层订单事务内同步 emit（裁剪保留关键行）**：

```ts
// apps/backend/src/module/client/order/services/order-creation-application.service.ts
@Transactional()
private async createOrderInTransaction(params: CreateOrderInTxParams) {
  // ... omsOrder.create + items.create
  await this.marketingPort.writeOrderItemAttributions(...);
  await this.marketingPort.ensureMemberUpgradePlayInstances(...);
  await this.marketingPort.ensureCourseGroupPlayInstances(...);
  await this.inventoryPort.deductForOrderItems(...);
  await this.cartPort.consumeCheckedOutItems(...);
  await this.publishOrderCreatedForMarketing(order.id, orderSn, memberId, dto); // ← 仍在 tx 内
  return order;
}

private async publishOrderCreatedForMarketing(...) {
  if (!dto.userCouponId && (!dto.pointsUsed || dto.pointsUsed <= 0)) return;  // ← 选择性发布
  await this.orderEventPublisher.publishCreated({ ... });
}
```

**listener 同步在外层 tx 内锁券/冻积分（ALS tx 透传）**：

```ts
// apps/backend/src/module/marketing/integration/order-domain-event.listener.ts
@OnEvent(OrderDomainEventType.CREATED)
async handleOrderCreated(event: OrderCreatedDomainEvent): Promise<void> {
  await this.orderIntegrationService.handleOrderCreated(  // ← 同步调用，共享 ALS tx
    event.orderId, event.memberId, event.userCouponId, event.pointsUsed,
  );
}
```

```ts
// apps/backend/src/module/marketing/integration/integration.service.ts:160
async handleOrderCreated(orderId, memberId, userCouponId?, pointsUsed?) {
  return this.executeWithIdempotency('created', orderId, async () => {
    if (userCouponId) await this.couponUsageService.lockCoupon(userCouponId, orderId);
    if (pointsUsed > 0) await this.pointsAccountService.freezePoints(memberId, pointsUsed, orderId);
    await this.emitIntegrationEvent(MarketingEventType.INTEGRATION_ORDER_CREATED, ...);  // ← 又一层假事件
  });
}
```

**tx 外 enqueue 失败无补偿**：

```ts
// payment.service.ts:148
private async publishPaidEvent(order, transactionId, orderPayAmount) {
  try {
    await this.orderEventPublisher.publishPaid({ ... });   // ← emitAsync → listener queue.add
  } catch (error) {
    this.logger.error(`Publish order paid event failed for order ${order.id}`, error);
    throw error;                                            // ← 抛错后调用方无补偿，订单状态已 PAID
  }
}
```

```ts
// order-domain-event.listener.ts:97
private async enqueue(name, jobId, payload) {
  try {
    await this.marketingQueue.add(name, payload, { jobId });
  } catch (error) {
    this.logger.error({ message: 'Failed to enqueue order marketing event', ... });
    throw error;                                            // ← 同样抛错回业务
  }
}
```

### 2.3 当前已具备 / 不需要重建的能力

- ✅ `OrderIntegrationService.executeWithIdempotency` 已有 Redis 幂等键（600s）；outbox 化后保留，作为 worker 端"业务级幂等"二道防线。
- ✅ `Bull jobId = ${eventType}:${orderId}[:${refundReferenceId}]` 已有队列级去重；保留。
- ✅ `OrderMarketingEventProcessor` 已用 `TenantContext.run` 包裹 handler；保留，dispatcher 写 outbox 时同步带上 `tenantId`。**注意：当前 worker 内 `tenantId || TenantContext.SUPER_TENANT_ID` 兜底**必须废弃（详见 §3.4 不变量），缺 tenantId 直接死信，不能静默走超级租户路径——否则跨租户隔离失效。
- ✅ `Transactional` ALS 已经能跨 service 透传 tx；outbox 写入复用同一 tx。

### 2.4 当前缺失能力清单（本设计要补齐的）

1. `OmsOrderEventOutbox` 表 + migration。
2. `OrderOutboxDispatcher`：基于 `setInterval` + Postgres `SELECT … FOR UPDATE SKIP LOCKED` + Bull `add`，单实例锁。
3. 锁券/冻积分从事件回调路径前移到 `OrderCreationApplicationService` 事务内直调；删 `OrderIntegrationService.handleOrderCreated`。
4. 调用方移除"tx 外 publishXxx"模式，统一改"tx 内 writeOutbox"。

---

## 3. 设计方案

### 3.1 数据模型

新增表 `oms_order_event_outbox`：

```prisma
// apps/backend/prisma/models/50-order.prisma（追加，不动既有 OmsOrder）

enum OrderOutboxStatus {
  PENDING
  DISPATCHED
  FAILED          // 重试达到上限的死信状态，由人工或独立补偿流程处理
}

model OmsOrderEventOutbox {
  id          BigInt            @id @default(autoincrement())
  tenantId    String            @map("tenant_id")
  orderId     String            @map("order_id")
  /// 事件类型，与 OrderDomainEventType 1:1 对齐：order.created/paid/cancelled/refunded
  eventType   String            @map("event_type") @db.VarChar(32)
  /// dispatcher 投递时用作 Bull jobId 的稳定键；不再外部生成
  dedupeKey   String            @unique @map("dedupe_key") @db.VarChar(160)
  /// 完整事件 payload（与 OrderXxxDomainEvent 等价），dispatcher 直接透传给 Bull
  payload     Json
  status      OrderOutboxStatus @default(PENDING)
  attempts    Int               @default(0)
  lastError   String?           @map("last_error") @db.VarChar(500)
  /// 第一次到达可投递时间；用于将来需要"延迟事件"时扩展
  availableAt DateTime          @default(now()) @map("available_at")
  dispatchedAt DateTime?        @map("dispatched_at")
  createTime  DateTime          @default(now()) @map("create_time")
  updateTime  DateTime          @updatedAt @map("update_time")

  @@index([status, availableAt], map: "idx_oms_order_outbox_status_avail")
  @@index([orderId])
  @@map("oms_order_event_outbox")
}
```

**字段决策说明**：

- `dedupeKey` 形如 `paid:<orderId>` / `refunded:<orderId>:<refundReferenceId>`，与现 listener `enqueue` 第二参完全一致 → migration 期对老 Bull jobId 兼容。
- 不存 `version` / 乐观锁列：dispatcher 通过 `UPDATE … WHERE status = 'PENDING'` returning 拿到行后立刻 `SKIP LOCKED` 占用，避免 ABA。
- 不存 `idempotency` 列：worker 端继续用 Redis 幂等键，outbox 只管投递可靠，不替代 worker 幂等（**两层职责分离**）。
- `payload` 是 Json 而非 Jsonb：保持简单、读出后 `JSON.parse` 不影响性能；Postgres `json` 列写入 `Prisma.InputJsonValue` 即可。

### 3.2 写入侧（业务事务内）

**新建 `OrderOutboxWriter`**（`apps/backend/src/module/client/order/events/order-outbox.writer.ts`）：

```ts
@Injectable()
export class OrderOutboxWriter {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cls?: ClsService,
  ) {}

  private get client(): PrismaService | Prisma.TransactionClient {
    return this.cls?.get<Prisma.TransactionClient>('PRISMA_TX') ?? this.prisma;
  }

  /** 必须在 @Transactional 内调用，与订单状态变更共享同一 tx。 */
  async write(event: OrderDomainEvent): Promise<void> {
    const dedupeKey = buildDedupeKey(event); // paid:<orderId> | refunded:<orderId>:<refundRef> | ...
    await this.client.omsOrderEventOutbox.create({
      data: {
        tenantId: event.tenantId,
        orderId: event.orderId,
        eventType: event.type,
        dedupeKey,
        payload: event as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
```

**替换 `OrderDomainEventPublisher`**（保留类名与方法签名，避免雪崩式 caller 改动）：

```ts
@Injectable()
export class OrderDomainEventPublisher {
  constructor(private readonly outboxWriter: OrderOutboxWriter) {}

  async publishCreated(event: Omit<OrderCreatedDomainEvent, 'type'>): Promise<void> {
    await this.outboxWriter.write({ type: OrderDomainEventType.CREATED, ...event });
  }
  async publishPaid(event: Omit<OrderPaidDomainEvent, 'type'>): Promise<void> {
    await this.outboxWriter.write({ type: OrderDomainEventType.PAID, ...event });
  }
  async publishCancelled(event: Omit<OrderCancelledDomainEvent, 'type'>): Promise<void> {
    await this.outboxWriter.write({ type: OrderDomainEventType.CANCELLED, ...event });
  }
  async publishRefunded(event: Omit<OrderRefundedDomainEvent, 'type'>): Promise<void> {
    await this.outboxWriter.write({ type: OrderDomainEventType.REFUNDED, ...event });
  }
}
```

**调用点必须满足的约束**（一条不满足就必须先调整调用点再合并 P0-02）：

| 调用点                                                | 当前是否在 tx 内 | 需改造                                                                                  |
| ----------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------- |
| `order-creation-application.service.ts:178` (CREATED) | 是               | 保持在 `createOrderInTransaction` 内，且**必须**在锁券/冻积分 SQL **之后**（详见 §3.3） |
| `payment.service.ts:151` (PAID)                       | 否               | 把 `publishPaidEvent` 移到 `markOrderPaidAndEnsureFulfillment`（已 `@Transactional`）内 |
| `order.service.ts:187` / `:247` (CANCELLED)           | 否               | 把 publish 移到包裹取消的 `@Transactional` 方法内（若无则新增）                         |
| `store-order.service.ts:503` / `:711` (REFUNDED)      | 部分在 tx 内     | 全部纳入退款 `@Transactional` 方法内                                                    |

### 3.3 锁券 / 冻积分的去事件化

`order.created` 事件原本承担"锁券 + 冻积分"职责。outbox 化后事件投递是异步的，不能再依赖 listener 在 tx 内做这件事。锁券/冻积分必须**先于** outbox 写入完成。

新增到 `OrderCreationApplicationService.createOrderInTransaction`：

```ts
// 在 omsOrder.create 之后、publishOrderCreatedForMarketing 之前：
if (dto.userCouponId) {
  await this.couponUsageService.lockCouponInTx(dto.userCouponId, order.id);
  //  ↑ lockCouponInTx 通过 UPDATE mkt_user_coupon SET status='LOCKED'
  //    WHERE id=? AND status='UNUSED' AND memberId=? AND tenantId=?
  //    RETURNING * — count=0 时抛 BusinessException，由 outer tx 回滚。
}
if (dto.pointsUsed && dto.pointsUsed > 0) {
  await this.pointsAccountService.freezePointsInTx(memberId, dto.pointsUsed, order.id);
  //  ↑ 同样走 SQL 原子扣减，行为见 [[P1-10-points-deduction-retry-fix]]
}
```

然后再写 outbox：

```ts
await this.publishOrderCreatedForMarketing(order.id, orderSn, memberId, dto);
```

如此一来：

- 锁券/冻积分失败 → tx 回滚，订单不存在、outbox 行也不存在。
- 锁券/冻积分成功 + outbox 写入失败（不可能：同一 tx）→ tx 回滚，全部撤销。
- 锁券/冻积分成功 + outbox 行写入 + tx commit → 后续 dispatcher 异步派发"已创建"事件，listener 只做"通知 / 上报 / 派生积分预热"等**非关键路径**。
- 删除 `OrderIntegrationService.handleOrderCreated` 和 listener 的 `@OnEvent(CREATED)`（[[P1-08-clean-fake-events]] 一并清理）。

> **此变更必须与 P1-10 协同**：`freezePointsInTx` 的原子 SQL 是 P1-10 的实现物，本文档假设它已就绪。如果 P0-02 早于 P1-10 实施，先临时用现有的 `freezePoints`（accept its known retry bug），但要在 P1-10 完成前不上 prod。

### 3.4 派发侧（独立调度线）

**`OrderOutboxDispatcher`**（`apps/backend/src/module/client/order/events/order-outbox.dispatcher.ts`）：

```ts
@Injectable()
export class OrderOutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderOutboxDispatcher.name);
  private readonly tickIntervalMs = 1000; // 业务 SLA: tx commit 后 ≤2s 派发
  private readonly batchSize = 50;
  private readonly maxAttempts = 8; // 与 Bull 默认 attempts 协同
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(ORDER_MARKETING_QUEUE) private readonly queue: Queue,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.tickSafe(), this.tickIntervalMs);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tickSafe() {
    if (this.running) return; // 单实例内串行
    this.running = true;
    try {
      await this.tick();
    } catch (e) {
      this.logger.error({ message: 'outbox tick failed', error: getErrorMessage(e) });
    } finally {
      this.running = false;
    }
  }

  private async tick() {
    // 多实例并发：用 advisory lock 把同一 batch 内的行 SKIP LOCKED 占有
    const rows = await this.prisma.$queryRaw<OutboxRow[]>`
      SELECT id, tenant_id, order_id, event_type, dedupe_key, payload, attempts
      FROM oms_order_event_outbox
      WHERE status = 'PENDING' AND available_at <= NOW()
      ORDER BY id ASC
      LIMIT ${this.batchSize}
      FOR UPDATE SKIP LOCKED
    `;
    if (rows.length === 0) return;

    for (const row of rows) {
      try {
        await this.queue.add(row.event_type, row.payload, { jobId: row.dedupe_key });
        await this.prisma.$executeRaw`
          UPDATE oms_order_event_outbox
          SET status='DISPATCHED', dispatched_at=NOW(), update_time=NOW()
          WHERE id=${row.id}
        `;
      } catch (error) {
        const nextAttempts = row.attempts + 1;
        const nextStatus = nextAttempts >= this.maxAttempts ? 'FAILED' : 'PENDING';
        const nextAvailable = backoff(nextAttempts); // 指数退避
        await this.prisma.$executeRaw`
          UPDATE oms_order_event_outbox
          SET attempts=${nextAttempts},
              status=${nextStatus}::"OrderOutboxStatus",
              last_error=${truncate(getErrorMessage(error), 500)},
              available_at=${nextAvailable},
              update_time=NOW()
          WHERE id=${row.id}
        `;
      }
    }
  }
}
```

**关键决策**：

- **不接入 SchedulerRegistry / @Cron**：dispatcher 是基础设施，不应进入 `sys_job` 治理面（不需要运营改频率）；`setInterval` 在 NestJS lifecycle 中受控。
- **`SKIP LOCKED` + 隐式 advisory**：多 API 实例同时 tick 时，Postgres 行级跳锁天然分片，无须额外协调；如果将来拆出 Worker 进程并独占 dispatcher，把 dispatcher 改成 `process.env.RUN_OUTBOX_DISPATCHER === 'true'` 才启用即可。
- **批量大小 50 + tick 1s**：理论吞吐 50 tps/实例，远高于业务侧每秒下单数；超出时 backlog 自然累积，由 ops 报警发现而不是默默丢失。
- **`maxAttempts` = 8 + 指数退避**：`min(2^attempts, 600)` 秒，与 Bull 默认 attempts/backoff 形成"outbox 重投 → Bull 内重投"双层。8 次累计 ~20 分钟后 FAILED 死信，等待人工或 P1-08 后的死信清理 job。
- **Bull jobId 直接复用 `dedupeKey`**：dispatcher 失败重投 → Bull 看到同 jobId 不会重复入队；worker 端再用 Redis 幂等键兜底。**三层去重**：outbox 唯一约束（同 dedupeKey 第二次写入会被外层 tx 失败拦下）+ Bull jobId 去重 + worker 业务幂等。

**不变量（跨租户隔离硬约束）**：

- 写 outbox 时，`tenantId` **必须**非空非默认值；publisher 入口若收到空 tenantId 直接抛 `BusinessException`，不允许写库。
- worker 端 `OrderMarketingEventProcessor.runWithTenant` **不允许** `tenantId || TenantContext.SUPER_TENANT_ID` 兜底。改为：`tenantId` 缺失 → log error + `throw new Error('outbox row missing tenantId')` → Bull 触发 retry → maxAttempts 后入死信，**绝不进入 SUPER_TENANT_ID 上下文**。
- 历史脏数据（migration 前的 outbox 行）由 D2 部署前手工对账清理（详见 §5.3）；上线后 schema NOT NULL 兜底，写入路径不可能产生空 tenantId 行。
- 跨租户内部任务（如运营批量清理）若需要超级租户上下文，必须显式调用 `TenantContext.runAsSuper(() => ...)`，禁止通过 outbox 链路绕道。

**幂等键格式遵循 [[P2-14-idempotency-key-convention]]**：`buildIdempotencyKey('order', <action>, orderId, refundReferenceId?)`，禁止业务模块手写字面值拼接。

### 3.5 事件消费侧不变

- `OrderDomainEventListener.handlePaid / handleCancelled / handleRefunded` 的"事件 → queue.add"逻辑整体迁移到 dispatcher，listener 类**只保留 `@OnEvent(CREATED)` 兜底监听**吗？不——决策见 §3.4 Q3：CREATED 不再有任何 listener，整个 listener 类删除。
- `OrderMarketingEventProcessor` / `OrderFinanceEventListener`（PAID 兜底走 listener 而非 outbox dispatcher，因为 listener 在 Bull worker 内）保留。Wait — `OrderFinanceEventListener` 还在用 `@OnEvent(PAID)`：那条路径走 EventEmitter2 而非 Bull。这是个分裂。**本文档要求 `OrderFinanceEventListener` 也改为 Bull worker 监听 `paid` job**，由同一 worker 同步调用 `commissionService.triggerCalculation` + `settlementCore.recordPaidOrder`，而不是再叠一个 listener。具体改名：`OrderFinanceEventListener` → `OrderFinanceJobHandler`，在 `OrderMarketingEventProcessor.handlePaid` 处理完后调用，或者改造 `ORDER_MARKETING_QUEUE` 的 `paid` job 内同时执行营销和财务两类副作用（保持单 worker，事务边界清晰）。

### 3.6 监控与可观测

- `oms_order_event_outbox` 暴露 3 个查询用 metric：
  - `outbox_pending_count`（PENDING 数量）→ Grafana 阈值告警 > 100。
  - `outbox_max_pending_age_seconds`（最老 PENDING 行年龄）→ > 60s 告警。
  - `outbox_failed_count`（FAILED 累计）→ > 0 告警。
- 这 3 个 metric 由 `OrderOutboxMetricsService` 每 10s 采集（`@Cron('*/10 * * * * *')`，进入 sys_job 治理面，运营可见）。**这是 P0-02 唯一允许的新定时器**。

---

## 4. 决策依据（trade-off）

> 本节是用户已确认的决策的取证留档。所有 Q 都对应"产 P0-02"上一轮对话已选 A。

### 4.1 Q1 dispatcher 用什么投递目标？

| 选项                             | 优                                                          | 劣                                                           | 选择 |
| -------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ | ---- |
| **A. Bull 队列**                 | 复用 `ORDER_MARKETING_QUEUE`，0 新依赖；worker 现成；可重试 | Redis 单点 → 但已是项目硬依赖；不适合跨服务集成              | ✅   |
| B. Kafka / RabbitMQ              | 跨服务/跨语言；持久化更强                                   | 新增基础设施，违反 [[feedback_no_compensating_complexity]]   |      |
| C. Postgres LISTEN/NOTIFY        | 0 新依赖；事务感知                                          | 不持久，订阅方挂掉就丢；nest 生态适配差                      |      |
| D. dispatcher 直接 await handler | 极简                                                        | 阻塞 dispatcher tick；任何 handler 慢 1s 都会让 backlog 雪崩 |      |

### 4.2 Q2 上线策略：灰度还是一刀切？

| 选项                                                 | 优                                       | 劣                                                         | 选择 |
| ---------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------- | ---- |
| **A. 一刀切切流**                                    | 没有"半 outbox 半直发"裂缝；代码路径单一 | 上线日有窗口风险；需充分集成测试                           | ✅   |
| B. feature flag 灰度                                 | 风险隔离                                 | 双路径长期共存，难维护；新代码路径无 production 流量验证   |      |
| C. 仅 PAID/CANCELLED/REFUNDED 切换，CREATED 保持同步 | 改动小                                   | CREATED 是本设计要解决的最大裂缝（逆向裂缝），不切等于白做 |      |

### 4.3 Q3 锁券 / 冻积分前移还是保持事件触发？

| 选项                                   | 优                                                  | 劣                                                      | 选择 |
| -------------------------------------- | --------------------------------------------------- | ------------------------------------------------------- | ---- |
| **A. 前移到 createOrderInTransaction** | 锁券/冻积分与订单状态强一致；删 listener 后链路极简 | 调用方编排责任加重；要求 P1-10 SQL 原子化先就位         | ✅   |
| B. 用 outbox 同步事务"事件 → 锁券"     | 保留事件驱动语义                                    | 异步窗口内允许超用券；outbox 不能"在 tx 内回调 handler" |      |

### 4.4 Q4 dispatcher 频率？

| 选项                      | 优                      | 劣                               | 选择 |
| ------------------------- | ----------------------- | -------------------------------- | ---- |
| **A. 1s tick + 50 batch** | 业务 SLA: ≤2s；负载可控 | Postgres 每秒一次空查（极轻）    | ✅   |
| B. 100ms tick + 5 batch   | 更低尾延迟              | Postgres 空查频率提升 10×        |      |
| C. 10s tick + 200 batch   | 极低负载                | C 端"下单后立即看到积分到账"破坏 |      |

---

## 5. 迁移与回滚

### 5.1 部署顺序

1. **D1**：合并 P1-10 PR（SQL 原子化扣积分 / 冻结），等其稳定 ≥3 天。
2. **D2**：合并本 PR 的 schema 部分（建表 + index），不接入业务代码。
3. **D3**：合并 dispatcher + writer + publisher 替换 + 业务调用点重构，单次切流。**部署窗口选低峰**，部署前清理掉 `mkt_user_coupon` 中残留的孤立 LOCKED 行（详见 §5.3）。
4. **D4**：部署后 24h 内观察 `outbox_pending_count` / `outbox_max_pending_age_seconds`。

### 5.2 回滚

- D3 出问题：`git revert` 整个 PR。schema 不删（向后兼容），表保留为空。
- 老代码恢复后，`emitAsync` 路径重新可用，业务无感。

### 5.3 D3 前置清理

部署前在 staging 跑：

```sql
-- 找出"订单已 PAID / CANCELLED 但 user_coupon 仍 LOCKED"的孤儿行，清理或上报
SELECT uc.id, uc.order_id, uc.status, o.status AS order_status
FROM mkt_user_coupon uc
JOIN oms_order o ON o.id = uc.order_id
WHERE uc.status = 'LOCKED'
  AND o.status IN ('PAID', 'CANCELLED', 'REFUNDED')
  AND o.update_time < NOW() - INTERVAL '1 hour';
```

如有数据，先按订单状态把 LOCKED 推到 USED / UNUSED，再上线。否则上线后 dispatcher 投递 paid/cancelled job → worker 试图 useCoupon / unlockCoupon 命中已不在 LOCKED 的行 → 业务幂等会让它跳过 → **看似 ok 实则掩盖历史脏数据**。

---

## 6. 验证矩阵

| 层           | 用例                                                                                                                 | 工具                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 静态         | `grep` 4 处 publisher caller 全在 `@Transactional` 内；listener 无 `@OnEvent(CREATED)`；`marketingQueue.add` 仅 1 处 | `rg`                               |
| Spec（强制） | 订单 tx commit 后 `oms_order_event_outbox` 存在 PENDING 行；dispatcher 1 tick 内 status → DISPATCHED                 | 集成测试 + Postgres testcontainers |
| Spec         | 模拟 Bull `add` 抛错：行 attempts++, status=PENDING, available_at 后移                                               | jest mock + integration test       |
| Spec         | 模拟订单 tx 回滚：outbox 行不存在（同 tx 写入）                                                                      | jest + tx mock                     |
| 性能         | 1000 并发下单 → dispatcher 5s 内全部派发；`outbox_pending_count` 峰值 ≤ 100                                          | k6 / autocannon + Grafana          |
| 故障演练     | 强杀 dispatcher 节点 → 30s 内由另一 API 实例的 dispatcher 接手；无重复投递                                           | docker compose kill + curl 重试    |
| 手动         | 用 admin 端取消订单 → 30s 内看到券 UNUSED、积分解冻                                                                  | admin-web + 后台日志               |
| 监控         | `outbox_max_pending_age_seconds` 实时数据从 Grafana 可看到                                                           | Grafana dashboard                  |

---

## 7. 风险与未决问题

### 7.1 留给实施者的 TODO

1. **TODO-1**：`buildDedupeKey(event)` 工具函数放哪？建议放 `apps/backend/src/module/client/order/events/order-outbox.dedupe.ts` 与 `OrderOutboxWriter` 同目录；测试与 `order-domain-event.types.ts` 强约束。
2. **TODO-2**：metric 上报通道（Prometheus / OpenTelemetry / 内部 metrics）—— 本仓库当前 metric 基建不清晰，**实施期必须 grep `harness:smoke` 与 `sys_metric` 看是否已有标准上报点**；如果没有，先落 log，由 ops 加 dashboard。
3. **TODO-3**：`maxAttempts=8` 后的死信 → 当前设计只 set status=FAILED，未自动通知。需要确认是否要新增 admin 端死信查看页面；若否，先依赖 `outbox_failed_count > 0` 告警 + DBA 手动 SQL。
4. **TODO-4**：`OrderFinanceEventListener` 改成 Bull worker handler 后，是否要保留 `@OnEvent(PAID)` 作为本地集成测试兜底？建议**不保留**，集成测试改为直接调用 `OrderMarketingEventProcessor.handlePaid` mock job。

### 7.2 已知风险

| 风险                                                                      | 等级 | 缓解                                                                                                                                                                           |
| ------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| dispatcher 单节点崩溃，PENDING 积压                                       | 中   | 多 API 实例自动接手；告警 `outbox_max_pending_age_seconds > 60s`                                                                                                               |
| Postgres `SKIP LOCKED` 在 RR 隔离下行为                                   | 低   | Prisma 默认 RC；本仓库 `prisma.service` 未启用 RR；如启用需复测                                                                                                                |
| `OmsOrderEventOutbox` 表无限增长                                          | 中   | 已 DISPATCHED ≥ 30 天的行由独立 retention job 软删；本设计**不**写这个 job（违反 [[feedback_no_compensating_complexity]] 兜底原则），等 P1 阶段集中规划保留期                  |
| 旧 jobId（按 `${eventType}:${orderId}` 命名）与新 dedupeKey 同名碰撞      | 低   | 完全相同，是预期行为：dispatcher 切流前 Bull 内的同 jobId 已被 worker 消化或 stuck；新行入队 jobId 与 stuck job 撞会被 Bull 去重——但 stuck 的旧 job 反正未投递成功，丢弃可接受 |
| `commission` / `settlement` 走 Bull worker 后失败重试与原 listener 不一致 | 中   | 在 §3.5 标记 `OrderFinanceEventListener` 同步改造；本 PR 与 finance 模块 owner 共审                                                                                            |

### 7.3 不在本设计范围（明确划线）

- 跨服务事件总线（Kafka / NATS）：等真要做微服务再说。
- `mkt_user_coupon` 状态机重新设计：另案。
- `play_instance` 事件外发：play 自己的发布逻辑独立演进（[[P1-06-merge-play-strategy-handler]]）。
- `commission` 计算的幂等与并发：在 finance 模块自治范围内。

---

## 8. 实施清单

### 8.1 backend

- [ ] `apps/backend/prisma/models/50-order.prisma`：新增 `OmsOrderEventOutbox` model + `OrderOutboxStatus` enum + 索引。
- [ ] `pnpm prisma:migrate --name add_oms_order_event_outbox`（schema 变更走标准 migration，禁止改既有 migration）。
- [ ] `apps/backend/src/module/client/order/events/order-outbox.dedupe.ts`：`buildDedupeKey(event)`。
- [ ] `apps/backend/src/module/client/order/events/order-outbox.writer.ts`：`OrderOutboxWriter`。
- [ ] `apps/backend/src/module/client/order/events/order-outbox.dispatcher.ts`：`OrderOutboxDispatcher`。
- [ ] `apps/backend/src/module/client/order/events/order-outbox-metrics.service.ts`：`OrderOutboxMetricsService`（cron 10s）。
- [ ] `apps/backend/src/module/client/order/events/order-domain-event.publisher.ts`：4 个 publish 方法改为 `outboxWriter.write`，删除 EventEmitter2 依赖。
- [ ] `apps/backend/src/module/client/order/order.module.ts`：注册 writer / dispatcher / metrics；`InjectQueue(ORDER_MARKETING_QUEUE)`。
- [ ] `apps/backend/src/module/client/order/services/order-creation-application.service.ts`：
  - `createOrderInTransaction` 内、写 outbox 之前插入 `lockCouponInTx` / `freezePointsInTx`；
  - 删除 `publishOrderCreatedForMarketing` 内的 `if (!dto.userCouponId && ...) return;` 早返回（事件**总是**发，listener 端处理是否 no-op）。
- [ ] `apps/backend/src/module/client/payment/payment.service.ts:148-164`：把 `publishPaidEvent` 调用挪到 `markOrderPaidAndEnsureFulfillment` 内、`fulfillmentService.ensureForPaidOrder` 之后。
- [ ] `apps/backend/src/module/client/order/order.service.ts:185-190` / `:245-250`：把 `publishCancelled` 调用挪到对应 `@Transactional` 边界内。
- [ ] `apps/backend/src/module/store/order/store-order.service.ts:495-510` / `:705-715`：同上，纳入退款 `@Transactional`。
- [ ] `apps/backend/src/module/marketing/integration/order-domain-event.listener.ts`：删除 `@OnEvent(CREATED)` handler 与对 `OrderIntegrationService.handleOrderCreated` 的调用；`handlePaid / handleCancelled / handleRefunded` 的 enqueue 逻辑**删除**（dispatcher 接管）；整个 listener 类大概率清空 → 删文件。
- [ ] `apps/backend/src/module/marketing/integration/integration.service.ts:160-191`：删除 `handleOrderCreated` 方法。
- [ ] `apps/backend/src/module/finance/events/order-finance-event.listener.ts`：转为 `OrderMarketingEventProcessor.handlePaid` 内 await 调用（或保留 listener 但订阅 worker 端发出的内部事件，二选一，**实施期与 finance owner 复审**）。

### 8.2 契约同步

无需 `pnpm generate-types`：本设计不动 controller / DTO / VO。

### 8.3 admin-web

无变更（除 §7.1 TODO-3 如果决定要做死信查看页面，再单独立项）。

### 8.4 验证

- [ ] `pnpm typecheck:backend`
- [ ] `pnpm lint:backend`
- [ ] `pnpm test:backend -- order-outbox` 至少覆盖 dispatcher 4 个分支（add 成功 / add 失败 / max attempts 死信 / 多实例 SKIP LOCKED）
- [ ] `pnpm test:backend -- order-domain-event.publisher` 覆盖 4 个 publish 方法的 tx 内写入
- [ ] `pnpm test:backend -- order-creation-application` 覆盖锁券失败 → tx 回滚 → outbox 行不存在
- [ ] `pnpm check:slice`
- [ ] 合并前：`pnpm verify-monorepo; pnpm verify:scripts; pnpm lint; pnpm typecheck; pnpm test`

### 8.5 PR 标题

`refactor(backend): 订单领域事件改为 transactional outbox 模式`
