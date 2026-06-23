# 共演失败防线（Co-evolution Checklist）

## 目标

防止"实现改了、测试没改"导致的规格漂移（spec drift）。

规格漂移的典型形式：

1. `*.service.ts` 重构了内部逻辑，`*.service.spec.ts` 的 mock 仍然对应旧实现
2. Port 接口新增方法，Adapter 的 spec 没有补充对应测试
3. Processor / Scheduler 改变了调度策略，spec 的断言还是老的语义

---

## 触发时机

进入本清单的条件（满足其中一个即触发）：

- 修改了任意 `*.service.ts`、`*.processor.ts`、`*.scheduler.ts`、`*.adapter.ts`
- 修改了 Port 接口（`*port.ts`）或 Repository（`*.repository.ts`）
- 修改了 Prisma Schema 或任何 `$transaction` 调用的内部结构
- 修改了 mock 辅助函数或 test-utils（如 `getTenantHelperTestProvider`）

---

## 检查清单

### 一、实现层

- [ ] 改动了哪些 **公开方法签名**（入参/出参/异常语义）？
- [ ] 改动了哪些 **内部协作者**（注入了新依赖、删除了旧依赖、改了调用顺序）？
- [ ] 改动了哪些 **副作用语义**（事务模式、并发控制、幂等边界）？
- [ ] 改动了哪些 **错误路径**（什么时候抛出、什么时候吞掉、什么时候记日志）？

### 二、Spec 层

对于上面每一条改动，检查对应 spec 文件：

- [ ] Mock 是否仍然与实现对齐？
  - `$transaction` 改为 CAS 后，mock 应包含 `updateMany`，而非旧的 `upsert` + `update`
  - 注入了新 Port 后，mock 应在 providers 里出现，而非被遗漏
- [ ] 断言是否仍然是有效的行为断言？
  - `toHaveBeenCalledWith(...)` 的参数是否与新实现一致？
  - 数值断言（如 `15`）是否随计算逻辑的变化同步更新？
- [ ] 失败路径是否仍然被覆盖？
  - 修改了错误处理后，预期 reject 的测试是否仍然有效？
- [ ] 新引入的逻辑分支是否有新测试？

### 三、共演确认

- [ ] 运行 `pnpm check:slice` — spec-drift 检查应无严重漂移（❌）
- [ ] 运行 `pnpm --filter @apps/backend test` — 全绿

### 四、注释（触达文件必审）

根 `AGENTS.md` §7 约定：本次 diff 触及的每个源码文件都要扫一遍注释是否够读懂。

- [ ] **要补**：非显而易见的分支、状态迁移、幂等键、金额单位/精度、补偿与重试、租户过滤、与外部系统（支付/财务）的对应关系。
- [ ] **不堆**：一眼能看懂的 getter/setter、纯重命名、无业务语义的样板代码。
- [ ] **语言**：与文件现有注释风格一致（本项目 backend 常用中文业务说明）。
- [ ] **交付**：review / 交付说明中列出「已补注释的路径」或「无需补（原因）」；禁止只改逻辑不审注释。

---

## 常见漂移模式与对策

| 漂移场景                        | 根因                                        | 对策                                                |
| ------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| CAS 替换 upsert+rollback        | 实现改了事务策略，mock 未跟进               | 检查 `$transaction` mock 和 `updateMany` mock       |
| 新增父档案查询                  | L1 计算器增加了一次 `findProfile` 调用      | `mockResolvedValueOnce` 链式注入不同结果            |
| Scheduler 绕过 Port 直访数据库  | 忘记遵守架构隔离                            | Scheduler 只通过 Port 读写，spec 中 Prisma 不应出现 |
| 事件监听器吞错                  | try/catch 包住了应该上浮的错误              | spec 中增加 `.rejects.toThrow(...)` 断言            |
| 跨店限额在 advanced spec 中失效 | `fin_user_daily_quota` mock 缺 `updateMany` | 检查顶层 mock 对象是否完整                          |

---

## 自动检查

`pnpm check:slice` 对 `apps/backend/src/` 下的改动会运行：

```
scripts/check-spec-drift.mjs
```

规则：

- ❌ **严重**（exit 1）：改动了实现文件但对应 `.spec.ts` **完全不存在**
- ⚠️ **警告**（exit 0）：spec 存在但本次改动未同步更新 → 需人工确认

---

## 扩展：非 Service 层的共演

### Port / Adapter

- 修改 Port 接口（新增 / 删除抽象方法）时：
  - Adapter 实现必须同步
  - Adapter spec 必须覆盖新方法

### Repository

- 修改 Repository 方法签名时：
  - 使用该 Repository 的 Service spec 中的 mock 必须同步

### Test Utils / Mock Factories

- 修改 `getTenantHelperTestProvider()` 或其他 mock 辅助函数时：
  - 所有依赖该辅助函数的 spec 文件都是潜在漂移点
  - 运行完整测试套件 `pnpm --filter @apps/backend test` 确认

---

## 参考

- 规格漂移修复案例：`feature/commission-review`（2026-05）
  - `commission-validator.service.spec.ts` — CAS 事务模式漂移
  - `commission-calculator-level-integration.spec.ts` — 父档案查询漂移
  - `commission.service.advanced.spec.ts` — 跨店限额 mock 漂移
- 自动检查脚本：`scripts/check-spec-drift.mjs`
