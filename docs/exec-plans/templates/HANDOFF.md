# 会话 HANDOFF 片段

> 粘贴到聊天回复末尾，并同步更新 `docs/exec-plans/active/<TASK-ID>.md` 的 §5–§8。  
> 与 `AGENT_OUTPUT_PROTOCOL` 模板 28 §11–§12、模板 29 对齐；勿维护第三套格式。

**禁止重复**：不得粘贴 PRD、长方案、完整 diff 说明；只写指针（路径、TASK-ID、Phase）与下一会话 Prompt。细节以 `active/<TASK-ID>.md` 与 Git 为准。

## 本轮摘要

- **TASK-ID**：
- **Phase**：
- **完成**：
- **未完成 / blocked**：

## 开发者下一步

1. 本地执行：`pnpm …`
2. 预期结果：exit 0 / …
3. 若通过：新开对话，粘贴下方 Prompt
4. 若失败：不要进入 Phase N+1

## 下一会话 Prompt

```text
你是续作 Agent。先读 docs/exec-plans/active/<TASK-ID>.md Phase <N>。
任务模式：<mode> | 路径类型：<path-type> | 高风险：<yes/no>
本 Phase 范围：<paths globs>
DoD：<commands>
约束：只读/可写范围 …；禁止 mock 假绿；禁止无证据结论。
验证：pnpm check:slice
```

## 已写入 plan 的验证（实际运行）

| 命令 | exit code |
| ---- | --------- |
|      |           |
