---
task_id: FAFAFA-PIVOT-PHASE4-2026-06
status: implemented
current_phase: 4.4
task_mode: refactor
path_type: cross-app
high_risk: true
created: 2026-06-23
last_updated: 2026-06-23
related_plan: c:/Users/13415/.cursor/plans/fafafa-template-pivot_4dd42921.plan.md
prev_phase_plan: docs/exec-plans/active/FAFAFA-PIVOT-PHASE3-2026-06.md
phase_status:
  '4.0': done
  '4.1': done
  '4.2': done
  '4.3': done
  '4.4': done
  '4.5': done
---

# Exec Plan: FAFAFA-PIVOT-PHASE4-2026-06

父 plan Phase 4：**miniapp 下线 + admin-web 店铺设置页**。

## 1. 目标 / 非目标

**目标**

- `apps/miniapp-client` 按 `module-retirement.md` 冻结归档（保留源码，移出默认 CI/verify 链路）
- 部署移除 `h5` 服务，`c-web` 替代 `/shop/`；GitLab CI `build:h5` → `build:c-web`
- `SysTenant` 增加店铺品牌字段（logo / 主题色 / 协议）
- admin-web `system/tenant` 改造为「店铺设置」单页表单（编辑 `000000` 单条记录）
- 不提供改域名 UI（域名仍由 fafafa 注入）

**非目标**

- 不物理删除 `apps/miniapp-client` 目录
- 不删 `tenantId` 字段 / 租户套餐管理页
- 不实施 Phase 5 feature flag 分拆

## 2. Phase 列表

### Phase 4.0 — exec-plan [done]

### Phase 4.1 — miniapp 退役 + 根 scripts

- `apps/miniapp-client/RETIRED.md`
- 根 `package.json`：`lint`/`typecheck`/`contracts:check` 用 `c-web` 替代 `h5`
- **DoD**：`pnpm verify:scripts` exit 0

### Phase 4.2 — 部署去 h5、接 c-web

- `deploy/docker-compose.{prod,tpl}.yml`、`gateway.conf`、`.gitlab-ci.yml`
- `deploy/scripts/template/{healthcheck,deploy,lib/common}.sh`
- **DoD**：compose/gateway 无 `h5` upstream；CI 构建 `c-web`

### Phase 4.3 — Backend shop-settings

- Prisma：`logoUrl` / `themeColor` / `userAgreement` / `privacyAgreement`
- `GET|PUT /system/tenant/shop-settings`
- `apply-template-branding` 写入 `logoUrl`
- **DoD**：`pnpm --filter @apps/backend typecheck` exit 0

### Phase 4.4 — admin-web 店铺设置页 [done]

### Phase 4.5 — C 端读取店铺品牌 [done]

- `GET /client/shop/branding`（只读）
- c-web：`stores/shop-branding` + `plugins/shop-branding.client.ts`
- 顶栏 / 登录页 / Tab 激活色应用 `--shop-theme`

## 3. 验证命令

| 命令                                                                           | 用途      |
| ------------------------------------------------------------------------------ | --------- |
| `pnpm fix:changed`                                                             | Micro     |
| `pnpm check:slice`                                                             | SliceOK   |
| `pnpm eval:phase --plan docs/exec-plans/active/FAFAFA-PIVOT-PHASE4-2026-06.md` | PhaseDone |
