# 平台抽成实际情况说明

## ❗ 重要结论

**平台抽成在当前系统中并未实际实现，只是在测试脚本中演示了概念。**

---

## 🔍 实际情况

### 测试脚本中的"平台抽成"

在 `apps/backend/test/e2e-marketing-flow.test.ts` 中，我们看到：

```typescript
// 计算平台和门店收入
const platformRate = 0.1; // 平台抽成 10%
const platformCommission = totalRevenue * platformRate;
const storeGrossRevenue = totalRevenue * (1 - platformRate); // 门店毛收入
const storeNetRevenue = storeGrossRevenue - totalCommission; // 门店净收入（扣除分佣）
```

**这只是计算和展示，并没有实际存储到数据库！**

### 系统中实际没有的功能

经过代码搜索，以下功能**都不存在**：

❌ **订单表中没有平台抽成字段**

```sql
-- 不存在这些字段
ALTER TABLE oms_order ADD COLUMN platform_commission DECIMAL(10,2);
ALTER TABLE oms_order ADD COLUMN store_revenue DECIMAL(10,2);
```

❌ **没有平台收入表**

```sql
-- 不存在这个表
CREATE TABLE fin_platform_income (
  id BIGINT PRIMARY KEY,
  order_id VARCHAR(50),
  tenant_id VARCHAR(50),
  amount DECIMAL(10,2),
  ...
);
```

❌ **租户表中没有抽成比例配置**

```sql
-- 不存在这个字段
ALTER TABLE sys_tenant ADD COLUMN commission_rate DECIMAL(5,2) DEFAULT 0.00;
```

❌ **订单创建时没有计算平台抽成**

```typescript
// 在 order.service.ts 中，创建订单时没有这个逻辑
const platformCommission = orderAmount * commissionRate; // ❌ 不存在
```

---

## 💰 实际的资金流向

### 当前系统的真实情况

```
消费者支付 ¥4,030
    ↓
┌─────────────────────────────────────────┐
│  订单总收入 ¥4,030                      │
├─────────────────────────────────────────┤
│  ├─ 平台抽成：¥0 ❌ 未实现              │
│  └─ 门店收入：¥4,030 ✅ 100%           │
│     ├─ 分佣支出：¥442 ✅ 已实现         │
│     └─ 门店净利润：¥3,588 ✅           │
└─────────────────────────────────────────┘
```

### 各方实际收入

| 角色                 | 实际收入 | 占比 | 状态        |
| -------------------- | -------- | ---- | ----------- |
| **平台方（000000）** | ¥0       | 0%   | ❌ 未实现   |
| **门店（100001）**   | ¥3,588   | 89%  | ✅ 实际收入 |
| **推荐人（张三）**   | ¥238     | 5.9% | ✅ 已实现   |
| **推荐人（李四）**   | ¥136     | 3.4% | ✅ 已实现   |
| **推荐人（王五）**   | ¥68      | 1.7% | ✅ 已实现   |
| **总计**             | ¥4,030   | 100% | -           |

**注意**：门店实际净利润是 ¥3,588（¥4,030 - ¥442），而不是测试脚本中显示的 ¥3,185。

---

## 🎯 平台抽成的钱去哪了？

### 答案：没有平台抽成！

**当前系统是纯 SaaS 工具模式**：

1. **平台方（租户 000000）的收入来源**：

   - ✅ 租户订阅费（月费/年费）
   - ✅ 增值服务费
   - ❌ 交易抽成（未实现）

2. **门店（普通租户）获得**：

   - ✅ 100% 订单收入
   - ❌ 不需要支付交易抽成
   - ✅ 只需支付分佣给推荐人

3. **超级管理员租户（000000）的作用**：
   - ✅ 系统管理员
   - ✅ 可以查看所有租户数据
   - ✅ 可以管理所有租户
   - ❌ 不从交易中抽成

---

## 📊 测试脚本中的"平台抽成"是什么？

### 只是演示概念

测试脚本中的平台抽成计算：

```typescript
// 场景 4: 计算分佣（详细版）
const platformRate = 0.1; // 平台抽成 10%
const platformCommission = totalRevenue * platformRate;
const storeGrossRevenue = totalRevenue * (1 - platformRate);
const storeNetRevenue = storeGrossRevenue - totalCommission;

// 输出
console.log('💰 金额流向详解：');
console.log(`   订单总收入：¥${totalRevenue.toFixed(2)}`);
console.log(`   ├─ 平台抽成（10%）：¥${platformCommission.toFixed(2)}`);
console.log(`   └─ 门店收入（90%）：¥${storeGrossRevenue.toFixed(2)}`);
console.log(`      ├─ 分佣支出：¥${totalCommission.toFixed(2)}`);
console.log(`      └─ 门店净利润：¥${storeNetRevenue.toFixed(2)}`);
```

**这只是为了演示如果有平台抽成，金额会如何分配。**

### 为什么要演示？

1. **教育目的**：让你了解平台抽成的概念
2. **未来扩展**：如果将来要实现，可以参考这个计算逻辑
3. **完整性**：展示一个完整的商业模式

---

## 🛠️ 如果要实现平台抽成

### 需要做的事情

#### 1. 数据库改造

```sql
-- 1. 订单表添加字段
ALTER TABLE oms_order
ADD COLUMN platform_commission DECIMAL(10,2) DEFAULT 0.00 COMMENT '平台抽成',
ADD COLUMN store_revenue DECIMAL(10,2) DEFAULT 0.00 COMMENT '门店收入';

-- 2. 创建平台收入表
CREATE TABLE fin_platform_income (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id VARCHAR(50) NOT NULL COMMENT '订单ID',
  tenant_id VARCHAR(50) NOT NULL COMMENT '来源租户',
  order_amount DECIMAL(10,2) NOT NULL COMMENT '订单金额',
  rate DECIMAL(5,2) NOT NULL COMMENT '抽成比例',
  amount DECIMAL(10,2) NOT NULL COMMENT '抽成金额',
  status VARCHAR(20) DEFAULT 'PENDING' COMMENT '状态：PENDING/SETTLED',
  settle_time DATETIME COMMENT '结算时间',
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_status (tenant_id, status),
  INDEX idx_order (order_id)
) COMMENT '平台收入表';

-- 3. 租户表添加抽成配置
ALTER TABLE sys_tenant
ADD COLUMN commission_rate DECIMAL(5,2) DEFAULT 0.00 COMMENT '抽成比例（%）',
ADD COLUMN commission_mode VARCHAR(20) DEFAULT 'NONE' COMMENT '抽成模式：NONE/FIXED/TIERED';
```

#### 2. 业务逻辑改造

```typescript
// apps/backend/src/module/client/order/order.service.ts

async createOrder(dto: CreateOrderDto) {
  // 1. 获取租户抽成配置
  const tenant = await this.tenantService.findOne(dto.tenantId);
  const commissionRate = Number(tenant.commissionRate) / 100;

  // 2. 计算金额分配
  const orderAmount = dto.totalAmount;
  const platformCommission = orderAmount * commissionRate;
  const storeRevenue = orderAmount - platformCommission;

  // 3. 创建订单（包含抽成信息）
  const order = await this.prisma.omsOrder.create({
    data: {
      ...dto,
      platformCommission,
      storeRevenue,
    }
  });

  // 4. 如果有抽成，创建平台收入记录
  if (platformCommission > 0) {
    await this.prisma.finPlatformIncome.create({
      data: {
        orderId: order.id,
        tenantId: dto.tenantId,
        orderAmount,
        rate: tenant.commissionRate,
        amount: platformCommission,
        status: 'PENDING',
      }
    });
  }

  return order;
}
```

#### 3. 结算流程

```typescript
// apps/backend/src/module/finance/platform-income/platform-income.scheduler.ts

@Cron('0 0 2 * * *') // 每天凌晨2点执行
async settlePlatformIncome() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const pendingIncomes = await this.prisma.finPlatformIncome.findMany({
    where: {
      status: 'PENDING',
      createTime: { lte: sevenDaysAgo }
    }
  });

  for (const income of pendingIncomes) {
    await this.prisma.finPlatformIncome.update({
      where: { id: income.id },
      data: {
        status: 'SETTLED',
        settleTime: new Date(),
      }
    });
  }

  this.logger.log(`结算了 ${pendingIncomes.length} 条平台收入记录`);
}
```

#### 4. 管理后台

```typescript
// 超级管理员查看平台收入
async getPlatformIncome(startDate: Date, endDate: Date) {
  const income = await this.prisma.finPlatformIncome.aggregate({
    _sum: { amount: true },
    _count: true,
    where: {
      status: 'SETTLED',
      createTime: { gte: startDate, lte: endDate }
    }
  });

  return {
    totalAmount: income._sum.amount,
    orderCount: income._count,
  };
}
```

---

## 💡 建议

### 当前阶段（推荐）

**不实现平台抽成**，理由：

1. ✅ **简化系统**：减少复杂度，专注核心功能
2. ✅ **吸引商家**：100%收入归门店，更有吸引力
3. ✅ **快速验证**：先验证商业模式，再考虑抽成
4. ✅ **降低门槛**：商家更愿意尝试

**平台收入来源**：

- 租户订阅费（月费/年费）
- 增值服务（高级功能、数据分析等）
- 技术服务费

### 未来阶段（可选）

当系统成熟后，可以考虑：

1. **低比例抽成**（3-5%）

   - 提供支付通道
   - 提供营销工具
   - 提供流量支持

2. **分级抽成**

   - 新商家：0%（前3个月）
   - 普通商家：3%
   - 大商家：5%（交易量大）

3. **可选抽成**
   - 不抽成：订阅费 ¥999/月
   - 抽成 3%：订阅费 ¥299/月

---

## 📝 总结

### 关键要点

1. **平台抽成未实现**：测试脚本中只是演示概念
2. **门店获得 100% 收入**：扣除分佣后，全部归门店
3. **超级管理员租户（000000）**：是系统管理员，不是收入接收方
4. **平台收入来源**：订阅费 + 增值服务，不是交易抽成

### 实际金额分配

```
订单总收入：¥4,030
├─ 分佣支出：¥442（给推荐人）
└─ 门店净收入：¥3,588（100%归门店）

平台收入：¥0（从交易中）
平台收入：订阅费（从租户订阅）
```

### 如果要实现平台抽成

需要：

1. 数据库改造（3个表）
2. 业务逻辑改造（订单创建、结算）
3. 管理后台（收入统计、报表）
4. 财务合规（资金监管、税务）

**工作量估计**：2-3周开发 + 1周测试

---

## 相关文档

- [端到端测试指南](../testing/e2e-test-guide.md) - 测试说明
- [完整业务流程](../references/complete-business-flow.md) - 业务流程

---

**最后更新**：2026-02-08
**状态**：平台抽成未实现，当前为纯 SaaS 模式
