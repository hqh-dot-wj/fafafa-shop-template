---
status: draft
doc_type: delivery
last_verified: YYYY-MM-DD
feature_name: （功能名称）
author: （作者）
---

# 发布检查清单：（功能名称）

## 1. 代码与质量

- [ ] PR 已合并
- [ ] `pnpm verify-monorepo` 通过
- [ ] `pnpm lint` 通过
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test` 通过
- [ ] `pnpm build` 通过

## 2. 文档与交付物

- [ ] REQ.md 已冻结
- [ ] SOLUTION.md 已确认
- [ ] TEST_PLAN.md 已执行
- [ ] 相关 source of truth 文档已更新（如有）

## 3. 配置与环境

- [ ] 无新增环境变量（如有，`.env.example` 已更新）
- [ ] 无敏感配置误提交

## 4. 数据与迁移

- [ ] 无 schema 变更（如有，迁移脚本已验证、回滚方案已准备）

## 5. 功能验证

- [ ] 后端接口验证通过
- [ ] 前端页面验证通过
- [ ] 权限验证通过
- [ ] 空态 / 异常态验证通过

## 6. 风险与回滚

- [ ] 风险点已识别并告知
- [ ] 回滚步骤明确（高风险功能必填）
- [ ] 发布后验证人明确

## 7. 发布后验证

- [ ] 页面入口可访问
- [ ] 关键接口成功率正常
- [ ] 错误日志无明显异常
