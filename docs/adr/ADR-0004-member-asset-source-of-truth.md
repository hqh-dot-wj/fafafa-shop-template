# ADR-0004: 会员余额与积分的主真相（规范边界）

**日期**：2026-03-26  
**状态**：accepted

## 背景

1. **重复存放**：`UmsMember` 上存在 `balance`、`frozenBalance`、`points`，同时存在 `FinWallet`（及流水 `FinTransaction`）与 `MktPointsAccount`（及流水 `MktPointsTransaction`），语义重叠，存在**多处「看起来像主余额/主积分」**的风险。
2. **大表与快照**：订单、订单明细、佣金记录、门店 SKU、营销资产等表中含大量**金额或积分相关字段**，多数为**下单时快照、审计基数或营销权益余额**，不可与「会员当前总余额 / 总积分」混为一谈。
3. **变更策略**：二期收敛写入与读路径时，需在「双写 + 对账」与「单路径尽快切主表」之间择一或分阶段；该**工程策略尚未拍板**（见下文「二期迁移（待决）」与 `docs/superpowers/specs/2026-03-26-member-asset-source-of-truth-design.md`）。

## 决策

### 1. 规范性主真相（会员维度）

| 资产含义                                                           | 主真相（表）       | 不可变/明细账本（表）                                         | 说明                                                                                          |
| ------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **可划转的会员现金类余额**（可用、冻结、待回收等由钱包模型表达）   | `FinWallet`        | `FinTransaction`（单笔流水 + `balanceAfter` 快照）            | 流水表为**分录级**真相；`balanceAfter` 为**该笔之后**钱包可用余额快照，不是「全站汇总科目」。 |
| **会员积分**（可用、冻结、累计获得、已用、已过期等由积分账户表达） | `MktPointsAccount` | `MktPointsTransaction`（含 `balanceBefore` / `balanceAfter`） | 同上，`balanceAfter` 为**该笔之后**账户积分快照。                                             |

### 2. `UmsMember` 同名字段（`balance` / `frozenBalance` / `points`）

- 与上表**语义重复**，属于**第二真相来源**；在完成收敛前，**禁止**在评审中把其当作**唯一**权威而不经对账或不经钱包/积分服务。
- **新逻辑**：应通过既有 **finance / 积分域服务**读写主真相表（具体 API 与事务边界以代码为准）；**禁止**新增「只改 `UmsMember`、不同步钱包/积分表」的资金路径（与 `AGENTS.md` 中 finance 禁区一致，改动须带测）。

### 3. 明确不是「会员总余额 / 总积分」的常见字段

- **订单域**：`OmsOrder` / `OmsOrderItem` 上积分与金额字段多为**本单快照**（如明细上 `pointsRatio` 注释已说明快照语义）。
- **佣金域**：`FinCommission` 上金额为**在途佣金 / 审计基数**，状态为 `CommissionStatus`，**不是**会员钱包的可用现金余额。
- **营销资产**：`MktUserAsset.balance` / `initialBalance` 表示**核销类权益（如次卡）**的剩余次数或权益额度语义（见模型注释），**不是** `FinWallet` 的现金余额。
- **租户/分销配置**：`SysDistConfig`、`PmsTenantSku.distRate` 等为**规则与比例**，不是用户资产。

### 4. 二期迁移（待决）

在「双写 + 对账再收口」与「单路径只写主表」之间的取舍、对账与发布节奏，**不在本篇冻结**；对比与检查清单见：

`docs/superpowers/specs/2026-03-26-member-asset-source-of-truth-design.md`

## 影响

- **正面**：产品/研发排查「余额不对」时有统一术语；Code Review 可对照附录区分快照与账本。
- **负面**：收敛前仍需理解历史双写；二期改动 finance 相关代码时必须带测试。
- **缓解**：附录清单按版本迭代；`schema.prisma` 变更时在 PR 中更新附录相关行或执行检索脚本复核。

## 附录 A：如何从 Schema 生成/复核清单

在仓库根目录（PowerShell）示例：

```powershell
# 宽匹配字段名（按需增删关键字）
rg -n "balance|points|frozen|wallet|commission|withdraw|积分|余额|佣金|提现" apps/backend/prisma/schema.prisma

# 仅看模型/字段定义行（仍可能漏掉纯注释，需人工扫注释）
rg -n "^\s+\w+\s+.*(balance|points|frozen|wallet)" apps/backend/prisma/schema.prisma -i
```

**分级规则（人工标注）**：

- **账本**：主真相表或其流水上、直接参与余额/积分连续性的字段。
- **分录快照**：流水上的 `balanceAfter` / `balanceBefore`（单笔后的快照，非另一套总账）。
- **业务快照**：订单/佣金行上记录「当时算了多少钱/多少积分」的字段。
- **规则/配置**：比例、上限、枚举类型、租户策略。
- **其它资产**：营销次卡/权益等，字段名像 `balance` 但语义非现金钱包。
- **待确认**：检索命中但语义依赖业务代码才能判断的，标 TBD，PR 中消化。

## 附录 B：当前 Schema 疑似字段分级表（2026-03-26）

> 依据 `apps/backend/prisma/schema.prisma` 人工标注；迁移或加表后请用附录 A 复核并更新本表。

| 模型                    | 字段（或对象）                                                                                                                | 分级                | 说明                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------ |
| UmsMember               | balance, frozenBalance, points                                                                                                | 第二真相 / 待收敛   | 与 FinWallet / MktPointsAccount 重复；收敛前勿单独当唯一写入目标。 |
| FinWallet               | balance, frozen, totalIncome, pendingRecovery                                                                                 | 账本                | 会员现金类余额主真相。                                             |
| FinWallet               | status, frozenReason, frozenAt, frozenBy                                                                                      | 账本元数据          | 钱包级冻结，非订单快照。                                           |
| FinTransaction          | amount, balanceAfter                                                                                                          | 分录 + 分录快照     | 不可变流水；`balanceAfter` 为该笔后可用余额。                      |
| FinCommission           | amount, commissionBase, rateSnapshot, orderOriginalPrice, orderActualPaid, couponDiscount, pointsDiscount, commissionBaseType | 业务快照 + 在途资金 | 佣金单条记录与审计；`status` 为佣金状态。                          |
| FinWithdrawal           | amount, fee, actualAmount                                                                                                     | 业务单据            | 提现申请与打款，非「当前余额」。                                   |
| FinUserDailyQuota       | usedAmount, limitAmount                                                                                                       | 规则执行计数        | 跨店佣金限额，非会员总余额。                                       |
| FinSettlementLog        | totalAmount, settledCount, failedCount                                                                                        | 批处理汇总          | 结算批次统计。                                                     |
| OmsOrder                | pointsUsed, pointsDiscount, pointsEarned, totalAmount, payAmount, …                                                           | 业务快照            | 订单级金额与积分使用/本单获得。                                    |
| OmsOrderItem            | pointsRatio, earnedPoints                                                                                                     | 业务快照            | 注释已标明 `pointsRatio` 为下单快照。                              |
| PmsTenantSku            | pointsRatio, distRate, newcomerPrice                                                                                          | 规则/配置 + 价格    | 积分比例与分佣比例为经营配置；非用户资产。                         |
| MktUserAsset            | balance, initialBalance                                                                                                       | 其它资产            | 营销核销权益（如次卡），非 FinWallet。                             |
| AssetStatus             | 枚举值 FROZEN                                                                                                                 | 规则                | 资产状态，非钱包冻结字段。                                         |
| MktPointsAccount        | totalPoints, availablePoints, frozenPoints, usedPoints, expiredPoints                                                         | 账本                | 积分主真相。                                                       |
| MktPointsTransaction    | amount, balanceBefore, balanceAfter                                                                                           | 分录 + 分录快照     | 积分流水。                                                         |
| MktPointsRule           | orderPointsRatio, orderPointsBase, signinPointsAmount, pointsRedemptionRatio, maxPointsPerOrder, …                            | 规则/配置           | 租户积分规则。                                                     |
| MktPointsTask           | pointsReward                                                                                                                  | 规则/配置           | 任务奖励定额。                                                     |
| MktUserTaskCompletion   | pointsAwarded                                                                                                                 | 业务快照            | 完成记录上的发放额。                                               |
| MktPointsGrantFailure   | amount                                                                                                                        | 运维/补偿           | 发放失败队列，非主余额。                                           |
| SysDistConfig           | crossMaxDaily, maxCommissionRate, commissionBaseType, …                                                                       | 规则/配置           | 分销与佣金策略。                                                   |
| TransType               | 枚举（COMMISSION_IN, WITHDRAW_OUT, …）                                                                                        | 规则/配置           | 钱包流水类型分类。                                                 |
| CourseGroupBuyExtension | leaderDiscount                                                                                                                | 业务快照            | 营销拼团团长优惠金额。                                             |

## 实施记录（运行时 · 增量）

- **2026-03-26**：采纳主真相定义与附录 B 初版；二期读写收敛与对账策略见设计文档，**待单独 PR 实施**。
- **2026-03-26**：补充 **后端代码读写路径枚举**（Task 5 Step 1）→ `docs/superpowers/specs/2026-03-26-member-asset-source-of-truth-design.md` **§5**。
- **2026-03-26（Step 3 第一波）**：管理端会员 **列表 / 详情 / 导出** 的 `balance` 改为读取 **`FinWallet.balance`**（`member.service.ts`）。
- **2026-03-26（Step 3 第二波）**：C 端 **`GET client/user/info`**：`balance`/`frozenBalance` 来自 **`FinWallet`**，`points` 为 **`MktPointsAccount.availablePoints`**（`user.service.ts`）。
- **2026-03-26（Step 3 第三波）**：门店订单**部分退款**回退已结算佣金改为 **`WalletService.reverseSettledCommissionForOrderRefund`**（`store-order.service.ts` + `wallet.repository`/`wallet.service`）。
