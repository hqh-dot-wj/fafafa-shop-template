# Process Spec: 平台清结算对账中心

> 模板级别：**Full**（资金核对、异常处理、人工复核）
> 来源：已完成的财务全量改造过程稿，收敛日期 2026-05-10

---

## 0. Meta

| 项目         | 值                                             |
| ------------ | ---------------------------------------------- |
| 流程名称     | 平台清结算对账中心                             |
| 流程编号     | FIN_RECONCILIATION_CENTER_V1                   |
| 负责人       | Finance Team                                   |
| 最后修改     | 2026-05-10                                     |
| 影响系统     | Backend / Admin-Web                            |
| 是否核心链路 | 是                                             |
| Spec 级别    | Full                                           |

---

## 1. Why（流程目标）

平台清结算只处理门店、租户、合作方应收资金的计算、审核、执行和对账，不处理 L1/L2 佣金入账或个人钱包提现。

对账中心的目标是：

- 把渠道账单、支付单、应结算单、结算执行单放到同一核对链路。
- 将“对账中心”作为目录，拆分为渠道账单、对账批次、核对结果、待复核记录、异常账单五个页面。
- 发现系统账与外部通道账不一致时，先进入缓冲复核，再按规则升级为正式异常或忽略。
- 保留旧对账异常接口兼容，但新增页面应使用目录化后的对账中心语义。

不可接受的错误：

- 将对账中心继续实现成单个异常列表页。
- 把个人提现对账和平台清结算对账混在同一业务语义内。
- 对账异常被静默吞掉，缺少复核、处理人、处理结果和可追溯记录。

---

## 2. 领域边界

| 对象             | 定义                                                         | 不负责什么                         |
| ---------------- | ------------------------------------------------------------ | ---------------------------------- |
| 支付单           | 第三方支付通道的真实收款记录                                 | 不表达应向谁打款                   |
| 应结算单         | 系统内部算账结果，记录订单应如何拆分                         | 不等同于渠道账单                   |
| 结算执行单       | 实际发起打款或线下处理的一次执行记录                         | 不重新计算订单金额                 |
| 渠道账单         | 外部通道导入或同步的账单批次与明细                           | 不作为系统内部事实源               |
| 对账批次         | 一次核对任务，连接渠道账单、支付单、应结算单和结算执行单       | 不直接处理异常                     |
| 核对结果         | 单条核对产物，表达匹配、金额差异、状态差异或缺失关系           | 不承载人工处理结论                 |
| 待复核记录       | 暂不能自动判定的缓冲记录                                     | 不等同于正式异常                   |
| 异常账单         | 已确认需要人工处理和闭环的正式异常                           | 不覆盖普通查询和统计               |

---

## 3. Input Contract

```typescript
interface ImportStatementInput {
  channelType: 'WECHAT_PROFITSHARING' | 'WECHAT_TRANSFER' | 'BANK_TRANSFER' | 'OFFLINE_TRANSFER' | string;
  statementDate: string;
  fileKey?: string;
  rawPayload?: unknown;
  operatorId: string;
}

interface RunReconciliationInput {
  channelType?: string;
  statementBatchId?: string;
  reconcileDate?: string;
  operatorId: string;
}

interface HandleReconciliationBufferInput {
  bufferId: string;
  action: 'recheck' | 'ignore' | 'escalate';
  remark?: string;
  operatorId: string;
}

interface HandleReconciliationIssueInput {
  issueId: string;
  result: string;
  remark?: string;
  operatorId: string;
}
```

### 输入规则

| 字段             | 规则                                           | Rule ID        |
| ---------------- | ---------------------------------------------- | -------------- |
| channelType      | 必须是受支持的支付或执行通道                   | R-IN-RECON-01  |
| statementDate    | 导入渠道账单时必填                             | R-IN-RECON-02  |
| statementBatchId | 重解析、重跑或批次详情场景必填                 | R-IN-RECON-03  |
| bufferId         | 缓冲池复核、忽略、升级异常时必填               | R-IN-RECON-04  |
| issueId          | 异常处理时必填                                 | R-IN-RECON-05  |
| operatorId       | 所有人工动作必填，且应写入操作日志或处理记录   | R-IN-RECON-06  |

---

## 4. Happy Path（主干流程）

### 4.1 渠道账单导入与标准化

| 步骤 | 操作                         | 产出             | Rule ID          |
| ---- | ---------------------------- | ---------------- | ---------------- |
| S1   | 校验通道、日期、文件或载荷   | 合法导入请求     | R-FLOW-RECON-01  |
| S2   | 创建渠道账单批次             | statement batch  | R-FLOW-RECON-02  |
| S3   | 解析渠道账单明细             | statement lines  | R-FLOW-RECON-03  |
| S4   | 记录解析结果、失败原因和数量 | 可追溯导入结果   | R-FLOW-RECON-04  |

### 4.2 发起对账批次

| 步骤 | 操作                                               | 产出             | Rule ID          |
| ---- | -------------------------------------------------- | ---------------- | ---------------- |
| S1   | 选择渠道账单批次或日期范围                         | 对账输入         | R-FLOW-RECON-05  |
| S2   | 批量读取支付单、应结算单、结算执行单和渠道账单明细 | 候选事实集合     | R-FLOW-RECON-06  |
| S3   | 按交易号、订单号、执行单号或批次规则匹配           | 对账结果         | R-FLOW-RECON-07  |
| S4   | 生成核对结果                                       | result records   | R-FLOW-RECON-08  |
| S5   | 无法自动判定的记录写入缓冲池                       | buffer records   | R-FLOW-RECON-09  |
| S6   | 明确异常写入异常账单                               | issue records    | R-FLOW-RECON-10  |

### 4.3 待复核与异常处理

| 步骤 | 操作                     | 产出             | Rule ID          |
| ---- | ------------------------ | ---------------- | ---------------- |
| S1   | 财务查看待复核记录       | 缓冲详情         | R-FLOW-RECON-11  |
| S2   | 选择立即复核             | 重新核对结果     | R-FLOW-RECON-12  |
| S3   | 选择忽略                 | 缓冲记录关闭     | R-FLOW-RECON-13  |
| S4   | 选择升级异常             | 正式异常账单     | R-FLOW-RECON-14  |
| S5   | 财务处理正式异常         | 处理结果和备注   | R-FLOW-RECON-15  |

---

## 5. State And UI Contract

平台清结算后台菜单中，`对账中心` 必须是目录，不是单页面。目录下保留五类页面：

1. 渠道账单
2. 对账任务
3. 核对结果
4. 待复核记录
5. 异常账单

对账异常的长期状态语义：

```text
WAITING -> HANDLED
MATCHED / UNMATCHED 用于核对结果或中间判定，不应直接替代人工处理结论。
```

---

## 6. Branch Rules（分支规则）

| 编号 | 触发条件                         | 行为                             | Rule ID            |
| ---- | -------------------------------- | -------------------------------- | ------------------ |
| B1   | 渠道账单解析失败                 | 记录失败原因，批次不可进入核对   | R-BRANCH-RECON-01  |
| B2   | 重复导入同一账单                 | 阻止或生成可追溯的新解析版本     | R-BRANCH-RECON-02  |
| B3   | 支付单存在但渠道账单缺失         | 生成待复核或异常                 | R-BRANCH-RECON-03  |
| B4   | 渠道账单存在但系统支付单缺失     | 生成待复核或异常                 | R-BRANCH-RECON-04  |
| B5   | 金额不一致                       | 生成核对结果并进入复核/异常链路  | R-BRANCH-RECON-05  |
| B6   | 执行状态和外部通道状态不一致     | 生成核对结果并进入复核/异常链路  | R-BRANCH-RECON-06  |
| B7   | 缓冲记录被忽略                   | 必须记录操作人和原因             | R-BRANCH-RECON-07  |
| B8   | 异常已处理后重复处理             | 拒绝或返回幂等结果               | R-BRANCH-RECON-08  |

---

## 7. Idempotency And Concurrency

| 项目         | 规则                                                       | Rule ID            |
| ------------ | ---------------------------------------------------------- | ------------------ |
| 导入幂等     | 以通道、账单日期、文件指纹或外部批次号识别重复导入         | R-CONCUR-RECON-01  |
| 对账批次幂等 | 同一渠道与日期范围不应并发生成多个互相覆盖的进行中批次     | R-CONCUR-RECON-02  |
| 缓冲处理幂等 | 待复核记录关闭后不得再次升级异常                           | R-CONCUR-RECON-03  |
| 异常处理幂等 | 已处理异常不得重复改变最终处理结论                         | R-CONCUR-RECON-04  |

---

## 8. Observability（可观测性要求）

| 要求         | 说明                                           | Rule ID        |
| ------------ | ---------------------------------------------- | -------------- |
| 导入日志     | 记录通道、账单日期、明细数量、失败数量         | R-LOG-RECON-01 |
| 对账批次日志 | 记录批次、候选数量、匹配数量、异常数量         | R-LOG-RECON-02 |
| 人工处理日志 | 待复核和异常处理必须记录操作人、动作、备注     | R-LOG-RECON-03 |
| 性能指标     | 大批量导入和对账应记录耗时，避免阻塞主链路     | R-LOG-RECON-04 |

---

## 9. Test Mapping（测试用例映射）

| Rule ID             | 测试建议                                   |
| ------------------- | ------------------------------------------ |
| R-IN-RECON-01~06    | 参数缺失、非法通道、非法批次 ID            |
| R-FLOW-RECON-01~04  | 渠道账单导入、解析失败、重复导入           |
| R-FLOW-RECON-05~10  | 发起对账、匹配、金额差异、状态差异         |
| R-FLOW-RECON-11~15  | 缓冲复核、忽略、升级异常、异常处理         |
| R-CONCUR-RECON-*    | 重复批次、并发处理、已处理后重复操作       |
| R-LOG-RECON-*       | 导入、对账、人工处理日志和处理人记录       |

推荐验证链路：

```powershell
pnpm typecheck:backend
pnpm typecheck:admin
pnpm verify:admin-view-types
```
