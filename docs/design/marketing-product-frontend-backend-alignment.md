# 小程序营销商品前后端对齐设计

## 1. 背景

当前小程序商品、营销、订单、佣金四条链路处于半闭合状态：

- 商品详情已支持聚合多个活动，但首页与聚合列表尚未形成统一裁决逻辑。
- 前端仍存在“只取第一个活动”的展示方式，活动类型命名也存在不一致。
- 订单主链路主要依赖整单级 `marketingConfigId`，无法支撑一个订单内多条商品命中不同活动。
- 拼团、拼课、秒杀等玩法已具备实例状态机，但尚未与订单项、退款、佣金形成逐项闭环。
- 普通商品分销、商品级分佣覆盖、租户默认分销、会员等级分佣已经存在多层规则，营销活动如果继续沿用“默认继承商品分佣”，会直接引发亏损和对账混乱。

本设计的目标不是局部修补，而是重建一套可解释、可追踪、可扩展的营销商品体系。

## 2. 目标

### 2.1 业务目标

- 同一个商品允许挂多个候选活动。
- 营销专区允许同商品重复出现。
- 营销聚合页必须按商品去重，一个商品只能出现一次。
- 聚合页、详情页、结算页、订单页、佣金页必须围绕同一条活动上下文工作。
- 秒杀、拼团、拼课、新人价、会员价等商品级活动共同进入竞争池。
- 优惠券、满减、积分默认不抢商品主活动位，归属订单层优惠。

### 2.2 交易目标

- 用户从列表看到什么活动，详情页就锁定什么活动。
- 结算与下单只能校验当前活动，不允许静默切换为其他活动继续成交。
- 历史订单永远看成交快照，不回看现状。

### 2.3 结算目标

- 活动佣金只支持 `禁佣` / `固定比例`。
- 活动未配置佣金时，默认 `禁佣`。
- 活动命中后，不默认回退商品分佣。
- 活动固定比例按订单项最终分摊实付金额计算总佣金池，再按 L1/L2 结构拆分。

## 3. 核心原则

### 3.1 展示按商品聚合，成交按订单项精算

- 页面展示可以按商品聚合。
- 结算、退款、佣金、统计必须按订单项逐条计算。

### 3.2 活动上下文一旦进入详情和结算，就不能偷偷切换

- 列表页负责选活动。
- 详情页负责锁活动。
- 结算页负责校验活动。
- 订单页负责保存活动快照。

### 3.3 历史订单永远使用快照

- 商品名称、活动名称、活动价格、活动佣金、入口来源、资格状态、门店状态都必须在下单时冻结。
- 后续配置变更不影响历史订单解释。

## 4. 领域对象

完整版本至少要明确以下对象：

- 商品：基础销售对象。
- SKU：具体规格、库存、价格落点。
- 候选活动：商品或 SKU 的一个营销身份。
- 主活动：某个页面、某个用户、某个门店下最终选出的展示活动。
- 活动上下文：详情、购物车、结算、下单过程中锁定的活动视角。
- 玩法实例：拼团、拼课等结果型活动的生命周期载体。
- 订单项：真实成交、退款、佣金的计算中心。
- 佣金池：活动订单项最终可分配的总佣金额。

## 5. 活动分层

### 5.1 商品级活动层

进入主活动竞争池：

- 秒杀
- 拼团
- 拼课
- 新人价
- 会员价

### 5.2 订单级优惠层

不抢主活动位：

- 优惠券
- 满减
- 积分抵扣

### 5.3 佣金层

不直接决定页面主展示：

- 普通商品分佣
- 活动禁佣
- 活动固定比例佣金

## 6. 活动裁决规则

### 6.1 候选活动

同一商品允许同时挂多个候选活动。

### 6.2 有效候选活动

一个活动要进入当前可选池，至少同时满足：

- 商品上架
- 门店商品上架
- 参与活动的 SKU 可售
- 活动启用
- 活动在有效时间内
- 活动库存或名额有效
- 当前用户资格满足

### 6.3 聚合主活动选择

- 先按商品聚合。
- 再取当前商品的有效候选活动池。
- 按后台可配置优先级从高到低选主活动。
- 优先级是固定规则，但最终结果仍需要经过当前用户资格过滤。
- 主活动失效后，自动切换到下一个有效候选活动；若不存在有效候选活动，则从聚合页隐藏。

## 7. 页面规划

### 7.1 小程序页面

#### 首页

- 自然商品区：普通商品逻辑。
- 营销商品区：本质上是营销聚合页前 N 个商品。

#### 营销聚合页

- 同商品只出现一次。
- 返回主活动卡片。
- 卡片至少包含：主标签、主价格、状态、倒计时或名额摘要。

#### 营销专区页

- 按活动类型区分专区。
- 同商品可在不同专区重复出现。
- 同一专区内同商品只出现一次。

#### 商品详情页

- 接收并锁定活动上下文。
- 不提供商品级活动切换器。
- 如果入口活动失效，明确提示，不自动切换到别的活动继续成交。

#### 购物车页

- 同 SKU 不同活动上下文必须拆成不同购物车行。
- 每行需要显示活动标签。

#### 结算页

- 逐项展示原价、活动价、分摊优惠、最终实付。
- 逐项校验活动、资格、库存、名额。

#### 拼团 / 拼课进度页

- 展示玩法实例状态。
- 支持分享、查看剩余人数、截止时间、失败原因、退款状态。

#### 订单列表 / 订单详情页

- 订单项需明确展示成交活动、活动状态、退款状态、佣金状态。

### 7.2 后台页面

#### 门店商品管理页

- 展示门店商品、SKU、售价、普通分销配置。
- 增加候选活动摘要和当前主活动摘要。

#### 候选活动配置页

- 配活动价格、时间、门店范围、资格范围、SKU 绑定、活动佣金、是否参与聚合、是否展示专区。

#### 聚合优先级配置页

- 配活动类型优先级。
- 支持门店覆盖。
- 支持聚合参与开关、专区参与开关。

#### 聚合模拟器页

- 输入门店、用户身份、时间、商品。
- 输出候选活动池、过滤原因、当前主活动、备用活动。

#### 活动实例管理页

- 专门查看拼团、拼课等结果型玩法实例状态。

#### 订单审计页

- 解释订单项为什么命中了某个活动。

#### 佣金审计页

- 解释某个订单项为什么返佣、为什么禁佣、为什么回滚佣金。

## 8. 后端模块规划

### 8.1 新增营销裁决域

新增目录：

- `apps/backend/src/module/marketing/resolution/`

建议文件：

- `resolution.module.ts`
- `resolution.service.ts`
- `resolution.repository.ts`
- `services/candidate-loader.service.ts`
- `services/eligibility-filter.service.ts`
- `services/aggregate-selector.service.ts`
- `services/activity-context-key.service.ts`
- `dto/resolve-context.dto.ts`
- `vo/resolved-activity-context.vo.ts`
- `vo/aggregate-product-card.vo.ts`

职责：

- 加载候选活动
- 过滤用户资格与活动有效性
- 选择主活动
- 生成活动上下文

### 8.2 现有模块改造

- `client/product`：不再自行聚合活动，统一调用 `resolution` 域。
- `client/cart`：按活动上下文拆行。
- `client/order`：按订单项接收活动上下文、逐项校验、逐项落快照。
- `marketing/instance`：玩法实例与订单项建立绑定。
- `finance/commission`：新增活动订单项佣金路径。
- `store/distribution`：继续服务普通商品分销逻辑，不作为活动佣金默认兜底。

## 9. 数据库落库设计

### 9.1 修改 OmsCartItem

新增字段：

- `activityContextKey`
- `entrySource`
- `activityType`
- `activityConfigId`
- `playInstanceId`
- `activityNameSnapshot`
- `displayPriceSnapshot`

唯一索引改为：

- `memberId + tenantId + skuId + activityContextKey`

### 9.2 修改 OmsOrderItem

新增字段：

- `activityContextKey`
- `entrySource`
- `activityType`
- `activityConfigId`
- `playInstanceId`
- `activityNameSnapshot`
- `activityPriceSnapshot`
- `activityCommissionModeSnapshot`
- `activityCommissionRateSnapshot`
- `orderItemOriginalAmount`
- `orderItemDiscountAllocated`
- `orderItemFinalPaid`
- `commissionRuleSource`
- `commissionPoolSnapshot`
- `l1WeightSnapshot`
- `l2WeightSnapshot`
- `activityStatusSnapshot`
- `resolutionSnapshot`

### 9.3 修改 PlayInstance

新增字段：

- `orderId`
- `orderItemId`

约束：

- `orderItemId` 唯一
- `orderSn` 保留为快照字段，不再承担唯一绑定职责

### 9.4 修改 StorePlayConfig

新增字段：

- `scopeType`
- `aggregateEnabled`
- `zoneEnabled`
- `displayPriority`
- `commissionMode`
- `commissionRate`
- `fallbackPolicy`

### 9.5 新建 StorePlayTargetSku

字段建议：

- `id`
- `configId`
- `tenantSkuId`
- `globalSkuId`
- `sort`
- `isPrimaryDisplay`

### 9.6 新建 MktActivityPriorityRule

字段建议：

- `id`
- `tenantId`
- `activityType`
- `priority`
- `aggregateEnabled`
- `zoneEnabled`
- `manualLockEnabled`

### 9.7 新建 MktResolutionAudit

字段建议：

- `id`
- `tenantId`
- `productId`
- `memberId`
- `scene`
- `candidateSnapshot`
- `filteredSnapshot`
- `selectedActivityType`
- `selectedConfigId`

### 9.8 修改 FinCommission

新增字段：

- `activityType`
- `activityConfigId`
- `playInstanceId`
- `commissionRuleSource`
- `activityCommissionRateSnapshot`
- `commissionPoolSnapshot`

## 10. 接口职责规划

### 10.1 商品与营销接口

- `/client/product/list`

  - 返回普通商品列表
  - 可附带轻量 `mainActivitySummary`

- `/client/marketing/aggregate/products`

  - 返回营销聚合商品卡片
  - 一商品一条记录

- `/client/marketing/zones/:activityType/products`

  - 返回专区商品列表

- `/client/product/detail/:id`
  - 接收 `activityContextKey`
  - 返回锁定后的商品详情与活动上下文

### 10.2 购物车接口

- `/client/cart/add`

  - 接收活动上下文
  - 相同 SKU 不同上下文不合并

- `/client/cart/list`

  - 返回活动快照

- `/client/cart/quantity`

  - 建议改为按 `cartItemId` 更新

- `/client/cart/item/:cartItemId`
  - 删除单条购物车记录

### 10.3 订单接口

- `/client/order/checkout/preview`

  - 按订单项接收活动上下文
  - 逐项返回原价、优惠分摊、最终实付、活动状态

- `/client/order/create`

  - 按订单项落活动快照
  - 结果型活动同时绑定或创建玩法实例

- `/client/order/:id`
  - 返回订单项活动快照

### 10.4 玩法实例接口

- `/client/marketing/instances/:id`
  - 返回拼团、拼课等玩法实例状态

### 10.5 后台接口

- 候选活动 CRUD
- 优先级规则 CRUD
- 聚合模拟接口
- 订单项活动审计接口
- 佣金审计接口

## 11. 佣金设计

### 11.1 普通商品

- 继续走现有普通分销链路。
- 使用 SKU 分佣基数、商品/品类覆盖、租户默认、会员等级等现有逻辑。

### 11.2 活动商品

活动佣金仅支持：

- `NONE`
- `FIXED_RATE`

规则：

- 活动未配置佣金，默认 `NONE`
- 一旦命中活动，不默认回退商品分佣
- 活动固定比例按 `订单项最终分摊实付 × 活动比例` 计算总佣金池
- L1/L2 只拆分总佣金池，不二次放大佣金

## 12. 订单与玩法实例状态机

### 12.1 订单状态机

- `PENDING_PAY`
- `PAID`
- `SHIPPED`
- `COMPLETED`
- `CANCELLED`
- `REFUNDED`

### 12.2 玩法实例状态机

- `PENDING_PAY`
- `PAID`
- `ACTIVE`
- `SUCCESS`
- `TIMEOUT`
- `FAILED`
- `REFUNDED`

### 12.3 职责分工

- 订单状态机负责支付、履约、退款。
- 玩法实例状态机负责营销结果。
- 秒杀更接近即时成功型活动。
- 拼团、拼课属于结果型活动，支付成功不等于活动成功。

## 13. 边界场景

必须覆盖以下场景：

- 同商品多候选活动
- 同 SKU 只参加部分活动
- 新人资格、会员资格在详情或结算前变化
- 秒杀结束后聚合页切换主活动
- 拼课失败退款后佣金回滚
- 同一订单混合普通商品与活动商品
- 同一 SKU 以不同活动身份同时存在购物车
- 活动修改后历史订单快照保持不变
- 门店切换导致活动上下文失效

## 14. 实施顺序

### 阶段一：数据库与类型

- 修改 Prisma schema
- 生成 Prisma Client
- 更新 OpenAPI 类型

### 阶段二：营销裁决域

- 新建 `marketing/resolution`
- 打通候选活动、资格过滤、主活动选择、活动上下文生成

### 阶段三：商品与页面

- 改商品列表、聚合页、专区页、详情页
- 前端统一吃 `resolvedActivityContext`

### 阶段四：购物车与订单项

- 购物车引入活动上下文
- 结算与下单改为订单项逐条处理

### 阶段五：玩法实例闭环

- 订单项与 `PlayInstance` 绑定
- 打通秒杀、拼团、拼课的支付后状态流转

### 阶段六：佣金与退款

- 新增活动订单项佣金路径
- 打通退款回滚

### 阶段七：后台运营工具

- 候选活动页
- 优先级页
- 模拟器页
- 订单审计页
- 佣金审计页

### 阶段八：统计、预警、回归

- 活动统计
- 入口统计
- 预警提示
- 高风险链路回归测试

## 15. 当前代码最主要冲突点

- 当前购物车只按 `skuId` 唯一，不支持多活动上下文。
- 当前订单 DTO 和结算预览只支持整单一个 `marketingConfigId`。
- 当前商品详情仍存在“只取第一个活动”的逻辑。
- 当前秒杀命名存在 `SECKILL / FLASH_SALE` 不一致问题。
- 当前订单项不保存活动快照。
- 当前玩法实例和订单项未形成逐项闭环。

## 16. 最终结论

这次重构的核心不是“把营销标签显示出来”，而是把以下主线彻底打通：

`候选活动 -> 主活动 -> 活动上下文 -> 购物车行 -> 订单项快照 -> 玩法实例 -> 佣金与退款`

只有这条主线打通，小程序页面、后台运营、客服售后、财务对账、活动统计才能使用同一套解释口径。
