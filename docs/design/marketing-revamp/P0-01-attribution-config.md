---
title: P0-01 营销归因配置统一
status: draft
doc_type: design
phase: P0
last_verified: 2026-05-15
owner:
---

# 1. 目标与范围

> **跨文档硬约束**：本设计涉及金额字段全链路遵循 [[P0-00-money-precision]]；幂等键格式遵循 [[P2-14-idempotency-key-convention]]。

## 1.1 一句话目标

把营销/分销链路里散落 hardcode 的"时间窗"全部收敛到统一配置层，让运营在活动后台配的 `attributionWindowMinutes` 真正生效；同时清理一处 TTL 单位 bug 和一段死代码。

## 1.2 在范围内

- 新增 `AttributionConfigService`（三层优先级：活动 > 租户 sharePolicy > 全局默认）。
- 新增 `toMillis(minutes)` helper，强制 redis TTL 单位。
- 删除 `apps/backend/src/module/client/order/services/attribution.service.ts` 中 `bindRelation` 方法（死代码 + 单位 bug）。
- 替换所有归因相关 hardcode 时间窗为 `AttributionConfigService` 读取。
- 扩展 `sysDistSharePolicy` 增加 `attributionWindowMinutes` 字段。

## 1.3 不在范围内

- 不动 sid 机制本身（创建/解析/事件）。
- 不动 commission 等待 14 天逻辑（属 finance 模块，单独治理）。
- 不动 commission-compensation 24 小时扫描窗口（属于 worker 内部参数，不暴露给运营）。
- 不动 `umsMember.parentId` 永久绑定语义。

## 1.4 完成判定（DoD）

1. `grep -rn "7 \* 24 \* 60\|10080" apps/backend/src/module/marketing apps/backend/src/module/client/order apps/backend/src/module/store/distribution` 输出空。
2. 在 admin 端把某活动 `distributionGrowth.attributionWindowMinutes` 改成 30 天 → 通过该活动 sid 完成 BIND → `redis TTL attr:member:<mid>` ≈ 30 天（误差 1 分钟内）。
3. `attribution.service.ts` 中不再包含 `bindRelation`。
4. 三层优先级行为有 unit test 覆盖（活动配置最高、租户次之、全局兜底）。
5. `pnpm typecheck:backend` 通过；新增 spec 通过；`pnpm verify:scripts` 通过。

---

# 2. 现状取证

## 2.1 时间窗散落清单

| #   | 位置                                                                                       | 数值                     | 单位                            | 谁用                                                              |
| --- | ------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------- | ----------------------------------------------------------------- |
| 1   | `apps/backend/src/common/constants/business.constants.ts:14`                               | 24 \* 60                 | 分钟                            | sharePolicy.linkExpireMinutes 默认值 → sysDistShareToken.expireAt |
| 2   | `apps/backend/src/common/constants/business.constants.ts:18`                               | 5                        | 分钟                            | 点击去重窗口（SHARE_CLICK_DEDUPE_WINDOW_MINUTES）                 |
| 3   | `apps/backend/src/module/store/distribution/services/share-token.service.ts:327`           | policy 或 入参           | 分钟                            | createToken 时计算 expireAt                                       |
| 4   | `apps/backend/src/module/store/distribution/services/share-token.service.ts:543-546`       | **7 _ 24 _ 60**          | 分钟值 + 毫秒 TTL               | tryBindMember 后写 redis `attr:member:*`，hardcode                |
| 5   | `apps/backend/src/module/client/order/services/attribution.service.ts:82-90`               | **7 _ 24 _ 60**          | 分钟值 + 秒 TTL（**单位 bug**） | bindRelation，**实际无生产调用方**                                |
| 6   | `apps/backend/src/module/marketing/activity/handlers/distribution-growth.handler.ts:52-55` | 运营配                   | 分钟                            | 校验 attributionWindowMinutes>0，但**写入后无人读**               |
| 7   | `apps/backend/src/module/finance/commission/services/commission-calculator.service.ts:241` | 14 _ 24 _ 60 _ 60 _ 1000 | 毫秒                            | 佣金等待窗口（**不归本文档处理**）                                |

## 2.2 单位 bug 证据

`apps/backend/src/module/common/redis/redis.service.ts:80-94`：

```typescript
/**
 * @param ttl 可选，过期时间，单位 毫秒
 */
async set(key, val, ttl?: number) {
  if (!ttl) return await this.client.set(key, data);
  return await this.client.set(key, data, 'PX', ttl);  // PX = 毫秒
}
```

`attribution.service.ts:82-90`：

```typescript
const attributionWindowMinutes = options.attributionWindowMinutes ?? 7 * 24 * 60;
const ttlSeconds = Math.max(1, attributionWindowMinutes * 60); // 算出来是 604800（秒）
await this.redis.set(redisKey, JSON.stringify(payload), ttlSeconds); // 当毫秒解释 = 10.08 分钟
```

实际写入 redis 的 TTL 是 **604,800 毫秒 ≈ 10 分钟**，与变量名 `ttlSeconds` 不符，与"7 天归因窗口"语义严重不符。

`share-token.service.ts:543-546` 是写对的（传 ms）：

```typescript
await this.redisService.set(
  `attr:member:${...}`,
  { shareUserId, attributionWindowMinutes: 7 * 24 * 60, sourceChannel: 'DIST_SHARE_TOKEN' },
  7 * 24 * 60 * 60 * 1000,  // ms，正确
);
```

## 2.3 死代码确认

`AttributionService.bindRelation` 在 `apps/backend/src/module/client/order/` 目录搜索：仅在自身文件 + spec 文件出现，**无任何生产调用方**。该方法保留即增加误用风险。

## 2.4 假配置确认

`MktActivity.rules.distributionGrowth.attributionWindowMinutes`：

- 写入路径：`marketing/activity/activity.service.ts:325-373`（`normalizeDistributionGrowth` 把字段塞进 JSON 列）。
- 校验路径：`marketing/activity/handlers/distribution-growth.handler.ts:52-55`（要求 >0）。
- **读取路径**：grep 结果除 `activity.service.ts` 内部回读和 `OmsOrderItem` 落库 snapshot 外，**没有任何下游消费**。
- 结论：运营在活动配的归因窗口对 redis TTL **无任何影响**。

---

# 3. 设计方案

## 3.1 新增 AttributionConfigService

文件：`apps/backend/src/module/marketing/common/attribution-config.service.ts`

```typescript
@Injectable()
export class AttributionConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sharePolicyService: SharePolicyService,
  ) {}

  /**
   * 归因有效期（BIND 后 redis attr:member:* 的存活时间）
   * 优先级：活动 > 租户 sharePolicy > 全局默认
   */
  async getAttributionWindowMinutes(input: { tenantId: string; activityVersionId?: string | null }): Promise<number> {
    // 第 1 层：活动配置
    if (input.activityVersionId) {
      const activityWindow = await this.readActivityAttributionWindow(input.activityVersionId);
      if (activityWindow && activityWindow > 0) return activityWindow;
    }
    // 第 2 层：租户 sharePolicy
    const policy = await this.sharePolicyService.getPolicy(input.tenantId);
    if (policy?.data?.attributionWindowMinutes && policy.data.attributionWindowMinutes > 0) {
      return policy.data.attributionWindowMinutes;
    }
    // 第 3 层：全局默认
    return BusinessConstants.DISTRIBUTION.DEFAULT_ATTRIBUTION_WINDOW_MINUTES;
  }

  /**
   * 链接物理过期（sysDistShareToken.expireAt）
   * 优先级：调用方入参 > 租户 sharePolicy > 全局默认
   * 注意：链接过期 ≠ 归因有效期，语义独立
   */
  async getLinkExpireMinutes(input: { tenantId: string; override?: number | null }): Promise<number> {
    if (input.override && input.override > 0) return input.override;
    const policy = await this.sharePolicyService.getPolicy(input.tenantId);
    if (policy?.data?.linkExpireMinutes && policy.data.linkExpireMinutes > 0) {
      return policy.data.linkExpireMinutes;
    }
    return BusinessConstants.DISTRIBUTION.DEFAULT_SHARE_LINK_EXPIRE_MINUTES;
  }

  private async readActivityAttributionWindow(activityVersionId: string): Promise<number | null> {
    // 从 MktActivity.rules.distributionGrowth.attributionWindowMinutes 读
    // 用 cache（5 分钟 TTL）避免高频读 DB
    // ... 实现细节
  }
}
```

## 3.2 toMillis helper

文件：`apps/backend/src/module/marketing/common/duration.util.ts`

```typescript
/**
 * 分钟 → 毫秒，强制 number 类型，禁止负值。
 * 所有写入 redis TTL（基于 RedisService.set 的 PX 语义）必须经过本函数。
 */
export function minutesToMillis(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new BusinessException(ResponseCode.PARAM_INVALID, `Invalid duration: ${minutes} minutes`);
  }
  return Math.floor(minutes) * 60 * 1000;
}
```

## 3.3 sharePolicy schema 扩展

`apps/backend/prisma/models/40-distribution.prisma`：`SysDistSharePolicy` 增加：

```prisma
attributionWindowMinutes Int @default(10080) @map("attribution_window_minutes")  // 默认 7 天 = 10080 分钟
```

迁移文件：`apps/backend/prisma/migrations/<timestamp>_add_attribution_window_to_share_policy/migration.sql`

```sql
ALTER TABLE sys_dist_share_policy
  ADD COLUMN attribution_window_minutes INT NOT NULL DEFAULT 10080;
```

## 3.4 business.constants 扩展

`apps/backend/src/common/constants/business.constants.ts` DISTRIBUTION 节增加：

```typescript
DEFAULT_ATTRIBUTION_WINDOW_MINUTES: 7 * 24 * 60,  // 归因有效期默认 7 天
```

## 3.5 代码替换点

| 文件:行                                                                     | 现状                                                                  | 改为                                                                                                                                      |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `share-token.service.ts:543-547`                                            | `await this.redisService.set(key, payload, 7*24*60*60*1000)`          | `await this.redisService.set(key, payload, minutesToMillis(await attrConfig.getAttributionWindowMinutes({tenantId, activityVersionId})))` |
| `share-token.service.ts:543` payload 中 `attributionWindowMinutes: 7*24*60` | hardcode                                                              | 用上面读出来的同一变量                                                                                                                    |
| `share-token.service.ts:327`                                                | `expireMinutes = input.linkExpireMinutes ?? policy.linkExpireMinutes` | `expireMinutes = await attrConfig.getLinkExpireMinutes({tenantId, override: input.linkExpireMinutes})`                                    |
| `attribution.service.ts:77-95` 整段 `bindRelation` 方法                     | 死代码+单位 bug                                                       | **删除整个方法 + spec 文件中的相关 case**                                                                                                 |
| `attribution.service.ts:82` `?? 7 * 24 * 60`                                | hardcode                                                              | 整段方法删除                                                                                                                              |
| `business.constants.ts:14` `DEFAULT_SHARE_LINK_EXPIRE_MINUTES: 24 * 60`     | 保留                                                                  | 不动（链接过期默认值仍合理）                                                                                                              |

## 3.6 admin-web 适配

- `sharePolicy` 编辑表单（`apps/admin-web/src/views/distribution/share-policy/**`，待定位）增加 `attributionWindowMinutes` 字段输入。
- `MktActivity` 详情页 `distributionGrowth` 面板的 `attributionWindowMinutes` 字段保留（已存在），提示文案改为 "归因有效期（分钟），覆盖租户默认"。
- 列宽/类型不变 → 不触发 `pnpm verify:admin-view-types`。

## 3.7 OpenAPI / 类型契约

`sysDistSharePolicy` 加字段属于 backend 契约变更：

```
backend schema → migration → pnpm generate-types → libs/common-types → admin-web 消费
```

---

# 4. 迁移与回滚

## 4.1 部署顺序

1. **执行 SQL migration**（无破坏，新增字段有默认值）。
2. **部署 backend**（旧 redis key 不受影响，新 BIND 走新 TTL）。
3. **运行 `pnpm generate-types`**，提交生成的 `libs/common-types` 改动。
4. **部署 admin-web**（含新表单字段）。

## 4.2 旧 redis key 处理

- 现存 `attr:member:*` key 是用旧的 7-天-hardcode-毫秒 TTL 写的，**已经在正确生效**，无需迁移。
- `bindRelation` 死代码删除后，没有任何写入 10-分钟错 TTL 的路径；旧错 TTL key 因为该方法本来就无生产调用，**理论上不存在**。

## 4.3 回滚方案

- 代码层：`git revert` 即可，新增 schema 字段保留（向前兼容）。
- 数据层：无需 down migration（字段有默认值且不影响旧逻辑）。

---

# 5. 验证矩阵

## 5.1 静态层

- `pnpm typecheck:backend`
- `pnpm lint:backend`
- `pnpm verify:scripts`

## 5.2 行为测试（spec，按 TEST_SPEC_PROTOCOL）

| spec 文件                                  | 覆盖点                                                      |
| ------------------------------------------ | ----------------------------------------------------------- |
| `attribution-config.service.spec.ts`（新） | 三层优先级：活动 > 租户 > 全局                              |
| `attribution-config.service.spec.ts`（新） | 活动配 0 / 负数 / 未配 → fallback 到租户                    |
| `attribution-config.service.spec.ts`（新） | 租户 policy 不存在 → fallback 到全局                        |
| `duration.util.spec.ts`（新）              | minutesToMillis 正常值 / 负值抛错 / NaN 抛错                |
| `share-token.service.spec.ts`（既有）      | tryBindMember 后 redis TTL 应等于 config 返回的窗口 × 60000 |
| `attribution.service.spec.ts`（既有）      | 确认 bindRelation 被删除（spec 中相关 case 同步删除）       |

## 5.3 集成验证（手动）

1. admin 配活动 A：`distributionGrowth.attributionWindowMinutes = 30 * 24 * 60`（30 天）。
2. C 端用 A 关联的 sid 完成 BIND。
3. `redis-cli PTTL attr:member:<mid>` ≈ 30 _ 24 _ 60 _ 60 _ 1000 = 2,592,000,000（误差 1 分钟）。
4. 删活动 A 的窗口配置 → 重 BIND → PTTL 应回到租户 sharePolicy 配的值。
5. 删租户 policy 字段 → 重 BIND → PTTL 应为 604,800,000（7 天）。

## 5.4 监控指标（后续接入）

- 归因 BIND 成功率：`metrics.share.bind.success / metrics.share.bind.total`
- redis key TTL 分布（按场景统计）：用于发现新的"假配置"漏洞

---

# 6. 风险与未决问题

## 6.1 风险

| 风险                                                        | 影响       | 缓解                                                                           |
| ----------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| AttributionConfigService 读 MktActivity 会高频查 DB         | 性能       | 加 5 分钟内存缓存（cache-manager）。activityVersionId 是字符串 key，命中率高。 |
| 旧 redis key 仍按 7 天 hardcode 写过的会持续到 7 天后才过期 | 行为不一致 | 无需处理，自然过期。新 BIND 走新逻辑。                                         |
| 删 bindRelation 若有未发现的调用方                          | 编译失败   | typecheck 会立即报错；删除前再次全仓 grep 确认。                               |

## 6.2 留给实施者的 TODO

- [ ] 实施前再 grep 一次 `bindRelation` 确认零调用。
- [ ] 决定 AttributionConfigService 缓存方案（cache-manager / Redis / 内存 LRU），本文档不强制。
- [ ] admin-web sharePolicy 编辑页路径需要先在前端定位（`apps/admin-web/src/views/distribution/**`）。

---

# 7. 实施清单（按文件粒度可勾选）

## 7.1 backend 改动

- [ ] `apps/backend/prisma/models/40-distribution.prisma` 加 `attributionWindowMinutes` 字段。
- [ ] 新增 migration `add_attribution_window_to_share_policy`。
- [ ] `apps/backend/src/common/constants/business.constants.ts` 加 `DEFAULT_ATTRIBUTION_WINDOW_MINUTES`。
- [ ] 新建 `apps/backend/src/module/marketing/common/duration.util.ts`（含 spec）。
- [ ] 新建 `apps/backend/src/module/marketing/common/attribution-config.service.ts`（含 spec）。
- [ ] 注册到 `marketing/common/common.module.ts`（或合适的模块），并 export。
- [ ] `apps/backend/src/module/store/distribution/services/share-token.service.ts:327` 改用 `attrConfig.getLinkExpireMinutes`。
- [ ] 同文件 `:543-547` tryBindMember 写 redis 改用 `attrConfig.getAttributionWindowMinutes` + `minutesToMillis`。
- [ ] `apps/backend/src/module/client/order/services/attribution.service.ts` 删除 `bindRelation` 方法 + `BindRelationOptions` 接口。
- [ ] `attribution.service.spec.ts` 删除相关 case。
- [ ] `apps/backend/src/module/store/distribution/services/share-policy.service.ts` create/update 时支持新字段。
- [ ] sharePolicy DTO/VO 增加字段。

## 7.2 契约同步

- [ ] `pnpm typecheck:backend`
- [ ] `pnpm generate-types`
- [ ] 提交 `libs/common-types` 变更

## 7.3 admin-web 改动

- [ ] sharePolicy 编辑表单加 `attributionWindowMinutes` 输入（带单位提示"分钟"）。
- [ ] MktActivity `distributionGrowth` 面板该字段保留，文案改为"归因有效期（分钟）。覆盖租户默认"。

## 7.4 验证

- [ ] `pnpm typecheck:backend` 通过
- [ ] `pnpm lint:backend` 通过
- [ ] `pnpm test:backend -- attribution-config` 通过
- [ ] `pnpm test:backend -- duration.util` 通过
- [ ] `pnpm verify:scripts` 通过
- [ ] 手动验证 5.3 节集成步骤 1-5

## 7.5 PR 标题与 commit message 建议

```
fix(backend): 归因时间窗统一三层配置层
- 新增 AttributionConfigService 收敛 hardcode
- 新增 minutesToMillis helper 强制 redis TTL 单位
- 修复 attribution.service.bindRelation TTL 单位 bug（直接删除死代码）
- 扩展 sysDistSharePolicy 加 attributionWindowMinutes 字段
- 活动配的 distributionGrowth.attributionWindowMinutes 真正生效
```
