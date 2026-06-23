# P1-08 清理假事件驱动（删 20 TODO listener + 删 emit + dispatchMessageTouchpoint 直调）

**owner**: 待指派 / 后端
**status**: draft
**last_verified**: 2026-05-15
**related**: [[P0-02-order-outbox]]、[[P1-09-split-course-group-service]]

---

> **跨文档硬约束**：本设计涉及金额字段全链路遵循 [[P0-00-money-precision]]；幂等键格式遵循 [[P2-14-idempotency-key-convention]]。

## 1. 目标与范围

### 1.1 目标

`apps/backend/src/module/marketing/events/marketing-event.listener.ts`（843 行，25 个 `@OnEvent`）现状是**假事件驱动**：

- 25 个 listener 中，约 20 个的方法体只有 `logger.log + recordCriticalEvent + TODO 注释 + dispatchMessageTouchpoint`。
- TODO 注释从未实现，等同于"事件被发出后没人真正消费"。
- 真正承载业务的只有少数：`dispatchMessageTouchpoint` 把 `INSTANCE_PAID / INSTANCE_SUCCESS / COURSE_OPEN / COURSE_GROUP_*` 等事件转给 `TouchpointOrchestratorService` 真发短信/Push；其余分支是空壳。
- 与此同时各业务 service 还有 `this.eventEmitter.emit(...)` 大量调用，**只为了让上面的空壳 listener 跑一遍 logger.log**。形成两套"消费方"在生产环境同时背负 EventEmitter 调度成本。

修复方式（用户已批准）：

- **删除 20 个纯 TODO listener**（保留 INSTANCE_PAID / INSTANCE_SUCCESS / COURSE_OPEN 等真正调 `dispatchMessageTouchpoint` 的）。
- **删除对应业务 service 内的 `eventEmitter.emit`** 调用。
- 把 `dispatchMessageTouchpoint` 改为**直接函数调用**（在业务路径合适位置同步调用），不再走 EventEmitter。
- **保留** 4 个订单领域事件（`order.created/paid/cancelled/refunded` → 走 [[P0-02]] 的 outbox 体系）+ 1 个场景发布事件（`scene.released` → 触发 release snapshot 失效缓存）。

### 1.2 范围

- ✅ 删除 `marketing-event.listener.ts` 内 20 个纯 TODO + recordCriticalEvent 的 listener。
- ✅ 把 `dispatchMessageTouchpoint` 抽成独立 `MessageTouchpointDispatcher.dispatch(event)`，由业务路径在合适时刻直调。
- ✅ 删除 `MarketingEventEmitter` 在业务 service 内的所有调用（保留类作为退路，但 0 caller）。
- ✅ 保留 `recordCriticalEvent`（Redis stats），改为 `MessageTouchpointDispatcher.dispatch` 内同步执行。
- ✅ 保留 [[P0-02]] 的 `OrderDomainEventListener` + [[P0-02]] 已定义的 4 个事件路径。
- ✅ 保留 `MktSceneRelease` 发布后的缓存失效事件（如果当前有）；如果没有，本设计不引入。
- ❌ 不动 `MarketingEvent` / `MarketingEventType` enum（保留作为 dispatcher 的入参 schema）。
- ❌ 不动 `TouchpointOrchestratorService` 内部（它是真业务）。

### 1.3 DoD

1. `marketing-event.listener.ts` 行数从 843 减到 ≤200，`@OnEvent` 计数从 25 减到 ≤5。
2. `grep -r "eventEmitter.emit\(MarketingEventType" apps/backend/src` 命中 0（保留 `OrderDomainEventPublisher` 已切换 outbox 后的入口）。
3. 所有"真业务消费方"改直调 `messageTouchpointDispatcher.dispatch(event)`，无 EventEmitter 中转。
4. `recordCriticalEvent` 的 Redis stats key 名称、TTL、写入语义不变（运营看的报表不受影响）。

---

## 2. 现状取证

### 2.1 25 个 @OnEvent 全清单

```
INSTANCE_CREATED                  TODO only + recordCriticalEvent
INSTANCE_PAID                     TODO only + recordCriticalEvent + dispatchMessageTouchpoint
INSTANCE_SUCCESS                  TODO only + recordCriticalEvent + dispatchMessageTouchpoint
INSTANCE_FAILED                   TODO only + recordCriticalEvent
INSTANCE_TIMEOUT                  TODO only + recordCriticalEvent
INSTANCE_REFUNDED                 TODO only + recordCriticalEvent

COUPON_CLAIMED / COUPON_USED / COUPON_EXPIRED           TODO only
POINTS_EARNED / POINTS_USED / POINTS_EXPIRED            TODO only

INTEGRATION_ORDER_DISCOUNT_CALCULATED                   TODO only
INTEGRATION_ORDER_CREATED                               TODO only
INTEGRATION_ORDER_PAID                                  TODO only
INTEGRATION_ORDER_CANCELLED                             TODO only
INTEGRATION_ORDER_REFUNDED                              TODO only

GROUP_FULL / GROUP_FAILED                               TODO only + dispatchMessageTouchpoint
FLASH_SALE_SOLD_OUT                                     TODO only

COURSE_OPEN                                             TODO only + dispatchMessageTouchpoint
COURSE_GROUP_TEAM_CREATED                               handleCourseGroupEvent → recordCriticalEvent + dispatchMessageTouchpoint
COURSE_GROUP_MEMBER_JOINED                              同上
COURSE_GROUP_VIRTUAL_FILLED                             同上
COURSE_GROUP_TEAM_FORMED                                同上
COURSE_GROUP_TEAM_FAILED                                同上
COURSE_GROUP_SCHEDULE_BOUND                             同上
COURSE_GROUP_CLASS_STARTED                              同上
COURSE_GROUP_ATTENDANCE_CONFIRMED                       同上
COURSE_GROUP_CLASS_FINISHED                             同上
```

### 2.2 真业务 vs 假事件

只有这两段是真的：

```ts
// marketing-event.listener.ts:789-807
private async dispatchMessageTouchpoint(event: MarketingEvent): Promise<void> {
  if (!MESSAGE_TOUCHPOINT_EVENT_SET.has(event.type)) return;
  const result = await this.touchpointOrchestrator.dispatch({ event });
  ...
}

// marketing-event.listener.ts:809-838
private async recordCriticalEvent(event: MarketingEvent): Promise<void> {
  // Redis incr 计数 + LPUSH 最近事件
}
```

其余都是 TODO。

### 2.3 emitter caller

`MarketingEventEmitter` 在业务 service 中被广泛调用（grep `eventEmitter.emit(MarketingEvent`、`marketingEventEmitter.emit`、`emitIntegrationEvent`），其唯一目的是触发上面这些 listener；假事件 listener 删后这些 emit 也全部失去意义。

---

## 3. 设计方案

### 3.1 `MessageTouchpointDispatcher`

```ts
// apps/backend/src/module/marketing/events/message-touchpoint.dispatcher.ts

@Injectable()
export class MessageTouchpointDispatcher {
  private readonly logger = new Logger(MessageTouchpointDispatcher.name);
  private readonly eventStatsTtlSeconds = 7 * 24 * 60 * 60;
  private readonly recentEventLimit = 100;
  private readonly MESSAGE_TOUCHPOINT_EVENT_SET = new Set<MarketingEventType>(
    getMarketingEventTypesByUsableScope('TOUCHPOINT'),
  );

  constructor(
    private readonly redis: RedisService,
    private readonly orchestrator: TouchpointOrchestratorService,
  ) {}

  /** 业务路径在 happy-path 末尾直接调用；不再经过 EventEmitter。 */
  async dispatch(event: MarketingEvent): Promise<void> {
    await this.recordCriticalEvent(event);   // 保留 Redis stats，运营报表不变

    if (!this.MESSAGE_TOUCHPOINT_EVENT_SET.has(event.type)) return;

    try {
      const result = await this.orchestrator.dispatch({ event });
      // ... 同原 dispatchMessageTouchpoint
    } catch (error) {
      this.logger.error(...);  // 触点失败不抛错回业务
    }
  }

  private async recordCriticalEvent(event: MarketingEvent): Promise<void> {
    // 内容与原 listener 内 recordCriticalEvent 一致
  }
}
```

### 3.2 业务路径替换

在 `course-group.service` / `flash-sale.service` / `member-upgrade.service` / `instance.service` 等地方：

```ts
// 替换前
await this.eventEmitter.emit(MarketingEventType.INSTANCE_PAID, eventPayload);

// 替换后
await this.messageTouchpointDispatcher.dispatch({
  type: MarketingEventType.INSTANCE_PAID,
  ...eventPayload,
});
```

### 3.3 listener 保留清单

| 保留 listener                                                    | 说明                                |
| ---------------------------------------------------------------- | ----------------------------------- |
| 无（marketing-event.listener.ts 整文件删除）                     | dispatcher 取代 listener            |
| `OrderDomainEventListener.handleCreated/Paid/Cancelled/Refunded` | 由 [[P0-02]] outbox dispatcher 驱动 |
| `SceneReleaseListener.handleReleased`（如已存在）                | 失效场景快照缓存                    |

若 `SceneReleaseListener` 当前不存在但需要，**本设计不引入**；P1-07 场景模板化 PR 中若发现需要再补。

### 3.4 删除清单

- `marketing-event.listener.ts` 整文件删除（dispatcher 已取代）。
- `marketing-event.emitter.ts` 保留为空壳：保留类、所有 `emit` 方法改 `no-op + console.warn('deprecated')`，**不要立即删**，给 grep 兼容期 1 release。
- `marketing-event.catalog.ts` 中 `getMarketingEventTypesByUsableScope('TOUCHPOINT')` 保留：dispatcher 仍需要它。

---

## 4. 决策依据

### 4.1 Q1 EventEmitter 完全清退 vs 部分保留

| 选项                                                   | 优                                           | 劣                                | 选择 |
| ------------------------------------------------------ | -------------------------------------------- | --------------------------------- | ---- |
| **A. 业务路径完全直调 dispatcher**                     | 0 中转；调用栈清晰；删 EventEmitter listener | 业务 service 增加 dispatcher 依赖 | ✅   |
| B. EventEmitter 保留 + listener 内只剩 dispatcher 转发 | 兼容                                         | 一层无意义中转                    |      |

### 4.2 Q2 保留 listener 数量

| 选项                                                             | 优       | 劣                        | 选择 |
| ---------------------------------------------------------------- | -------- | ------------------------- | ---- |
| **A. 删 25 个 listener；保留 outbox 4 个 + 可选 scene 1 个**     | 极简     | 业务 service 改写工作量大 | ✅   |
| B. 仅删 20 个 TODO，保留 5 个 dispatchMessageTouchpoint listener | 工作量小 | EventEmitter 仍存在       |      |

### 4.3 Q3 recordCriticalEvent 保留 vs 删

| 选项                            | 优           | 劣                           | 选择 |
| ------------------------------- | ------------ | ---------------------------- | ---- |
| **A. 保留，搬到 dispatcher 内** | 运营报表不变 | 与 P1 主旨"删假事件"略不一致 | ✅   |
| B. 删除                         | 极简         | 运营 Redis 监控页面会断      |      |

---

## 5. 迁移与回滚

### 5.1 部署顺序

1. **D1**：引入 `MessageTouchpointDispatcher`；与旧 listener 并存（双发会导致 recordCriticalEvent 计数翻倍，需在 D1 关掉旧 listener 的 recordCriticalEvent）。
2. **D2**：业务 service 批量替换 emit → dispatcher.dispatch；同 PR 删 listener 文件。
3. **D3**：`MarketingEventEmitter.emit` 改 no-op + warn；1 release 后再删类本身。

### 5.2 回滚

D2 git revert 即可；listener 文件保留在 git 历史可恢复。

---

## 6. 验证矩阵

| 层   | 用例                                                                                                           | 工具            |
| ---- | -------------------------------------------------------------------------------------------------------------- | --------------- | --- |
| 静态 | `grep -r "@OnEvent(MarketingEventType" apps/backend/src` 0                                                     | rg              |
| 静态 | `grep -r "eventEmitter.emit(MarketingEventType\|marketingEventEmitter.emit" apps/backend/src --include='\*.ts' | grep -v spec` 0 | rg  |
| Spec | dispatcher.dispatch(INSTANCE_PAID) 触发 recordCriticalEvent + touchpoint orchestrator                          | unit            |
| Spec | dispatcher.dispatch(INSTANCE_CREATED, not in touchpoint set) 仅触发 recordCriticalEvent                        | unit            |
| Spec | touchpoint orchestrator 抛错时 dispatcher 不抛回业务                                                           | unit            |
| 集成 | course-group join → dispatcher 直调 → Redis stats 记录                                                         | supertest       |
| 监控 | 部署后 Redis `mkt:event:stats:*` key 与上线前 24h 计数相对值 ±5%                                               | Grafana         |

---

## 7. 风险与未决

### 7.1 TODO

1. **TODO-1**：业务 service 中 emit 调用点列表（grep `eventEmitter.emit\(MarketingEventType`）实施期补完，本设计仅给数量级。
2. **TODO-2**：`SceneReleaseListener` 是否已存在或需要新建？grep `'scene.released'` 确认。
3. **TODO-3**：`MarketingEventEmitter` 类完全删除时机 —— 建议下一 release 周期一并清理，本 PR 仅 no-op。

### 7.2 风险

| 风险                                            | 等级 | 缓解                                                 |
| ----------------------------------------------- | ---- | ---------------------------------------------------- |
| 业务路径直调 dispatcher 后，同步链路时间增加    | 低   | dispatcher 内 try/catch；触点失败不抛错回业务        |
| recordCriticalEvent 双发导致 Redis 计数翻倍     | 中   | D1 PR 内同时关闭旧 listener 内的 recordCriticalEvent |
| 隐藏的第三方 listener 订阅了 MarketingEventType | 低   | grep `@OnEvent\(MarketingEventType` 全仓             |

---

## 8. 实施清单

### 8.1 backend

- [ ] `events/message-touchpoint.dispatcher.ts`：新增。
- [ ] `events/marketing-event.listener.ts`：删除。
- [ ] `events/marketing-event.emitter.ts`：emit 方法改 no-op + 弃用 warn。
- [ ] 业务 service 批量替换 emit → dispatcher.dispatch：
  - `play/course-group-buy.service.ts`
  - `play/flash-sale.service.ts`
  - `play/member-upgrade.service.ts`
  - `instance/instance.service.ts`
  - `integration/integration.service.ts`
  - `coupon/**` 内 emit COUPON\_\*
  - `points/**` 内 emit POINTS\_\*
- [ ] marketing.module.ts：注册 dispatcher，删 listener provider。

### 8.2 验证

- [ ] `pnpm typecheck:backend && pnpm lint:backend`
- [ ] `pnpm test:backend -- message-touchpoint`
- [ ] `pnpm test:backend -- course-group`
- [ ] `pnpm check:slice`
- [ ] PR 前完整 verify。

### 8.3 PR 标题

`refactor(backend): 清理假事件驱动，业务直调 MessageTouchpointDispatcher`
