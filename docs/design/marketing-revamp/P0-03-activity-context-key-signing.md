# P0-03 activityContextKey 与归因元数据签名化

**owner**: 待指派 / 后端 + admin-web
**status**: draft（待评审 → 待实施）
**last_verified**: 2026-05-15（仅取证，未执行任何代码改动）
**related**: [[P0-01-attribution-config]]、[[P0-04-cart-bind-sid]]、[[P2-13-eligibility-share-commission-chain]]

---

> **跨文档硬约束**：本设计涉及金额字段全链路遵循 [[P0-00-money-precision]]；幂等键格式遵循 [[P2-14-idempotency-key-convention]]。

## 1. 目标与范围

### 1.1 目标

把 `activityContextKey` 从"明文 `${activityType}:${configId}` 字符串"升级为"服务端 HMAC-SHA256 签名 token"，并把当前**完全信任客户端透传**的 7 个归因元数据字段一并纳入签名。消除三类裂缝：

- **元数据伪造**：`entrySceneCode / entryModuleCode / cardTemplateCode / resolverPolicyCode / resolverReleaseNoSnapshot / activityVersionId / attributionWindowMinutes / shareChannel` 当前由客户端透传到 `omsOrderItemAttribution` 快照，攻击者可以伪造场景/模块归因来污染分佣报表和归因统计（`order-checkout.service.ts:157-167` 的 SECURITY-NOTE 已自陈）。
- **跨会员/跨租户重放**：当前 `activityContextKey` 不绑定 memberId / tenantId，理论上 A 用户的购物车行 key 可以被 B 用户提交（B 用户若巧合资格通过，会继承 A 的归因元数据）。
- **历史 / 离线活动重放**：过期或已下架活动的 `activityContextKey` 没有时间属性，依赖 `validateAndLock` 在下单时识别"配置已下架"才挡掉；快照报表入口（checkout preview 写入 `omsOrderItemAttribution`）若早于活动下架，则攻击窗口存在。

### 1.2 范围

- ✅ 新增 `ActivityContextTokenService`：build / verify / 双 key 轮换。
- ✅ 替换 `ActivityContextKeyService.build / parse / validate` 的所有现有 caller（17 处文件，详见 §3.5），改为发放/校验签名 token。
- ✅ Cart / Checkout / Resolution / Zone / Simulator / PrimaryOfferResolver 6 大入口统一接入。
- ✅ DTO / VO 字段保留 `activityContextKey` 命名（向前兼容前端调用），仅改语义为 token 字符串。
- ✅ 旧 cart 行（明文 key）切流清空（决策见 §4 Q2）。
- ❌ 不调整 `omsCartItem` 的 schema 形状（仍是 nullable string 列）。
- ❌ 不动 `mkt_activity` 的 `rules` 结构。
- ❌ 不再做"事件总线签名"或"分布式 JWT"——P0-03 的签名只服务于"客户端不可伪造"，不进入 service-to-service 信任域。

### 1.3 DoD（Definition of Done）

1. `keyService.build / parse / validate` 全部调用点替换为 `tokenService.issue / verify`，`ActivityContextKeyService` 类删除。
2. `order-checkout.service.ts:157-167` 的 SECURITY-NOTE 删除（注释里说的伪造路径已被 HMAC 阻塞）。
3. `omsCartItem.activityContextKey` 的所有读路径（addToCart / updateQuantity / list / consumeCheckedOutItems）都调用 `tokenService.verify`；解析失败的行视为"无活动"行（不报错、不下架，直接走标准价）。
4. 双 key 轮换：`MARKETING_ACTIVITY_TOKEN_SECRET_PRIMARY` / `MARKETING_ACTIVITY_TOKEN_SECRET_SECONDARY` 两个环境变量；issue 永远用 primary，verify 先 primary 再 secondary。
5. 部署时 `oms_cart_item` 表所有 `activity_context_key NOT NULL` 的行被批量清空（详见 §5.3）。
6. 集成测试覆盖：篡改 token 任一字段 → `validateAndLock` 抛 401-ish 异常；过期 token → 拒绝；用 secondary key 签的 token → primary 在线时也能验证通过；rotate 之后旧 primary 退入 secondary，再过一个窗口废弃。

---

## 2. 现状取证

> 基于 2026-05-15 主干 commit `02537317`。

### 2.1 当前 `ActivityContextKeyService` 实现（无签名）

```ts
// apps/backend/src/module/marketing/resolution/services/activity-context-key.service.ts
build(activityType, configId): string | null {
  if (!activityType || !configId) return null;
  return `${activityType}:${configId}`;   // ← 明文，任何人可构造
}

parse(key): { activityType, configId } | null {
  const idx = key.indexOf(':');
  return { activityType: key.substring(0, idx), configId: key.substring(idx + 1) };
}

validate(key, activityType, activityConfigId) {
  // 只校验 key 与冗余字段 type/configId 一致，不校验真实性
  parsed.activityType !== activityType || parsed.configId !== activityConfigId  → 抛错
}
```

### 2.2 七个未签名的归因元数据字段

```ts
// apps/backend/src/module/client/order/services/order-checkout.service.ts:157-167
// SECURITY-NOTE(marketing-team): 以下归因字段直接信任客户端透传，存在数据污染风险。
// 后续迭代应改为服务端签名验证或从活动上下文反推，避免伪造归因影响分佣和报表。
entrySceneCode: item.entrySceneCode ?? null,
entryModuleCode: item.entryModuleCode ?? null,
cardTemplateCode: item.cardTemplateCode ?? null,
resolverPolicyCode: item.resolverPolicyCode ?? null,
resolverReleaseNoSnapshot: item.resolverReleaseNo ?? null,
activityVersionId: item.activityVersionId ?? null,
attributionWindowMinutes: item.attributionWindowMinutes ?? null,
shareChannel: item.shareChannel ?? null,
```

这 8 个字段（含 `shareChannel`）目前从 DTO 直接落入 `omsOrderItemAttribution.entryContextSnapshot` / 各 `*Snapshot` 列（`order-item-attribution.service.ts:38-45`），全程**没有任何 server-side 反查或验证**。它们直接进入：

- `rpt_order_item_marketing_fact`（运营报表的归因维度）
- 后续 `commissionService.triggerCalculation` 的入参（影响分佣链路）
- admin-web 营销监控页面（错误数据被沉淀）

### 2.3 客户端入口（issue 端）

`activityContextKey` 在以下 server-side 路径**生成**：

| 入口（issuer）                      | 文件                                             | 调用                                               | 备注                 |
| ----------------------------------- | ------------------------------------------------ | -------------------------------------------------- | -------------------- |
| 营销专区 zone 列表                  | `client-zone.service.ts:129`                     | `keyService.build(config.templateCode, config.id)` | C 端拉专区列表时下发 |
| 场景模块解析（resolveSceneView 内） | `resolution.service.ts:106` / `:152`             | 同上                                               | 场景模块卡片里下发   |
| Primary offer 解析（商品详情/卡片） | `primary-offer-resolver.service.ts:182` / `:193` | 同上                                               | 商品详情页下发       |
| Simulator（admin 营销预演）         | `simulator.service.ts:108`                       | 同上                                               | 仅 admin 内部使用    |

### 2.4 服务端入口（verify 端）

| 入口（verifier）                         | 文件                                                        | 调用                                                 | 备注                                              |
| ---------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| 下单 checkout preview / 提交             | `order-checkout.service.ts` → `batch-validation.service.ts` | `keyService.validate` + `keyService.parse`           | 实际只做"key 字符串与冗余 type/configId 一致"校验 |
| 单笔活动校验（admin 工具调用）           | `resolution.service.ts:170` `validateAndLock`               | 同上                                                 |                                                   |
| 购物车 addToCart / updateQuantity / list | `cart.service.ts:36 / :188 / :298`                          | **无**校验，直接 `normalizeActivityContextKey(trim)` | 这是最弱的一环：cart 完全不验证                   |

### 2.5 实质性威胁评估（必要的去夸大）

`validateAndLock` 在下单时会以 `parsed.configId` 重新从 DB 查活动 → 重新跑 `filterCandidates` → 重新计算价格 / 佣金。这意味着：

- **价格篡改**：不可行（价格从 DB 读，不从 token 读）。
- **资格绕过**：不可行（资格 filter 在 server 跑）。
- **元数据伪造**：**可行**（7 个 attribution 字段未参与 validate，直接进入快照）。
- **跨会员重放**：**可行但收益低**（继承者必须满足资格才完成下单，纯属归因污染）。

因此 P0-03 的核心收益不是"防止超额优惠"——这道防线已有——而是"保证 attribution 元数据可信"，让分佣口径和运营报表口径不再被客户端污染。

---

## 3. 设计方案

### 3.1 Token 结构

签名 token 采用紧凑 base64url 编码，三段式（仿 JWT 但不引入 jose / jsonwebtoken 依赖，自实现以避免错误用法）：

```
<payload-base64url>.<kid>.<sig-base64url>
```

- `payload-base64url`：JSON 序列化的 payload base64url 编码。
- `kid`：签名密钥版本，`1` 或 `2`，对应 PRIMARY / SECONDARY。
- `sig`：HMAC-SHA256(`${payload-base64url}.${kid}`, secret[kid]) 截断为 16 字节再 base64url（**128 bit** 足够防伪造，又比完整 256 bit 短）。

**Payload schema**：

```ts
interface ActivityContextTokenPayload {
  v: 1; // token 版本，方便将来字段加减
  t: string; // tenantId
  m: string | null; // memberId（C 端发卡时已登录写入；游客或 admin 场景为 null）
  type: string; // activityType（== templateCode）
  cid: string; // activityConfigId
  ver?: string; // activityVersionId（[[P0-01-attribution-config]] 引入）
  esc?: string; // entrySceneCode
  emc?: string; // entryModuleCode
  ctc?: string; // cardTemplateCode
  rpc?: string; // resolverPolicyCode
  rrn?: number; // resolverReleaseNoSnapshot
  awm?: number; // attributionWindowMinutes
  sc?: string; // shareChannel
  iat: number; // issued at（秒）
  exp: number; // expires at（秒）
}
```

**字段决策**：

- 字段名都做了缩写（`esc / emc / ctc / rpc / rrn / awm / sc`）—— Token 是高频字段（每次商品卡片都带），明显短一点对 wire size 和 cart row 存储都有意义。
- 不放 `productId` / `skuId`：cart 已经按 `[memberId, tenantId, skuId, activityContextKey]` 四元组唯一索引，token 不需要再次绑定 sku；后续 cart 行被多 sku 共享时，token 也可复用。
- 不放 `nonce`：token 本来就和 (member, activity, scene) 紧耦合，重放价值低；加 nonce 会让 cart 唯一索引失效（不同 nonce 同活动会产生多行）。
- `m` 为 null 的场景：admin simulator、未登录浏览的 zone 列表 → 验证时若 `verify` 期望 `member=null` 但 cart 提交时 `memberId=xxx`，按"严格匹配"判定为重放 → 拒绝。**未登录浏览的商品卡片不应被加入购物车**，业务前置已有登录拦截。

### 3.2 `ActivityContextTokenService`

```ts
// apps/backend/src/module/marketing/resolution/services/activity-context-token.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { BusinessException, ResponseCode } from 'src/common/exceptions';

const TOKEN_VERSION = 1 as const;
const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24h；cart 行最大有效期

export type Kid = '1' | '2';

export interface IssueInput {
  tenantId: string;
  memberId: string | null;
  activityType: string;
  activityConfigId: string;
  activityVersionId?: string;
  entrySceneCode?: string;
  entryModuleCode?: string;
  cardTemplateCode?: string;
  resolverPolicyCode?: string;
  resolverReleaseNo?: number;
  attributionWindowMinutes?: number;
  shareChannel?: string;
  ttlSeconds?: number; // 调用方可覆盖；默认 24h
}

export interface VerifiedToken {
  tenantId: string;
  memberId: string | null;
  activityType: string;
  activityConfigId: string;
  activityVersionId?: string;
  entrySceneCode?: string;
  entryModuleCode?: string;
  cardTemplateCode?: string;
  resolverPolicyCode?: string;
  resolverReleaseNo?: number;
  attributionWindowMinutes?: number;
  shareChannel?: string;
  /** 实际使用的 kid，便于 caller 决定是否需要 issue 新 token 替换 */
  signedWith: Kid;
}

@Injectable()
export class ActivityContextTokenService {
  private readonly logger = new Logger(ActivityContextTokenService.name);

  private readonly primarySecret = this.requireSecret('MARKETING_ACTIVITY_TOKEN_SECRET_PRIMARY');
  private readonly secondarySecret = process.env.MARKETING_ACTIVITY_TOKEN_SECRET_SECONDARY ?? null;
  private readonly defaultTtl = Number(process.env.MARKETING_ACTIVITY_TOKEN_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);

  /** issue：服务器内部调用，前端永远不能直调。 */
  issue(input: IssueInput): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      v: TOKEN_VERSION,
      t: input.tenantId,
      m: input.memberId,
      type: input.activityType,
      cid: input.activityConfigId,
      ...(input.activityVersionId && { ver: input.activityVersionId }),
      ...(input.entrySceneCode && { esc: input.entrySceneCode }),
      ...(input.entryModuleCode && { emc: input.entryModuleCode }),
      ...(input.cardTemplateCode && { ctc: input.cardTemplateCode }),
      ...(input.resolverPolicyCode && { rpc: input.resolverPolicyCode }),
      ...(input.resolverReleaseNo !== undefined && { rrn: input.resolverReleaseNo }),
      ...(input.attributionWindowMinutes !== undefined && { awm: input.attributionWindowMinutes }),
      ...(input.shareChannel && { sc: input.shareChannel }),
      iat: now,
      exp: now + (input.ttlSeconds ?? this.defaultTtl),
    };
    const payloadB64 = base64url(JSON.stringify(payload));
    const kid: Kid = '1';
    const sig = this.sign(payloadB64, kid);
    return `${payloadB64}.${kid}.${sig}`;
  }

  /** verify：所有 server-side 入口（cart、checkout、validateAndLock）必经路径。 */
  verify(token: string, expected: { tenantId: string; memberId: string | null }): VerifiedToken {
    BusinessException.throwIf(!token, '活动上下文缺失', ResponseCode.PARAM_INVALID);
    const parts = token.split('.');
    BusinessException.throwIf(parts.length !== 3, '活动上下文非法', ResponseCode.PARAM_INVALID);
    const [payloadB64, kidRaw, sigRaw] = parts;

    const kid = (kidRaw === '1' || kidRaw === '2' ? kidRaw : null) as Kid | null;
    BusinessException.throwIf(!kid, '活动上下文密钥版本未知', ResponseCode.PARAM_INVALID);

    const expectedSig = this.sign(payloadB64, kid!);
    BusinessException.throwIf(
      !this.constantTimeEquals(sigRaw, expectedSig),
      '活动上下文签名校验失败',
      ResponseCode.PARAM_INVALID,
    );

    const payload = JSON.parse(base64urlDecode(payloadB64)) as Record<string, unknown>;
    BusinessException.throwIf(payload.v !== TOKEN_VERSION, '活动上下文版本不匹配', ResponseCode.PARAM_INVALID);
    BusinessException.throwIf(
      (payload.exp as number) < Math.floor(Date.now() / 1000),
      '活动上下文已过期',
      ResponseCode.PARAM_INVALID,
    );
    BusinessException.throwIf(payload.t !== expected.tenantId, '活动上下文租户不匹配', ResponseCode.PARAM_INVALID);
    // memberId 严格匹配：null token 只能给 null caller；具名 token 必须等同
    BusinessException.throwIf(
      (payload.m ?? null) !== (expected.memberId ?? null),
      '活动上下文会员不匹配',
      ResponseCode.PARAM_INVALID,
    );

    return {
      tenantId: payload.t as string,
      memberId: (payload.m ?? null) as string | null,
      activityType: payload.type as string,
      activityConfigId: payload.cid as string,
      activityVersionId: payload.ver as string | undefined,
      entrySceneCode: payload.esc as string | undefined,
      entryModuleCode: payload.emc as string | undefined,
      cardTemplateCode: payload.ctc as string | undefined,
      resolverPolicyCode: payload.rpc as string | undefined,
      resolverReleaseNo: payload.rrn as number | undefined,
      attributionWindowMinutes: payload.awm as number | undefined,
      shareChannel: payload.sc as string | undefined,
      signedWith: kid!,
    };
  }

  private sign(payloadB64: string, kid: Kid): string {
    const secret = kid === '1' ? this.primarySecret : this.requireSecondary();
    const h = createHmac('sha256', secret).update(`${payloadB64}.${kid}`).digest();
    return base64url(h.subarray(0, 16)); // 128bit 截断，长度 22 char
  }

  private constantTimeEquals(a: string, b: string): boolean {
    const ab = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }

  private requireSecret(envKey: string): string {
    const v = process.env[envKey];
    if (!v || v.length < 32) {
      throw new Error(`${envKey} must be set and >=32 chars`);
    }
    return v;
  }
  private requireSecondary(): string {
    if (!this.secondarySecret || this.secondarySecret.length < 32) {
      // 注意：稳态下 SECONDARY 主动清空，遗留 kid=2 token 进来必走此分支。
      // 不能抛 SYSTEM_ERROR——那是"服务端故障"语义，会让 caller 重试 / 触发监控告警。
      // 正确语义是"该 token 由旧密钥签，已不可验证 → token 失效"，让前端引导用户刷新。
      throw new BusinessException(ResponseCode.PARAM_INVALID, '活动上下文密钥已失效，请重新打开商品');
    }
    return this.secondarySecret;
  }
}
```

> `base64url` / `base64urlDecode` 两个工具函数放在同目录的 `token-codec.util.ts`（不引入 jose 等三方包，纯 Node `Buffer.from(..., 'base64url')`）。

### 3.3 双密钥轮换流程

| 阶段    | PRIMARY | SECONDARY | issue 用 | verify 接受   | 持续     |
| ------- | ------- | --------- | -------- | ------------- | -------- |
| 稳态    | key-A   | （空）    | key-A    | 只 key-A      | 默认     |
| 轮换 T0 | key-B   | key-A     | key-B    | key-B + key-A | ≥ 25h \* |
| 稳态    | key-B   | （空）    | key-B    | 只 key-B      |          |

- "25h" = token TTL (24h) + 1h 余量。

**轮换操作脚本**（不进 backend 业务代码，归 ops scripts）：

```bash
# scripts/security/rotate-marketing-activity-token-secret.sh（建议路径，本 PR 不强制创建）
# 1. 生成新密钥
NEW_KEY=$(openssl rand -base64 48)
# 2. 把当前 PRIMARY 写到 SECONDARY，再把 NEW_KEY 写到 PRIMARY
# 3. 重启 API 实例（滚动）
# 4. 25h 后把 SECONDARY 清空（再次滚动重启）
```

### 3.4 业务调用点改造

**Issuer 端**（所有 `keyService.build(...)` 调用点）：

| 文件 / 位置                                    | 当前                                               | 改后                                                                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client-zone.service.ts:129`                   | `keyService.build(config.templateCode, config.id)` | `tokenService.issue({ tenantId, memberId, activityType: config.templateCode, activityConfigId: config.id, entrySceneCode: zone.code, entryModuleCode: ... })` |
| `resolution.service.ts:106`                    | 同上                                               | 同上 + 注入 `resolverPolicyCode` / `activityVersionId`                                                                                                        |
| `resolution.service.ts:152`                    | 同上                                               | 同上                                                                                                                                                          |
| `simulator.service.ts:108`                     | 同上                                               | issue 时 `memberId = null`（admin 模拟）                                                                                                                      |
| `primary-offer-resolver.service.ts:182 / :193` | 同上                                               | 同上，注入 `cardTemplateCode`                                                                                                                                 |

**Verifier 端**（替换 `keyService.parse / validate` 调用点）：

| 文件 / 位置                                                                      | 当前                                                        | 改后                                                                                                                                                                          |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolution.service.ts:172-173` `validateAndLock`                                | `keyService.validate(...)` + `keyService.parse(...)`        | `const verified = tokenService.verify(dto.activityContextKey, { tenantId: dto.tenantId, memberId: dto.memberId })`，然后用 `verified.activityConfigId` 替代 `parsed.configId` |
| `order-checkout.service.ts:95-106` `batchValidationService.validateAndLockLines` | 透传 `activityContextKey / activityType / activityConfigId` | 内部改为 `tokenService.verify` → 取 verified payload 内的元数据；DTO 字段 `activityType / activityConfigId` 不再从客户端读                                                    |
| `order-checkout.service.ts:157-167`                                              | 7 个字段从客户端 `item.*` 取                                | 改为从 `verified.entrySceneCode / verified.entryModuleCode / ... ` 取，**删除 SECURITY-NOTE**                                                                                 |
| `cart.service.ts:34-99` `addToCart`                                              | `normalizeActivityContextKey(dto.activityContextKey)`       | `dto.activityContextKey ? tokenService.verify(dto.activityContextKey, { tenantId: dto.tenantId, memberId }) : null`，token 校验失败 → 拒绝加购                                |
| `cart.service.ts:188-199` `updateCartQuantity`                                   | 同上                                                        | 同上                                                                                                                                                                          |
| `cart.service.ts:158`（list）                                                    | 直接读 `cartItem.activityContextKey` 返回客户端             | 直接返回，**不重新签发**：cart 行就是 token 本身；前端继续传回即可                                                                                                            |
| `cart.service.ts:297` Redis cache field                                          | `${item.skuId}:${item.activityContextKey ?? ''}`            | 同上（不动）                                                                                                                                                                  |

### 3.5 DTO / VO 字段约束

- `CreateOrderItemDto.activityContextKey`：保留 `string?`，但**移除**与之并列的 `activityType / activityConfigId / entrySceneCode / entryModuleCode / cardTemplateCode / resolverPolicyCode / resolverReleaseNo / activityVersionId / attributionWindowMinutes / shareChannel` 等"冗余字段"——这些值现在从 token 解出，客户端不再需要重复发送。
- `AddCartDto.activityContextKey`：保留 `string?`，其余冗余字段同样移除。
- `CheckoutPreviewItemVo.activityContextKey`：保留（前端 / cart 之间的协议字段）；`activityType / activityConfigId` 等 VO 字段保留，但**由服务端 verify 后回填**，不再"等于客户端发什么就回什么"。
- `MarketingProductCard.activityContextKey`：保留；server-side build 时改用 token。

> 字段命名保持 `activityContextKey`（语义仍是"客户端去标识活动上下文的字符串"），避免雪崩式契约变更（[[P0-01-attribution-config]] / [[P0-04-cart-bind-sid]] 都依赖这个字段名继续工作）。

### 3.6 与 P0-01 / P0-04 的衔接

- **与 P0-01**：`attributionWindowMinutes` 当前由前端透传，P0-01 在 server 端用 `AttributionConfigService` 计算后注入 token（issue 时填入 `awm`）；verify 端不再回传客户端值，直接用 token 里的 `awm`。
- **与 P0-04**：cart 行后续会增加 `sid` 列（sysDistShareToken 引用）；token 与 sid 是正交的两个概念——token 锁活动上下文 + 元数据；sid 锁分销归因人。

---

## 4. 决策依据（trade-off）

### 4.1 Q1 密钥管理：双 key 轮换 vs JWT 标准 vs 单 key

| 选项                              | 优                                                  | 劣                                                            | 选择 |
| --------------------------------- | --------------------------------------------------- | ------------------------------------------------------------- | ---- |
| **A. 双 key 自实现 HMAC**         | 0 三方依赖；rotate 不需要踢用户；签名常量时间 < 1ms | 自实现要小心 timing attack（本设计已用 `timingSafeEqual`）    | ✅   |
| B. `jose` / `jsonwebtoken` 三方包 | 标准 JWT 生态；JWK rotate 现成                      | 引入复杂度（RS256 / EdDSA 等不必要）；本场景不需要互操作      |      |
| C. 单 key 滚动重启                | 实现最简                                            | rotate 那一刻所有未过期 cart 行/token 立即失效 → 用户层面雪崩 |      |

### 4.2 Q2 旧 cart 行迁移：切流清空 vs 兼容期 vs 在线签名

| 选项                                                  | 优                                 | 劣                                                          | 选择 |
| ----------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------- | ---- |
| **A. 切流清空旧 cart**                                | 上线即统一语义；后续验证逻辑无分支 | 用户购物车被清空一次；运营公告 + UI 提示即可                | ✅   |
| B. 兼容期：明文 key 在 verify 失败时降级当作 "无活动" | 用户无感                           | server-side 有"无 token 也算合法"的分支，引入永久弱化       |      |
| C. 在线为旧 cart 行批量签名补刷                       | 用户无感                           | 不知 issuer 上下文（场景、模块），补刷的 token 元数据是假的 |      |

### 4.3 Q3 Token 编码：base64url 自实现 vs Protobuf vs CBOR

| 选项                  | 优                 | 劣                         | 选择 |
| --------------------- | ------------------ | -------------------------- | ---- |
| **A. JSON base64url** | 简单可读；调试友好 | 比二进制大 ~30%            | ✅   |
| B. Protobuf           | 紧凑               | 引入 .proto / runtime 依赖 |      |
| C. CBOR               | 紧凑 + 标准化      | 不如 JSON 直观；生态弱     |      |

### 4.4 Q4 Token TTL：24h vs 7d vs 永不过期

| 选项                     | 优                     | 劣                                           | 选择 |
| ------------------------ | ---------------------- | -------------------------------------------- | ---- |
| **A. 24h**               | 过期窗口短，重放成本高 | 用户跨日购物车需重进商品页刷新（容忍范围）   | ✅   |
| B. 7d                    | 用户体验更顺           | 重放窗口长；与 cart 行业务自然清理周期不一致 |      |
| C. 不过期 + jti 拒绝列表 | 用户极顺               | jti 黑名单运营成本高；攻击者可永久缓存       |      |

---

## 5. 迁移与回滚

### 5.1 部署顺序

1. **D1**：合入 `ActivityContextTokenService` + 工具函数 + 单测；不替换业务调用点。
2. **D2**：在 staging 设置 `MARKETING_ACTIVITY_TOKEN_SECRET_PRIMARY` = 32+ 字符随机串，验证 issue / verify 单测。
3. **D3**：替换所有 issuer 端调用（zone / resolution / simulator / primary-offer-resolver）；此时旧 cart 行的明文 key verify 会失败 → cart addToCart 路径开始拒绝旧 key 加购的新增。
4. **D4**：替换所有 verifier 端调用（cart / checkout / validateAndLock）。
5. **D5**：执行 §5.3 的 cart 清空脚本，上线后 24h 内观察 cart addToCart 错误率。

### 5.2 回滚

- D3 / D4 出问题：`git revert` 整体 PR，恢复 `ActivityContextKeyService`。
- §5.3 的 cart 清空**不可回滚**——用户加车需要重做。所以 D5 必须在 D4 稳定 ≥4h 后执行。

### 5.3 切流清空 cart

```sql
-- 部署窗口期执行；先 staging 后 prod
-- 清空所有带活动上下文的购物车行（保留无活动的标品加购）
DELETE FROM oms_cart_item
WHERE activity_context_key IS NOT NULL
  AND activity_context_key != ''
  AND create_time < '<deploy-cutoff-time>';

-- 同步 Redis cache（按租户）
-- 在 admin-web 出公告："系统升级，请重新选择活动加购"
```

**为什么不留兼容期**：兼容期意味着 `verify` 必须容忍 "no token" → "fallback to plain string parse" 路径，这条路径在线后会变成永久代码债，违反 [[feedback_no_compensating_complexity]]。

---

## 6. 验证矩阵

| 层       | 用例                                                                                                                                | 工具                                     |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 静态     | `grep -r 'keyService.build\|keyService.parse\|keyService.validate' apps/backend/src` 返回 0；`ActivityContextKeyService` class 已删 | `rg`                                     |
| Spec     | issue token → verify 通过；payload 各字段无篡改                                                                                     | `activity-context-token.service.spec.ts` |
| Spec     | 篡改 payload base64url 任 1 char → verify 抛 PARAM_INVALID                                                                          | 同上                                     |
| Spec     | exp 已过 → verify 抛"活动上下文已过期"                                                                                              | 同上                                     |
| Spec     | tenantId / memberId 不匹配 → verify 抛对应错                                                                                        | 同上                                     |
| Spec     | kid=2 token 在 SECONDARY 配置时 verify 通过；SECONDARY 缺失时抛 SYSTEM_ERROR                                                        | 同上                                     |
| Spec     | timing attack 防护：篡改最后 1 byte vs 篡改第 1 byte 的耗时差 < 1ms                                                                 | benchmark 测试（可选）                   |
| 集成     | C 端：客户端 base64 篡改 token 后 addToCart → 400；checkout submit 同链路也 400                                                     | e2e 或 supertest                         |
| 集成     | 双 key 轮换：先以 key-A issue，rotate 后改为 key-B + key-A，旧 token 仍可用；再次 rotate 清空 SECONDARY，旧 token 才失效            | 集成测试                                 |
| 数据迁移 | 部署后 `SELECT COUNT(*) FROM oms_cart_item WHERE activity_context_key IS NOT NULL AND length(activity_context_key) < 50` 为 0       | DBA 查询                                 |
| 监控     | `cart_add_token_invalid_count` metric 每 5min 上报；正常应 ≈ 0                                                                      | Prometheus / 日志                        |

---

## 7. 风险与未决问题

### 7.1 留给实施者的 TODO

1. **TODO-1**：环境变量 `MARKETING_ACTIVITY_TOKEN_SECRET_PRIMARY` 注入到哪个秘钥库？仓库当前没有 secret-manager 接入，临时可走 `.env`，但要在 ops 文档（不在本 PR）登记轮换 SOP。
2. **TODO-2**：admin-web simulator 是 admin 内部工具，issue token 时 `memberId=null`，但 simulator 同时模拟"以某 member 视角执行"——这种情况要不要让 admin 显式选 memberId 并 issue 具名 token？建议：simulator 维持 `memberId=null`，校验 `validateAndLock` 时跳过 member 严格匹配（admin 特权路径）。**实施期与产品确认**。
3. **TODO-3**：`activity-context-token.service.ts` 注入到 `ResolutionModule` 还是单独 `MarketingSecurityModule`？建议放 resolution 内（与 keyService 同位置 → 重命名替换），不增加模块树深度。
4. **TODO-4**：admin "活动详情页"是否有"直接以某 activityContextKey 链接打开 C 端"功能？如果有，admin 那一侧也需要 issue token。Grep `activityContextKey` in admin-web 确认。

### 7.2 已知风险

| 风险                                                | 等级 | 缓解                                                                                     |
| --------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| 密钥泄露（git 误提交 / 日志输出）                   | 高   | `.env` 已在 gitignore；`pre-write-guard` hook 应增加对环境变量名的明文检测（不本 PR 做） |
| 24h TTL 导致用户跨日 cart 失效                      | 中   | UI 检测 verify 失败 → 引导用户点商品卡片重新发 token                                     |
| `kid` 仅 2 个版本，将来 3 轮 rotate 需要扩展        | 低   | `Kid = '1' \| '2'` 扩为 `'1' \| '2' \| '3'`；payload format 不变                         |
| HMAC 截断 128bit 不够强                             | 低   | NIST SP 800-107: HMAC-SHA256 截断 128bit 仍提供 128bit 安全；OK                          |
| Token 落入 omsCartItem 字符串列后日志泄露           | 中   | 日志层禁止打印 `activityContextKey`（grep 当前日志输出确认）                             |
| Simulator memberId=null token 被复制粘贴到 C 端使用 | 低   | C 端 verify 路径强制 memberId 匹配，null token 必然拒绝                                  |

### 7.3 不在本设计范围

- 服务间 mTLS / 服务身份签名：不需要。
- ASR 接入（攻击审计）：等 P2 阶段集中规划日志架构。
- Token 黑名单 / 主动撤销：不实现；TTL=24h 是默认撤销机制。

---

## 8. 实施清单

### 8.1 backend

- [ ] `apps/backend/src/module/marketing/resolution/services/activity-context-token.service.ts`：新增。
- [ ] `apps/backend/src/module/marketing/resolution/services/token-codec.util.ts`：`base64url` / `base64urlDecode`。
- [ ] `apps/backend/src/module/marketing/resolution/resolution.module.ts`：providers / exports 增加 `ActivityContextTokenService`，移除 `ActivityContextKeyService`。
- [ ] **删除** `apps/backend/src/module/marketing/resolution/services/activity-context-key.service.ts`（含 spec）。
- [ ] 替换 issuer：`client-zone.service.ts:129` / `resolution.service.ts:106,152` / `simulator.service.ts:108` / `primary-offer-resolver.service.ts:182,193`。
- [ ] 替换 verifier：
  - `resolution.service.ts:170-204` `validateAndLock` 内 `keyService.validate + parse` → `tokenService.verify`
  - `batch-validation.service.ts`：DTO 上 `activityType / activityConfigId` 移除，从 verify 结果回填
  - `order-checkout.service.ts:157-167`：从客户端 item 字段取 7 个 attribution 改为从 `verified.*` 取；**删除 SECURITY-NOTE 块注释**
  - `cart.service.ts:34-99 / 188-199`：addToCart / updateCartQuantity 内增加 `tokenService.verify`，失败拒绝
- [ ] `apps/backend/src/module/client/cart/dto/cart.dto.ts`：移除 `activityType / activityConfigId` 等冗余客户端字段（保留 `activityContextKey`）。
- [ ] `apps/backend/src/module/client/order/dto/order.dto.ts`：同上。
- [ ] env：在 `apps/backend/.env.example` 增加 `MARKETING_ACTIVITY_TOKEN_SECRET_PRIMARY=` 占位。

### 8.2 契约同步

- [ ] `pnpm build:backend`（必要时）
- [ ] `pnpm generate-types`：DTO 字段减少 → 前端类型同步
- [ ] admin-web：检查 `activityContextKey` 调用点的 issuer/verifier 链路（TODO-4），按需补 issue
- [ ] miniapp-client：cart / checkout DTO 字段移除后，前端不能再传 `activityType` 等冗余字段（一旦传也无害，只是会被忽略）

### 8.3 验证

- [ ] `pnpm typecheck:backend`
- [ ] `pnpm lint:backend`
- [ ] `pnpm test:backend -- activity-context-token`
- [ ] `pnpm test:backend -- resolution.service`
- [ ] `pnpm test:backend -- order-checkout`
- [ ] `pnpm test:backend -- cart.service`
- [ ] `pnpm check:slice`
- [ ] `pnpm generate-types && pnpm typecheck:admin && pnpm typecheck:h5`
- [ ] PR 前：`pnpm verify-monorepo; pnpm verify:scripts; pnpm lint; pnpm typecheck; pnpm test`

### 8.4 PR 标题

`security(backend): activityContextKey 改为 HMAC-SHA256 签名 token`
