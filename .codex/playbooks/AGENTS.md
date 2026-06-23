# Playbooks 场景手册指引

## 1. 速览

- 适用范围：`.codex/playbooks/**`
- 职责定位：面向具体场景的执行手册。
- 先读顺序：
  1. 根 `AGENTS.md`
  2. 本文件
  3. 当前任务对应 playbook
  4. 涉及文档治理时读 `docs/governance/DOCUMENT_POLICY.md`

Playbook 是“怎么执行某类任务”的手册，不是仓库总规则、业务事实源或长期设计文档。

## 2. 编写边界

- 根 `AGENTS.md` 负责任务分类、权威顺序、高风险清单和统一验证矩阵。
- 子 app / 子目录 `AGENTS.md` 负责局部地图和边界。
- `docs/governance/**` 负责制度正文。
- `.codex/playbooks/**` 负责把制度转成场景化步骤。

不要在 playbook 里复制根规则全文；需要引用时写路径和触发条件。

## 3. 现有手册

| 文件                         | 场景                                      |
| ---------------------------- | ----------------------------------------- |
| `harness-workflow.md`        | **默认执行入口**（Tier、MSV、删除分级）   |
| `risk-tiering.md`            | 验证/删除 Tier 细则                       |
| `module-retirement.md`       | 模块下线、impact、cutover                 |
| `context-scan.md`            | 跨 app / 跨目录上下文扫描                 |
| `backend-safe-change.md`     | 后端安全改动                              |
| `admin-web-module-change.md` | admin-web 模块与页面改动                  |
| `miniapp-page-change.md`     | miniapp 页面改动                          |
| `dict-and-job-change.md`     | 字典治理与定时任务                        |
| `verification-gates.md`      | 验证门禁                                  |
| `review-mode.md`             | review-only 分析                          |
| `doc-request-flow.md`        | 文档请求确认流程                          |
| `co-evolution-checklist.md`  | service/processor/repository 联动改动     |
| `session-orchestration.md`   | 大任务分会话、HANDOFF、exec-plan 强制条件 |
| `large-refactor.md`          | 跨模块重构 Phase 0–5 顺序与单对话红线     |
| `subagent-roles.md`          | 八角色子代理注册表（三端壳指针）          |
| `claude-agent-teams.md`      | Claude 多队友并行（≠ 单子代理）           |

新增 playbook 前先确认现有手册是否可扩展。检查项登记见 `pnpm harness:manifest`。

## 4. Playbook 质量要求

- 每份 playbook 只覆盖一个明确场景。
- 步骤应能被智能体执行，避免抽象口号。
- 写清输入、必读文件、扫描边界、停手条件、验证命令和交付要求。
- 高风险动作只引用根 `AGENTS.md` 的确认协议，不在 playbook 中另造确认标准。
- 如果规则可以机械检查，优先补 `scripts/**`，playbook 只说明何时运行。

## 5. 验证建议

仅改 playbook 文档时，一般无需代码验证。交付前检查：

- 是否和根 `AGENTS.md`、子目录 `AGENTS.md` 冲突。
- 是否引用了真实存在的文件和命令。
- 是否需要更新根 `AGENTS.md` 的权威文件索引。
