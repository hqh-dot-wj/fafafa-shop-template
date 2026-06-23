# Eval Phase（程序性 Phase 评估）

只读执行 plan 中 DoD 命令并审计 diff；规范见 `docs/governance/HARNESS_ROADMAP.md` §6.4。

```bash
pnpm eval:phase --plan docs/exec-plans/active/<TASK-ID>.md
pnpm eval:phase --plan docs/exec-plans/active/<TASK-ID>.md --phase 2
```

- 会**重跑** Phase 节内反引号包裹的 `pnpm` / `node` 命令
- 写入 `<plan>.eval-log.json`
- `exit 0` 才可声称 PhaseDone（还须 `pnpm check:slice` 作 SliceOK）
