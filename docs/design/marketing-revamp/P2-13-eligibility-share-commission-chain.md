# P2-13 资格 / 分享 / 分佣三段联动（强校验 + 资格变更同步 DISABLE sid + 已成单分佣保留）

**owner**: 待指派 / 后端
**status**: draft
**last_verified**: 2026-05-15
**related**: [[P0-01-attribution-config]]、[[P0-04-cart-bind-sid]]、[[P1-05-merge-activity-campaign]]

---

> **跨文档硬约束**：本设计涉及金额字段（commission 计算）全链路遵循 [[P0-00-money-precision]]。幂等键格式遵循 [[P2-14-idempotency-key-convention]]；`sid='AGGREGATE'` hack 由 P2-14 §3.4 正式废弃，改 sid nullable + partial unique。

## 1. 目标与范围

### 1.1 目标

分销链路三个核心实体——**资格档案**（`SysDistDistributorProfile`）、**分享令牌**（`SysDistShareToken`）、**佣金记录**（`FinCommission`）——当前是三段独立流转：

- 资格档案被 admin 冻结 / 撤销时，**对应的分享令牌不会同步状态**；用户仍可继续点该 sid 加车，下单后产生的归因数据指向一个"已无资格的 share user"，commission 计算时再补一次资格校验（散乱）。
- `tryBindMember`（`share-token.service.ts:499`）只校验 `shareUserId !== memberId` 与 `circular`，**不校验 share user 是否仍有 ACTIVE 资格档案**。
- 已存在的 FinCommission 是否要在资格被撤销后冲销？当前代码无定义；运营投诉"分销员被冻结，但 1 个月前的订单还在结算佣金"。

修复方式：

- **强校验**：share token 创建、cart 绑 sid、订单创建、commission 计算 4 个入口统一调 `DistributorEligibilityService.assertActive(shareUserId, tenantId)`，资格不存在/非 ACTIVE → 当场拒绝（除 commission 计算外，详见 §3）。
- **资格变更联动**：admin 把 `SysDistDistributorProfile.status` 从 ACTIVE 改 FROZEN/REVOKED 时，同步把该 share user 的 active `SysDistShareToken` 全部 `status=DISABLED`；写 `SysDistShareEvent.eventType=MANUAL_DISABLE` 审计。
- **已成单分佣保留**：对应订单 `FinCommission` 不冲销（已审计完成的财务事实），但**新订单 commission 计算时拒绝**（rejectReason = `SHARE_USER_NOT_ELIGIBLE`）。

### 1.2 范围

- ✅ 新建 `DistributorEligibilityService.assertActive(shareUserId, tenantId)`。
- ✅ 4 个入口接入：`createShareToken` / cart addToCart sid 验证 / order creation attribution 写入 / commission 计算 trigger。
- ✅ Admin profile 状态变更路径（grep `sysDistDistributorProfile.update`）增加联动：批量 DISABLE 该 user 的 active token + 写 event。
- ✅ 已成单 commission 不冲销（明确写入文档；代码上是默认行为，不需要改）。
- ❌ 不动 `FinCommission` 表结构。
- ❌ 不动 `SysDistRelation` 团队关系（团队归属在另一条线）。
- ❌ 不重做佣金计算公式。

### 1.3 DoD

1. 4 个入口的 assertActive 调用点 grep 可见；缺一即视为漏。
2. Admin 把 distributor profile 设为 FROZEN/REVOKED 后，其 `sys_dist_share_token.status` 全部从 ACTIVE → DISABLED；该 user 的新分享请求被拒。
3. 历史 `FinCommission` 行不被自动改动；admin 端运营页面可见"分销员已冻结 + 历史佣金仍结算中"的合理状态。
4. 集成测试覆盖：freeze profile → 试创建 token 400；旧 token 转 DISABLED；旧订单 commission 仍能进入结算流程。

---

## 2. 现状取证

### 2.1 三段实体（参见 `40-distribution.prisma`）

- `SysDistDistributorProfile`（line 489-509）：分销员档案，状态 `DistDistributorProfileStatus { ACTIVE / FROZEN / REVOKED }`。
- `SysDistShareToken`（line 200-234）：分享令牌，状态 `DistShareTokenStatus { ACTIVE / DISABLED / EXPIRED }`，含 shareUserId。
- `FinCommission`：佣金行（在 `60-finance.prisma`），含 distributorMemberId / orderId。

### 2.2 当前 share token 创建未校验资格

```ts
// share-token.service.ts:310-352  createToken
async createToken(input: CreateShareTokenInput) {
  const shareMember = await this.prisma.umsMember.findFirst({ ... });
  // ✓ 校验 member 存在
  // ✓ 校验 tenantId 匹配
  // ✓ 校验 sharePolicy 启用
  // ❌ 不校验 SysDistDistributorProfile.status === ACTIVE
  return await this.prisma.sysDistShareToken.create({ ... });
}
```

### 2.3 cart / order 不校验资格

[[P0-04]] cart 加 sid 时仅校验 sid token 自身 status=ACTIVE，**不再回查 shareUser 是否仍有 active profile**；下单时同理。

### 2.4 commission 路径

`triggerCalculation` 在 [[P0-02]] 已挪到 PAID worker；该 service 内部当前 grep（搜 `eligibility` / `profile.status`）应能确认是否做了校验，本设计**假设没有**（实施期再 confirm）。

---

## 3. 设计方案

### 3.1 `DistributorEligibilityService`

```ts
@Injectable()
export class DistributorEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async isActive(shareUserId: string, tenantId: string): Promise<boolean> {
    if (!shareUserId) return false;
    const profile = await this.prisma.sysDistDistributorProfile.findFirst({
      where: { tenantId, memberId: shareUserId },
      select: { status: true },
    });
    return profile?.status === 'ACTIVE';
  }

  async assertActive(shareUserId: string, tenantId: string): Promise<void> {
    if (!(await this.isActive(shareUserId, tenantId))) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, '分销员资格不可用，无法继续操作');
    }
  }

  async filterActive(shareUserIds: string[], tenantId: string): Promise<Set<string>> {
    if (shareUserIds.length === 0) return new Set();
    const rows = await this.prisma.sysDistDistributorProfile.findMany({
      where: { tenantId, memberId: { in: shareUserIds }, status: 'ACTIVE' },
      select: { memberId: true },
    });
    return new Set(rows.map((r) => r.memberId));
  }
}
```

### 3.2 4 个入口接入

| 入口                                                                                | 改动                                                                                                                                          |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `createShareToken`（share-token.service.ts:310）                                    | 在 sharePolicy 校验之后追加 `await eligibility.assertActive(input.shareUserId, input.tenantId)`                                               |
| Cart `addToCart` sid 校验（[[P0-04]] §3.2）                                         | sid 反查 token 后再 `await eligibility.isActive(token.shareUserId, tenantId)`；非 ACTIVE 视为无效，cart 静默不写 sid（与 sid EXPIRED 同语义） |
| `OrderCreationApplicationService` last-touch shareUserId 选定后（[[P0-04]] §3.3.2） | `await eligibility.isActive(...)`；不 active 则 fallback 到 Redis bind / parentId（与 sid 为 null 同 path）                                   |
| `CommissionService.triggerCalculation`                                              | 计算前对每行 commission 候选行的 distributorMemberId 调 `filterActive`；不 active 的不写入新 FinCommission（已经存在的 FinCommission 行不动） |

### 3.3 profile 状态变更联动

```ts
// admin profile update path
@Transactional()
async setProfileStatus(profileId: string, nextStatus: 'FROZEN' | 'REVOKED', operator: string, reason: string) {
  const profile = await this.prisma.sysDistDistributorProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new BusinessException('Profile not found');
  if (profile.status === nextStatus) return;

  await this.prisma.sysDistDistributorProfile.update({
    where: { id: profileId },
    data: {
      status: nextStatus,
      [nextStatus === 'FROZEN' ? 'frozenReason' : 'revokedReason']: reason,
    },
  });

  // 联动 1：disable 该 member 的所有 active share token
  const disabled = await this.prisma.sysDistShareToken.updateMany({
    where: { tenantId: profile.tenantId, shareUserId: profile.memberId, status: 'ACTIVE' },
    data: { status: 'DISABLED' },
  });

  // 联动 2：审计事件（仅一条聚合事件，不为每个 sid 写一条）
  if (disabled.count > 0) {
    await this.prisma.sysDistShareEvent.create({
      data: {
        sid: 'AGGREGATE',
        tenantId: profile.tenantId,
        shareUserId: profile.memberId,
        eventType: 'MANUAL_DISABLE',
        eventMessage: `profile status -> ${nextStatus} by ${operator}: ${reason}; disabled ${disabled.count} tokens`,
      },
    });
  }
}
```

注意：**不动现有 `FinCommission` 行**。已计算的佣金属于历史财务事实，撤销资格不冲销既往。

### 3.4 admin UI 配合

- profile 详情页显示"X 张分享令牌已联动 DISABLE"。
- 列表页过滤"已冻结分销员"按钮。
- 不暴露"佣金回收"操作（决策见 §4 Q3）。

---

## 4. 决策依据

### 4.1 Q1 share token 创建的 hard fail vs 静默 fallback

| 选项                                | 优         | 劣                                 | 选择 |
| ----------------------------------- | ---------- | ---------------------------------- | ---- |
| **A. createShareToken 直接 400**    | 早暴露问题 | admin 误操作时给用户的链接生成失败 | ✅   |
| B. 静默生成但 token.status=DISABLED | 用户体验   | 隐藏问题                           |      |

### 4.2 Q2 cart/order 路径上不 active 的行为

| 选项                        | 优         | 劣                               | 选择 |
| --------------------------- | ---------- | -------------------------------- | ---- |
| **A. 静默丢归因（不报错）** | 不影响购物 | 用户感觉不到归因丢失             | ✅   |
| B. 拒绝下单                 | 严格       | 让用户为"分销员被冻结"买单不合理 |      |

### 4.3 Q3 已成单 commission 是否冲销

| 选项                               | 优                         | 劣                                                    | 选择 |
| ---------------------------------- | -------------------------- | ----------------------------------------------------- | ---- |
| **A. 不冲销，保留历史**            | 财务事实尊重；运营审计清晰 | 极端违规情况下需要人工通过财务模块单独冲销            | ✅   |
| B. 自动冲销所有 pending commission | 一刀切                     | 部分 commission 已进入 settlement，撤销会破坏结算账单 |      |
| C. 仅冲销 pending（未结算）的      | 折中                       | 复杂度高，逻辑边界难解释                              |      |

### 4.4 Q4 status 变更通知用户

| 选项                               | 优   | 劣                       | 选择 |
| ---------------------------------- | ---- | ------------------------ | ---- |
| **A. 仅 admin 看；C 端无主动通知** | 简单 | 分销员不知道为啥不能分享 |      |
| **B. 主动短信/Push**               | 友好 | 触点编排路径要扩展       |      |

本设计不强制；建议短信走 [[P1-08]] 引入的 dispatcher 异步发送，**TODO-1**。

---

## 5. 迁移与回滚

### 5.1 部署顺序

1. **D1**：`DistributorEligibilityService` 上线；4 个入口接入；联动逻辑上线。
2. **D2**：staging 验证：手动设一个 profile 为 FROZEN，确认其 sid 全部 DISABLED；旧 commission 行不动。
3. **D3**：prod 上线。

### 5.2 回滚

PR git revert 即可；旧 share token / commission 数据无破坏。

---

## 6. 验证矩阵

| 层   | 用例                                                                | 工具      |
| ---- | ------------------------------------------------------------------- | --------- |
| Spec | assertActive(profile=FROZEN) → BusinessException                    | unit      |
| Spec | filterActive([a,b,c], 其中 b=FROZEN) → Set([a,c])                   | unit      |
| Spec | setProfileStatus(FROZEN) → token.status 批量变更 + 审计写入         | unit      |
| 集成 | E2E：admin 冻结 → 用户点旧分享链接 → 拒绝/无归因                    | supertest |
| 集成 | E2E：admin 冻结 → 旧 FinCommission 行不变                           | DB 查询   |
| 集成 | E2E：admin 冻结 → 新订单 commission 计算 → 0 行写入对应 distributor | supertest |
| 静态 | 4 个入口 grep `assertActive` 命中 ≥4                                | rg        |

---

## 7. 风险与未决

### 7.1 TODO

1. **TODO-1**：是否给被冻结分销员发短信？走 [[P1-08]] dispatcher。本设计不强求，运营 PRD 决定。
2. **TODO-2**：`SysDistShareEvent.sid='AGGREGATE'` 是占位值；event 表 sid 列 nullable 吗？schema 是 NOT NULL 看：`@db.VarChar(64)` 没标 `?` → NOT NULL。AGGREGATE 字面值是临时方案；建议把 schema 改为可空，**实施期决定**。
3. **TODO-3**：`CommissionService.triggerCalculation` 当前是否已有资格校验？grep 确认。

### 7.2 风险

| 风险                             | 等级 | 缓解                                                                  |
| -------------------------------- | ---- | --------------------------------------------------------------------- |
| 旧 commission 仍结算造成运营投诉 | 中   | admin UI 明确显示"已冻结但历史佣金继续结算"；运营培训文档             |
| 资格校验额外 DB query 性能       | 低   | profile 表行数少（每租户分销员一行），有 `(tenantId, memberId)` index |
| profile 状态变更联动事务过长     | 低   | active token 数对单 user 通常 ≤10 张；批量 update 单 SQL              |

---

## 8. 实施清单

### 8.1 backend

- [ ] `marketing/distribution/services/distributor-eligibility.service.ts` 新增。
- [ ] `share-token.service.ts:310` createToken 接入 assertActive。
- [ ] Cart `addToCart` ([[P0-04]] 路径) 加 eligibility.isActive 二次校验。
- [ ] `order-creation-application.service.ts` last-touch shareUserId 校验。
- [ ] `commission.service.ts` triggerCalculation 调 filterActive。
- [ ] admin profile 状态变更服务（grep `sysDistDistributorProfile.update`）增加联动 + audit event。

### 8.2 admin-web

- [ ] profile 详情显示联动数量。
- [ ] 列表筛选"已冻结分销员"。

### 8.3 验证

- [ ] `pnpm typecheck:backend && pnpm test:backend -- eligibility`
- [ ] `pnpm test:backend -- share-token`
- [ ] `pnpm test:backend -- distributor-profile`
- [ ] `pnpm check:slice`
- [ ] PR 前完整 verify。

### 8.4 PR 标题

`feat(backend): 资格/分享/分佣三段联动，资格变更同步 DISABLE 分享令牌`
