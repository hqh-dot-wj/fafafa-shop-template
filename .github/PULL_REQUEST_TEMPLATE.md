## 变更概要

<!-- 2–3 行：改了什么、为什么改、主要影响范围 -->

## 编排与交付链接（大改/跨 app 必填）

| 项           | 链接                                                                                   |
| ------------ | -------------------------------------------------------------------------------------- |
| Exec Plan    | <!-- docs/exec-plans/active/\<TASK-ID\>.md 或 completed/；无则写 no-exec-plan 原因 --> |
| Feature Pack | <!-- docs/delivery/features/\<FEAT-ID\>/；可选 -->                                     |
| Phase        | <!-- 当前 Phase 编号 + 是否 PhaseDone（pnpm eval:phase exit 0） -->                    |

本地自检：`pnpm verify:pr-slice` → 按输出补全下方质量属性勾选。

## 变更类型

- [ ] Bug 修复 &nbsp;&nbsp; - [ ] 新功能 &nbsp;&nbsp; - [ ] 重构/优化 &nbsp;&nbsp; - [ ] 文档/配置 &nbsp;&nbsp; - [ ] 测试

## 影响范围

**后端**：[ ] 金融 &nbsp;[ ] 营销 &nbsp;[ ] 商城/订单 &nbsp;[ ] 商品 &nbsp;[ ] 用户/权限 &nbsp;[ ] 系统/基础设施
**前端**：[ ] admin-web &nbsp;&nbsp;[ ] miniapp-client
**数据层**：[ ] Prisma schema &nbsp;[ ] 数据库迁移 &nbsp;[ ] Redis 键结构

---

## 质量属性证据

> Codex/Claude reviewer 会对照 diff 验证以下声明。只填与本次改动相关的维度，无关维度留空。
> 路由规则见 `docs/quality-attributes/matrix.yml`。

### 业务正确性（金融 / 订单 / 支付 / 钱包 / 营销 必填）

- [ ] 状态转换单向、无跳过（说明：\_\_\_）
- [ ] 金额字段有非负约束（字段名：\_\_\_）
- [ ] 写操作有幂等键或 DB 唯一约束（key：\_\_\_）
- [ ] 并发控制：[ ] 乐观锁 &nbsp;[ ] 悲观锁 &nbsp;[ ] DB 约束（说明：\_\_\_）
- [ ] 事务回滚路径已有测试覆盖

### 金额精度（金额 / 支付 / 退款 / 结算 / 前端金额运算必填）

- [ ] 已重读 `docs/governance/MONEY_PRECISION_PROTOCOL.md`
- [ ] 新增 / 修改金额加减乘除已使用 `Money` / Prisma `Decimal`，未引入新的浮点金额运算
- [ ] 微信支付 / 退款 / 转账金额入参经过整数分校验，未把受理状态当业务成功
- [ ] API 出口新增金额 number 字段最多 2 位小数，前端未手写 backend DTO / VO
- [ ] 影响 `MONEY_PRECISION_PROTOCOL.md` §2 finding 状态时，已同步更新对应条目

### 数据库查询（新增 / 改动列表或搜索接口必填）

- [ ] `findMany` 有 `take` 上限，最大值 = \_\_\_
- [ ] 排序字段有索引（字段：\_\_\_）
- [ ] 无 N+1（关联通过 `include` / `select` 合并，不在循环内查询）
- [ ] 无循环内 `await prisma.*` 写操作

### 缓存 / 兜底（改动缓存或降级逻辑时填）

- [ ] 覆盖命中路径 ✓ &nbsp; 未命中路径 ✓ &nbsp; 缓存失效路径 ✓
- [ ] Fallback 有明确语义（不是静默返回空或无限 retry）

### 接口性能（新增接口或改动导出 / 下载时填）

- [ ] 无阻塞操作放在 HTTP 请求链路内（CPU 密集 / 大 I/O 走队列）
- [ ] 导出接口有 limit 保护或走异步任务路径

### 前端体验（改动页面 / 组件时填）

- [ ] 列表 / 详情页有 loading 态
- [ ] 数据为空时有 empty 态
- [ ] 接口失败时有 error 提示 + 可操作动作（重试 / 返回）
- [ ] 提交按钮有 loading / disabled 防重复

### 安全（所有 PR 必填）

- [ ] 有接口级权限校验 + 租户隔离
- [ ] 无硬编码密钥 / tenantId
- [ ] 敏感字段已脱敏（日志 / 响应）
- [ ] 无 SQL 注入 / XSS 风险

---

## 测试证据

```bash
# 粘贴实际命令输出，不要留空
pnpm fix:changed
pnpm check:slice
# 大任务 Phase 收口（重跑 plan DoD，非自述）：
# pnpm eval:phase --plan docs/exec-plans/active/<TASK-ID>.md --phase N
```

---

## 数据库变更（改动 Prisma schema 时填）

- [ ] migration 已验证无报错（`pnpm prisma migrate dev`）
- [ ] 新增字段有默认值或可为 null（防存量数据迁移失败）
- [ ] 新增索引：字段 \_\_\_，写放大影响说明：\_\_\_
- [ ] 回滚方案：\_\_\_

---

## 破坏性变更

- [ ] 无破坏性变更
- [ ] 有（影响：\_\_\_，迁移方案：\_\_\_）

---

## 部署说明

- [ ] 无特殊步骤
- [ ] 需数据库迁移（`pnpm prisma migrate deploy`）
- [ ] 需更新环境变量（变量名：\_\_\_）
- [ ] 需清理 Redis 缓存（key 前缀：\_\_\_）
- [ ] 需重启 Worker / Scheduler 进程

---

## 审查重点

<!-- 告诉 reviewer 重点看哪里，贴关键文件路径 + 行号 -->

1.
2.

---

<!--
AI Reviewer 指引（Codex / Claude）：
1. 读取"影响范围"勾选项，查 docs/quality-attributes/matrix.yml routes 确定需核查属性集合
2. 对照 diff 逐一验证"质量属性证据"中每条勾选声明是否有代码支撑
3. 声明与 diff 不一致 → 标注 file:line，要求作者补充或修正
4. diff 中无法验证的声明 → 标注"无法从 diff 验证，需人工确认"
5. 治理文档：docs/quality-attributes/QUALITY_ATTRIBUTE_GOVERNANCE.md
-->
