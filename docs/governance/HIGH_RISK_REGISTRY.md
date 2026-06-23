---
title: 高风险入口登记
status: active
doc_type: governance
last_verified: 2026-05-19
---

# 高风险入口登记

实施、写入、修复、迁移、契约变更前，若命中下表任一行，须按根 `AGENTS.md` §3 停手确认（review-only 只读分析可继续，但须标记 L3 与未验证风险）。

| 触发条件                           | 典型场景                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Prisma schema / migration / seed   | `apps/backend/prisma/**`、init SQL、seed                                 |
| 支付、认证、资金                   | `finance/**`、`payment/**`、`auth/**`                                    |
| 订单、退款、库存、佣金、钱包、结算 | 交易状态机、金额计算、结算口径、退款链路                                 |
| 多租户隔离                         | 租户过滤、`tenant-id`、租户豁免、跨租户查询                              |
| 字典治理                           | `dictType`、字典项、展示文案、治理注册、seed、前端消费                   |
| 定时任务和后台任务页               | `@CodeManagedJob`、`@Task`、`sys_job`、任务管理页联动                    |
| 删除、批量写入、迁移               | 清理脚本、批处理、历史数据回填、修复脚本                                 |
| 跨 app 契约变更                    | backend DTO / VO / API 字段变化并影响前端                                |
| 高风险页面或模块                   | `system/tenant`、`system/dict`、`system/menu`、`monitor/job`、登录、权限 |
| 状态机、幂等、并发、补偿           | 订单、支付、退款、任务、批处理、Worker                                   |

## 停手确认最小内容

- 改动清单：路径 + 操作类型。
- 影响面：app / 模块 / 接口 / 数据表 / 页面 / 任务 / 字典 / 租户 / 权限 / 金额 / 状态机。
- 验证方案：静态、行为、集成 / E2E / 人工链路。
- 回滚方案、不做范围、待确认问题。

实施中仅在路径超出确认范围、发现新高风险、需删除/迁移/批量写入/改已有 migration、命令失败且非本次改动、发现相邻 bug、方案无法满足目标时再次停手。

金额与精度另读 `docs/governance/MONEY_PRECISION_PROTOCOL.md`。
