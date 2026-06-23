---
task_id: TASK-ID-HERE
status: active
current_phase: 0
task_mode: refactor
path_type: cross-app
high_risk: false
created: YYYY-MM-DD
last_updated: YYYY-MM-DD
---

# Exec Plan: {TASK-ID-HERE}

## 1. 目标 / 非目标

**目标**

- **非目标**

-

## 2. 任务元数据

| 字段      | 值                                                     |
| --------- | ------------------------------------------------------ |
| 任务模式  | `refactor` / `new-feature` / …                         |
| 路径类型  | `backend-only` / `cross-app` / …                       |
| 高风险    | 是 / 否（若「是」链 `HIGH_RISK_REGISTRY.md` 确认记录） |
| 关联 FEAT | `docs/delivery/features/...`（可选）                   |

## 3. Phase 列表

### Phase 0 — 只读扫描

- **范围**：
- **文件上限**：0 业务代码改动
- **DoD**：
  - [ ] `context-scan.md` 第 1–9 问已回答
  - [ ] 本 plan 已提交到 `active/`
- **会话**：1 对话

### Phase 1 — 保护测试

- **范围**：
- **文件上限**：≤ `MAX_FILES`（见 `large-refactor.md`）
- **DoD**：
  - [ ] 相关 spec 绿灯或已写 characterization
  - [ ] `pnpm check:slice`（若已有改动）
- **会话**：1 对话

<!-- 按需复制 Phase 2+ -->

## 4. 会话切分建议

| Phase | 建议对话数 | 说明          |
| ----- | ---------- | ------------- |
| 0     | 1          | 只读          |
| 1     | 1          | 测试保护      |
| 2+    | 1:1 或 1:N | 按 app/域拆分 |

## 5. 当前状态

| 字段               | 值                         |
| ------------------ | -------------------------- |
| **current_phase**  | `0`                        |
| **phase_status**   | `wip` / `blocked` / `done` |
| **blocked_reason** | （若 blocked）             |

## 6. 已执行验证（命令 + 退出码）

> 由 Agent 在 **实际运行** 后填写；M3 后由 `pnpm eval:phase` 回写。禁止未运行写 `0`。

| Phase | 命令 | exit code | 时间 |
| ----- | ---- | --------- | ---- |
|       |      |           |      |

## 7. 下一会话 Prompt（复制）

```text
你是续作 Agent。先读 docs/exec-plans/active/{TASK-ID-HERE}.md 的 Phase {N}。
任务模式：… | 路径类型：… | 高风险：…
约束：只改 Phase 声明范围；禁止扩大验证声称。
验证：pnpm check:slice（Phase 未完成前不得宣称 TaskComplete）
```

## 8. 开发者下一步（复制）

1. 本地执行：`…`
2. 预期：exit 0 / 具体通过条件
3. 若通过：新对话粘贴 §7 Prompt
4. 若失败：不要进入 Phase N+1，先修当前 Phase
