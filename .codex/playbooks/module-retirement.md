---
title: 模块退役 / 功能下线
status: active
doc_type: playbook
last_verified: 2026-05-21
---

# 模块退役 / 功能下线

删除页面、API、菜单前必读。默认工作流见 [harness-workflow.md](./harness-workflow.md)。

## 1. 顺序（强制）

1. `pnpm harness:impact --keyword <词>` 或 `--module <路径片段>` → 出关联清单。
2. 用户确认删除范围（D1 或用户已授权 D0）。
3. **先改测试**（尤其要求 legacy 路由存在的 spec），再删路由/API/实现。
4. `pnpm check:slice`；跨 app 再 `pnpm generate-types`。
5. 更新 `docs/design/*-alignment.md` 或标 deprecated；过程稿按 `DOCUMENT_POLICY.md` 收敛。

## 2. 营销 cutover 专项

- 登记：`apps/backend/.../cutover-registry.ts`、`apps/admin-web/.../marketing-cutover.ts`
- 到期扫描：`pnpm harness:cutover-due`（warn，不阻塞）
- 勿在一次 T1 小改里删光 compat；用专项 PR。

## 3. 禁止

- 只删 Vue 页不查 seed / `prisma/seeds` / e2e。
- 未跑 impact 就宣称「已清理干净」。
