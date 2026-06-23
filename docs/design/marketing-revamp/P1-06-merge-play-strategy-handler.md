# P1-06 合并 PlayStrategy 与 ActivityHandler 为统一 play_definition

**owner**: 待指派 / 后端
**status**: draft（待评审 → 待实施）
**last_verified**: 2026-05-15
**related**: [[P1-05-merge-activity-campaign]]、[[P1-08-clean-fake-events]]、[[P1-09-split-course-group-service]]

---

> **跨文档硬约束**：本设计涉及金额字段（`IPlayHandler.resolvePrice` 返回值、`applyRewards` 内的金额运算）全链路遵循 [[P0-00-money-precision]]，返回 `Decimal | null`。幂等键格式遵循 [[P2-14-idempotency-key-convention]]。

## 1. 目标与范围

### 1.1 目标

把当前两套并行的"玩法执行体系"——**PlayStrategy + IMarketingStrategy**（COURSE_GROUP_BUY / FLASH_SALE / MEMBER_UPGRADE，由 `PlayStrategyFactory` 通过 DiscoveryService 自动扫描装饰器注册）和 **IActivityHandler**（NEWCOMER_EXCLUSIVE / DISTRIBUTION_GROWTH，由 `handler.registry` 收集）——合并为单一执行体系，落到 **`play_definition`** 单表 + 单一 `IPlayHandler` 接口 + 单一 dispatch 入口。消除以下问题：

- **两套接口职责重叠**：`IMarketingStrategy.validateJoin / calculatePrice / onPaymentSuccess / onStatusChange / getDisplayData` 与 `IActivityHandler.checkEligibility / grantRewards / getPrice / validateConfig` 各自部分覆盖；都有 `validateConfig`、都有"价格覆盖"、都有"准入"，但参数类型不同、调用点不同。
- **元数据散在两处**：PlayStrategy 走 `PLAY_REGISTRY` 硬编码（`play.registry.ts` 100-154）+ Reflect.metadata；ActivityHandler 走 `@ActivityHandler` 装饰器收集。
- **fail-silent**：`PlayStrategyFactory.onModuleInit` 只 `logger.log('注册成功')`，没注册的玩法在调用时才报 `BusinessException('未找到玩法策略')`；启动阶段无 fail-fast 校验。
- **元数据"运营可写"假象**：`PLAY_REGISTRY` 是 const 字典，注释里写"新增玩法不改核心代码"，但实际每次新增/调整 hasInstance/canFail 等元数据都必须改这个 const，本质是"仅开发可改"。当前文档说一套、代码做一套，混淆了"声明式 type"（P1-05 的 POLICY，运营可配）与"代码玩法"（必须开发）。

### 1.2 范围

- ✅ 新建 `play_definition` 表，承载所有玩法的元数据（code / name / hasInstance / hasState / canFail / canParallel / defaultStockMode / handlerClassName）。
- ✅ 新建 `IPlayHandler` 接口（合并 IMarketingStrategy + IActivityHandler 的方法集），入参类型按 [[P1-05]] 改为 `MktCampaign` + `PlayInstance?`。
- ✅ 启动阶段 fail-fast：`PlayDispatcher.onModuleInit` 校验"`play_definition` 表中所有 active 行的 `handlerClassName` 都能在 IoC 容器内找到对应 provider"；任一缺失 → 抛错阻止 boot。
- ✅ 删除 `PlayStrategyFactory` / `@PlayStrategy` 装饰器 / `play.registry.ts`；删除 `handler.registry` / `@ActivityHandler` 装饰器。
- ✅ POLICY 类活动（[[P1-05]] 的 5 种 type）通过 `PolicyEvaluatorAdapter` 注册为 `play_definition.code='POLICY_EVAL'` 的特殊 handler，dispatch 时按 `campaign.kind=POLICY` 优先使用。
- ✅ `play_definition` 写入仅通过 Prisma migration / seed，**不暴露 admin API**（决策见 §4 Q2）。
- ❌ 不动 PlayInstance 状态机（lifecycle 由 [[P1-09]] 处理）。
- ❌ 不动 PolicyEvaluatorService 内部实现（[[P1-05]] 已定义）。

### 1.3 DoD

1. `play_definition` 表上线；初始 seed 包含 6 行：`COURSE_GROUP_BUY` / `FLASH_SALE` / `MEMBER_UPGRADE` / `NEWCOMER_EXCLUSIVE` / `DISTRIBUTION_GROWTH` / `POLICY_EVAL`。
2. 所有 handler 实现 `IPlayHandler`；boot 时 `PlayDispatcher` 一次性校验 6 个 `handlerClassName` 全部解析成功，缺一抛错。
3. `PlayStrategyFactory` / `@PlayStrategy` / `play.registry.ts` / `IActivityHandler` / `@ActivityHandler` / `handler.registry` 全部删除。
4. `instance.service` / `resolution.service` / `course-group.service` 等下游调用方统一改为 `PlayDispatcher.resolve(campaign).XXX()`。
5. `play_definition` 表上**无 admin API**（仅 Prisma seed 维护）；admin-web 列表页若需要展示，调用 readonly endpoint。

---

## 2. 现状取证

### 2.1 PlayStrategy 体系（3 个 play）

- 装饰器 `@PlayStrategy(code)`：`play-strategy.decorator.ts:68`。装饰时校验 `PLAY_REGISTRY[code]` 存在，否则在**类定义时**抛错（这是当前唯一的 fail-fast 点）。
- 注册扫描 `PlayStrategyFactory.onModuleInit`：`play.factory.ts:31-45`，通过 `DiscoveryService.getProviders()` + `Reflect.getMetadata(PLAY_CODE_METADATA_KEY)` 自动收集。
- 静态元数据 `PLAY_REGISTRY`：`play.registry.ts:100`，3 个 const 入口；`hasInstance / hasState / canFail / canParallel / ruleSchema / defaultStockMode / description` 字段固定。

### 2.2 ActivityHandler 体系（2 个 handler）

- 装饰器与注册：`activity/handlers/handler.registry.ts` + `activity-handler.interface.ts`。
- 实现：`newcomer.handler.ts` / `distribution-growth.handler.ts`。
- 调用方：`activity.service` / `activity-center.service` / `scene.service` 等。

### 2.3 dispatch 调用点（高频）

```ts
// instance.service.ts
const strategy = this.playStrategyFactory.getStrategy(config.templateCode);
await strategy.validateJoin(config, memberId, params);
await strategy.onPaymentSuccess(instance);

// resolution.service.ts / scene.service.ts（[[P1-05]] 已改读 MktCampaign）
const handler = this.handlerRegistry.resolve(activity.type);
await handler.checkEligibility(activity, memberId);
```

### 2.4 接口字段重合

| 概念          | IMarketingStrategy | IActivityHandler |
| ------------- | ------------------ | ---------------- |
| 准入          | validateJoin       | checkEligibility |
| 价格          | calculatePrice     | getPrice         |
| 配置校验      | validateConfig     | validateConfig   |
| 奖励发放      | onPaymentSuccess   | grantRewards     |
| 状态变更      | onStatusChange     | —                |
| 前端展示      | getDisplayData     | —                |
| readonly code | ✓                  | type             |

两套接口的方法名不同但语义对齐 4/6。

### 2.5 fail-silent 风险

```ts
// play.factory.ts:60-66
getStrategy(code: string): IMarketingStrategy {
  const strategy = this.strategies.get(code);
  if (!strategy) {
    throw new BusinessException(ResponseCode.BUSINESS_ERROR, `未找到玩法策略: ${code}`);
  }
  return strategy;
}
```

未注册的玩法只在被调用时才抛错。生产环境部署一个忘了带 @PlayStrategy 装饰器的 service，启动正常，运营创建对应活动 → 用户下单 → 当时才报 500。

---

## 3. 设计方案

### 3.1 Schema

```prisma
// apps/backend/prisma/models/80-marketing.prisma 追加

model PlayDefinition {
  id                String   @id @default(cuid())
  /// 唯一玩法代码，对应 mkt_campaign.type 或特殊值 'POLICY_EVAL'
  code              String   @unique @db.VarChar(50)
  name              String   @db.VarChar(80)

  /// 行为元数据（从 PlayMetadata 迁过来）
  hasInstance       Boolean  @default(false) @map("has_instance")
  hasState          Boolean  @default(false) @map("has_state")
  canFail           Boolean  @default(false) @map("can_fail")
  canParallel       Boolean  @default(true)  @map("can_parallel")
  defaultStockMode  String   @default("LAZY_CHECK") @map("default_stock_mode") @db.VarChar(20)

  /// IoC 容器中的 provider 类名（用于 dispatcher 解析）；不允许从 admin 修改
  handlerClassName  String   @map("handler_class_name") @db.VarChar(120)

  description       String?  @db.VarChar(500)
  isActive          Boolean  @default(true) @map("is_active")

  createTime        DateTime @default(now()) @map("create_time")
  updateTime        DateTime @updatedAt @map("update_time")

  @@map("play_definition")
}
```

**保留** `mkt_play_template` 表（前端 zone / scene 模板）作为运营可见的"模板列表"，与 `play_definition` 解耦：`play_definition.code` 是运行时身份，`mkt_play_template.code` 是 admin 列表展示。两表通过 code 自然关联，但 schema 上不加 FK（避免 admin 改模板时拖运行时）。

### 3.2 统一接口 `IPlayHandler`

```ts
// apps/backend/src/module/marketing/play/play-handler.interface.ts

export interface PlayContext {
  campaign: MktCampaign; // [[P1-05]] 引入
  memberId: string;
  skuId?: string;
  instance?: PlayInstance; // 仅 hasInstance=true 时存在
  params?: Record<string, unknown>;
}

export interface PlayHandlerResult {
  eligible: boolean;
  price?: Decimal;
  displayData?: Record<string, unknown>;
  rewards?: PlayHandlerReward[];
  reason?: string;
}

export interface IPlayHandler {
  /** play_definition.code；启动校验时核对 */
  readonly code: string;

  /** 合并 validateJoin + checkEligibility */
  checkEligibility(ctx: PlayContext): Promise<boolean>;

  /** 合并 calculatePrice + getPrice */
  resolvePrice(ctx: PlayContext): Promise<Decimal | null>;

  /** 合并 onPaymentSuccess + grantRewards */
  applyRewards(ctx: PlayContext): Promise<void>;

  /** 仅 hasState=true 的 play 实现 */
  onStatusChange?(instance: PlayInstance, oldStatus: string, newStatus: string): Promise<void>;

  /** 配置校验 */
  validateConfig(campaign: MktCampaign): Promise<void>;

  /** 可选：前端展示数据 */
  getDisplayData?(ctx: PlayContext): Promise<Record<string, unknown>>;
}
```

### 3.3 `PlayDispatcher`

```ts
// apps/backend/src/module/marketing/play/play.dispatcher.ts

@Injectable()
export class PlayDispatcher implements OnModuleInit {
  private readonly handlers = new Map<string, IPlayHandler>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
    private readonly discovery: DiscoveryService,
  ) {}

  /**
   * 启动校验：3 次 retry + DB-unreachable / config-mismatch 区分
   * - DB 抖动 / prisma 慢启动 → retry，不 fail boot
   * - DB 可达但 play_definition 与 IoC handler 对不上 → fail boot（真实配置错）
   */
  async onModuleInit(): Promise<void> {
    let definitions: PlayDefinition[] | null = null;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        definitions = await this.prisma.playDefinition.findMany({ where: { isActive: true } });
        break;
      } catch (err) {
        lastErr = err;
        this.logger.warn(`[PlayDispatcher] DB unreachable on boot (attempt ${attempt}/3): ${getErrorMessage(err)}`);
        await sleep(5_000); // 固定 5s 间隔；总等 ≤15s
      }
    }
    if (!definitions) {
      throw new Error(
        `[PlayDispatcher] DB_UNREACHABLE: 3 次重试后仍读不到 play_definition；这是基础设施故障，不是配置问题。${getErrorMessage(lastErr)}`,
      );
    }

    const ioCInstances = new Map<string, IPlayHandler>();
    for (const wrapper of this.discovery.getProviders()) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;
      // 必须 implements IPlayHandler 并显式 readonly code
      if (
        typeof (instance as IPlayHandler).code === 'string' &&
        typeof (instance as IPlayHandler).checkEligibility === 'function'
      ) {
        ioCInstances.set(metatype.name, instance as IPlayHandler);
      }
    }

    const missing: string[] = [];
    for (const def of definitions) {
      const handler = ioCInstances.get(def.handlerClassName);
      if (!handler) {
        missing.push(`${def.code}(${def.handlerClassName})`);
        continue;
      }
      if (handler.code !== def.code && def.code !== 'POLICY_EVAL') {
        // POLICY_EVAL 是特殊 sentinel，由 PolicyEvaluatorAdapter 提供
        missing.push(`${def.code} class.code mismatch (handler.code=${handler.code})`);
        continue;
      }
      this.handlers.set(def.code, handler);
    }

    if (missing.length > 0) {
      throw new Error(
        `[PlayDispatcher] CONFIG_MISMATCH: play_definition 与 IoC provider 对不上：${missing.join(', ')}。` +
          `这是配置错误，需要更新 seed 或代码。`,
      );
    }
  }

  resolve(campaign: MktCampaign): IPlayHandler {
    // POLICY kind 优先走 PolicyEvaluatorAdapter（[[P1-05]]）
    if (campaign.kind === 'POLICY') {
      const adapter = this.handlers.get('POLICY_EVAL');
      if (!adapter) throw new Error('POLICY_EVAL handler missing');
      return adapter;
    }
    const handler = this.handlers.get(campaign.type);
    if (!handler) {
      throw new BusinessException(`No play handler for code=${campaign.type}`);
    }
    return handler;
  }
}
```

### 3.4 删除清单

| 文件                                                                                       | 处置                                            |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `play/play-strategy.decorator.ts`                                                          | 删除                                            |
| `play/play.registry.ts`                                                                    | 删除（内容迁入 seed）                           |
| `play/play.factory.ts` (`PlayStrategyFactory`)                                             | 删除，调用方改 `PlayDispatcher.resolve`         |
| `play/strategy.interface.ts` (`IMarketingStrategy`)                                        | 删除，所有 implements 改 `IPlayHandler`         |
| `activity/handlers/activity-handler.interface.ts` (`IActivityHandler`)                     | 删除                                            |
| `activity/handlers/handler.registry.ts`                                                    | 删除                                            |
| `activity/handlers/newcomer.handler.ts`                                                    | 改 implements `IPlayHandler`                    |
| `activity/handlers/distribution-growth.handler.ts`                                         | 改 implements `IPlayHandler`                    |
| `play/course-group-buy.service.ts` / `flash-sale.service.ts` / `member-upgrade.service.ts` | 改 implements `IPlayHandler`，方法名迁移见 §3.5 |

### 3.5 方法名映射（一次性替换）

| IMarketingStrategy           | IPlayHandler                        |
| ---------------------------- | ----------------------------------- |
| `validateJoin(config, m, p)` | `checkEligibility(ctx)`             |
| `calculatePrice(config, p)`  | `resolvePrice(ctx)`                 |
| `onPaymentSuccess(instance)` | `applyRewards(ctx)`（ctx.instance） |
| `onStatusChange(...)`        | `onStatusChange(...)`               |
| `getDisplayData(config)`     | `getDisplayData(ctx)`               |
| `validateConfig?(dto)`       | `validateConfig(campaign)`          |

| IActivityHandler           | IPlayHandler               |
| -------------------------- | -------------------------- |
| `checkEligibility(a, m)`   | `checkEligibility(ctx)`    |
| `getPrice?(a, sku, m)`     | `resolvePrice(ctx)`        |
| `grantRewards(a, m)`       | `applyRewards(ctx)`        |
| `validateConfig(t, r, rw)` | `validateConfig(campaign)` |

### 3.6 Seed

`apps/backend/prisma/seeds/play-definition.seed.ts`（建议路径）：

```ts
const PLAY_DEFINITIONS = [
  {
    code: 'COURSE_GROUP_BUY',
    handlerClassName: 'CourseGroupBuyService',
    hasInstance: true,
    hasState: true,
    canFail: true,
    canParallel: true,
    defaultStockMode: 'LAZY_CHECK',
  },
  {
    code: 'FLASH_SALE',
    handlerClassName: 'FlashSaleService',
    hasInstance: true,
    hasState: true,
    canFail: false,
    canParallel: false,
    defaultStockMode: 'STRONG_LOCK',
  },
  {
    code: 'MEMBER_UPGRADE',
    handlerClassName: 'MemberUpgradeService',
    hasInstance: true,
    hasState: true,
    canFail: false,
    canParallel: false,
    defaultStockMode: 'LAZY_CHECK',
  },
  {
    code: 'NEWCOMER_EXCLUSIVE',
    handlerClassName: 'NewcomerHandler',
    hasInstance: false,
    canFail: false,
    canParallel: false,
    defaultStockMode: 'LAZY_CHECK',
  },
  {
    code: 'DISTRIBUTION_GROWTH',
    handlerClassName: 'DistributionGrowthHandler',
    hasInstance: false,
    canFail: false,
    canParallel: true,
    defaultStockMode: 'LAZY_CHECK',
  },
  {
    code: 'POLICY_EVAL',
    handlerClassName: 'PolicyEvaluatorAdapter',
    hasInstance: false,
    canFail: false,
    canParallel: true,
    defaultStockMode: 'LAZY_CHECK',
  },
];
```

---

## 4. 决策依据

### 4.1 Q1 单表 vs 文件常量

| 选项                                 | 优                                          | 劣                                              | 选择 |
| ------------------------------------ | ------------------------------------------- | ----------------------------------------------- | ---- |
| **A. play_definition 表 + 启动校验** | dispatcher 在 boot 时一致性可验证；运营可读 | seed 必须维护                                   | ✅   |
| B. 继续用 const 字典                 | 0 schema 变更                               | 启动校验只能匹配代码内字段，不能跨 service 校验 |      |
| C. 配置文件（YAML）                  | 易读                                        | 与 Prisma 的运行时校验脱节                      |      |

### 4.2 Q2 admin 是否可改 play_definition

| 选项                                       | 优                                                   | 劣                         | 选择 |
| ------------------------------------------ | ---------------------------------------------------- | -------------------------- | ---- |
| **A. 仅开发可改（seed）**                  | handlerClassName 必须对应代码，运营改了等于线上 boom | 运营要等 PR                | ✅   |
| B. admin 可改部分字段（name、description） | 文案运营自助                                         | 易误改 handlerClassName    |      |
| C. admin 完全可改                          | 灵活                                                 | 第一次改错就 dispatch 失败 | ❌   |

### 4.3 Q3 fail-fast vs fail-silent

| 选项                    | 优                                         | 劣                                   | 选择 |
| ----------------------- | ------------------------------------------ | ------------------------------------ | ---- |
| **A. boot 抛错**        | 早暴露；CI 能跑通的代码上线一定能 dispatch | 误删 handler 后整个 backend 不可启动 | ✅   |
| B. boot 警告 + 调用时抛 | 当前行为                                   | 错误在生产用户面前暴露               |      |

### 4.4 Q4 接口合并范围

| 选项                                        | 优                             | 劣                       | 选择 |
| ------------------------------------------- | ------------------------------ | ------------------------ | ---- |
| **A. 6 方法接口（含 optional）**            | 一套接口覆盖所有 dispatch 场景 | 部分 handler 实现空函数  | ✅   |
| B. 双接口共存（IPlayCore + IPlayLifecycle） | 关注点分离                     | dispatcher 要分别 lookup |      |

---

## 5. 迁移与回滚

### 5.1 部署顺序

1. **D1**：schema 增加 `play_definition` + seed；不改业务代码。
2. **D2**：引入 `IPlayHandler` 接口 + `PlayDispatcher` provider；旧 factory 与 registry 并存，dispatcher boot 校验通过即可。
3. **D3**：handler 改写 implements `IPlayHandler`；旧接口删除。一刀切，无 feature flag。
4. **D4**：调用方批量替换 `playStrategyFactory.getStrategy` / `handlerRegistry.resolve` → `playDispatcher.resolve`。
5. **D5**：删除 `play.factory.ts` / `play.registry.ts` / `play-strategy.decorator.ts` / `handler.registry.ts`。

### 5.2 回滚

D2-D4 任一步 git revert 即可；D5 真删之后回滚成本上升。

---

## 6. 验证矩阵

| 层   | 用例                                                                                                    | 工具      |
| ---- | ------------------------------------------------------------------------------------------------------- | --------- |
| 静态 | `grep -r "PlayStrategyFactory\|@PlayStrategy\|IMarketingStrategy\|IActivityHandler" apps/backend/src` 0 | `rg`      |
| 启动 | 删一行 seed `play_definition` 后 boot：抛 `[PlayDispatcher] fail-fast: ...`                             | 集成测试  |
| 启动 | handler service 改类名后 boot：同样抛错                                                                 | 集成测试  |
| Spec | dispatcher.resolve(campaign with kind=POLICY) → PolicyEvaluatorAdapter                                  | unit test |
| Spec | dispatcher.resolve(campaign type=FLASH_SALE) → FlashSaleService 实例                                    | unit test |
| 集成 | 创建 NEWCOMER_EXCLUSIVE campaign → resolve → checkEligibility → applyRewards                            | supertest |
| 集成 | 创建 COURSE_GROUP_BUY campaign + PlayInstance → onStatusChange 触发                                     | supertest |

---

## 7. 风险与未决

### 7.1 TODO

1. **TODO-1**：`handlerClassName` 用 class.name 还是 string token？class.name 在生产构建中可能被 minifier 改名。建议 backend `nest build` 实测后决定；若被 minify，则改为 NestJS `@Injectable({ scope, name })` 显式 token。
2. **TODO-2**：boot 校验阶段还没有 tenantContext，`play_definition` 不分租户（全局表）；若将来不同租户启用不同 play set，需要扩展 `play_definition.tenantId` 字段。本设计不预留。
3. **TODO-3**：`PolicyEvaluatorAdapter` 的 `code` 字段值（`POLICY_EVAL`）是否进入 type 命名空间冲突？grep 确认无 `'POLICY_EVAL'` 字符串已存在。

### 7.2 风险

| 风险                                                      | 等级 | 缓解                                                      |
| --------------------------------------------------------- | ---- | --------------------------------------------------------- |
| Minifier rename class.name 导致 boot 失败                 | 中   | TODO-1 落定后修正                                         |
| seed 与代码同时改，PR review 漏 seed                      | 中   | CI 加 `pnpm test:backend -- play-dispatcher.boot.spec.ts` |
| handler 之间循环依赖加深（dispatcher 注入 PrismaService） | 低   | forwardRef 已在 marketing.module 里准备好                 |

---

## 8. 实施清单

### 8.1 backend

- [ ] Prisma：新增 `PlayDefinition` 模型 + migration + seed。
- [ ] `play/play-handler.interface.ts`：新增。
- [ ] `play/play.dispatcher.ts`：新增。
- [ ] handler 改写：CourseGroupBuy / FlashSale / MemberUpgrade / Newcomer / DistributionGrowth / PolicyEvaluatorAdapter。
- [ ] 调用方替换：`instance.service` / `resolution.service` / `course-group.service` / `activity-center.service` 等。
- [ ] 删旧接口/装饰器/factory/registry。

### 8.2 验证

- [ ] `pnpm typecheck:backend && pnpm lint:backend`
- [ ] `pnpm test:backend -- play-dispatcher`
- [ ] `pnpm check:slice`
- [ ] PR 前：`pnpm verify-monorepo; pnpm verify:scripts; pnpm lint; pnpm typecheck; pnpm test`

### 8.3 PR 标题

`refactor(backend): 合并 PlayStrategy 与 ActivityHandler 为 play_definition + 单接口 + boot fail-fast`
