# 大重构（Large Refactor）

## 适用

- 任务模式 `refactor` 或 `cross-app`，且已建 `docs/exec-plans/active/<TASK-ID>.md`（或 `no-exec-plan` 豁免）。
- 与 `session-orchestration.md`、`context-scan.md` 一起读。

## 单对话红线

| 常量                         | 值  | 说明                              |
| ---------------------------- | --- | --------------------------------- |
| `MAX_FILES_PER_CONVERSATION` | 20  | 建议单对话改动文件上限            |
| `MAX_LINES_PER_CONVERSATION` | 800 | 建议单对话 diff 行数上限（增+删） |

禁止同一对话：**全仓扫描 + 多 app 实现 + 宣称完整 PR verify 已完成**。

## 强制 Phase 顺序

```text
Phase 0  只读：context-scan +（按需）模块梳理(09) → 产出/更新 exec-plan；禁止写业务代码
Phase 1  保护：characterization / 现有测试绿灯；可补失败测试复现
Phase 2  后端切片：单域 refactor + co-evolution-checklist + pnpm check:slice
Phase 3  契约：若动 DTO/VO → OpenAPI → pnpm generate-types
Phase 4  前端切片：admin 或 miniapp 二选一（不要同对话双端实现）
Phase 5  Batch 验证 + PR 模板（verify 全套仅在此 Phase 或用户明确要求时）
```

每 Phase 在 exec-plan 中声明：

- 范围（路径 glob）
- 文件/行数上限
- DoD 命令列表
- 负责人/工具（可选）

## Phase 完成判定

见 `HARNESS_ROADMAP.md` §0.2：

- **SliceOK**：对本 Phase 产生的 diff 跑 `pnpm check:slice`。
- **PhaseDone**：M3 前人工核对 DoD；M3 后 `pnpm eval:phase --plan ... --phase N`。
- 禁止仅用 SliceOK 标记 PhaseDone。

## 后端切片注意

- 改 `service` / `processor` / `repository` 联动：`.codex/playbooks/co-evolution-checklist.md`。
- 模块环 / `forwardRef`：见 `HARNESS_ENGINEERING.md` §14.9、`HARNESS_AUDIT.md`。
- backend 交付前：启动 smoke 见 §14.7（`pnpm dev:backend` 或未来 `harness:boot:backend`）。

## 契约 Phase（Phase 3）

```text
backend 改 DTO/VO → 刷新 openApi.json → pnpm generate-types → 受影响前端 typecheck
```

未 `generate-types` 不得声明 cross-app 契约完成。

## 演练计划

仓库内示例：`docs/exec-plans/active/HARNESS-DRILL-2026-05.md`（仅 Harness 治理，不与业务 WIP 混用）。
