# Process Spec: 商品展示投影与商品卡展示边界

> 模板级别：**Full**（跨 app 契约 + C 端展示语义）
> 来源：已实现的 miniapp 商品卡统一与 `displayTags` 投影过程稿，收敛日期 2026-05-10

---

## 0. Meta

| 项目         | 值                                      |
| ------------ | --------------------------------------- |
| 流程名称     | 商品展示投影与商品卡展示边界            |
| 流程编号     | PRODUCT_DISPLAY_PROJECTION_V1           |
| 负责人       | Marketing / Product / Miniapp Team      |
| 最后修改     | 2026-05-10                              |
| 影响系统     | Backend / Common Types / Miniapp-Client |
| 是否核心链路 | 是                                      |
| Spec 级别    | Full                                    |

---

## 1. Why（流程目标）

商品卡需要让用户看清商品、价格、当前优惠和下一步动作。商品展示标签、营销价签和场景入口必须分离：

- `displayTags`：商品展示事实或运营展示标签。
- `primaryOffer`：营销权益、活动价和下单活动上下文。
- `sceneCode/moduleCode/entrySource`：来源归因，不是商品属性。

不可接受的错误：

- 前端根据零散字段自行推断新品、爆品、自营、售罄。
- 把 `primaryOffer.tagLabel` 当作商品标签。
- 把场景名、模块名展示成商品标签。
- 用 `isHot` 展示“爆品”，误导为销量事实。

---

## 2. Output Contract

```typescript
export interface ProductDisplayTag {
  code: 'NEW' | 'STORE_RECOMMEND' | 'FREE_SHIPPING' | 'SERVICE_HOME';
  label: string;
  source: 'RULE' | 'FACT' | 'MANUAL';
  priority: number;
}

export interface ProductPurchaseStatus {
  code: 'NORMAL' | 'BOOKING_REQUIRED';
  label: string;
  purchasable: boolean;
}

export interface ProductServiceSummary {
  serviceDuration?: number;
  serviceRadius?: number;
  needBooking?: boolean;
}
```

第一版不返回 `SOLD_OUT`，除非库存展示口径和售罄事实源稳定。

---

## 3. Display Tag Rules

| code              | label    | source   | 规则                              | Rule ID        |
| ----------------- | -------- | -------- | --------------------------------- | -------------- |
| `NEW`             | 新品     | `RULE`   | 门店商品 `createTime <= 14` 天    | R-TAG-PROJ-01  |
| `STORE_RECOMMEND` | 门店推荐 | `MANUAL` | `PmsTenantProduct.isHot === true` | R-TAG-PROJ-02  |
| `FREE_SHIPPING`   | 包邮     | `FACT`   | `PmsProduct.isFreeShip === true`  | R-TAG-PROJ-03  |
| `SERVICE_HOME`    | 服务商品 | `FACT`   | `PmsProduct.type === SERVICE`     | R-TAG-PROJ-04  |

暂不支持：

| 标签   | 原因                                 |
| ------ | ------------------------------------ |
| 自营   | 缺稳定经营主体或履约主体来源         |
| 爆品   | `isHot` 不是销量事实                 |
| 高复购 | 缺行为统计口径                       |
| 限量   | 需要库存、活动库存或名额语义确认     |

---

## 4. Purchase Status Rules

| code               | label  | purchasable | 来源                            | Rule ID          |
| ------------------ | ------ | ----------- | ------------------------------- | ---------------- |
| `NORMAL`           | 可购买 | true        | 默认                            | R-PURCHASE-01    |
| `BOOKING_REQUIRED` | 需预约 | true        | 服务类且 `needBooking === true` | R-PURCHASE-02    |

说明：

- C 端列表通常只返回上架商品，不在该契约中表达 `OFF_SHELF`。
- `SOLD_OUT` 等库存状态等待库存展示事实源稳定后再加。

---

## 5. Happy Path（主干流程）

### 5.1 Backend 投影构建

| 步骤 | 操作                                         | 产出                         | Rule ID        |
| ---- | -------------------------------------------- | ---------------------------- | -------------- |
| S1   | 读取商品事实、门店商品事实和服务事实         | projection source            | R-FLOW-PROJ-01 |
| S2   | 按规则生成 `displayTags`                     | 最多 3 个标签                | R-FLOW-PROJ-02 |
| S3   | 按服务预约事实生成 `purchaseStatus`          | 可购买 / 需预约              | R-FLOW-PROJ-03 |
| S4   | 按服务事实生成 `serviceSummary`              | 服务摘要                     | R-FLOW-PROJ-04 |
| S5   | 普通商品接口和场景商品卡返回同一投影语义     | OpenAPI/common-types 契约    | R-FLOW-PROJ-05 |

### 5.2 Miniapp 商品卡消费

| 步骤 | 操作                                           | 产出                    | Rule ID        |
| ---- | ---------------------------------------------- | ----------------------- | -------------- |
| S1   | 分类页、商品列表页、首页精选区统一走 mapper   | ProductCardPresentation | R-FLOW-CARD-01 |
| S2   | 商品卡最多展示 2 个 `displayTags`              | 标签不过载              | R-FLOW-CARD-02 |
| S3   | 营销价签只展示在价格区                         | 价签和商品标签分离      | R-FLOW-CARD-03 |
| S4   | `entrySceneCode/moduleCode/source` 只用于归因   | 不展示为标签            | R-FLOW-CARD-04 |
| S5   | 商品卡主动作统一为查看详情                     | 避免提前碰下单链路      | R-FLOW-CARD-05 |

---

## 6. UI Contract

商品卡第一屏只展示：

| 信息     | 数量 / 限制                         |
| -------- | ----------------------------------- |
| 图片     | 1 张，4:3，缺失时使用占位图         |
| 商品名   | 最多 2 行                           |
| 副标题   | 最多 1 行，缺失时隐藏               |
| 商品标签 | 最多 2 个，来自 `displayTags`       |
| 营销价签 | 最多 1 个，来自 `primaryOffer`      |
| 解释文案 | 最多 1 行                           |
| 按钮     | 1 个主动作                          |

禁止展示：

- 原始 code，如 `COURSE_GROUP`、`UNKNOWN`。
- 场景名作为商品标签，如“首页精选”“拼课推荐”。
- 没有事实来源的“爆品”“自营”“限量”。

老龄友好 UX 约束：

- 优先使用单列大卡、上图下文和稳定图片比例，避免双列瀑布流导致信息拥挤。
- 商品名、价格和主按钮优先保证可读性；卡片内不要堆叠多个价格、多个活动或多个动作。
- 每张卡只保留一个主动作，第一版统一为“查看详情”，避免在列表卡片中过早触发 SKU、购物车或活动锁定链路。
- 兜底文案必须面向用户，例如“价格待确认”“拼课活动进行中”“新人专享”，不得展示原始枚举或技术 code。
- 无图使用占位图，副标题、原价、解释文案缺失时隐藏或使用明确兜底，不保留空洞占位。

---

## 7. Boundary Rules

| 边界                         | 规则                                                     | Rule ID          |
| ---------------------------- | -------------------------------------------------------- | ---------------- |
| `displayTags` vs `primaryOffer` | 商品标签不影响价格，营销价签不冒充商品标签             | R-BOUNDARY-01    |
| 商品卡 vs 场景模块           | 场景和模块只作为入口归因，不作为商品属性                 | R-BOUNDARY-02    |
| 前端 mapper                  | 只转换契约字段，不自行推断稳定业务标签                   | R-BOUNDARY-03    |
| 后台标签维护                 | 第一版不做标签定义表、关联表、后台标签页、批量打标       | R-BOUNDARY-04    |
| `isHot`                      | 只能映射为 `STORE_RECOMMEND`，不得映射为“爆品”            | R-BOUNDARY-05    |

---

## 8. Observability And Drift Notes

- OpenAPI 生成时，`serviceDuration`、`serviceRadius` 等数值字段必须明确 Swagger 类型，避免生成成 `Record<string, never>`。
- 场景商品卡和普通商品详情必须返回同一套展示投影语义。
- 本地种子中的图片 URL 可能失效，前端应有占位图兜底，但不能把资源 404 误判为商品卡布局失败。

---

## 9. Test Mapping

| Rule ID             | 测试建议                                                     |
| ------------------- | ------------------------------------------------------------ |
| R-TAG-PROJ-01~04    | 新品、门店推荐、包邮、服务商品标签生成                       |
| R-PURCHASE-01~02    | 普通商品、需预约服务商品的购买状态                           |
| R-FLOW-PROJ-*       | 普通商品接口、详情接口、场景商品卡返回投影字段               |
| R-FLOW-CARD-*       | 分类页、商品列表页、首页精选区使用统一商品卡模型             |
| R-BOUNDARY-*        | 商品标签不参与营销裁决，营销价签不进入商品标签区             |

推荐验证链路：

```powershell
pnpm typecheck:backend
pnpm generate-types
pnpm lint:h5
pnpm typecheck:h5
```
