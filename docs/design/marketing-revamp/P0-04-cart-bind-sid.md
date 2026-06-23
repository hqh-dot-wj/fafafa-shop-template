# P0-04 购物车绑定 sid（结算时刻 last-touch + 支付成功计 orderCount）

**owner**: 待指派 / 后端 + miniapp-client
**status**: draft（待评审 → 待实施）
**last_verified**: 2026-05-15（仅取证，未执行任何代码改动）
**related**: [[P0-01-attribution-config]]、[[P0-02-order-outbox]]、[[P0-03-activity-context-key-signing]]、[[P2-13-eligibility-share-commission-chain]]

---

> **跨文档硬约束**：本设计涉及金额字段全链路遵循 [[P0-00-money-precision]]；幂等键格式遵循 [[P2-14-idempotency-key-convention]]。

## 1. 目标与范围

### 1.1 目标

把"分销分享链接/海报/小程序码（统一 sid 机制）"和"购物车归因"两条目前断开的链路拼起来，并把 `sid.orderCount` 的计数权力从客户端搬回服务端。修复三个具体问题：

- **Cart 不绑 sid**：`oms_cart_item` 只有 `shareUserId` 列且**直接信任客户端 DTO 透传**（`cart.service.ts:97`：`shareUserId: dto.shareUserId || null`）。任何 C 端调用都可以指定任意 `shareUserId` 加车，污染归因。
- **跨次点击丢归因**：同一会员先点 sidA 的卡 → 加 A 商品；再点 sidB 的卡 → 加同 SKU 商品。两行 cart 都存了各自 `shareUserId`，但下单时 `attributionService.getFinalShareUserId` 走 `dto.items[0].shareUserId` / Redis `attr:member:` 的混合优先级，**不读 cart 行**，最后实际归因结果与 cart 行不一致，运营无法解释。
- **orderCount 被客户端控制**：`sid.orderCount++` 走 `client` 端的 `POST /distribution/track-event` (`share-token.service.ts:286`)。客户端可以在"打开 checkout 页"就调一次，触发 `ORDER_ATTRIBUTED`，无论订单后续是否完成支付都会消耗 `maxOrderCount` 名额；也可以**永远不调**，导致正常成单的订单不计数。两个方向都让 `orderCount` 失真。

修复方法（用户已批准的两条决策）：

- **结算时刻 last-touch**：cart 行新增 `sid` 列，每次 addToCart 都更新到最新 sid；结算时按"最后落到 cart 上的 sid"做归因（last-touch），订单 item 快照里完整记录。
- **结算成功才计 orderCount**：删客户端的 `ORDER_ATTRIBUTED` 触发口，改在 P0-02 引入的"order paid" Bull job handler 内自动按订单 item 的 sid 做 `increaseOrderCount`。

### 1.2 范围

- ✅ Prisma: `OmsCartItem` 增加 `sid String?`；`OmsOrderItemAttribution` 已有 `entryContextSnapshot`，复用并加结构化字段（`sidSnapshot / sourceChannelSnapshot` 已存在的字段直接利用）。
- ✅ Cart 服务层：addToCart / updateQuantity / list / consumeCheckedOutItems 全部接入 sid 校验与 last-touch 写入。
- ✅ Checkout：`order-checkout.service.ts` preview 阶段从 cart 行回填 sid → 写入 `omsOrderItemAttribution`。
- ✅ Order creation：订单 header 的 `shareUserId / referrerId` 不再依赖 `dto.shareUserId` / Redis 兜底，改为"items[*] 中按 createTime DESC 的最新 sid 对应的 shareUserId"。
- ✅ `attributionService` 简化：删 `bindRelation`（已是 dead code，[[P0-01-attribution-config]] 已计划删）；`getFinalShareUserId` 改为"cart 行 sid > Redis bind > parentId"三段优先级。
- ✅ ShareToken `trackClientEvent` 移除 `ORDER_ATTRIBUTED` 分支；订单 paid 走 server-side 的 `applySidOrderCountIncrement`。
- ❌ 不重新设计 sid 生成 / metadata 字段（沿用现 `SysDistShareToken`）。
- ❌ 不动 `SysDistAttributionBind` / `SysDistRelation`（团队关系是另一回事，[[P2-13-eligibility-share-commission-chain]] 处理）。
- ❌ 不引入 first-touch / first-bind-lock 的语义切换；当前 `DistShareAttributionMode` 的 enum 保留，但 cart 这一层固定走 last-touch（决策见 §4 Q3）。

### 1.3 DoD（Definition of Done）

1. `oms_cart_item.sid` 列上线（带 index）；migration 标准命名。
2. `cart.service.ts` 中 `dto.shareUserId` 不再写入 cart 列：addToCart 收到 `dto.sid` → 校验 → 反查 shareUserId → 写入 `sid` 列；客户端再也不能跨过 sid 直接指定 shareUserId。
3. `share-token.service.ts` 中 `trackClientEvent` 删除 `ORDER_ATTRIBUTED` 分支；`increaseOrderCount` 只剩内部调用，被 server-side 的 `applySidOrderCountIncrement(orderId)` 唯一使用。
4. 订单 paid 后 ≤ 5 秒内，`sys_dist_share_token.orderCount` 对应订单 item 的 sid 自增 ≥1；并写一条 `sys_dist_share_event.eventType=ORDER_ATTRIBUTED` 日志（含 `orderId`）。
5. 部分退款不冲销 orderCount（决策见 §4 Q4），但全单退款冲销（事件类型扩展，见 §3.5）。
6. 单元测试 + 集成测试覆盖：addToCart 同 sku 不同 sid → cart 行的 sid 被覆盖为最新；checkout preview 回填 sid；订单 paid 触发 increaseOrderCount；超过 `maxOrderCount` 时 token 转 EXPIRED 但订单不报错。

---

## 2. 现状取证

> 基于 2026-05-15 主干 commit `02537317`。

### 2.1 数据模型现状

`oms_cart_item`（`50-order.prisma:91`）字段：

```prisma
shareUserId    String? @map("share_user_id")
activityContextKey   String? @map("activity_context_key")
entrySource          String? @map("entry_source")
activityType         String? @map("activity_type")
activityConfigId     String? @map("activity_config_id")
playInstanceId       String? @map("play_instance_id")
@@unique([memberId, tenantId, skuId, activityContextKey])
```

**无 `sid` 列**。`shareUserId` 是 cart 行唯一与分销有关的字段，且**不绑定到 sid 实体**。

`sys_dist_share_token`（`40-distribution.prisma:200`）字段（节选）：

```prisma
sid          String @unique @db.VarChar(64)
shareUserId  String @map("share_user_id")
bizType      DistShareBizType
bizId        String
maxClickCount / maxBindCount / maxOrderCount Int
clickCount / bindCount / orderCount        Int @default(0)
status       DistShareTokenStatus @default(ACTIVE)
```

### 2.2 客户端透传 shareUserId

```ts
// apps/backend/src/module/client/cart/cart.service.ts:97
shareUserId: dto.shareUserId || null,
```

`AddCartDto.shareUserId` 是 client-supplied 任意 string。无任何校验。

### 2.3 客户端可直接增 orderCount

```ts
// apps/backend/src/module/store/distribution/services/share-token.service.ts:257-308
async trackClientEvent(tenantId, memberId, dto: TrackShareEventDto) {
  if (dto.eventType === DistShareEventType.BIND) { ... }
  else if (dto.eventType === DistShareEventType.ORDER_ATTRIBUTED) {
    const orderAllowed = await this.increaseOrderCount(token.id, token.maxOrderCount);
    // ↑ 客户端直接 POST 即可让 orderCount++
  }
  await this.writeShareEvent(...);
}
```

```ts
// apps/backend/src/module/client/distribution/distribution.controller.ts:67
@Post('track-event')
trackClientEvent(...) { return this.shareTokenService.trackClientEvent(tenantId, memberId, dto); }
```

### 2.4 订单创建侧的 shareUserId 推导

```ts
// apps/backend/src/module/client/order/services/order-creation-application.service.ts:63-64
const itemShareId = dto.items.find((item) => item.shareUserId)?.shareUserId || null;
const shareUserId = await this.attributionService.getFinalShareUserId(memberId, itemShareId || dto.shareUserId);
```

- "items 中第一个有 shareUserId 的" → 非确定性，依赖前端传入顺序。
- `attributionService.getFinalShareUserId`（`attribution.service.ts:38-72`）三段优先级：参数 > Redis `attr:member:${memberId}` > `umsMember.parentId`。**不读 cart 行的 sid**。

### 2.5 Cart shareUserId 与 cart 行其他字段语义不一致

`addToCart` 中 `[memberId, tenantId, skuId, activityContextKey]` 是唯一约束（`OmsCartItem` @@unique）；`shareUserId` 不在 key 内。当同 member 用不同 sid（不同 shareUserId）加同 sku 同活动时：

- 路径 1：`shareUserId` 不同 → 同 cart 行被 quantity++，**老的 shareUserId 不变**（路径 `existing → update` 不写 shareUserId）。这是隐式的 first-touch（先到先得），与 SysDistSharePolicy 默认 `LAST_TOUCH` 矛盾。
- 路径 2：`existing=null` → 新建行，shareUserId=新值。

### 2.6 SysDistSharePolicy 默认 last-touch 但 cart 无效

`SysDistSharePolicy.attributionMode @default(LAST_TOUCH)`（`40-distribution.prisma:187`）——租户配置默认末触归因，但 cart 实现是隐式 first-touch（见上）。**Policy 是死配置**：grep `attributionMode` 无任何业务代码消费。

---

## 3. 设计方案

### 3.1 Schema 变更

```prisma
// apps/backend/prisma/models/50-order.prisma  OmsCartItem 内追加：

  /// 分销分享令牌 sid；通过 sysDistShareToken.sid 反查 shareUserId 与归因元数据
  sid String? @map("sid") @db.VarChar(64)

// 索引
@@index([memberId, tenantId, sid], map: "idx_oms_cart_item_member_sid")
```

> **保留** `shareUserId` 列：旧数据迁移期作为只读快照；新写入路径**只**经 sid → 反查 → 写 `shareUserId` 同步列（为读路径兼容）。这是过渡期一次性的双写，不构成长期补偿（见 §5.3）。

不动 `OmsOrderItemAttribution`：现有字段 `sourceChannelSnapshot / shareUserIdSnapshot / entryContextSnapshot` 足够承载 sid 快照，新增 sid 仅落入 `entryContextSnapshot` JSON。

### 3.2 Cart 写入路径

#### 3.2.1 `addToCart`

```ts
async addToCart(memberId: string, dto: AddCartDto) {
  // 0. 解码 activityContextKey（P0-03 引入）
  const verifiedToken = dto.activityContextKey
    ? this.tokenService.verify(dto.activityContextKey, { tenantId: dto.tenantId, memberId })
    : null;

  // 1. 校验 sid：必须 ACTIVE、未过期；shareUserId 强制由 sid 反查得到
  let sid: string | null = null;
  let shareUserId: string | null = null;
  if (dto.sid) {
    const token = await this.shareTokenReader.findActiveBySid(dto.sid, dto.tenantId);
    if (token && token.shareUserId !== memberId) {
      sid = token.sid;
      shareUserId = token.shareUserId;
    }
    // sid 无效（不存在/EXPIRED/DISABLED/自分享）→ 静默丢弃，不报错，不写 cart sid
  }

  // 2. 库存/商品校验（保持现状）

  // 3. UPSERT：unique key = [memberId, tenantId, skuId, activityContextKey]
  //    若 existing 存在：quantity += dto.quantity；并 LAST-TOUCH 覆盖 sid + shareUserId
  //    若 existing 不存在：新建
  if (existing) {
    await this.prisma.omsCartItem.update({
      where: { id: existing.id },
      data: {
        quantity: { increment: dto.quantity },
        ...(sid !== null && { sid, shareUserId }),   // ← last-touch：sid 非空才覆盖
        updateTime: new Date(),
      },
    });
  } else {
    await this.prisma.omsCartItem.create({
      data: { ...existingFields, sid, shareUserId },
    });
  }
}
```

**关键设计**：

- `dto.shareUserId` **完全失效**（建议同时从 DTO schema 中删除字段）。
- `sid` 无效不抛错 → C 端体验：分享链接过期了，加车照样可以；只是这次加车没有归因。
- `existing` 时 sid 非空才覆盖：A 用户带 sidA 加 1 个，回头再不带 sid 加 1 个 → sid 不被清空（清空意味着归因丢失）。
- 自分享：`token.shareUserId === memberId` 时不绑（不能自己给自己分销）。

#### 3.2.2 `updateQuantity` / 删除

不动 sid（数量变更不改变归因）。

#### 3.2.3 list 返回

VO 增加 `sid?: string` 字段，主要给运营端调试可见；C 端通常不直接展示。`shareUserId` 字段仍返回，由 sid 反查保证一致性。

### 3.3 Checkout 与下单路径

#### 3.3.1 preview / checkout 阶段（`order-checkout.service.ts`）

```ts
// 在 batchValidationService.validateAndLockLines 之后、写 previewItems 之前
for (const { item, sku, cartRow } of prepared) {
  let sid: string | null = cartRow?.sid ?? null;
  let shareUserId: string | null = null;
  if (sid) {
    const token = await this.shareTokenReader.findBySid(sid, tenantId);
    // checkout 阶段允许 EXPIRED：归因仍可保留，只是不可再点击；但 DISABLED（人工禁用）则丢弃
    if (token && token.status !== DistShareTokenStatus.DISABLED) {
      shareUserId = token.shareUserId;
    } else {
      sid = null;
    }
  }
  previewItems.push({
    ...existing,
    sid,
    shareUserId,
    // sourceChannelSnapshot 从 sid token metadata 取
    shareChannel: token?.metadata?.sourceChannel ?? null,
  });
}
```

#### 3.3.2 订单 header 的 shareUserId（`order-creation-application.service.ts`）

```ts
// 取 preview.items 中最后一个 sid 非空的项的 shareUserId（结算时刻 last-touch）
const lastTouchShareUserId =
  preview.items
    .slice()
    .reverse()
    .find((it) => it.shareUserId)?.shareUserId ?? null;

// 替换原 attributionService.getFinalShareUserId 调用
const shareUserId = lastTouchShareUserId ?? (await this.attributionService.getFinalShareUserId(memberId, null));
//                                            ^^^ cart 无 sid 时才走 Redis attr:member: 兜底 + parentId 永久绑定
```

> "结算时刻"严格定义为"调用 `createOrder` 的时刻 → preview.items 顺序与用户提交 dto.items 顺序一致 → 取最后一个有 sid 的 item"。C 端 UI 应让用户最近选中的商品排在底部，符合直觉。如果产品另有顺序约定，按 cart 行 `updateTime DESC` 取最新（**实施期与产品确认 §7 TODO-1**）。

#### 3.3.3 `omsOrderItemAttribution` 快照

```ts
// order-item-attribution.service.ts createFromPreview
entryContextSnapshot: {
  ...current,
  sid: previewItem.sid ?? null,             // ← 新增
  shareChannel: previewItem.shareChannel ?? null,
  attributionWindowMinutes: previewItem.attributionWindowMinutes ?? null,
},
sourceChannelSnapshot: previewItem.shareChannel ?? null,
shareUserIdSnapshot: shareUserId,           // 已存在
```

### 3.4 订单支付成功后计 orderCount

#### 3.4.1 删客户端入口

```ts
// share-token.service.ts:285-291  整段删除
- } else if (dto.eventType === DistShareEventType.ORDER_ATTRIBUTED) {
-   const orderAllowed = await this.increaseOrderCount(token.id, token.maxOrderCount);
-   if (!orderAllowed) { ... }
- }
```

`TrackShareEventDto` 类型上把 `ORDER_ATTRIBUTED` 从允许列表中移除（前端调用直接返回 400）。

#### 3.4.2 加 server-side 入口

在 [[P0-02-order-outbox]] 引入的 `OrderMarketingEventProcessor.handlePaid` 内追加一步（或在 `OrderIntegrationService.handleOrderPaid` 内）：

```ts
// 伪代码：把 sid 增计纳入 PAID handler
const items = await this.prisma.omsOrderItem.findMany({
  where: { orderId },
  include: { attribution: true },
});
for (const item of items) {
  const sid = (item.attribution?.entryContextSnapshot as Record<string, unknown>)?.sid as string | null;
  if (!sid) continue;
  await this.shareTokenWriter.applySidOrderCountIncrement(sid, { orderId, eventLog: true });
  //  ↑ 内部走 atomic update + write SysDistShareEvent
}
```

`applySidOrderCountIncrement`：

```ts
async applySidOrderCountIncrement(sid: string, ctx: { orderId: string; eventLog: boolean }) {
  const token = await this.prisma.sysDistShareToken.findUnique({ where: { sid } });
  if (!token) return;       // 历史无对应 sid，幂等放过
  if (token.status !== 'ACTIVE') return;

  const incremented = await this.prisma.sysDistShareToken.updateMany({
    where: { sid, orderCount: { lt: token.maxOrderCount } },
    data: { orderCount: { increment: 1 } },
  });

  // 命中上限 → 转 EXPIRED（不阻塞订单）
  if (incremented.count === 0) {
    await this.prisma.sysDistShareToken.updateMany({
      where: { sid, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });
  }

  if (ctx.eventLog) {
    await this.prisma.sysDistShareEvent.create({
      data: {
        sid,
        tenantId: token.tenantId,
        shareUserId: token.shareUserId,
        eventType: 'ORDER_ATTRIBUTED',
        bizType: token.bizType,
        bizId: token.bizId,
        orderId: ctx.orderId,
      },
    });
  }
}
```

> **幂等**：`OrderMarketingEventProcessor` 用 Bull jobId = `paid:<orderId>` 去重 + worker 内部 `executeWithIdempotency` Redis 锁，所以不会重复 increment。`SysDistShareEvent` 是日志表，**允许**同订单同 sid 多次写入（不去重）— 用于审计回溯；如果需要可加 `@@unique([orderId, sid, eventType])`，但本设计**不强加**，等 P2 阶段统一审计去重策略。

### 3.5 全单退款冲销 orderCount

`order.refunded` 事件由 P0-02 的 outbox dispatcher 投递到 Bull `refunded` worker。在 `OrderIntegrationService.handleOrderRefunded` 内追加：

```ts
if (options.partialRefund) return;       // 部分退款不冲销（决策 Q4）

const items = await prisma.omsOrderItem.findMany({ ... });
for (const item of items) {
  const sid = (item.attribution?.entryContextSnapshot as Record<string, unknown>)?.sid as string | null;
  if (!sid) continue;
  await this.shareTokenWriter.applySidOrderCountDecrement(sid, { orderId, eventLog: true });
}
```

`applySidOrderCountDecrement` 与 increment 对称，但：

- `orderCount` 不会减到 0 以下（`Math.max(0, current - 1)`）。
- 不主动把 EXPIRED 转回 ACTIVE（已经过期或人工 DISABLED 的 token 不复活）。
- 事件类型扩展：在 `DistShareEventType` 枚举末尾追加 `ORDER_REFUND_REVERSED`（schema 变更，归入本 PR）。

### 3.6 attributionService 简化

```ts
// attribution.service.ts 改造后
async getFinalShareUserId(memberId: string, inputShareId?: string): Promise<string | null> {
  if (!memberId) return inputShareId || null;
  if (inputShareId) return inputShareId;     // checkout 已传入 last-touch 结果时

  // Redis bind 兜底（点击但未加车场景）
  const redisKey = `attr:member:${memberId}`;
  const cached = parseCachePayload(await this.redis.get(redisKey));
  if (cached?.shareUserId) return cached.shareUserId;

  // 永久绑定兜底
  const member = await this.prisma.umsMember.findFirst({ where: { memberId }, select: { parentId: true } });
  return member?.parentId || null;
}

// bindRelation 删除（已是 dead code，且 [[P0-01-attribution-config]] 已计划删）
```

### 3.7 Redis 缓存不变

`syncCartToRedis` 已用 `${item.skuId}:${item.activityContextKey ?? ''}` 作 hash field；不需要把 sid 编进 field（field 单调对应一行 cart）。Redis field value 增加 sid 即可（JSON 中追加字段）。

---

## 4. 决策依据（trade-off）

### 4.1 Q1 归因模式：last-touch / first-touch / first-bind-lock？

| 选项               | 优                                                                                                | 劣                                                                 | 选择 |
| ------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---- |
| **A. last-touch**  | 与现 `SysDistSharePolicy` 默认值一致；运营直观；当前 cart 隐式 first-touch 与配置矛盾，本设计扶正 | 反复点不同分享的用户的归因易变                                     | ✅   |
| B. first-touch     | 公平给"第一推荐人"                                                                                | 与现有默认 policy 矛盾；用户后来明确点的链接被忽略，运营投诉路径长 |      |
| C. first-bind-lock | 绑定即锁，最简单                                                                                  | 已通过 `tryBindMember` 写 `parentId`，不需要 cart 再做一层 lock    |      |

### 4.2 Q2 orderCount 计数时机：paid / created / preview？

| 选项                       | 优                                     | 劣                                    | 选择 |
| -------------------------- | -------------------------------------- | ------------------------------------- | ---- |
| **A. order.paid**          | 与真实业务事实对齐；不被未支付订单污染 | 计数延迟到支付（合理）                | ✅   |
| B. order.created           | 早 1 步                                | 未支付订单 / 取消订单也算了           |      |
| C. checkout preview        | 最早                                   | 用户多次预览同 sid 多次计数，完全失真 |      |
| D. 客户端 trackClientEvent | 当前实现                               | 客户端完全可控，业务事实失真          |      |

### 4.3 Q3 同 sku 同活动多次加车的 sid 覆盖策略

| 选项                                       | 优                            | 劣                                                                 | 选择 |
| ------------------------------------------ | ----------------------------- | ------------------------------------------------------------------ | ---- |
| **A. 新 sid 覆盖 existing.sid**            | 行为符合 last-touch；实现简单 | 用户从无 sid 入口加 2 个 + 从 sidA 加 1 个 → sid 仅记最后那次（A） | ✅   |
| B. 新建独立 cart 行（sid 加入 unique key） | 严格保留每次 sid              | unique key 4 列 → 5 列；前端展示出现多行同 SKU；用户体验恶化       |      |
| C. 维持 existing.sid 不变（first-touch）   | 与 Q1 矛盾                    | —                                                                  |      |

### 4.4 Q4 退款冲销 orderCount？

| 选项                                | 优                               | 劣                                                      | 选择 |
| ----------------------------------- | -------------------------------- | ------------------------------------------------------- | ---- |
| **A. 全单退款冲销；部分退款不冲销** | 与"订单实际成交"一致；操作可解释 | 实现要识别 partialRefund 标志（[[P0-02]] payload 已有） | ✅   |
| B. 全部冲销                         | 简单                             | 部分退款（如 100 元订单退 10 元）冲销整个名额，过度补偿 |      |
| C. 都不冲销                         | 简单                             | 名额永久占用，与真实成交脱节                            |      |

### 4.5 Q5 sid 在 EXPIRED 后 cart 行如何处理？

| 选项                                           | 优                     | 劣                                                                | 选择 |
| ---------------------------------------------- | ---------------------- | ----------------------------------------------------------------- | ---- |
| **A. cart 行保留 sid，但 checkout 时丢弃归因** | 用户无感；归因结果干净 | cart 仍存"看似有效"的 sid，运营查可能困惑                         | ✅   |
| B. cart 行同步把 sid 清空                      | 数据干净               | 需要后台扫表 / cron，违反 [[feedback_no_compensating_complexity]] |      |

---

## 5. 迁移与回滚

### 5.1 部署顺序

1. **D1**：合并 P0-02（outbox + handlePaid Bull worker 已就位）→ 这是本 PR 的强依赖。
2. **D2**：合并 P0-03（activityContextKey 签名）→ token verify 在 cart 已生效；本 PR 可拼接 sid 校验。
3. **D3**：本 PR 合并 schema + writer + reader + handler 三件套；客户端 trackClientEvent 的 `ORDER_ATTRIBUTED` 分支同时删除。
4. **D4**：miniapp-client / admin-web 把 addToCart 调用方的 `shareUserId` 入参替换为 `sid`；旧字段保留兼容 2 周后删除（前端契约同步）。

### 5.2 回滚

- D3 出问题：`git revert` 整个 PR；schema `sid` 列保留（向后兼容）。旧 `ORDER_ATTRIBUTED` 入口需要紧急恢复时，单独 cherry-pick share-token.service.ts 一段；不建议恢复，宁愿 orderCount 短暂失真也比客户端入口好。

### 5.3 旧 cart 数据兼容

旧 cart 行 sid 列默认 null；`shareUserId` 列保留（非 null 的为历史值）。读路径：

```ts
const effectiveShareUserId =
  (sid && (await reader.findBySid(sid, tenantId)))?.shareUserId ??
  cartRow.shareUserId ?? // ← 历史值兜底
  null;
```

兜底逻辑保留 1 个 release 周期（约 4 周）后删除；删除时间点：**D3 部署日 + 4 周**（实施期写入具体日期）。删除走独立 PR（见 §8.5 follow-up PR），动作清单：

1. 删 `OmsCartItem.shareUserId` 列（migration）
2. 删读路径中的 `cartRow.shareUserId` 兜底分支
3. 删 admin-web / miniapp-client 的 `shareUserId` 字段类型残留

**不**做数据迁移脚本（旧 shareUserId 没有 sid 来源，补不出来），4 周后自然过期 → 直接 drop column。

---

## 6. 验证矩阵

| 层       | 用例                                                                                                                                          | 工具                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 静态     | `grep -r "ORDER_ATTRIBUTED" apps/backend/src/module/store/distribution` 仅剩 `applySidOrderCountIncrement` 内部使用；client controller 0 处   | `rg`                                |
| 静态     | `grep -r "dto.shareUserId" apps/backend/src/module/client/cart` 0 处                                                                          | `rg`                                |
| Spec     | addToCart 带 sid → cart.sid + shareUserId 写入；不带 sid → cart.sid=null                                                                      | `cart.service.spec.ts`              |
| Spec     | addToCart existing 行：sid 覆盖（last-touch）；不带 sid 加车不清空已有 sid                                                                    | 同上                                |
| Spec     | sid 不存在 / EXPIRED / DISABLED → cart 静默无 sid                                                                                             | 同上                                |
| Spec     | self-share（token.shareUserId == memberId）→ cart 无 sid                                                                                      | 同上                                |
| Spec     | order paid → `applySidOrderCountIncrement` 命中所有 item 的 sid；orderCount++ ；event log 写入                                                | `order-integration.service.spec.ts` |
| Spec     | order paid 时 orderCount 达 max → token 转 EXPIRED；订单不报错                                                                                | 同上                                |
| Spec     | order refunded（全单）→ `applySidOrderCountDecrement`；orderCount 不减到负                                                                    | 同上                                |
| Spec     | order refunded（部分）→ 不冲销                                                                                                                | 同上                                |
| 集成     | E2E：clientA 分享 → clientB 点击 → clientB 加车 → checkout → pay → token.orderCount==1，omsOrderItemAttribution.entryContextSnapshot.sid 命中 | supertest                           |
| 数据迁移 | 部署后 `SELECT COUNT(*) FROM oms_cart_item WHERE sid IS NULL AND share_user_id IS NOT NULL` 不增长（旧数据兼容期）                            | DBA 查询                            |
| 监控     | Grafana 看 sid `orderCount` 增长曲线是否与 `oms_order.status=PAID` 计数对齐                                                                   | Grafana                             |

---

## 7. 风险与未决问题

### 7.1 留给实施者的 TODO

1. **TODO-1**：last-touch 顺序定义二选一 —— "dto.items 数组顺序"还是"cart 行 updateTime DESC"。本设计偏向前者（与用户提交顺序对齐），但若 C 端 UI 习惯让用户最先选的排在底部，需要与产品/前端确认。
2. **TODO-2**：是否允许"已支付订单"重新触发 sid 计数（如手动重新派发 Bull job）？当前 P0-02 已有 Redis 幂等键 + jobId 去重，应该天然不会重复；但若 P0-02 的 outbox dispatcher 死信被人工 replay，需要确认会不会重复 increment。**建议实施时把 `applySidOrderCountIncrement` 在事件日志侧加 `[orderId, sid, eventType] unique 约束`**（含违约 catch 跳过即可）。
3. **TODO-3**：`SysDistShareEvent.eventType` 新增 `ORDER_REFUND_REVERSED` 涉及 Prisma enum 变更，需要标准 migration；同时检查 admin 端运营页面是否有事件类型枚举的硬编码 switch。
4. **TODO-4**：miniapp-client 与 admin-web 的 `AddCartDto.shareUserId` / `entrySource` 等冗余字段彻底废弃后，前端是否有埋点依赖这些值？grep `shareUserId` 在前端代码确认。

### 7.2 已知风险

| 风险                                                          | 等级 | 缓解                                                                                                                                |
| ------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| sid 校验增加 cart 写入延迟（多一次 DB query）                 | 低   | `findActiveBySid` 走 sid unique 索引；同 request 内可 memo cache                                                                    |
| 多分享人同 sku 加车，user 实际未察觉归因被覆盖                | 中   | UI 应在加车成功后 toast 提示当前推荐人（前端配合，未在本设计强求）                                                                  |
| 退款冲销在分布式场景下与正向增计有顺序竞争（pay→refund 抢跑） | 低   | Bull jobId 互不冲突；payed handler 必先于 refunded handler 入队（业务上时间序），无须额外锁                                         |
| 部分退款后再全单退款的二次冲销                                | 中   | refunded handler 必须基于"本订单累积已冲销次数 vs item 数"判定；本设计**简化为**全单退款一次性冲销整单全部 item，部分退款历史不冲销 |
| Redis `attr:member:` 缓存与 cart sid 之间的优先级歧义         | 低   | §3.6 已固定：cart sid > Redis bind > parentId；测试覆盖 §6 集成用例                                                                 |
| 历史 cart 行的 shareUserId 在 §5.3 兼容期内仍生效，跨期失效   | 低   | §5.3 明确兼容窗口，并在 TODO 标注删除时间点                                                                                         |

### 7.3 不在本设计范围

- `SysDistAttributionBind` 表的语义化、与 `SysDistRelation` 合并：[[P2-13-eligibility-share-commission-chain]] 处理。
- 跨租户分享的归因路径（policy.enableCrossTenantBind）：现实现保留，本设计不动。
- 多 sku 订单中各 item 分别归因到不同 shareUserId 的佣金分摊：finance 模块自治，与本设计正交。
- sid 生成熵和碰撞检测：现有 6 次重试 + UUID 子串足够，不动。

---

## 8. 实施清单

### 8.1 backend

- [ ] `apps/backend/prisma/models/50-order.prisma`：`OmsCartItem` 新增 `sid String?` 列 + index；`pnpm prisma:migrate --name add_oms_cart_item_sid`。
- [ ] `apps/backend/prisma/models/40-distribution.prisma`：`DistShareEventType` enum 末尾追加 `ORDER_REFUND_REVERSED`；同次 migration。
- [ ] `apps/backend/src/module/store/distribution/services/share-token.service.ts`：
  - 删除 `trackClientEvent` 中 `ORDER_ATTRIBUTED` 分支（行 285-291）；DTO `TrackShareEventDto` 移除该枚举值。
  - 新增 `applySidOrderCountIncrement(sid, ctx)` / `applySidOrderCountDecrement(sid, ctx)` 公共方法。
  - 新增 reader：`findActiveBySid(sid, tenantId)`、`findBySid(sid, tenantId)`。
- [ ] `apps/backend/src/module/client/cart/cart.service.ts`：addToCart / updateQuantity / list 接入 sid；移除 `dto.shareUserId` 写入路径。
- [ ] `apps/backend/src/module/client/cart/dto/cart.dto.ts`：DTO 移除 `shareUserId`，新增 `sid?: string`。
- [ ] `apps/backend/src/module/client/order/services/order-checkout.service.ts`：preview 阶段 cartRow 透传 sid → previewItem.sid + shareUserId；写 `omsOrderItemAttribution.entryContextSnapshot.sid`。
- [ ] `apps/backend/src/module/client/order/services/order-creation-application.service.ts`：order header.shareUserId 改 last-touch（见 §3.3.2）；移除 `dto.items.find((item) => item.shareUserId)` 与 `dto.shareUserId`。
- [ ] `apps/backend/src/module/client/order/services/order-item-attribution.service.ts:38`：`entryContextSnapshot` 增加 sid 字段。
- [ ] `apps/backend/src/module/client/order/services/attribution.service.ts`：删 `bindRelation`（与 [[P0-01-attribution-config]] 重叠）；`getFinalShareUserId` 简化为 §3.6。
- [ ] `apps/backend/src/module/marketing/integration/integration.service.ts`：`handleOrderPaid` 末尾追加 sid increment 循环；`handleOrderRefunded` 追加 sid decrement 循环（仅当 `!options.partialRefund`）。
- [ ] `apps/backend/src/module/client/distribution/distribution.controller.ts`：检查 `TrackShareEventDto` 客户端调用是否还有人传 `ORDER_ATTRIBUTED`；如有报错明确（400 + 提示）。

### 8.2 契约同步

- [ ] `pnpm build:backend`
- [ ] `pnpm generate-types`
- [ ] miniapp-client：`AddCartDto` 改字段；前端 cart 调用替换 `shareUserId` → `sid`；首页/详情页埋点接入 sid。
- [ ] admin-web：分销监控页面如需展示 sid 维度的 orderCount，新增展示列；本 PR 不强求。

### 8.3 验证

- [ ] `pnpm typecheck:backend && pnpm lint:backend`
- [ ] `pnpm test:backend -- cart`
- [ ] `pnpm test:backend -- share-token`
- [ ] `pnpm test:backend -- order-integration`
- [ ] `pnpm test:backend -- order-creation`
- [ ] `pnpm check:slice`
- [ ] `pnpm generate-types && pnpm typecheck:h5 && pnpm typecheck:admin`
- [ ] PR 前：`pnpm verify-monorepo; pnpm verify:scripts; pnpm lint; pnpm typecheck; pnpm test`

### 8.4 PR 标题

`feat(backend): 购物车绑定 sid，订单支付驱动 sid orderCount`

### 8.5 Follow-up PR（D3 部署日 + 4 周）

兼容期结束后单独跑一次 PR：

- [ ] Prisma `OmsCartItem.shareUserId` 列删除 + migration（标准 drop column）。
- [ ] `cart.service.ts` 内读路径删除 `cartRow.shareUserId` 兜底分支。
- [ ] `cart.vo.ts` 内 `shareUserId` 字段删除；`pnpm generate-types` 同步前端。
- [ ] miniapp-client / admin-web grep `shareUserId` 残留点清理。
- [ ] PR 标题：`chore(backend): 删 oms_cart_item.shareUserId 列（P0-04 兼容期结束）`

**触发条件**：D3 上线 ≥ 28 天 + 监控指标 `cart_legacy_share_user_fallback_hit_count` 24h 内 ≤ 5（基本不再命中）。
