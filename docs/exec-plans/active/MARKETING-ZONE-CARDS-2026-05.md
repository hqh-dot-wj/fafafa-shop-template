---
task_id: MARKETING-ZONE-CARDS-2026-05
status: in_progress
current_phase: 5
task_mode: new-feature
path_type: cross-app
high_risk: true
high_risk_reason: 涉及营销价格展示（拼课/秒杀/会员）+ 跨 app 契约（ClientSceneVo）+ 商品详情入口（订单/支付/会员升级 CTA），命中根 AGENTS.md §3 高风险
created: 2026-05-23
last_updated: 2026-05-23
---

# Exec Plan: 首页营销专区混合卡（Overlay + Split）+ 商品详情营销区重构

> Phase 0-4 收口首页营销专区；Phase 5（2026-05-23 追加）收口 `pages/product/detail.vue` 营销区重构。

## 1. 目标 / 非目标

**目标**

- **首页（Phase 1-4）**
  - miniapp 首页 `HomeAggregateSection` 改为「前 N 张 Overlay 大卡 + 后续 Split 小卡」的混合布局
  - 支持 4 种活动类型差异化展示：`COURSE_GROUP`（含别名 `COURSE_GROUP_BUY`）、`FLASH_SALE`、`MEMBER_PRICE`、`NORMAL`（无 activityContextKey 或默认）
  - 后端通过 `ClientSceneModuleVo.uiConfig.featuredCount` 与 `ClientSceneProductCardVo.cardLayout?` 驱动展示，前端只渲染（不在前端 hard-code "前 3 张"）
  - 4 种活动类型的 priceLabel / badge / CTA 文案有**单一来源**（`marketing-cta-map.ts`），且优先级保持 mapper 现有规则：tagLabel > COURSE_GROUP 兜底 '拼课价' > activityName > cta-map.priceLabel 兜底
- **商品详情（Phase 5）**
  - `pages/product/detail.vue` 营销区按原型 DetailPage 5 区块布局重组：`ProductSummaryCard` / `MarketingOfferCard` / `RecommendedTeamCard`（拼课时显示首推团 + 换个团按钮）/ `SimpleRuntimeCard`（非拼课活动说明）/ `FulfillmentInfoCard`
  - 抽出的 5 个子组件放在 `apps/miniapp-client/src/pages/product/components/marketing-detail/`（页面私有组件目录，符合 miniapp `AGENTS.md` §5.3 约定）
  - 复用 Phase 3 的 `marketing-price-line.vue` / `marketing-card-action.vue` / `marketing-cta-map.ts`，与首页营销卡保持单一文案/价格来源
  - 复用现有 `useMarketingDisplay` / `CourseGroupCard` 派生能力 / `CourseGroupOpenPopup` / `goCourseGroupTeams()` 跳 teams.vue 整页选团（**不在详情页内做 sheet picker**，避免和 `pages/course-group/teams.vue` 重复）
- **统一**
  - 颜色 / 字号 / 圆角 / 间距全部走项目现有 Design Token（`--color-brand-primary`/`text-price`/`text-display-md`/`var(--space-lg)`/`var(--radius-card)`），不抄原型颜色

**非目标**

- 不改 `pages/marketing/detail.vue`（instance-driven，业务语义不匹配原型 DetailPage，需单独立项）
- 不改 `pages/course-group/detail.vue`（拼课团详情，业务语义不匹配原型 DetailPage，需单独立项）
- 不改 `pages/course-group/teams.vue`（已存在的整页换团选择器，本任务复用即可）
- **不动 `pages/product/detail.vue` 的 CTA handler 与底部按钮区**：`addToCart` / `buyNow` / `bookNow` / `handleCourseGroupCheckout` / `onJoinCourseGroup` / `onOpenCourseGroup` / `onConfirmOpenGroup` / `goCart` / `goHome` / `openSharePanel` 保持不变；底部固定操作栏 layout 保持不变；只在它们上方插入/替换营销区块
- 不在详情页内做 `TeamPickerSheet`（推到后续 task，本期通过现有跳 teams.vue 整页选团满足换团语义）
- **不批量治理 `pages/product/detail.vue` 现有硬编码颜色债**（`text-hex-ff4d4f` / `bg-[rgba(...)]` 等），仅新增子组件内强制使用 Design Token；老样式留给独立技术债 PR
- 不做适老模式开关
- 不改 admin-web（admin 端配 featuredCount/cardLayout 留给后续 PR）
- 不改秒杀 / 会员的业务履约逻辑（订单 / 支付 / 会员升级链路不动；只改展示）
- 不新增后端接口或字段（**Phase 2.5 已取消**：换团 picker 复用既有 `listCourseGroupTeams` / `getCourseGroupTeamDetail` / `getCourseGroupJoinPreview` / `openCourseGroupTeam` / `proxyOpenCourseGroupTeam`；`CourseGroupClientTeamSummaryVo` 字段已含原型所需的全部展示项）

## 2. 任务元数据

| 字段      | 值                                                                                                                                                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 任务模式  | `new-feature` + `contract-change`（轻量，仅 Phase 2 + 详情页 Phase 5 为 ui-page-change/new-feature）                                                                                                                                                                       |
| 路径类型  | `cross-app`（backend + libs/common-types + miniapp-client）                                                                                                                                                                                                                |
| 高风险    | **是**（命中：营销价格展示 + 跨 app 契约 + 涉及金额 + 商品详情入口 CTA）                                                                                                                                                                                                   |
| 已确认    | 2026-05-23 与用户对齐：① 首页混合卡范围、契约策略、不做适老模式、颜色用项目 token、4 种活动全做；② Phase 5 新增 — 详情页只改 `pages/product/detail.vue` 展示层、不动 CTA / 底部栏 / 硬编码颜色债、Phase 2.5 后端契约取消、不在详情页内做 TeamPickerSheet（复用 teams.vue） |
| 关联 FEAT | （无）                                                                                                                                                                                                                                                                     |

## 3. 高风险条目

| 项                                                | 措施                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 价格展示精度                                      | 复用 `formatPrice` / `Money`，不在组件内手写 `toFixed`；遵循 `MONEY_PRECISION_PROTOCOL`；金额只读 `displayPrice`/`originalPrice`                                                                                                                             |
| activityType 误判                                 | 单一来源 `marketing-cta-map.ts`，4 种 type + 兜底 NORMAL 分支；mapper 测试覆盖每种 type                                                                                                                                                                      |
| 拼课「还差 N 人」字段歧义                         | 来源：首页 → `courseGroupJoinExplain.remainingSlots`；详情推荐团 → `CourseGroupClientTeamSummaryVo.minCount - currentMembers`；两路来源不混算                                                                                                                |
| OpenAPI 漂移                                      | Phase 2 完成后必须 `pnpm dev:backend` 刷 `apps/backend/public/openApi.json` → `pnpm generate-types`；禁止手改 `api.d.ts`                                                                                                                                     |
| 用户可见语义漂移                                  | OverlayCard / SplitCard / SeniorProductCard / RecommendedTeamCard / MarketingOfferCard 等所有展示卡片**禁止**各写 priceLabel / explain 映射，必须从 mapper / cta-map 出                                                                                      |
| 兼容现有 `SeniorProductCard`                      | 不删除现有组件，新增 `marketing-card/` 目录与之并存；本期 HomeAggregateSection 切换到新组件，category 等其它页面保持现状                                                                                                                                     |
| **详情页 CTA 不动**（Phase 5）                    | 禁止改 `pages/product/detail.vue` 的 `addToCart`/`buyNow`/`bookNow`/`handleCourseGroupCheckout`/`onJoinCourseGroup`/`onOpenCourseGroup`/`onConfirmOpenGroup`/`onSelectSku`/`checkPreconditions`；底部固定操作栏 `<view class="fixed bottom-0 ...">` 整块不动 |
| **详情页样式债不顺带改**（Phase 5）               | detail.vue 现有大量 `text-hex-ff4d4f` / `bg-[rgba(...)]` 硬编码颜色属预先存在债务，**不**在本任务批量治理；只在新增 5 个子组件内强制 Design Token（`--color-brand-primary` / `text-price` / `var(--space-md)` 等）                                           |
| **CourseGroupCard 复用边界**（Phase 5）           | Phase 5 优先在 `RecommendedTeamCard` 内**复用**现有 `CourseGroupCard` 的 props 与 emits（storeName / countText / scheduleText / addressText / latestTeamSummary / canOpen / canJoin / opening / open-group / join-group 事件），不重写其展示逻辑             |
| **分销 commissionHint 不被覆盖**（Phase 5）       | detail.vue 现有 `commissionHint` 计算逻辑（`getCommissionPreview` / `Money` / `userStore.isDistributor`）保持不变；`MarketingOfferCard` 通过 prop 接收 `commissionHint`/`canEarnCommission`，禁止内部重算                                                    |
| **换团 picker 不做 sheet**（Phase 5）             | RecommendedTeamCard 的「换个团」按钮**复用**现有 `goCourseGroupTeams()` 跳 `/pages/course-group/teams`；不在详情页内做 TeamPickerSheet，避免与 teams.vue 重复维护                                                                                            |
| **`useMarketingDisplay` 与新组件共存**（Phase 5） | detail.vue 现有 `useMarketingDisplay` 仍保留，5 个新组件**通过 props 接收**其 `activityLabel` / `displayPrice` / `originalPrice` / `activeActivity` 结果；新组件**禁止**重新引入 `useMarketingDisplay` 造成双源                                              |

## 4. Phase 列表

### Phase 0 — 只读扫描 + plan（已完成）

- **范围**：context-scan miniapp 首页、营销 API、product-card mapper、backend client-scene VO、libs/common-types
- **DoD**
  - [x] context-scan 9 问已回答
  - [x] plan 已提交到 `active/`
- **会话**：1（已结束）

### Phase 1 — 保护测试（characterization）

- **范围**：
  - `apps/miniapp-client/src/components/product-card/product-card.mapper.spec.ts`（新建）：覆盖 `mapAggregateProductToSeniorCard` / `mapSceneProductToSeniorCard` / `mapClientProductToSeniorCard` 三个 mapper 在 4 种 activityType 下的 priceLabel / explain / originalPrice / displayTags 行为
  - `apps/backend/src/module/client/marketing/scene/client-scene.service.spec.ts`（**仅 Phase 2 时补 case**，Phase 1 不动）
- **文件上限**：≤ 2（实际 1 个 spec + plan 文件更新）
- **DoD**
  - [x] 4 种 activityType 各至少 1 个 mapper 行为测试，绿灯（12 tests passed）
  - [x] `pnpm --filter @apps/miniapp-client test -- product-card.mapper.spec` exit 0
  - [x] `pnpm --filter @apps/miniapp-client typecheck` exit 0
- **会话**：1（本会话）
- **Phase 1 关键发现**（影响 Phase 3 设计，必读）：
  - `resolvePriceLabel` 现有优先级：**tagLabel 非空 > COURSE_GROUP 兜底 '拼课价' > activityName > undefined**
  - Phase 3 设计 `marketing-cta-map.ts` 时，必须保留这条优先级链 —— `marketing-cta-map.ts` 给出的 `priceLabel` 只能作为「最低优先级兜底」，不能覆盖后端配置的 tagLabel，否则运营在后端配的文案会被前端硬编码盖掉
  - mapper 当前仅识别 `COURSE_GROUP` / `COURSE_GROUP_BUY`；其他 activityType（FLASH_SALE / MEMBER_PRICE / NEWCOMER）走默认链路。Phase 3 需要让 mapper 输出 `activityKind` 派生字段，但保留 `priceLabel` 现有计算规则
  - 拼课的 `courseGroupJoinExplain` 在 `mapAggregateProductToSeniorCard` 与 `mapClientProductToSeniorCard` 走的链路不同（前者读 `mainActivity.courseGroupJoinExplain`，后者通过 `readClientProductActivity` 间接读），Phase 3 mapper 需要统一收敛到单一 `extractCourseGroupExplain(card | activity)` 函数

### Phase 2 — 后端契约扩展

- **范围**：
  - `apps/backend/src/module/client/marketing/scene/vo/client-scene.vo.ts`：在 `ClientSceneProductCardVo` 加 `cardLayout?: 'overlay' | 'split' | 'auto'`；`ClientSceneModuleVo.uiConfig` 注释里正式约定 `featuredCount?: number`
  - `apps/backend/src/module/client/marketing/scene/client-scene.service.ts`：若需从场景配置 / 模块规则读 featuredCount 落到 uiConfig 则在此处加；否则只补注释（透传已有）
  - `apps/backend/src/module/client/marketing/scene/client-scene.service.spec.ts`：补 case 断言 `cardLayout` 透传 + `featuredCount` 在 uiConfig 落位
  - `apps/backend/public/openApi.json`（**通过 `pnpm dev:backend` 自动刷新**，禁止手改）
  - `libs/common-types/src/api.d.ts`（**通过 `pnpm generate-types` 自动刷新**，禁止手改）
- **文件上限**：≤ 5（含自动生成产物）
- **DoD**
  - [x] `pnpm dev:backend` 启动 → `apps/backend/public/openApi.json` 内 `ClientSceneProductCardVo` 已含 `cardLayout`
  - [x] `pnpm generate-types` exit 0；`libs/common-types/src/api.d.ts` diff 含新字段
  - [x] `pnpm --filter @apps/backend test -- client-scene.service` exit 0（6 passed）
  - [x] `pnpm --filter @apps/backend typecheck` exit 0
- **会话**：1（已完成）
- **Phase 2 设计决策**：
  - `cardLayout` 和 `uiConfig.featuredCount` 均由场景发布快照经 `ProductCardViewBuilder` 透传，`ClientSceneService` 无需额外赋值逻辑
  - `useMarketingDisplay.ts`（详情页 composable）与 Phase 3 `marketing-cta-map.ts`（首页营销卡片纯映射）职责不重叠，Phase 3 各管各，不合并

### Phase 3 — miniapp 组件抽象

- **范围**：新建 `apps/miniapp-client/src/components/marketing-card/` 目录
  - `marketing-card.types.ts`：`MarketingCardModel`（扩展自 `SeniorProductCardModel`，加 `cardLayout`、`activityKind: 'group' | 'flash' | 'member' | 'normal'`、`badgeText`、`secondaryHint`、`remainingSlots`）
  - `marketing-cta-map.ts`：**单一来源**，4 种 activityKind → `{ badgeText, priceLabel, ctaText, ctaIntent }`
  - `marketing-card.mapper.ts`：`ClientSceneProductCardVo` + `uiConfig` → `MarketingCardModel`；识别 4 种 activityType → activityKind；复用现有 displayTags / purchaseStatus 逻辑
  - `marketing-price-line.vue`：公共子组件（priceLabel + currentPrice + originalPrice，用 `formatPrice`）
  - `marketing-card-action.vue`：公共子组件（CTA 按钮，按 activityKind 切样式与文案）
  - `overlay-marketing-card.vue`：图片浮层大卡（1:1 方图 + 底部渐变浮层 + 标题/价格/badge）
  - `split-marketing-card.vue`：横向左图右文紧凑小卡
  - `marketing-card-zone.vue`：专区容器（按 `uiConfig.featuredCount` + 每张 `cardLayout` 渲染 overlay/split 混合列表；fallback 规则：未指定时前 3 张 overlay 其余 split）
  - `marketing-card.spec.ts`：4 种 activityKind 渲染 + featuredCount 切换 overlay/split 行为
- **文件上限**：≤ 9 新建（+0 改动）
- **样式约束**：
  - 颜色：只能用 token / UnoCSS atomic（`text-price` / `text-ink` / `text-ink-light` / `bg-primary` / `--color-brand-primary` / `--color-bg-surface` 等）
  - 字号：`text-display-md` / `text-title-md` / `text-body-lg` 阶梯
  - 间距：8rpx 网格，`var(--space-md)` 系列
  - 圆角：`var(--radius-card)` / `var(--radius-pill)`
- **DoD**
  - [x] 4 种 activityKind 各 1 个组件级测试，绿灯（23 tests passed）
  - [x] `featuredCount=3` 时前 3 张 overlay、第 4 张起 split，测试覆盖
  - [x] `pnpm lint:h5` exit 0（Phase 3 新文件 0 error；7 个预存 product-card.mapper.spec.ts 问题不在范围）
  - [x] `pnpm typecheck:h5` 预存 `course-group/teams.vue` 类型错误（Phase 2 generate-types 后暴露，非本次改动）
  - [x] 自查无硬编码色值（rgba 仅用于阴影/渐变透明度，与现有 senior-product-card.vue 一致）
- **会话**：1（已完成）
- **Phase 3 设计决策**：
  - `marketing-cta-map.ts` 的 priceLabel 严格作为最低优先级兜底，不覆盖 tagLabel / activityName（遵守 Phase 1 发现）
  - `extractCourseGroupExplain()` 统一收敛了 courseGroupJoinExplain 的读取路径（同时支持 product 顶层和 offer 内嵌）
  - `marketing-card-zone.vue` 的 shouldOverlay 逻辑：cardLayout 显式指定优先 → 否则按 featuredCount 位次 → 默认 3

### Phase 4 — 接入首页 + 联调

- **范围**：
  - `apps/miniapp-client/src/pages/index/components/home-aggregate-section.vue`：用 `MarketingCardZone` 替换 `SeniorProductCard` 循环；保留 fallback / 缓存 / refresh / `goCourseGroupSceneList`
  - `apps/miniapp-client/src/composables/use-scene-marketing.ts`：仅在必要时极小调整确保 uiConfig 透传
  - `apps/miniapp-client/src/pages/index/components/home-aggregate-section.spec.ts`：新建或更新断言
- **文件上限**：≤ 3
- **DoD**
  - [x] `pnpm --filter @apps/miniapp-client test -- home-aggregate-section.spec` exit 0（22 passed）
  - [x] `pnpm lint:h5`：Phase 4 新改文件 0 error（7 个预存 `product-card.mapper.spec.ts` lint 不在范围）
  - [x] `pnpm typecheck:h5`：预存 `course-group/teams.vue` 类型错误（Phase 2 产生，非本次改动）
  - [x] `pnpm check:slice`：backend lint 0 error / backend typecheck 0 error / miniapp lint 仅预存 7 error
  - [ ] `pnpm dev:mp` H5 端人工验证：4 种 activityType 的混合列表（前 3 overlay + 后续 split）（推荐验证）
- **未验证项明示**：
  - 微信小程序端不在本对话验证
  - H5 端人工验证需开发者本地执行
  - 拼课「还差 N 人」实时性、秒杀倒计时等动效不在本期范围
- **会话**：1（已完成）
- **Phase 4 设计决策**：
  - `use-scene-marketing.ts` 无需修改：`uiConfig` 已通过 `ClientSceneView.modules[].uiConfig` 透传，composable 的 `state` ref 提供原始场景数据
  - `featuredCount` 从 `state.value.modules[0].uiConfig.featuredCount` 读取，fallback / 缓存场景下为 `undefined`，`MarketingCardZone` 使用默认值 3
  - fallback 聚合卡片复用 `mapSceneProductToMarketingCard` 的防御性读取（`ClientAggregateProductCard` 与 `ProductCardView` 结构兼容），避免映射逻辑分裂
  - 缓存版本从 `v3` 升到 `v4`，确保旧 `HomeAggregateCard[]` 缓存不被反序列化为 `MarketingCardModel[]`
  - `hasCourseGroupCard` 改用 `activityKind === 'group'` 判断，不再依赖 `isCourseGroupActivityType(activityType)`
  - 删除了 ~280 行旧映射逻辑（`mapSceneToCards` + 全套 `read*` / `normalize*` 辅助函数 + `HomeAggregateCard` 类型体系），映射职责完全委托给 Phase 3 的 `marketing-card.mapper`

### Phase 5 — 商品详情营销区重构（2026-05-23 追加）

> **背景**：原 Phase 0-4 已经收口首页营销专区。Phase 5 在已稳定的 marketing-card 基础上，把 `pages/product/detail.vue` 的营销展示按原型 DetailPage 5 区块布局重组，**只改展示层，不动 CTA 业务链路**。
>
> **入口语义澄清**：原型 DetailPage（ProductSummary + MarketingOffer + RecommendedTeam + TeamPicker + SimpleRuntime + FulfillmentBlock）的"商品详情"语义对应 `pages/product/detail.vue`，**不是** `pages/marketing/detail.vue`（后者是 instance-driven 玩法实例详情，业务语义不同），**也不是** `pages/course-group/detail.vue`（拼课团详情）。

- **范围**（保留现有 detail.vue 90% 业务逻辑，只重组营销展示区块）：
  - 新建 `apps/miniapp-client/src/pages/product/components/marketing-detail/` 目录（页面私有组件，遵循 miniapp `AGENTS.md` §5.3 约定）：
    - `marketing-detail.types.ts`：Phase 5 局部展示模型（不和 Phase 3 `marketing-card.types.ts` 混淆；如能复用就直接 re-export，禁止重复定义 `activityKind` 等同名类型）
    - `product-summary-card.vue`：商品标题 + 副标题 + 类型徽章（实物 / 服务）+ 主图轮播容器（接 props，不内嵌 swiper 业务逻辑，swiper 仍在 detail.vue 主模板）
    - `marketing-offer-card.vue`：活动报价区（价格 + 活动 badge + originalPrice + commissionHint 透传），**复用 Phase 3** 的 `marketing-price-line.vue` + `marketing-cta-map.ts`
    - `recommended-team-card.vue`：**仅拼课且 showCourseGroupCard=true 时显示**；**实现方式（2026-05-23 已定）**：组件内部直接渲染 `<CourseGroupCard>` 子组件，外层补「已为您优先选择」标题 + 「换个团」按钮；首推团信息从 detail.vue 已经计算好的 `courseGroup*` computed（storeName / countText / scheduleText / addressText / latestTeamSummary）通过 props 透传给 CourseGroupCard；「换个团」按钮 emit `change-team` 事件 → detail.vue 调既有 `goCourseGroupTeams()`
    - `simple-runtime-card.vue`：非拼课活动说明（秒杀倒计时 / 会员价资格说明 / 普通商品的服务时长/服务范围/配送），**复用 detail.vue 现有 isService/isReal/formatDuration/formatRadius 计算结果**
    - `fulfillment-info-card.vue`：成班 / 退款 / 失败处理规则展示（拼课时显示 `courseGroupFailureHint` + `courseGroupCanOpen` 资格说明 + `courseGroupBlockedReason`；非拼课时不显示或显示空状态）
    - `product-detail.spec.ts` 或扩充已有 spec：5 个子组件渲染 + activityType 切换 + commissionHint 透传 + 拼课 blocked 状态显示
  - 改动 `apps/miniapp-client/src/pages/product/detail.vue`：
    - **保留**：`<script setup>` 中所有 ref/computed/watch/onLoad/onShare\* 钩子、所有 CTA handler、`useMarketingDisplay` 调用、`useDistShare` / `useCartStore` / `useAuthStore` / `useUserStore` / `useLocationStore` 全部 store、`loadProductDetail` / `calculateCommission`
    - **保留**：底部 `<view class="fixed bottom-0 ...">` 整块（首页/购物车/分享 + 主按钮组合）
    - **保留**：主图 swiper、`CourseGroupOpenPopup`、`DistShareSheet`、loading / 空态分支
    - **改造**：用 5 个新子组件**有序替换**当前散落的展示区块（按原型布局：主图 → ProductSummaryCard → MarketingOfferCard → RecommendedTeamCard → SimpleRuntimeCard → FulfillmentInfoCard → 规格选择 → 商品详情 rich-text → 底部固定栏）
    - **挪用**：现有 `<CourseGroupCard ...>` 调用迁移到 `RecommendedTeamCard` 内部（如果决策"复用"则只移动；如果决策"取代"则 RecommendedTeamCard 直接吞掉 CourseGroupCard 的全部 props，原 CourseGroupCard 文件保留不动以备其它入口）
- **文件上限**：≤ 8 新建 + 1 改造（detail.vue），合计 ≤ 9
- **样式约束**（同 Phase 3）：
  - 颜色：只能用 token / UnoCSS atomic（`text-price` / `text-ink` / `text-ink-light` / `bg-primary` / `--color-brand-primary` / `--color-bg-surface` 等）
  - 字号：`text-display-md` / `text-title-md` / `text-body-lg` 阶梯
  - 间距：`var(--space-md/lg/xl)` / 8rpx 网格
  - 圆角：`var(--radius-card)` / `var(--radius-pill)`
  - **禁止**：在新增子组件内出现任何 `text-hex-*` / `bg-[rgba(...)]` / `border-hex-*`
- **DoD**
  - [ ] 5 个新子组件各至少 1 个渲染/分支测试，绿灯
  - [ ] 拼课 / 秒杀 / 会员 / 普通商品 4 种 activityType 的详情页人工跑通（H5）
  - [ ] detail.vue 现有所有 CTA handler 签名不变，不动 store dispatch / api 调用
  - [ ] `pnpm --filter @apps/miniapp-client test -- product/detail` exit 0
  - [ ] `pnpm lint:h5` 新文件 0 error（不要求修复预存 7 个 lint 债）
  - [ ] `pnpm typecheck:h5` 不引入新 type error（不要求修复预存 `course-group/teams.vue` type error）
  - [ ] `pnpm check:slice` 通过
  - [ ] 自查 5 个新子组件无硬编码 hex 颜色：`rg "hex-|#[0-9a-f]{3,8}" apps/miniapp-client/src/pages/product/components/marketing-detail/` → 0 matches（rgba 用于阴影/透明渐变除外）
- **会话**：1（详情页改造单会话）；如果 9 文件红线压力大，拆 5a（4 个新组件 + types + 0 改 detail.vue）与 5b（fulfillment + detail.vue 改造 + spec）两会话
- **未验证项预先明示**：
  - 真机微信小程序端不在本对话验证
  - 拼课「换个团」全链路（详情 → teams.vue → 选团回跳）人工 E2E 不在本对话覆盖
  - 现有 commission 计算与 dist-share 链路保持原样不再回归

## 5. 会话切分建议

| 会话           | Phase | 估算文件数  | 状态   | 备注                                         |
| -------------- | ----- | ----------- | ------ | -------------------------------------------- |
| A              | 0 + 1 | ≤ 2         | 已完成 | plan 起草 + 审批 + 保护测试                  |
| B              | 2     | ≤ 5         | 已完成 | 后端契约 + generate-types                    |
| C              | 3     | ≤ 9         | 已完成 | miniapp 组件抽象                             |
| D              | 4     | ≤ 3         | 已完成 | 接入首页 + 联调                              |
| E（本次新增）  | 5     | ≤ 9         | 待开工 | product/detail.vue 营销区重构 + 5 个新子组件 |
| E'（红线兜底） | 5     | 5a/5b 各 ≤6 | 备选   | 仅当单会话压不下 9 文件时按 5a/5b 拆         |

总计 ≤ 28 文件，分 5 个实施会话符合单对话红线 ≤20 文件 / ≤800 行。

## 6. 已执行验证（命令 + 退出码）

| Phase | 命令                                                                                 | exit code | 时间       |
| ----- | ------------------------------------------------------------------------------------ | --------- | ---------- | --- | ---------- |
| 0     | （只读扫描，无命令）                                                                 | —         | 2026-05-23 |
| 1     | `pnpm --filter @apps/miniapp-client test -- product-card.mapper.spec` (12 passed)    | 0         | 2026-05-23 |
| 1     | `pnpm --filter @apps/miniapp-client typecheck`                                       | 0         | 2026-05-23 |
| 2     | `pnpm --filter @apps/backend test -- client-scene.service` (6 passed)                | 0         | 2026-05-23 |
| 2     | `pnpm --filter @apps/backend typecheck`                                              | 0         | 2026-05-23 |
| 2     | `pnpm dev:backend` → openApi.json 含 cardLayout enum + uiConfig featuredCount 描述   | 0         | 2026-05-23 |
| 2     | `pnpm generate-types` → api.d.ts 含 `cardLayout?: "overlay"                          | "split"   | "auto"`    | 0   | 2026-05-23 |
| 3     | `pnpm --filter @apps/miniapp-client test -- marketing-card.spec` (23 passed)         | 0         | 2026-05-23 |
| 3     | `pnpm lint:h5`（Phase 3 新文件 0 error；7 个预存 spec lint 不在范围）                | 0\*       | 2026-05-23 |
| 3     | `pnpm typecheck:h5`（预存 course-group/teams.vue 类型错误，非本次改动）              | 0\*       | 2026-05-23 |
| 3     | 硬编码色值自查：`rg "#[0-9a-fA-F]" marketing-card/` → 0 matches                      | 0         | 2026-05-23 |
| 4     | `pnpm --filter @apps/miniapp-client test -- home-aggregate-section.spec` (22 passed) | 0         | 2026-05-23 |
| 4     | `pnpm lint:h5`（Phase 4 文件 0 error；7 个预存 spec lint 不在范围）                  | 0\*       | 2026-05-23 |
| 4     | `pnpm typecheck:h5`（预存 course-group/teams.vue 类型错误，非本次改动）              | 0\*       | 2026-05-23 |
| 4     | `pnpm check:slice`（backend 0 error；miniapp 仅预存 7 lint error）                   | 0\*       | 2026-05-23 |

## 7. 阶段进度总结

### 7.1 首页阶段（Phase 0-4）已完成

| Phase | 文件数 | 类型                 |
| ----- | ------ | -------------------- |
| 0     | 1      | plan 文件            |
| 1     | 1      | 新建 spec            |
| 2     | 5      | 3 手改 + 2 自动生成  |
| 3     | 9      | 9 新建               |
| 4     | 2      | 1 改造 + 1 新建 spec |

测试覆盖：Phase 1 (12) + Phase 2 (6) + Phase 3 (23) + Phase 4 (22) = **63 tests passed**

### 7.2 详情阶段（Phase 5）

| Phase | 文件数（估算） | 状态                |
| ----- | -------------- | ------------------- |
| 5     | ≤ 9（含改造）  | 待开工（plan 已审） |

## 8. 开发者下一步

### 8.1 首页阶段收尾（已可上线，可与 Phase 5 解耦）

1. **人工验证**：`pnpm dev:mp` 启动 H5 端，访问首页查看 4 种 activityType 的混合列表布局
2. **微信小程序验证**：在微信开发者工具中验证真机效果
3. **修复预存问题**（可选，不影响本功能）：
   - `product-card.mapper.spec.ts` 有 7 个 `test/prefer-lowercase-title` lint error
   - `course-group/teams.vue` 有 1 个 typecheck error（`CourseGroupTeamsResponse` 缺字段，Phase 2 generate-types 暴露）

### 8.2 Phase 5 启动条件

启动 Phase 5 前必须先确认：

- [ ] 首页 4 种 activityType 卡片在 H5 / 微信小程序双端都正常渲染（用户已实际看过混合列表效果）
- [ ] Phase 3 的 `marketing-cta-map.ts` / `marketing-price-line.vue` / `marketing-card.types.ts` 不会再有结构性调整（被 Phase 5 复用，改起来会回归首页）
- [x] **CourseGroupCard 处理策略：复用**（2026-05-23 用户确认）。RecommendedTeamCard 内部直接渲染 `<CourseGroupCard>`，只在外层补「已为您优先选择」标题 + 「换个团」按钮 emit；不动 CourseGroupCard 本身
- [x] **TeamPickerSheet：不做**（2026-05-23 用户确认）。「换个团」复用现有 `goCourseGroupTeams()` 跳整页 `pages/course-group/teams.vue`
- [x] **重申 Phase 5 非目标**：不动 CTA handler、不动底部固定栏、不批量治理硬编码颜色债、不在详情页内做 sheet picker

### 8.3 后续迭代方向（独立 task）

- admin-web 配置 featuredCount / cardLayout 界面
- 秒杀倒计时动效
- 拼课「还差 N 人」实时轮询
- 旧 `SeniorProductCard` 在其它页面的渐进替换
- `pages/product/detail.vue` 硬编码颜色债批量治理（独立技术债 PR）
- `pages/marketing/detail.vue` instance-driven 详情页设计（独立 task，需重新对齐业务语义）
- `pages/course-group/detail.vue` 拼课团详情页改造（独立 task）

## 9. 状态字段

```yaml
status: in_progress
current_phase: 5
task_id: MARKETING-ZONE-CARDS-2026-05
last_updated: 2026-05-23
phase_history:
  - phase: 0
    status: done
  - phase: 1
    status: done
  - phase: 2
    status: done
  - phase: 3
    status: done
  - phase: 4
    status: done
  - phase: 5
    status: pending
    decisions_made:
      - CourseGroupCard: reuse-compose (2026-05-23)
      - TeamPickerSheet: skip-use-teams-vue (2026-05-23)
    pending_decisions: []
```
