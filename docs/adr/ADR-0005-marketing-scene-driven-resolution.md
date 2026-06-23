---
title: ADR-0005 营销 C 端以场景发布快照为主链路
status: accepted
doc_type: architecture
last_verified: 2026-04-15
---

# ADR-0005：营销 C 端以场景发布快照为主链路

## 背景

历史 C 端营销聚合接口按商品逐次裁决，配置入口分散、缓存失效难统一观测。需要收敛为「单发布产物 + 单运行主链路」，并具备可回滚与可观测能力。

## 决策

1. **主链路**：C 端优先使用 `GET /client/marketing/scene/:sceneCode/modules`，运行时只读 `MktSceneRelease` 已发布快照。
2. **兼容**：`/client/marketing/aggregate/products` 保留为过渡兼容，响应携带 `Deprecation: true`，新需求禁止再扩展聚合特判。
3. **放量与熔断**：通过 `sys_config` 键 `marketing.client.scene.enabled`（Y/N）与 `marketing.client.scene.rolloutPercent`（0～100，按 `tenantId:memberId` 稳定哈希）控制租户级切流与 Kill Switch；`ADMIN_PREVIEW` 渠道不参与放量限制。
4. **保护**：场景模块接口单独限流（较全局默认更严）；裁决服务对单模块设超时与降级；聚合列表侧使用批量候选加载 + 单次优先级规则读取降低 N+1。
5. **观测**：Redis 记录按租户隔离的日级成功率、P95/P99 延迟、空模块累计与缓存失效键数；超阈值写入消息中心（站内信），并由定时任务轮询补发。
6. **审计**：`mkt_resolution_audit` 保留 90 天，由定时任务删除更早记录（归档策略为删除式，若后续需冷存再单独 ADR）。

## 后果

- 运营需迁移到「策略 → 场景模块 → 场景发布 → 监控」闭环；旧聚合依赖方应改接场景接口。
- 放量配置错误会导致部分会员无法命中场景接口，需在后台 `sys_config` 谨慎变更。
- 压测与 KPI 验证仍依赖环境与流量脚本，本 ADR 不替代容量测试报告。

## 指标冻结（口径）

- **延迟样本**：每次成功或失败的场景裁决请求耗时写入 Redis ZSET，按自然日聚合 P95/P99。
- **空模块**：成功返回的模块中 `products.length === 0` 的模块数，按日累计。
- **失败率**：`failed / (success + failed)`（按日 Redis 计数器）。
