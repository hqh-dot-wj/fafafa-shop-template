---
task_id: SCHEDULER-AUDIT-2026-05
status: active
current_phase: 0
task_mode: refactor
path_type: backend-only
high_risk: true
created: 2026-05-20
last_updated: 2026-05-20
related_feat: null
---

# Exec Plan: SCHEDULER-AUDIT-2026-05

后端定时任务全量审计与分级修复。源自 2026-05-20 review-only 报告（24 条 findings，覆盖 RCE / 金额锁 / dead code / 性能 / 一致性 / 治理）。
本 plan 不重写调度框架，不改运维侧 sysJob 数据契约，不做合规向的审计保留期决策（拆出 follow-up）。

## 1. 目标 / 非目标

**目标**

- 关闭 `task.service.parseParams` 的 `new Function` RCE。
- 给 finance 域三个调度器（settlement / withdrawal / settlement-core）补 Lua token 锁与看门狗，与 refund-reconciliation 风格统一。
- 下线 4 个空实现任务（`task.clearTemp` / `task.monitorSystem` / `task.backupDatabase` / `dailyBackup`）与 1 个 dead-code 任务（`marketing.cleanupExpiredData`），并清理 sysJob 中孤儿记录。
- 修 `job.service.ts:258` `?` 全替换 bug、注册失败回写 sysJob 状态。
- 降低 P1 域内 6 项性能/资源问题（finance / marketing / order-outbox 三块）。
- 收敛 P2/P3 一致性问题：跨租户调度统一 `@IgnoreTenant`、锁 TTL 边界、`sys_job_log` 保留窗口、阈值常量配置化。

**非目标**

- 不动 `marketing.archiveResolutionAudit` 合规决策（拆 follow-up `SCHEDULER-AUDIT-FOLLOWUP-COMPLIANCE-2026-0X`）。
- 不重构 Bull 队列侧（refund-retry / commission / wallet / order-delay processor 不在范围内）。
- 不改 admin-web 的 sysJob 管理页（运维界面契约不变）。
- 不引入新的调度框架（仍用 `@nestjs/schedule` + 内置 SchedulerRegistry）。
- 不做数据迁移/历史 sysJob 数据回填，只对孤儿记录做巡检告警。

## 2. 任务元数据

| 字段     | 值                                                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 任务模式 | `refactor`（Phase A 内嵌 `test-first-fix`）                                                                                                                 |
| 路径类型 | `backend-only`（多模块跨域，按 `session-orchestration.md` 切 Phase）                                                                                        |
| 高风险   | 是：① RCE 注入面 ② 金额相关 Redis 锁 ③ Prisma 表达式索引迁移（Phase C）                                                                                     |
| 必读     | 根/Backend `AGENTS.md`、`backend-safe-change.md`、`session-orchestration.md`、`co-evolution-checklist.md`、`HIGH_RISK_REGISTRY.md`、`TEST_SPEC_PROTOCOL.md` |

## 3. Phase 列表

### Phase 0 — 只读扫描 ✅ done

- **范围**：本 plan 关联的 24 条 findings 已在 2026-05-20 主会话产出，证据等级 L3。
- **DoD**：[x] 高风险清单已交付 [x] 用户已确认推荐方案

### Phase A — P0 安全/锁（主会话单线，停手确认）

- **范围**：
  - `apps/backend/src/module/admin/monitor/job/task.service.ts`（parseParams 重写）
  - `apps/backend/src/module/admin/monitor/job/job.service.ts:258`（`?` 全替换）
  - `apps/backend/src/module/finance/settlement/settlement.scheduler.ts`（锁 Lua + 看门狗 token）
  - `apps/backend/src/module/finance/withdrawal/withdrawal-reconciliation.scheduler.ts`（锁 Lua）
  - `apps/backend/src/module/finance/settlement-core/settlement-reconciliation.scheduler.ts`（锁 Lua）
  - `apps/backend/src/module/common/redis/redis.service.ts`（评估是否抽 `releaseLockWithToken` 公共方法）
- **拆分**：A1=RCE（hotfix 优先），A2=金额锁
- **DoD**：
  - [ ] A1：先有失败 spec 覆盖 `task.params(globalThis.process.exit())` 等向量，再换 JSON.parse + 白名单实现
  - [ ] A1：security-review skill 跑一次无 finding
  - [ ] A2：3 个调度器锁 release 走 Lua 校验 token；看门狗持有 token 后再续期
  - [ ] A2：新增 `redis-lock-token.spec.ts` 覆盖"token 失效不续期/不删除"
  - [ ] `pnpm check:slice` 通过
  - [ ] 用户已批准 Phase A 收口

### Phase B — P0 dead code 清理（Agent Teams 跨层模式）

- **范围**：
  - `apps/backend/src/module/admin/monitor/job/task.service.ts:190-214`（删除 clearTemp/monitorSystem/backupDatabase 三个空 `@Task`）
  - `apps/backend/src/module/backup/backup.service.ts`（删除 dailyBackup 空 `@Task`，评估整个 module 是否还有保留价值）
  - `apps/backend/src/module/marketing/scheduler/lifecycle.scheduler.ts:247-302`（删除 `cleanupExpiredData` 或显式 `@deprecated` + 不注册 CodeManagedJob）
  - `apps/backend/src/module/admin/monitor/job/services/job-definition-sync.service.ts`（孤儿 sysJob 巡检：sourceKey 找不到则告警，不静默 warn）
  - 新增针对孤儿/空实现注册的 spec
- **DoD**：
  - [ ] 5 个目标任务从代码与 sysJob 中下线，sync 脚本对孤儿告警
  - [ ] `pnpm fix:changed`、`pnpm check:slice`、`pnpm test --filter backend monitor/job`
  - [ ] 运维通告草稿（不入仓库，只交付）

### Phase C — P1 性能（Agent Teams 跨层模式，3 队友按域并行）

- **范围**（按队友切，文件无重叠）：
  - `perf-finance`：`commission-compensation.scheduler.ts` 时间窗死区 + Bull `removeOnFail` / `removeOnComplete` 配置评估；`withdrawal-reconciliation.scheduler.ts:83` 加 `orderBy: createTime asc`
  - `perf-marketing`：`lifecycle.handleActivityStatus` 用独立列 `startAt`/`endAt` + 索引（含 Prisma migration，**high-risk**）；`lifecycle.handleTimeoutInstances` ACTIVE 分支改 DB 层过滤；`resolution-alert` 加"昨日有流量才进入"预筛
  - `perf-infra`：`order-outbox-metrics.service.ts` 周期 10s→30s + 加 Redis 锁；评估 Prometheus exporter 方向（本 Phase 只做周期+锁，exporter 拆 follow-up）
- **Lead 批准要求**：`perf-marketing` 的 Prisma migration 与 `perf-finance` 的 Bull 配置变更，必须先提交带迁移说明/回滚/影响面的 plan，Lead 批准后才动手（playbook §3.3）。
- **DoD**：
  - [ ] 每个队友 PR 内含: 改动文件 + 新增 spec + 索引/迁移 SQL 评审痕迹
  - [ ] 三组 `pnpm check:slice` 全绿
  - [ ] 人类跑 `pnpm eval:phase --plan docs/exec-plans/active/SCHEDULER-AUDIT-2026-05.md`

### Phase D — P2/P3 治理（Agent Teams 跨层模式，2 队友低风险并行）

- **范围**：
  - `gov-tenant`：所有 cron 调度器显式补 `@IgnoreTenant()` 或 `TenantContext.run({...ignoreTenant:true})`；将 `resolution-alert` lockTtl 提到 6min、`course-group-*` 锁机制改成跨周期防护（lockTtl > cron 间隔的最小整数倍）
  - `gov-observability`：新增 `sysJobLogRetention` cron（默认 90 天）；定时任务阈值常量提到 `BusinessConstants.SCHEDULER.*`；为每个调度器加 metrics 埋点（暂用 logger.log 结构化字段，正式 Prometheus 走 follow-up）
- **DoD**：
  - [ ] 跨租户调度无隐式依赖
  - [ ] sys_job_log 保留窗口生效（spec 覆盖删除边界）
  - [ ] 阈值在 BusinessConstants 集中可改
  - [ ] `pnpm check:slice` 通过

### Phase E — 收口

- **范围**：当前 diff。
- **DoD**：
  - [ ] `pnpm verify:pr-slice`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（backend 部分）
  - [ ] `pnpm verify-monorepo`
  - [ ] 灰度计划：预发 `SCHEDULER_ENABLED=false` 启动 → 单任务逐个手动触发 → 单实例灰度 24h → 全量
  - [ ] HANDOFF 文档归档到 `docs/exec-plans/active/HANDOFF-SCHEDULER-AUDIT.md`

## 4. 会话切分建议

| Phase | 建议对话数         | 模式                                |
| ----- | ------------------ | ----------------------------------- |
| 0     | 1（已完成）        | 主会话只读                          |
| A1    | 1                  | 主会话 test-first-fix（高风险停手） |
| A2    | 1                  | 主会话 + subagent security-review   |
| B     | 1                  | Agent Teams 跨层（4 队友）          |
| C     | 1（嵌 3 队友并行） | Agent Teams 跨层 + 计划批准         |
| D     | 1（嵌 2 队友并行） | Agent Teams 跨层                    |
| E     | 1                  | 主会话收口                          |

## 5. 当前状态

| 字段               | 值                                                                                |
| ------------------ | --------------------------------------------------------------------------------- |
| **current_phase**  | `A2`                                                                              |
| **phase_status**   | `wip`（spec/实现已就绪，等 PR 合并 + 人工 `pnpm check:slice` + 用户批准）         |
| **blocked_reason** | A1 仍在 `fix/scheduler-rce-a1` 等待 `/ultrareview`；A2 在 `fix/scheduler-lock-a2` |

## 6. 已执行验证（命令 + 退出码）

> 由 Agent 在 **实际运行** 后填写；M3 后由 `pnpm eval:phase` 回写。禁止未运行写 `0`。

| Phase | 命令                                                                                       | exit code | 时间       | 备注                                                                                              |
| ----- | ------------------------------------------------------------------------------------------ | --------- | ---------- | ------------------------------------------------------------------------------------------------- |
| A1    | `npx jest src/module/admin/monitor/job/task.service.spec.ts --no-coverage`（pre-fix）      | 1         | 2026-05-20 | 红状态：11/29 失败（攻击向量在 `new Function` 实现下被成功执行），符合 test-first-fix 预期        |
| A1    | `npx jest src/module/admin/monitor/job/task.service.spec.ts --no-coverage`（post-fix）     | 0         | 2026-05-20 | 29/29 全绿；攻击向量全部拒绝；合法参数（数字/字符串/布尔/null/对象/数组）回归通过                 |
| A1    | `pnpm -w fix:changed`                                                                      | 0         | 2026-05-20 | 28 个 `@typescript-eslint/no-explicit-any` warning：13 个为既有代码、15 个为新 SEC 块沿用既有风格 |
| A2    | `npx jest src/module/finance/__tests__/redis-lock-token.spec.ts --no-coverage`（pre-fix）  | 1         | 2026-05-20 | 红状态：20/23 失败（旧实现 `set NX` + `del` 无 token，spec 期望 `tryLock/unlock/renewLock` 路径） |
| A2    | `npx jest src/module/finance/__tests__/redis-lock-token.spec.ts --no-coverage`（post-fix） | 0         | 2026-05-20 | 23/23 全绿；3 个调度器 I1-I6 不变量 + settlement watchdog I7-I9 全部满足                          |
| A2    | `npx jest src/module/finance --no-coverage`                                                | 0         | 2026-05-20 | 35 test suites / 371 tests 全绿；既有 finance 业务 spec mock 路径同步迁移到 RedisService API      |

## 7. 下一会话 Prompt（复制）

```text
你是续作 Agent。先读 docs/exec-plans/active/SCHEDULER-AUDIT-2026-05.md 的 Phase A1。
任务模式：test-first-fix | 路径类型：backend-only | 高风险：是（RCE）
约束：仅改 task.service.ts parseParams + 必要 spec；禁止扩大到 Phase A2 或 Phase B。
必读：根 CLAUDE.md、apps/backend/AGENTS.md、HIGH_RISK_REGISTRY.md、TEST_SPEC_PROTOCOL.md、security-review skill。
先写失败 spec（含 globalThis.process.exit() / require('child_process') 等向量），用户批准实现策略后再改业务代码。
验证：pnpm check:slice（Phase 未完成前不得宣称 TaskComplete）
```

## 8. 开发者下一步（复制）

1. 新对话粘贴 §7 Phase A1 Prompt
2. 主会话先输出失败 spec + 实现选项（JSON.parse + 白名单 vs 完全取消参数能力）等待人类批准
3. 实施完成后跑：`pnpm test apps/backend --testPathPattern=task.service.spec`
4. 进入 Phase A2 前再次让我或人类批准
