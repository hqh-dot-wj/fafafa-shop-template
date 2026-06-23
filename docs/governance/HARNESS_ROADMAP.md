---
title: Harness 工程分步建设路线图
status: active
doc_type: governance
last_verified: 2026-05-20
---

# Harness 工程分步建设路线图

本文是 **六阶段 Harness 建设方案** 的 canonical 正文（含逻辑闭合修订）。执行细节仍以根 `AGENTS.md`、`docs/governance/HARNESS_ENGINEERING.md`、`.codex/playbooks/**` 为准；本文负责 **阶段划分、里程碑、谓词定义与验收口径**。

默认三端并行：**Cursor + Codex + Claude Code**；canonical 以仓库为准；`.claude` hooks 为 Claude 专属增强，非全员前提。

---

## 0. 定义与谓词（逻辑闭合，全文引用本节）

### 0.1 真相源分层（避免「一个 JSON = 全部规则」）

| 层           | 载体                                                                | 职责                                                                                         |
| ------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **注册表**   | `harness-manifest`（阶段 0 落地）                                   | 检查项 id、script 路径、`package.json` 入口、trigger、severity、`canonical_doc` 锚点是否存在 |
| **语义规范** | `HARNESS_ENGINEERING.md`、playbook、`quality-attributes/matrix.yml` | 业务含义、何时必读、观察期升级策略                                                           |
| **执行 WIP** | `docs/exec-plans/active/<TASK-ID>.md`                               | Phase 范围、DoD 命令、状态、交接 Prompt                                                      |
| **产品交付** | `docs/delivery/features/<FEAT-ID>/`                                 | 验收与产品说明；**不得**替代 exec-plan 作 Agent 执行真相                                     |

**manifest 不是语义唯一真相**，而是 **「检查项注册表 + 触发路由」**。漂移检查范围：manifest 登记的 script 是否存在、根脚本是否有入口、文档锚点是否存在——**不**替代 HARNESS / playbook 的正文语义。

### 0.2 合格谓词（禁止混用）

```text
SliceOK(diff)     ⇔ 对当前 diff 运行 pnpm check:slice，exit 0
PhaseDone(plan,p) ⇔ 对 plan 中 Phase p 运行 pnpm eval:phase（或等价），exit 0
TaskComplete      ⇔ 当前 Phase 满足 PhaseDone ∧ SliceOK
```

- **`check:slice` 的变量是「变更文件集合」**，不知道 exec-plan 的 Phase 边界。
- **禁止**用 `SliceOK` 单独标记 `PhaseDone`。
- **禁止**在阶段 4 落地前，在 playbook 中写「Phase done = check:slice exit 0」而不提 `eval:phase`。

### 0.3 Evaluator 定义（名实一致）

| 类型                         | 能力边界                                                                                                                | 能否单独证明 TaskComplete              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **程序性 Evaluator**         | `pnpm eval:phase`：**重跑** plan 中 DoD 命令、核对 exit code；审计 git diff 是否超出 Phase 声明路径；可选读 CI artifact | **参与** PhaseDone（与 SliceOK 合取）  |
| **会话型 Evaluator（可选）** | 新对话 + **不同于实现阶段的 system 指令** + **禁止改代码**；对照 AGENTS / playbook 做 review                            | **否**；仅作 L3 补充，不能替代重跑 DoD |
| **plan 内手写 exit code**    | Agent 填入 Markdown                                                                                                     | **否**；除非 `eval:phase` 已重跑该命令 |

交付说明中的「已验证」：backend 高风险改动另见 `HARNESS_ENGINEERING.md` §14.7（启动 smoke）；不得仅用 plan 内自述 exit code。

### 0.4 Exec-plan 强制触发（可机械判定）

**仅以下项可升级为 fail**（观察期可先 warn）：

- `git diff origin/main --name-only` 文件数 ≥ `EXEC_PLAN_FILE_THRESHOLD`（默认 15，写入 manifest 常量）
- 或 diff 同时命中 ≥2 个 app 根路径（`apps/backend/`、`apps/admin-web/`、`apps/miniapp-client/`）

**以下不得作为 merge 门禁的 fail 条件**（仅 playbook 软约束）：

- 用户口头「大改」、预估文件数、未持久化的「拒绝 plan」

**唯一豁免载体**（merge 层可识别）：

- commit message trailer：`no-exec-plan: <reason>`
- 或 PR label：`no-exec-plan`

### 0.5 里程碑与阶段 0.3 的适用范围

| 交付单元                  | 阶段 0.3「不改 AGENTS 正文结构」                              |
| ------------------------- | ------------------------------------------------------------- |
| **单独 PR：仅阶段 0**     | ✅ 适用                                                       |
| **M1（阶段 0 + 1 合并）** | ❌ **废止** 0.3；允许 AGENTS 瘦身，但须满足 §1.6 迁出规则登记 |

### 0.6 阶段验收依赖（隐藏前置显式化）

| 验收项                                                   | 最早可验收里程碑       |
| -------------------------------------------------------- | ---------------------- |
| exec-plan 文件结构、DoD、HANDOFF 模板                    | M2 末（阶段 2）        |
| 三端 **仅人类** 按 README 续作同一 `active/<TASK-ID>.md` | M2 末（阶段 2.6 收窄） |
| Cursor commands / Claude 子代理句柄 / Codex 默认路径     | **M2**（阶段 3）       |
| `eval:phase` 重跑 DoD                                    | M3 ✅（阶段 4 核心）   |

### 0.7 并行轨道：基线硬化（非本路线图阶段编号）

`docs/governance/HARNESS_AUDIT.md` 中的 **基线自残**（`strictNullChecks`、ESLint warn-only、spec 漂移可 mock 改绿等）**不**被「地图瘦身」自动解决。

- 在 manifest 中用 `track: baseline-hardening` 标记依赖项（阶段 0 建表时即可占位）。
- **逻辑顺序**：迁出 AGENTS 的每条硬规则 → 须在 manifest 有 `check` 或 `enforcement: human-only`（见阶段 1.6）→ 再依赖瘦身降低违规率；**禁止**假设「缩短 AGENTS ⇒ 更守规矩」而无检查覆盖。

### 0.8 superpowers 与 exec-plans

```text
docs/superpowers/**     = 设计参考 / 历史 spec（非执行 WIP）
docs/exec-plans/**      = Agent 执行 WIP（唯一执行真相）
```

旧 `docs/superpowers/plans/*` 不自动等同 `active/`；迁移须在 exec-plan README 中写明规则。

---

## 1. 总目标

| 维度       | 目标状态                                                                      |
| ---------- | ----------------------------------------------------------------------------- |
| OpenAI     | 短 `AGENTS.md` 作目录 + `docs/` 渐进披露 + 可机械检查的 exec-plans + 规则 GC  |
| Anthropic  | Planner → Generator → **程序性** Evaluator（非自评）；会话型 Evaluator 仅可选 |
| 三端       | 共用 canonical + scripts；仅工具适配层不同                                    |
| 开发者体验 | 每阶段结束：**验证命令 + 下一对话 Prompt + WIP 文件路径**                     |

**总周期**：6 阶段，约 2～4 周/阶段，每阶段一个或数个 PR。

---

## 2. 阶段 0：基线与真相表（1～2 天）

**目的**：统一「现在到底有什么」，再改文档。

### 2.1 产出 `harness-manifest`

新增 `scripts/harness-manifest.mjs`（或生成 `docs/governance/harness-manifest.json`），每条记录示例：

```yaml
id: check-redis-blocking
canonical_doc: docs/governance/HARNESS_ENGINEERING.md#11-后续可机械化项目
script: scripts/check-redis-blocking.mjs
trigger: check:slice | pre-commit | manual
severity: fail | warn
paths: apps/backend/src/**
owner: scripts
promote_after: null # 或 date / N clean CI
enforcement: script # script | human-only
```

覆盖：`scripts/check-*.mjs`、`harness-*`、`package.json` 中 `verify:*` / `check:slice`、Git hooks、playbook 声明的必须命令。

**交付**：`pnpm harness:manifest`；`harness-doctor` 增加「文档声明 vs manifest 登记」漂移检查（先 warn）。

### 2.2 索引对齐审计

合并 `check-required-docs.mjs`、`check-agents-consistency.mjs` 的 `RULE_FILES`、根 `AGENTS.md` §10 → manifest 的 `required_artifacts` 差异表，驱动阶段 1 索引补全。

### 2.3 阶段验收

```bash
pnpm harness:doctor
pnpm verify:agents-consistency
pnpm harness:manifest   # exit 0；登记漂移为 warn，不阻塞本阶段
```

**单独 PR 时**：不改 `AGENTS.md` 正文结构。  
**合并进 M1 时**：见 §0.5。

---

## 3. 阶段 1：Canonical 重组（3～5 天）

**目的**：OpenAI 式目录 + 指针；**先 manifest 盘点，再瘦身**（§0.7）。

### 3.1 根 `AGENTS.md` 瘦身（次要指标 ≤120 行）

保留：硬规则表、任务模式×路径类型、高风险链接、验证分层表、**完整权威索引**、会话编排链接（阶段 2 playbook）。

迁出：证据等级全文、Mock 长文 → 链到 `verification-gates.md` / `HARNESS_ENGINEERING.md`。

### 3.2 补全权威索引（根 §10）

须列入且带「何时必读」：`co-evolution-checklist.md`、`ENGINEERING_CONSTITUTION.md`、`MONEY_PRECISION_PROTOCOL.md`、`ERROR_OBSERVABILITY_STANDARD.md`、`HARNESS_ROADMAP.md`（本文）、`docs/exec-plans/README.md`（阶段 2）、`session-orchestration.md` / `large-refactor.md`（阶段 2）。

### 3.3 子 `AGENTS.md` 去重

子文件不得复制根 §0 全文；只写域边界 + 深读链 + 本域高风险。

### 3.4 废弃/归档

`.cursor/agents/*.md`、`.claude/agents/*.md`、`.codex/agents/*.toml` → 短壳 + 指针 `subagent-roles.md`（八角色，纳入版本库）。  
`karpathy-guidelines.mdc`、`dev-cognitive-flow.mdc` → 弃用指针。  
`.github/copilot-instructions.md` → ≤15 行，正确 `apps/*` 路径。

### 3.5 `REQUIRED_DOCS` 数据源

阶段 1 末：`check-required-docs.mjs` 从 manifest 读列表；**仍保留双 CLAUDE**，阶段 3 再合并。

### 3.6 阶段验收（逻辑修正后）

| 条件       | 要求                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------- |
| **主验收** | 从根 `AGENTS.md` 迁出的每条硬规则，在 manifest 中有对应 `check` 或 `enforcement: human-only` |
| 次验收     | 根 `AGENTS.md` ≤120 行（不含 frontmatter）                                                   |
| 其他       | `pnpm verify:agents-consistency` 无新增超阈值；`pnpm harness:docs` 通过                      |

---

## 4. 阶段 2：会话编排与 Exec Plans（4～6 天）

### 4.1 目录约定

```text
docs/exec-plans/
  README.md
  active/<TASK-ID>.md    # 建议 YAML frontmatter：phase, status, dod_commands
  completed/
  templates/PLAN.md, HANDOFF.md
```

`active/<TASK-ID>.md` 必填：目标/非目标、任务模式+路径类型+高风险、Phase 列表（范围、文件上限、DoD）、会话切分建议、当前 Phase 状态、**下一会话 Prompt**、**已执行验证（命令 + 由 eval:phase 写入的 exit code，非手写自述）**。

### 4.2 Playbook：`session-orchestration.md`

- 何时必须建 exec-plan：`refactor` 且触发 §0.4 可计算阈值；`new-feature` 跨模块等（软约束 + 硬阈值组合）。
- 何时新开对话：tool 调用≥15 且 Phase 未完成；backend↔admin 切换；验证失败连续 2 次同方向。
- 每轮结束强制输出「开发者下一步」+「下一会话 Prompt」（与 `AGENT_OUTPUT_PROTOCOL` 合并模板 29，避免两套 HANDOFF）。

### 4.3 Playbook：`large-refactor.md`

Phase 0 只读 → 保护测试 → 后端切片 → generate-types → 前端切片 → Batch/PR。  
单对话红线：禁止同对话「扫描 + 多 app 实现 + 全量 verify 声称」；diff 建议 ≤20 文件或 ≤800 行（常量写 playbook）。

### 4.4 与 `context-scan.md` 挂钩

`refactor` / `cross-app` 进入实现前：须有 `docs/exec-plans/active/*.md`，或 `no-exec-plan` 豁免（§0.4）。  
context-scan 第 9 问：「是否应建 exec-plan / 分几会话？」

### 4.5 阶段验收（逻辑修正后）

| 项       | 要求                                                                            |
| -------- | ------------------------------------------------------------------------------- |
| 演练     | 独立 `TASK-ID`（如 `HARNESS-DRILL-2026-05`），**勿**与业务 in-flight 混用       |
| 2.6 三端 | **仅验证** exec-plan 可被人类按 README 续作；**不要求** Cursor commands（→ M2） |
| 交付块   | 人工确认「开发者下一步」可续作                                                  |

---

## 5. 阶段 3：三端适配层收敛（3～4 天）

Claude：`.claude/CLAUDE.md` 已瘦身为工具层入口（≤30 行，规则指向根 `CLAUDE.md`）；**仍保留双 CLAUDE 必需**直至 manifest 合并策略落地。子代理模板指向 `exec-plans/active/<id>.md`。  
Cursor：`000-entry` 大任务读 `session-orchestration`；`handoff` / `start-phase` commands；**alwaysApply 仅 entry**（团队约定 + 项目设置人工验收，仓库无法 fail）。  
Codex：`.codex/README.md` 增加 exec-plans 默认路径。

**阶段验收**：三端各执行同一 `TASK-ID` 的 Phase 2，**交接块格式一致**；manifest 中适配文件只引用 canonical，无重复硬规则段落。

---

## 6. 阶段 4：Evaluator 与验证闭环（5～7 天）

### 6.1 验证分层（manifest 登记）

| 层级  | 命令                       | 与 Phase 关系                 |
| ----- | -------------------------- | ----------------------------- |
| Micro | `pnpm fix:changed`         | 不标 Phase done               |
| Slice | `pnpm check:slice`         | **SliceOK**，不单独 PhaseDone |
| Batch | 矩阵 §6 + 多 app typecheck | plan 写明                     |
| PR    | `verify:pre-push` 等       | PR 模板                       |

### 6.2 `check:slice` 强化

按 manifest `promote_after` 升级；exec-plan 存在性检查仅 §0.4 可计算触发器。

### 6.3 `quality-attributes/matrix.yml` 接线

`changed-files.mjs` 读 matrix → PR 模板建议勾选；`pnpm verify:pr-slice` 模拟自检。

### 6.4 `pnpm eval:phase`（程序性 Evaluator）

```bash
pnpm eval:phase --plan docs/exec-plans/active/<id>.md [--phase N]
```

必须实现：

1. **重跑** 当前 Phase 的 DoD 命令，捕获真实 exit code（写入 plan 或 sidecar `.eval-log.json`）。
2. `git diff` 相对 `origin/main`（或可配置基线）是否超出 plan 声明路径。
3. 缺少 DoD 节或 Phase 状态为 done 但无重跑记录 → fail。

**不实现**：仅凭 plan Markdown 内数字判 pass。

可选：CI 评论机器人（方案 B）；Cursor `/eval-phase` 只读（方案 C）。

### 6.5 阶段验收

- 故意超范围 diff → `eval:phase` fail。
- Phase 标 done 但无重跑记录 → 不合格。

---

## 7. 阶段 5：输出模板与交付包对齐（3～4 天）

- 会话编排、大重构：**以 playbook 为准**，`AGENT_OUTPUT_PROTOCOL` 只索引。
- `docs/delivery/` 的 `META.yaml` 增加 `exec_plan:` 字段。
- `docs/superpowers/`：执行以 exec-plan + playbook 为准（§0.8）。

**验收**：cross-app 功能链 REQ → exec-plan → Phase 交付 → PR 可追溯；模板 28 含「开发者下一步」（聊天输出，**不**进 pre-commit fail）。

---

## 8. 阶段 6：运营、GC 与持续演进（长期）

- `pnpm harness:manifest --check`；active plan 超 14 天无 commit → blocked/归档。
- `verify:agents-consistency`：语义去重能力有限，**不**称「规则 GC 已完成」，仅作重复提示。
- manifest `promote_after` 到期 warn→fail。
- 根 `AGENTS.md` 末：大任务无 plan 不合并（§0.4）；完成 = PhaseDone ∧ SliceOK；争论以 manifest + **重跑 exit code** 为准。

---

## 9. 阶段依赖

```text
阶段0 真相表
   ↓
阶段1 Canonical（迁出规则登记 → 瘦身）──┐
   ↓                                      │
阶段2 Exec plans + 编排                   │
   ↓                                      │
阶段3 三端适配 ←──────────────────────────┘
   ↓
阶段4 eval:phase + slice/matrix
   ↓
阶段5 输出模板 + delivery
   ↓
阶段6 GC（持续）

并行：baseline-hardening（HARNESS_AUDIT）贯穿，不阻塞 0–3，但与 M3 验证闭环绑定。
```

---

## 10. 建议 PR / 里程碑

| 里程碑 | 阶段         | 合并策略                                                   |
| ------ | ------------ | ---------------------------------------------------------- |
| **M1** | 0 + 1        | 1 PR：manifest + 索引 + AGENTS 瘦身（满足 §3.6 主验收）    |
| **M2** | 2 + 3.1～3.3 | 1～2 PR：playbook + exec-plans 目录 + 演练 plan + 三端适配 |
| **M3** | 4            | 1 PR：`eval:phase` + slice/matrix                          |
| **M4** | 5 + 6 部分   | 1 PR：delivery 对齐 + plan-stale + PR 模板                 |
| **M5** | 6            | 持续小 PR                                                  |

---

## 11. 成功标准（修订后）

1. 大 refactor **默认**有 `active` exec-plan；强制仅 §0.4 可计算项 + 豁免载体。
2. Phase 结束交付含「开发者下一步」+「下一会话 Prompt」（人工续作；非 CI 必检）。
3. **manifest = 检查项注册表**；语义仍在 HARNESS / playbook / matrix。
4. 三端会话切分读同一 playbook；差异仅在 hooks/format。
5. **TaskComplete** = `PhaseDone`（`eval:phase` **重跑** DoD）∧ `SliceOK`；禁止 plan 自述代替重跑。
6. Copilot 不再引用 `server/`、`admin-naive-ui`。

---

## 12. 三端复用 vs 区分

| 共用                            | 仅工具层                         |
| ------------------------------- | -------------------------------- |
| `AGENTS.md` + 子 AGENTS         | `.cursor/rules`、`commands`      |
| `.codex/playbooks/**`           | Claude hooks（机器 B）           |
| `docs/exec-plans/**`            | Cursor `alwaysApply`（项目设置） |
| `docs/governance/**`            | Codex 云 review 配置             |
| `scripts/**` + manifest         | Serena memories（摘要指针）      |
| `AGENT_OUTPUT_*`、PR 模板       |                                  |
| `quality-attributes/matrix.yml` |                                  |
