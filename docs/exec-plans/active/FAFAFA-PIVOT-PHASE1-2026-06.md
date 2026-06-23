---
task_id: FAFAFA-PIVOT-PHASE1-2026-06
status: implemented
current_phase: 3
task_mode: refactor
path_type: cross-app
high_risk: true
created: 2026-06-23
last_updated: 2026-06-23
related_plan: c:/Users/13415/.cursor/plans/fafafa-template-pivot_72a80291.plan.md
---

# Exec Plan: FAFAFA-PIVOT-PHASE1-2026-06

把本仓库改造为 [fafafa.app](C:/Project/fafafa.app) 平台可一键拉起的「商城产品模板」。本 plan 仅覆盖父 plan 的 **Phase 1**（fafafa 模板适配），剩余 Phase 2-5 在后续 plan 推进。

## 1. 目标 / 非目标

**目标**

- 提供 `.gitlab-ci.yml` + `deploy/docker-compose.tpl.yml` + `deploy/scripts/template/*.sh`，按 fafafa 约定接收 `INSTANCE_ID/ORDER_NO/JOB_NO/DOMAIN/SERVER_IP/DB_HOST/DB_NAME/DB_USER/DB_CREDENTIAL_REF/CALLBACK_URL/CALLBACK_TOKEN/PROJECT_NAMES/EXTERNAL_NETWORK_NAME` 等变量
- 实现 fafafa 三类回调：`credentials/exchange`（换 DB 密码）、`callback`（每步状态）、`deploy-result`（容器/端口/镜像）
- 业务品牌配置（companyName / logo / 客服联系方式 / 初始管理员账号）从环境变量注入 seed pipeline
- 容器命名按 `${PROJECT_NAMES}-{service}-prod` 订单隔离，加入 `${EXTERNAL_NETWORK_NAME:-shared_net}` 共享网络供 task-nginx 反代

**非目标（本 Phase 不做）**

- **不**清理 `tenant.guard` / `BaseRepository` 多租户运行时（Phase 2 做）
- **不**新建响应式 C 端 web（Phase 3 做）
- **不**下线 miniapp-client（Phase 4 做）
- **不**改业务代码（finance / payment / marketing / pms 一律不动）
- **不**改 Prisma schema / migration（高风险，保持不动）

## 2. 任务元数据

| 字段     | 值                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| 任务模式 | `refactor`                                                                                                              |
| 路径类型 | `cross-app`（backend seed + deploy + 根 CI 配置）                                                                       |
| 高风险   | **是** — 触动 prisma seed、多租户 SysTenant 表（写）、部署链路                                                          |
| 必读     | `AGENTS.md`、`apps/backend/AGENTS.md`、`apps/backend/prisma/AGENTS.md`、`large-refactor.md`、`session-orchestration.md` |

## 3. Phase 列表（large-refactor.md 内部流程，复用语义）

### Phase 0 — 只读扫描 + 建 plan [done]

- **范围**：fafafa.app 的 `docs/provisioning-engine.md` / `variable-builder.ts` / `deploy-callback.service.ts` / `deploy/docker-compose.yml`；本仓库 `deploy/**`、`apps/backend/prisma/seeds/00-platform/`、`apps/backend/src/bootstrap/`、`apps/backend/src/config/`
- **DoD**：[x] context-scan 完成；[x] 契约已识别；[x] 本 plan 已建

### Phase 1 — 模板交付层（CI + Compose + Scripts）[done]

- **范围**：
  - `.gitlab-ci.yml`（新）
  - `deploy/docker-compose.tpl.yml`（新）
  - `deploy/scripts/template/{validate,init,migrate,deploy,healthcheck,callback}.sh`（新）
  - `deploy/scripts/template/exchange-credential.sh`（新）
  - `deploy/scripts/template/lib/common.sh`（新）
  - `deploy/template.env.example`（新，含全部变量说明）
- **文件上限**：≤12（实际交付 11）
- **DoD**：
  - [x] `.gitlab-ci.yml` stages: validate → build → deploy(init+migrate+deploy+healthcheck) → notify(callback)
  - [x] `docker-compose.tpl.yml` 容器名走 `${PROJECT_NAMES}` 前缀、web 容器加入外部 `shared_net`、外部 DB 通过 fafafa 注入
  - [x] 8 个 shell 脚本（含 lib/common.sh、exchange-credential.sh）按职责拆分，对 fafafa 三类 HTTP 接口（callback / deploy-result / credentials-exchange）封装到 common.sh
- **会话**：1（已完成）

### Phase 2 — 品牌配置外置（seed pipeline 扩展）[done]

- **范围**：
  - `apps/backend/prisma/seeds/00-platform/apply-template-branding.ts`（新）
  - `apps/backend/prisma/seeds/00-platform/index.ts`（改：导出新函数）
  - `apps/backend/prisma/seed-pipeline.ts`（改：pipeline 末尾调用品牌覆写）
  - `apps/backend/src/config/env.validation.ts`（改：新增 TEMPLATE*BRAND*\* env 可选项）
- **文件上限**：≤6（实际交付 3 新 + 1 改）
- **DoD**：
  - [x] 环境变量 `TEMPLATE_BRAND_COMPANY_NAME` / `TEMPLATE_BRAND_LOGO_URL` / `TEMPLATE_BRAND_CONTACT_PHONE` / `TEMPLATE_BRAND_DOMAIN` / `TEMPLATE_ADMIN_USERNAME` / `TEMPLATE_ADMIN_PASSWORD` 存在时，覆写 SysTenant 000000 的对应字段 + 管理员 SysUser (userId=1) 密码（bcrypt 10 轮）
  - [x] 不存在时，函数返回 `{ tenantUpdated: false, adminUpdated: false }`，行为与现状一致（向后兼容）
  - [x] `pnpm --filter @apps/backend typecheck` exit 0
  - [ ] LogoURL 字段当前 SysTenant 模型未含，仅在 env 收集，未落库；如后续 ADR 决议加 `logoUrl` 字段，需补 mapping（属技术债 / Phase 4 店铺设置页一起做）

### Phase 3 — 部署文档与 env 样例 [done]

- **范围**：`deploy/template.env.example`（与 Phase 1 合并，纯文档）
- **DoD**：所有 fafafa 注入的变量 + 本仓库新增的 TEMPLATE*BRAND*_ / TEMPLATE*ADMIN*_ 都有注释
- **会话**：与 Phase 1 合并完成

## 4. 会话切分建议

本 plan 全部内容（Phase 0-3）在 1 个会话内完成（≤18 文件、估算 ≤700 行）。父 plan 的 Phase 2-5 各自另开会话与 plan。

## 5. 当前状态

| 字段                | 值                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------- |
| **current_phase**   | `3`                                                                                 |
| **phase_status**    | `done`（代码层；端到端 fafafa Pipeline 验证待运营在 fafafa 后台配置后跑）           |
| **blocked_reason**  | —                                                                                   |
| **delivered_files** | 15 个（1 plan + 1 .gitlab-ci.yml + 1 compose 模板 + 7 shell + 1 env 样例 + 4 seed） |

## 6. 已执行验证（命令 + 退出码）

| Phase | 命令                                    | exit code | 时间       |
| ----- | --------------------------------------- | --------- | ---------- |
| 1     | `pnpm fix:changed`                      | 0         | 2026-06-23 |
| 2     | `pnpm --filter @apps/backend typecheck` | 0         | 2026-06-23 |
| 1+2   | `pnpm check:slice`                      | 0         | 2026-06-23 |

注：本 plan 未跑端到端 fafafa Pipeline 验证（需在 fafafa 后台配置 `ProductDeployTemplate` 并触发，属"开发者下一步"§8 的人工步骤）。`bash -n` 静态校验未在 Windows runner 上跑，脚本依赖 fafafa Pipeline 调起时由 alpine:3.20 + bash 验证。

## 7. 下一会话 Prompt（复制）

```text
你是续作 Agent。本 plan（FAFAFA-PIVOT-PHASE1-2026-06）已交付完成，进入父 plan 下一阶段。

下一个任务：父 plan 的 Phase 2「去多租户运行时」。
读：
  - c:/Users/13415/.cursor/plans/fafafa-template-pivot_72a80291.plan.md 的 Phase 2 节
  - apps/backend/src/common/tenant/tenant.guard.ts
  - apps/backend/src/common/repository/base.repository.ts
  - apps/backend/prisma/models/30-system.prisma 的 SysTenant 模型

新建 docs/exec-plans/active/FAFAFA-PIVOT-PHASE2-2026-06.md（用 docs/exec-plans/templates/PLAN.md 模板）。

任务模式：refactor | 路径类型：cross-app | 高风险：是
约束：保留 tenantId 字段不删；不改 200+ Prisma model；只让运行时单租户兜底
验证：pnpm fix:changed && pnpm check:slice
```

## 8. 开发者下一步（复制）

1. 本地执行：`pnpm fix:changed && pnpm --filter @apps/backend typecheck`
2. 预期：exit 0（typecheck 全绿）
3. 在 fafafa 后台「模板管理 · 部署模板」配置本仓库对应 `ProductDeployTemplate`：`driver=gitlab`、`gitlabProjectId=<本仓库 GitLab 项目 ID>`、`requiredVariables` 取 `WEBSITE_TEMPLATE_REQUIRED_VARIABLES + DB_*`、`pipelineTriggerTokenKey` 指向已配置的 Trigger Token 变量名
4. fafafa 管理后台对一个测试订单点「模拟开通」（driver=gitlab），全程 9 步走完 → WebsiteService=active
5. 若通过：粘贴 §7 Prompt 开新会话推进 Phase 2
6. 若失败：不要进入 Phase 2，先修当前 Phase
