# 术语词典

本词典统一定义项目中的核心业务术语，消除 tenant/client/member 等概念歧义。代码命名、文档编写、API 设计均应以此为准。

## 核心术语

| 英文术语        | 中文术语       | 定义                                                   | 代码中的使用位置                                                  | 相关术语                   |
| --------------- | -------------- | ------------------------------------------------------ | ----------------------------------------------------------------- | -------------------------- |
| tenant          | 租户           | 平台上的独立商户/机构                                  | Tenant model, tenantId                                            | client, member             |
| client          | 客户端/C端用户 | 小程序端的终端用户                                     | module/client/                                                    | member                     |
| member          | 会员           | 注册并绑定租户的C端用户                                | Member model                                                      | client, tenant             |
| admin           | 管理员         | 后台管理系统的操作用户                                 | module/admin/                                                     | tenant                     |
| order           | 订单           | 用户下单产生的交易记录                                 | module/store/order/                                               | settlement, payment        |
| settlement      | 结算           | 订单完成后的资金结算流程                               | module/finance/settlement/                                        | commission, withdrawal     |
| commission      | 佣金/抽成      | 平台从交易中收取的服务费                               | module/finance/commission/                                        | settlement                 |
| withdrawal      | 提现           | 商户将钱包余额提取到银行账户                           | module/finance/withdrawal/                                        | wallet                     |
| wallet          | 钱包           | 商户在平台的虚拟资金账户                               | module/finance/wallet/                                            | withdrawal, settlement     |
| payment         | 支付           | 用户为订单付款的行为                                   | module/store/payment/                                             | order                      |
| pay order       | 支付单         | 第三方支付通道的真实收款记录                           | module/finance/settlement/                                        | order, reconciliation      |
| settlement bill | 应结算单       | 系统内部算出的门店、租户或合作方应收金额               | module/finance/settlement/                                        | pay order, reconciliation  |
| reconciliation  | 对账           | 核对系统账、支付通道账与结算执行状态的过程             | module/finance/settlement/                                        | pay order, settlement bill |
| display tag     | 商品展示标签   | 商品事实、规则或运营展示标签，不参与营销裁决和价格计算 | module/pms/, module/client/product/, module/marketing/resolution/ | primary offer              |
| primary offer   | 营销价签       | 营销权益、活动价和活动上下文，只展示在商品卡价格区     | module/marketing/                                                 | display tag                |

## 营销领域

> 下方词汇以本节为准；代码命名、DTO 字段、前端组件名均应对齐。

| 英文术语             | 中文术语           | 定义                                                                      | 代码中的使用位置                          | 相关术语                    |
| -------------------- | ------------------ | ------------------------------------------------------------------------- | ----------------------------------------- | --------------------------- |
| PlayTemplate         | 玩法模板           | 定义某一类营销玩法规则骨架（FLASH_SALE、COURSE_GROUP_BUY 等）             | `MarketingTemplateModule`, `templateCode` | ActivityConfig              |
| ActivityConfig       | 活动配置           | 运营为某商品在某租户下创建的具体活动设置（Prisma: StorePlayConfig）       | `resolution/`, `config.service.ts`        | PlayTemplate, Activity      |
| Activity             | 活动实例（运行态） | 活动配置上架后在 C 端可被裁决和参与的实体                                 | `MktActivity`, `ActivityModule`           | ActivityConfig              |
| PlayInstance         | 玩法实例           | 用户参与结果型活动（拼课、拼团）时创建的运行记录                          | `PlayInstanceModule`, `MktPlayInstance`   | Activity                    |
| Campaign             | 活动编排壳         | 跨多个 ActivityConfig / 权益池 / 场景的大型活动容器（旧称 CampaignShell） | `CampaignShellModule`                     | ActivityConfig              |
| Entitlement          | 权益               | 活动可发放的奖励（优惠券、积分、折扣）的抽象                              | `EntitlementModule`                       | Coupon, Points              |
| Scene                | 场景               | 小程序中一个可配置的展示位；层级：ScenePlacement → SceneModule → Scene    | `MarketingSceneModule`                    | ScenePlacement, SceneModule |
| Resolution           | 裁决               | 运行时为某商品/用户选出最优 ActivityConfig 的决策过程                     | `ResolutionModule`                        | ActivityConfig, Activity    |
| ProductMarketingView | 营销展示视图       | 后端聚合裁决结果 + 运行态 + 按钮动作后返回给 C 端的统一读模型             | `ProductActivityViewModule`               | Resolution, PlayInstance    |
| COURSE_GROUP_BUY     | 拼课玩法枚举值     | 拼课活动的 templateCode 规范值；废弃 COURSE_GROUP（旧值），两者语义等同   | `play/`, `course-group/`                  | PlayTemplate                |

### 混用词映射（旧词 → 规范词）

| 代码旧词 / 混用词            | 规范词                      | 说明                                                          |
| ---------------------------- | --------------------------- | ------------------------------------------------------------- |
| `CampaignShell`              | `Campaign`                  | Shell 是实现细节，对外统一用 Campaign                         |
| `Template`                   | `PlayTemplate`              | 避免与 MarketingTemplate 混淆                                 |
| `Config` / `StorePlayConfig` | `ActivityConfig`            | 对外 API 用 ActivityConfig；Prisma model 仍用 StorePlayConfig |
| `COURSE_GROUP`               | `COURSE_GROUP_BUY`          | 统一为 COURSE_GROUP_BUY，兼容旧值保留映射                     |
| `activity.publish`           | `activityConfig.publish`    | Activity 是运行态，发布的是 ActivityConfig                    |
| `resolution.resolve`         | `resolution.selectActivity` | 更清晰地描述决策语义                                          |

### Scene 三层结构

| 层  | 名称           | 运营理解                             | 代码对象                       |
| --- | -------------- | ------------------------------------ | ------------------------------ |
| 1   | ScenePlacement | 投放位（首页 banner、拼课专区）      | `MktScenePlacement`            |
| 2   | SceneModule    | 投放模块（一个投放位里的一个内容块） | `MktSceneModule`               |
| 3   | Scene          | 场景（完整场景配置，包含多个模块）   | `MktScene` / `MktSceneRelease` |
