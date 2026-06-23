# P1-07 场景模板化（5 个预设包 + 继承覆盖）

**owner**: 待指派 / 后端 + admin-web
**status**: draft
**last_verified**: 2026-05-15
**related**: [[P1-05-merge-activity-campaign]]、[[P1-06-merge-play-strategy-handler]]

---

> **跨文档硬约束**：本设计涉及金额字段全链路遵循 [[P0-00-money-precision]]；幂等键格式遵循 [[P2-14-idempotency-key-convention]]。

## 1. 目标与范围

### 1.1 目标

当前每个 `MktScene` 都是空模板，运营创建一个"新人专享场景"需要：自己取 sceneCode、自己挑 placementConfig、自己定义每个 `MktSceneModule` 的 `sourcePolicyCode / resolverPolicyCode / sortPolicyCode / audiencePolicyCode / cardTemplateCode / attributionPolicyCode`，最后做发布快照。门槛极高，常见失误：

- module 的 6 个 policyCode 互相不兼容（如 `resolverPolicyCode=PRIMARY_OFFER` + `cardTemplateCode=FLASH_SALE_BIG_CARD` 但 source pool 里没有 FLASH_SALE 商品）；
- `placementConfig.activityTypeFilter` 与 module sourcePolicy 重复或冲突；
- 跨租户的"同样场景"被复制粘贴，配置漂移。

引入"场景模板（SceneTemplate）"：5 个预设包覆盖主要业务形态；运营创建场景时只需"选模板 → 选店 → 个别字段覆盖"；模板的字段在场景创建时**通过引用**继承，模板更新可选择性同步到子场景。

### 1.2 范围

- ✅ 新增 `MktSceneTemplate` + `MktSceneTemplateModule` 两张表（全租户共享）。
- ✅ Seed 5 个预设模板：`HOMEPAGE_PROMOTION_FEED` / `NEW_CUSTOMER_ZONE` / `MEMBER_DAY_BANNER` / `FLASH_SALE_TIMEBOX` / `DISTRIBUTION_LANDING`。
- ✅ `MktScene` 增加 `templateCode / templateOverrides Json?` 列，记录 inheritance 关系。
- ✅ `SceneAdminService` 新增 `createFromTemplate(templateCode, sceneCode, overrides)` / `syncFromTemplate(sceneId, fields[])` 两个动作。
- ✅ admin-web 创建场景流程改为"先选模板，再二次编辑"；保留"从空白创建"作为高级选项。
- ❌ 不动 `MktSceneRelease` 发布快照逻辑（模板继承在 admin 草稿层解决，发布快照保持冻结）。
- ❌ 不引入"模板版本化"（模板就是模板，不做 release；运营改完即生效，子场景手动 sync）。

### 1.3 DoD

1. 5 个模板 seed 入库；admin-web 创建页面下拉显示。
2. `createFromTemplate` 路径覆盖模板字段 + 子场景 `templateOverrides` 记录差异。
3. `syncFromTemplate` 可按字段选择性同步（如只同步 `cardTemplateCode`，不动 `audiencePolicyCode`）。
4. 现有空白场景仍可通过 admin-web "高级模式"创建，向后兼容。

---

## 2. 现状取证

### 2.1 MktScene 字段（80-marketing.prisma:1218-1271）

`MktScene` 持有：`sceneCode / sceneName / sceneType / channelScope / pageRoute / defaultCardTemplateCode / defaultResolverPolicyCode / placementConfig`。

`MktSceneModule` 持有 6 个 policy code + cardTemplateCode + uiConfig。

### 2.2 当前没有模板概念

`grep` 全仓 `SceneTemplate` 0 命中。每个新场景都是字段级手填。

### 2.3 admin-web 场景管理

`apps/admin-web/src/views/marketing/scene/**` 当前"创建场景"表单展开所有字段，无引导。

---

## 3. 设计方案

### 3.1 Schema

```prisma
model MktSceneTemplate {
  id                       String   @id @default(cuid())
  /// 全局唯一模板代码；非租户级
  templateCode             String   @unique @db.VarChar(60)
  templateName             String   @db.VarChar(120)
  sceneType                String   @db.VarChar(40)
  channelScope             Json
  pageRoute                String?  @map("page_route")
  defaultCardTemplateCode  String?  @map("default_card_template_code")
  defaultResolverPolicyCode String? @map("default_resolver_policy_code")
  placementConfig          Json?    @map("placement_config")
  description              String?  @db.VarChar(500)
  isActive                 Boolean  @default(true) @map("is_active")
  createTime               DateTime @default(now()) @map("create_time")
  updateTime               DateTime @updatedAt @map("update_time")

  modules MktSceneTemplateModule[]

  @@map("mkt_scene_template")
}

model MktSceneTemplateModule {
  id                    String  @id @default(cuid())
  templateCode          String  @map("template_code")
  moduleSlot            String  @map("module_slot") @db.VarChar(60)
  moduleName            String  @map("module_name")
  moduleType            String  @map("module_type")
  title                 String?
  subTitle              String?
  displayOrder          Int     @default(0) @map("display_order")
  limitSize             Int     @default(20) @map("limit_size")
  sourcePolicyCode      String  @map("source_policy_code")
  resolverPolicyCode    String  @map("resolver_policy_code")
  sortPolicyCode        String? @map("sort_policy_code")
  audiencePolicyCode    String? @map("audience_policy_code")
  cardTemplateCode      String  @map("card_template_code")
  attributionPolicyCode String? @map("attribution_policy_code")
  uiConfig              Json?   @map("ui_config")

  template MktSceneTemplate @relation(fields: [templateCode], references: [templateCode], onDelete: Cascade)

  @@unique([templateCode, moduleSlot])
  @@map("mkt_scene_template_module")
}

// MktScene 追加：
model MktScene {
  // ... 现有字段
  templateCode      String? @map("template_code") @db.VarChar(60)
  templateOverrides Json?   @map("template_overrides")   // 记录哪些字段被运营覆盖了
}
```

### 3.2 5 个预设模板

| templateCode              | 业务用途      | modules（slot）                                              |
| ------------------------- | ------------- | ------------------------------------------------------------ |
| `HOMEPAGE_PROMOTION_FEED` | 首页营销 feed | banner / hot-sale / personal-recommend                       |
| `NEW_CUSTOMER_ZONE`       | 新人专享专区  | newcomer-welcome / newcomer-coupon-pack / newcomer-flash     |
| `MEMBER_DAY_BANNER`       | 会员日活动    | member-day-hero / member-exclusive-coupons / member-products |
| `FLASH_SALE_TIMEBOX`      | 限时秒杀场景  | flash-current / flash-upcoming / flash-warmup                |
| `DISTRIBUTION_LANDING`    | 分销落地页    | landing-banner / distribution-products / referrer-card       |

每个 module 对应的 6 个 policyCode 在 seed 中预填，与现有 `mkt_policy` 中的标准 policy 对齐。

### 3.3 继承与覆盖

```ts
async createFromTemplate(
  tenantId: string,
  templateCode: string,
  input: { sceneCode: string; sceneName: string; overrides?: Record<string, unknown> },
): Promise<MktScene> {
  const template = await this.prisma.mktSceneTemplate.findUnique({
    where: { templateCode },
    include: { modules: true },
  });
  if (!template || !template.isActive) {
    throw new BusinessException('Template not found or inactive');
  }

  return await this.prisma.$transaction(async (tx) => {
    const scene = await tx.mktScene.create({
      data: {
        tenantId,
        sceneCode: input.sceneCode,
        sceneName: input.sceneName,
        sceneType: template.sceneType,
        channelScope: applyOverride(template.channelScope, input.overrides?.channelScope),
        pageRoute: input.overrides?.pageRoute ?? template.pageRoute,
        defaultCardTemplateCode: input.overrides?.defaultCardTemplateCode ?? template.defaultCardTemplateCode,
        defaultResolverPolicyCode: input.overrides?.defaultResolverPolicyCode ?? template.defaultResolverPolicyCode,
        placementConfig: applyOverride(template.placementConfig, input.overrides?.placementConfig),
        templateCode,
        templateOverrides: input.overrides ?? null,
        status: 'DRAFT',
      },
    });

    for (const tm of template.modules) {
      const mOverrides = input.overrides?.modules?.[tm.moduleSlot];
      await tx.mktSceneModule.create({
        data: {
          tenantId,
          sceneCode: input.sceneCode,
          moduleCode: `${input.sceneCode}-${tm.moduleSlot}`,
          moduleName: mOverrides?.moduleName ?? tm.moduleName,
          moduleType: tm.moduleType,
          title: mOverrides?.title ?? tm.title,
          subTitle: mOverrides?.subTitle ?? tm.subTitle,
          displayOrder: tm.displayOrder,
          limitSize: mOverrides?.limitSize ?? tm.limitSize,
          sourcePolicyCode: mOverrides?.sourcePolicyCode ?? tm.sourcePolicyCode,
          resolverPolicyCode: mOverrides?.resolverPolicyCode ?? tm.resolverPolicyCode,
          sortPolicyCode: mOverrides?.sortPolicyCode ?? tm.sortPolicyCode,
          audiencePolicyCode: mOverrides?.audiencePolicyCode ?? tm.audiencePolicyCode,
          cardTemplateCode: mOverrides?.cardTemplateCode ?? tm.cardTemplateCode,
          attributionPolicyCode: mOverrides?.attributionPolicyCode ?? tm.attributionPolicyCode,
          uiConfig: applyOverride(tm.uiConfig, mOverrides?.uiConfig),
          status: 'ACTIVE',
        },
      });
    }

    return scene;
  });
}
```

### 3.4 sync 操作

```ts
async syncFromTemplate(sceneId: string, fields: Array<'placementConfig' | 'modules.*.cardTemplateCode' | ...>) {
  const scene = await this.prisma.mktScene.findUnique({ where: { id: sceneId } });
  if (!scene?.templateCode) throw new BusinessException('Scene has no template');
  const template = await this.prisma.mktSceneTemplate.findUnique({
    where: { templateCode: scene.templateCode },
    include: { modules: true },
  });
  // 选择性把 template 的字段拷过来；不覆盖 templateOverrides 中已有 key
  // ...
}
```

---

## 4. 决策依据

### 4.1 Q1 模板：全局共享 vs 租户私有

| 选项                               | 优             | 劣                     | 选择 |
| ---------------------------------- | -------------- | ---------------------- | ---- |
| **A. 全局共享，运营覆盖**          | 中心化运营沉淀 | 跨租户业务差异不易表达 | ✅   |
| B. 租户私有模板                    | 适配差异       | 失去中心运营沉淀价值   |      |
| C. 双层（全局基础模板 + 租户私有） | 灵活           | 复杂度大               |      |

### 4.2 Q2 模板版本化？

| 选项                             | 优                              | 劣                                               | 选择 |
| -------------------------------- | ------------------------------- | ------------------------------------------------ | ---- |
| **A. 不版本化，子场景手动 sync** | 简单；与 `MktSceneRelease` 解耦 | 模板变更不会自动 propagate                       | ✅   |
| B. 模板带 version + auto-sync    | 心智模型重                      | 双重发布快照（template release + scene release） |      |

### 4.3 Q3 5 个模板的选定

由产品 + 现有 `MktScene` 实际使用数据归纳，覆盖 80% 创建需求。剩余 20% 用"高级模式（空白创建）"兜底。

---

## 5. 迁移与回滚

### 5.1 部署顺序

1. **D1**：schema + seed 5 个模板，admin 路径添加 createFromTemplate（旧 createScene 保留）。
2. **D2**：admin-web 改交互。
3. **D3**：观察 1 个迭代后，若空白创建率 <10%，将 admin-web "高级模式"折叠到隐藏入口。

### 5.2 回滚

模板表保留即可；admin 切回旧 createScene 入口。

---

## 6. 验证矩阵

| 层   | 用例                                                                                    | 工具 |
| ---- | --------------------------------------------------------------------------------------- | ---- |
| Spec | createFromTemplate(NEW_CUSTOMER_ZONE) → MktScene + 3 modules，templateOverrides 为空    | unit |
| Spec | createFromTemplate + overrides.placementConfig → 子场景写入 overrides，与 template 不同 | unit |
| Spec | syncFromTemplate(['modules.*.cardTemplateCode']) → 仅 cardTemplateCode 拷贝             | unit |
| 集成 | admin 通过 UI 创建 → 发布 → C 端按发布快照渲染                                          | e2e  |
| 数据 | seed 5 个模板入库，每个模板的 modules 数 ≥2                                             | DBA  |

---

## 7. 风险与未决

### 7.1 TODO

1. **TODO-1**：5 个模板 module 的具体 policyCode 取值，需与 `mkt_policy` 现有 ACTIVE 行交叉确认；本设计仅给 slot 占位，policyCode 在 seed PR 实施时填。
2. **TODO-2**：admin-web 是否需要"模板预览"页面（不创建直接看效果）？建议第一版不做，等运营反馈。
3. **TODO-3**：`syncFromTemplate` 在子场景已 PUBLISHED 时是否允许？建议允许，但同步后需重新创建 `MktSceneRelease`（运营触发 publish）。

### 7.2 风险

| 风险                             | 等级 | 缓解                                                     |
| -------------------------------- | ---- | -------------------------------------------------------- |
| 模板 seed 出错导致子场景批量异常 | 中   | seed PR 上 staging 跑 createFromTemplate × 5 后再合 main |
| 模板字段补充字段时 schema 漂移   | 低   | 严格走 Prisma migration                                  |

---

## 8. 实施清单

### 8.1 backend

- [ ] Prisma：`MktSceneTemplate` + `MktSceneTemplateModule`；`MktScene` 加 `templateCode / templateOverrides`。
- [ ] Seed：5 个模板 + 各自 modules。
- [ ] `SceneAdminService.createFromTemplate / syncFromTemplate`。

### 8.2 admin-web

- [ ] 创建场景页交互改"先选模板"。
- [ ] 模板列表 / 模板编辑（先 readonly，运营改模板由开发 PR 走）。

### 8.3 验证

- [ ] `pnpm typecheck:backend && pnpm test:backend -- scene`
- [ ] `pnpm verify:admin-view-types`
- [ ] PR 前完整 verify。

### 8.4 PR 标题

`feat(backend,admin-web): 引入场景模板，5 个预设包 + 继承覆盖`
