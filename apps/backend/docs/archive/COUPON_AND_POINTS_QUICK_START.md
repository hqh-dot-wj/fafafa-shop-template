# 优惠券和积分系统快速开始

## 🚀 快速开始

### 1. 数据库迁移

```bash
cd apps/backend

# 生成 Prisma Client
npx prisma generate

# 同步数据库
npx prisma db push
```

### 2. 启动服务

```bash
# 确保 Redis 服务已启动（分布式锁需要）
redis-server

# 启动后端服务
npm run start:dev
```

### 3. 访问 API 文档

打开浏览器访问: `http://localhost:3000/api-docs`

## 📝 常见使用场景

### 场景1: 创建并发放优惠券

#### Step 1: 创建优惠券模板

```http
POST /admin/marketing/coupon/templates
Content-Type: application/json

{
  "name": "新用户专享券",
  "description": "新用户首单立减10元",
  "type": "DISCOUNT",
  "discountAmount": 10,
  "minOrderAmount": 50,
  "totalStock": 1000,
  "limitPerUser": 1,
  "validityType": "FIXED",
  "validDays": 30,
  "status": "ACTIVE"
}
```

#### Step 2: 用户领取优惠券

```http
POST /client/marketing/coupon/claim/:templateId
```

#### Step 3: 查询我的优惠券

```http
GET /client/marketing/coupon/my-coupons?status=UNUSED
```

### 场景2: 配置积分规则

#### Step 1: 配置积分规则

```http
PUT /admin/marketing/points/rules
Content-Type: application/json

{
  "orderPointsEnabled": true,
  "orderPointsRatio": 1,
  "orderPointsBase": 1,
  "signinPointsEnabled": true,
  "signinPointsAmount": 10,
  "pointsRedemptionEnabled": true,
  "pointsRedemptionRatio": 100,
  "pointsRedemptionBase": 1,
  "maxDiscountPercentOrder": 50
}
```

#### Step 2: 用户签到获取积分

```http
POST /client/marketing/points/signin
```

#### Step 3: 查询积分余额

```http
GET /client/marketing/points/balance
```

### 场景3: 下单使用优惠券和积分

#### Step 1: 计算订单优惠

```http
POST /client/order/calculate-discount
Content-Type: application/json

{
  "items": [
    {
      "productId": "prod_001",
      "productName": "商品A",
      "price": 100,
      "quantity": 2
    }
  ],
  "userCouponId": "coupon_xxx",
  "pointsUsed": 100
}
```

响应示例:

```json
{
  "code": 200,
  "data": {
    "originalAmount": 200,
    "couponDiscount": 10,
    "pointsDiscount": 1,
    "totalDiscount": 11,
    "finalAmount": 189,
    "userCouponId": "coupon_xxx",
    "pointsUsed": 100,
    "couponName": "新用户专享券"
  }
}
```

#### Step 2: 创建订单（在订单服务中调用）

```typescript
// 在订单创建时调用
await orderIntegrationService.handleOrderCreated(orderId, memberId, userCouponId, pointsUsed);
```

#### Step 3: 订单支付（在订单服务中调用）

```typescript
// 在订单支付成功时调用
await orderIntegrationService.handleOrderPaid(orderId, memberId, payAmount);
```

## 🔧 管理端功能

### 优惠券管理

```http
# 查询优惠券模板列表
GET /admin/marketing/coupon/templates?pageNum=1&pageSize=10

# 查询优惠券使用统计
GET /admin/marketing/coupon/statistics?templateId=xxx

# 导出优惠券使用记录
GET /admin/marketing/coupon/export?startTime=2024-01-01&endTime=2024-12-31

# 手动发放优惠券
POST /admin/marketing/coupon/distribute/manual
{
  "templateId": "template_xxx",
  "memberIds": ["member_001", "member_002"],
  "remark": "活动奖励"
}
```

### 积分管理

```http
# 查询积分发放统计
GET /admin/marketing/points/statistics/earn?startTime=2024-01-01

# 查询积分使用统计
GET /admin/marketing/points/statistics/use?startTime=2024-01-01

# 查询积分余额统计
GET /admin/marketing/points/statistics/balance

# 查询积分排行榜
GET /admin/marketing/points/ranking?limit=10

# 手动调整用户积分
POST /admin/marketing/points/adjust
{
  "memberId": "member_001",
  "amount": 100,
  "type": "EARN_ADMIN",
  "remark": "活动奖励"
}

# 导出积分明细
GET /admin/marketing/points/export?memberId=member_001
```

## 🎯 核心业务规则

### 优惠券规则

1. **库存控制**

   - 使用 Redis 分布式锁防止超发
   - 支持并发领取

2. **领取限制**

   - 每个用户最多领取 N 张（由模板配置）
   - 总库存限制

3. **使用条件**

   - 最低消费金额
   - 有效期验证
   - 状态验证

4. **优惠计算**
   - 满减券：直接减免固定金额
   - 折扣券：按百分比计算，不超过最高优惠
   - 兑换券：全额抵扣

### 积分规则

1. **获取积分**

   - 消费获得：每消费N元获得M积分
   - 签到获得：每日签到获得固定积分
   - 任务获得：完成任务获得积分
   - 管理员调整：手动增加积分

2. **使用积分**

   - 订单抵扣：N积分抵扣M元
   - 最低使用限制
   - 最大抵扣比例限制

3. **积分有效期**

   - 支持永久有效
   - 支持指定天数后过期
   - 定时任务自动处理过期积分

4. **并发安全**
   - 使用乐观锁（version字段）
   - 支持重试机制（最多3次）

### 订单集成规则

1. **优惠计算顺序**

   ```
   订单原价 → 优惠券抵扣 → 积分抵扣 → 最终金额
   ```

2. **状态流转**
   ```
   订单创建 → 锁定优惠券 + 冻结积分
   订单支付 → 使用优惠券 + 扣减积分 + 发放消费积分
   订单取消 → 解锁优惠券 + 解冻积分
   订单退款 → 退还优惠券 + 退还积分 + 扣减消费积分
   ```

## 🔍 常见问题

### Q1: 优惠券库存不足怎么办？

A: 系统会返回"优惠券已抢光"的错误，建议前端做好提示。

### Q2: 积分扣减失败怎么办？

A: 系统会自动重试3次，如果仍然失败会返回错误。建议检查：

- 用户积分余额是否足够
- 是否存在并发操作

### Q3: 定时任务没有执行怎么办？

A: 检查以下几点：

- 服务器时区是否正确
- `@nestjs/schedule` 模块是否正确导入
- 查看日志确认任务是否触发

### Q4: 如何测试并发场景？

A: 建议使用压力测试工具（如 Apache JMeter）模拟并发请求。

### Q5: 如何查看详细日志？

A: 所有关键操作都有日志记录，包含：

- 操作类型
- 关键ID（orderId, memberId, couponId等）
- 关键参数（amount, points等）
- 操作结果

## 📊 监控指标

建议监控以下指标：

### 优惠券指标

- 发放数量
- 使用数量
- 核销率
- 库存剩余
- 过期数量

### 积分指标

- 发放总量
- 使用总量
- 账户总余额
- 过期总量
- 冻结总量

### 性能指标

- API 响应时间
- 并发处理能力
- 分布式锁获取成功率
- 乐观锁冲突率

## 🛠️ 故障排查

### 1. 优惠券领取失败

**可能原因**:

- 库存不足
- 已达到领取上限
- 优惠券已停用
- Redis 连接失败

**排查步骤**:

1. 查看错误消息
2. 检查优惠券模板状态
3. 检查用户已领取数量
4. 检查 Redis 服务状态

### 2. 积分扣减失败

**可能原因**:

- 积分余额不足
- 乐观锁冲突
- 并发操作过多

**排查步骤**:

1. 查看用户积分余额
2. 查看日志中的重试次数
3. 检查是否有大量并发请求

### 3. 定时任务未执行

**可能原因**:

- 服务器时区不正确
- 模块未正确导入
- 服务未启动

**排查步骤**:

1. 检查服务器时区: `date`
2. 检查日志中是否有定时任务触发记录
3. 确认 `ScheduleModule.forRoot()` 已导入

## 📚 相关文档

- [营销模板与扩展](./MARKETING_TEMPLATES_AND_EXTENSIONS.md)
- [数据库设计文档](./coupon-and-points-database-schema.md)
- [开发规范](./QUICK_START.md)

## 🎉 总结

优惠券和积分系统已完整实现，支持：

- ✅ 完整的优惠券生命周期管理
- ✅ 灵活的积分规则配置
- ✅ 安全的并发控制
- ✅ 完善的订单集成
- ✅ 自动化的定时任务
- ✅ 详细的统计分析

系统已可以投入使用！
