# Process Spec: 新人专享活动

> 模板级别：**Full**（涉及幂等性）

---

## 0. Meta

| 项目         | 值                                  |
| ------------ | ----------------------------------- |
| 流程名称     | 新人专享活动（礼包发放 + 价格覆盖） |
| 流程编号     | NEWCOMER_EXCLUSIVE_V1               |
| 负责人       | -                                   |
| 最后修改     | 2026-03-23                          |
| 影响系统     | Mini / Admin                        |
| 是否核心链路 | 是                                  |
| Spec 级别    | Full                                |

---

## 1. Why（流程目标）

- 新用户绑定手机号后自动发放优惠券礼包，提升转化率
- 新人可享受 SKU 级别的专享价格
- 不做这一步：新用户无差异化营销，转化率低
- 不可接受的错误：重复发放礼包、非新人享受新人价

---

## 2. Input Contract

### 2.1 管理端 - 创建活动

```typescript
interface CreateActivityInput {
  type: string; // 活动类型，必须为已注册类型
  name: string; // 活动名称，≤100字符
  description?: string; // 活动描述，≤500字符
  triggerCondition: object; // 触发条件 JSON
  rules: object; // 规则 JSON
  rewards: object; // 奖励 JSON
  startTime?: Date; // 开始时间
  endTime?: Date; // 结束时间
  isEnabled?: boolean; // 是否启用，默认 true
}
```

### 输入规则

| 字段                      | 规则                                | Rule ID      |
| ------------------------- | ----------------------------------- | ------------ |
| type                      | 必填，≤50字符，必须为已注册活动类型 | R-IN-NWCM-01 |
| name                      | 必填，≤100字符                      | R-IN-NWCM-02 |
| triggerCondition          | 必填，JSON 对象                     | R-IN-NWCM-03 |
| rules                     | 必填，JSON 对象                     | R-IN-NWCM-04 |
| rewards                   | 必填，JSON 对象                     | R-IN-NWCM-05 |
| rewards.couponTemplateIds | 新人专享时必须非空数组              | R-IN-NWCM-06 |
| triggerCondition.userType | 新人专享时必须为 'NEW'              | R-IN-NWCM-07 |

### 2.2 客户端 - 领取礼包 / 检查资格

输入仅 `memberId`（从 Token 解析），无额外参数。

---

## 3. PreConditions

| 编号 | 前置条件                              | 失败响应         | Rule ID       |
| ---- | ------------------------------------- | ---------------- | ------------- |
| P1   | 活动类型已注册 Handler                | 400 不支持的类型 | R-PRE-NWCM-01 |
| P2   | 活动存在且启用                        | 静默跳过         | R-PRE-NWCM-02 |
| P3   | 用户未参与过该活动（幂等）            | 静默跳过         | R-PRE-NWCM-03 |
| P4   | 用户已绑定手机号（requirePhone=true） | 静默跳过         | R-PRE-NWCM-04 |
| P5   | 活动 ID 存在（管理端 CRUD）           | 400 活动不存在   | R-PRE-NWCM-05 |

---

## 4. Happy Path（主干流程）

### 4.1 礼包发放

| 步骤 | 操作                    | 产出            | Rule ID        |
| ---- | ----------------------- | --------------- | -------------- |
| S1   | 查询启用的新人专享活动  | 活动配置        | R-FLOW-NWCM-01 |
| S2   | 校验用户资格            | eligible = true | R-FLOW-NWCM-02 |
| S3   | 创建 Participation 记录 | 幂等防重        | R-FLOW-NWCM-03 |
| S4   | 遍历发放优惠券          | 券到账          | R-FLOW-NWCM-04 |

### 4.2 价格覆盖

| 步骤 | 操作                   | 产出              | Rule ID        |
| ---- | ---------------------- | ----------------- | -------------- |
| S5   | 查询用户 Participation | 确认是新人        | R-FLOW-NWCM-05 |
| S6   | 查询 SKU newcomerPrice | 返回新人价或 null | R-FLOW-NWCM-06 |

### 4.3 管理端 CRUD

| 步骤 | 操作                   | 产出           | Rule ID        |
| ---- | ---------------------- | -------------- | -------------- |
| S7   | 创建活动（含配置校验） | 活动记录       | R-FLOW-NWCM-07 |
| S8   | 更新活动               | 更新后的活动   | R-FLOW-NWCM-08 |
| S9   | 启停活动               | isEnabled 翻转 | R-FLOW-NWCM-09 |
| S10  | 查询活动列表/详情      | 分页/单条      | R-FLOW-NWCM-10 |

---

## 5. Branch Rules（分支规则）

| 编号 | 触发条件                       | 行为                   | Rule ID          |
| ---- | ------------------------------ | ---------------------- | ---------------- |
| B1   | 活动不存在或未启用             | 静默返回，不发放       | R-BRANCH-NWCM-01 |
| B2   | 用户已领取过                   | 幂等跳过               | R-BRANCH-NWCM-02 |
| B3   | 用户未绑手机号                 | 不满足资格，跳过       | R-BRANCH-NWCM-03 |
| B4   | SKU 无新人价                   | 返回 null，使用原价    | R-BRANCH-NWCM-04 |
| B5   | 用户无 Participation（非新人） | 返回 null，使用原价    | R-BRANCH-NWCM-05 |
| B6   | 单张券发放失败                 | 记录日志，继续发放其余 | R-BRANCH-NWCM-06 |

---

## 6. State Machine

本模块无复杂状态机。Participation 记录为一次性写入，无状态转换。

---

## 7. Exception Strategy

| 场景                    | 策略         | 补偿操作         | Rule ID       |
| ----------------------- | ------------ | ---------------- | ------------- |
| 单张券发放失败          | 降级（继续） | 记录日志         | R-TXN-NWCM-01 |
| onPhoneBound 整体异常   | 静默降级     | 不阻断绑定主流程 | R-TXN-NWCM-02 |
| 创建 Participation 失败 | 事务回滚     | 不发放券         | R-TXN-NWCM-03 |

---

## 8. Idempotency

| 项目         | 规则                                  | Rule ID          |
| ------------ | ------------------------------------- | ---------------- |
| 幂等键       | `@@unique([activityId, memberId])`    | R-PRE-NWCM-03    |
| 重复请求行为 | checkEligibility 返回 false，静默跳过 | —                |
| 并发控制     | DB 唯一约束兜底                       | R-CONCUR-NWCM-01 |

---

## 9. Observability

| 要求     | 说明                                   | Rule ID       |
| -------- | -------------------------------------- | ------------- |
| 发放日志 | 记录 memberId、activityId、发放数量    | R-LOG-NWCM-01 |
| 失败日志 | 单券失败记录 templateId + error        | R-LOG-NWCM-02 |
| 异常日志 | onPhoneBound 异常记录 memberId + error | R-LOG-NWCM-03 |

---

## 10. Test Mapping

### 输入校验（R-IN-\*）

| Rule ID      | 测试 ID | Given                          | When     | Then                    |
| ------------ | ------- | ------------------------------ | -------- | ----------------------- |
| R-IN-NWCM-01 | TC-01   | type 为未注册类型              | 创建活动 | 400 不支持的活动类型    |
| R-IN-NWCM-06 | TC-02   | rewards.couponTemplateIds 为空 | 创建活动 | 400 必须配置优惠券模板  |
| R-IN-NWCM-07 | TC-03   | userType 不为 NEW              | 创建活动 | 400 userType 必须为 NEW |

### 前置条件（R-PRE-\*）

| Rule ID       | 测试 ID | Given          | When     | Then           |
| ------------- | ------- | -------------- | -------- | -------------- |
| R-PRE-NWCM-02 | TC-04   | 活动未启用     | 领取礼包 | 静默跳过       |
| R-PRE-NWCM-03 | TC-05   | 用户已领取过   | 领取礼包 | 幂等跳过       |
| R-PRE-NWCM-04 | TC-06   | 用户未绑手机号 | 领取礼包 | 不满足资格     |
| R-PRE-NWCM-05 | TC-07   | 活动 ID 不存在 | 更新活动 | 400 活动不存在 |

### 主干流程（R-FLOW-\*）

| Rule ID        | 测试 ID | Given                  | When     | Then                 |
| -------------- | ------- | ---------------------- | -------- | -------------------- |
| R-FLOW-NWCM-01 | TC-08   | 活动存在且启用         | 触发发放 | 查到活动配置         |
| R-FLOW-NWCM-02 | TC-09   | 新用户+已绑手机+未领取 | 校验资格 | eligible = true      |
| R-FLOW-NWCM-03 | TC-10   | 资格通过               | 创建参与 | Participation 已创建 |
| R-FLOW-NWCM-04 | TC-11   | 3张券模板              | 发放奖励 | 3张券全部发放        |
| R-FLOW-NWCM-05 | TC-12   | 用户有 Participation   | 查新人价 | 继续查 SKU 价格      |
| R-FLOW-NWCM-06 | TC-13   | SKU 有 newcomerPrice   | 查新人价 | 返回新人价           |
| R-FLOW-NWCM-07 | TC-14   | 合法配置               | 创建活动 | 活动创建成功         |
| R-FLOW-NWCM-09 | TC-15   | 活动已启用             | 启停活动 | isEnabled = false    |
| R-FLOW-NWCM-10 | TC-16   | 有活动数据             | 查询列表 | 返回分页数据         |

### 分支规则（R-BRANCH-\*）

| Rule ID          | 测试 ID | Given                | When     | Then            |
| ---------------- | ------- | -------------------- | -------- | --------------- |
| R-BRANCH-NWCM-01 | TC-17   | 活动不存在           | 触发发放 | 静默返回        |
| R-BRANCH-NWCM-02 | TC-18   | 已领取过             | 触发发放 | 幂等跳过        |
| R-BRANCH-NWCM-03 | TC-19   | 未绑手机号           | 触发发放 | 不发放          |
| R-BRANCH-NWCM-04 | TC-20   | SKU 无新人价         | 查新人价 | 返回 null       |
| R-BRANCH-NWCM-05 | TC-21   | 非新人（无参与记录） | 查新人价 | 返回 null       |
| R-BRANCH-NWCM-06 | TC-22   | 1/3 券发放失败       | 发放奖励 | 继续发放其余2张 |

### 异常与事务（R-TXN-\*）

| Rule ID       | 测试 ID | Given                  | When         | Then             |
| ------------- | ------- | ---------------------- | ------------ | ---------------- |
| R-TXN-NWCM-01 | TC-23   | 单张券发放异常         | grantRewards | 记录日志，不中断 |
| R-TXN-NWCM-02 | TC-24   | doTriggerActivity 异常 | onPhoneBound | 不阻断绑定流程   |

### 可观测性（R-LOG-\*）

| Rule ID       | 测试 ID | Given    | When         | Then                |
| ------------- | ------- | -------- | ------------ | ------------------- |
| R-LOG-NWCM-01 | TC-25   | 发放成功 | grantRewards | 日志含 grantedCount |
| R-LOG-NWCM-02 | TC-26   | 单券失败 | grantRewards | 日志含 templateId   |
