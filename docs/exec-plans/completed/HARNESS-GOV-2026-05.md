---
task_id: HARNESS-GOV-2026-05
status: completed
current_phase: 4
task_mode: doc-governance
path_type: doc-only
high_risk: false
created: 2026-05-20
last_updated: 2026-05-20
completed: 2026-05-20
---

# Exec Plan: HARNESS-GOV-2026-05（已完成）

Harness M1–M4 治理收口（manifest、doctor、eval-phase、注释约定、promoteAfter）。**不含**业务代码与 `HARNESS_AUDIT` 基线硬化。

## 3. Phase 列表（摘要）

| Phase | 内容                                              | 状态      |
| ----- | ------------------------------------------------- | --------- |
| 0     | manifest + doctor                                 | ✅        |
| 1     | AGENTS §7 注释 + co-evolution §四                 | ✅        |
| 2     | `effectiveSeverity` / `collectPromoteAfterIssues` | ✅        |
| 3     | export-limits 升 fail                             | 延期 → §6 |
| 4     | eval + 归档                                       | ✅        |

### Phase 4 DoD（已重跑）

- `pnpm harness:manifest:check` → 0
- `pnpm harness:docs` → 0
- `node --test scripts/harness-manifest.spec.mjs` → 0

## 5. 已执行验证

| Phase | 命令                                                        | exit code | 时间       |
| ----- | ----------------------------------------------------------- | --------- | ---------- |
| 4     | `pnpm harness:manifest:check`                               | 0         | 2026-05-20 |
| 4     | `pnpm harness:docs`                                         | 0         | 2026-05-20 |
| 4     | `node --test scripts/harness-manifest.spec.mjs`             | 0         | 2026-05-20 |
| 4     | `pnpm eval:phase --plan …/HARNESS-GOV-2026-05.md --phase 4` | 0         | 2026-05-20 |

侧车日志：`docs/exec-plans/completed/HARNESS-GOV-2026-05.md.eval-log.json`

## 6. 须你人工处理（Agent 不做）

### 必做（合并治理）

1. **独立 PR**
   - 只纳入治理路径（勿夹 `apps/**`、deploy、Docker 等业务/运维）：  
     `docs/governance/**`、`scripts/harness-*`、`scripts/eval-phase*`、`scripts/check-exec-plan*`、`docs/exec-plans/**`、`.codex/**`、`.cursor/commands/**`、`.cursor/rules/000-entry.mdc`、`.github/PULL_REQUEST_TEMPLATE.md`、`AGENTS.md`、`CLAUDE.md`、`.claude/CLAUDE.md`
   - 当前工作区若还有 `deploy/`、`Dockerfile`、`docker-compose.prod.yml` 等，**不要**与本 PR 混提。
   - PR 描述链接：`docs/exec-plans/completed/HARNESS-GOV-2026-05.md`

2. **Review + 合并**
   - 合并前本地：`pnpm harness:manifest:check && pnpm harness:doctor && pnpm verify:scripts`（可选 `pnpm verify` 全量）。
   - 不要求为治理 PR 跑全仓 `pnpm test`（无业务改动）。

### 建议做（三端习惯）

3. **Cursor 项目设置**
   - `alwaysApply` **仅**保留 `.cursor/rules/000-entry.mdc`（路线图阶段 3；仓库无法自动验收）。

4. **大 diff 业务 PR**
   - 保持 `docs/exec-plans/active/MONEY-*`、`REFUND-*` 等；大改无 plan 时会被 `exec-plan-presence` **warn**（观察期，尚未 fail）。

### 日历 / 后续小 PR（非阻塞本收口）

5. **2026-06-19 后**
   - 将 `scripts/harness-manifest.mjs` 中 `check-export-limits` 的 `severity` 从 `warn` 改为 `fail`（到期前 `pnpm harness:manifest:check` 会提示 `promote-after:*`）。

6. **阶段 3 余量**（另开 TASK 或下轮 HARNESS-GOV）
   - 双 `CLAUDE.md` 是否合并为 manifest 单必需。
   - `exec-plan-presence` 观察期结束后是否升 fail（团队拍板）。

7. **并行轨 `HARNESS_AUDIT`**
   - strictNull、ESLint 阻断、`harness:boot:backend` 实现 — **独立 PR**，不与本治理合并。
