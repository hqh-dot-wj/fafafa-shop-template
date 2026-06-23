---
title: 文档治理策略
status: active
doc_type: governance
last_verified: 2026-05-22
---

# 文档治理策略（DOCUMENT_POLICY）

## 1. 目录分层（知识分层）

| 目录                                          | 用途           | 说明                                                                                                 |
| --------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| `docs/governance/`                            | 制度与宪章     | 工程宪章、本文档                                                                                     |
| `docs/adr/`                                   | 架构决策记录   | 不可逆或高成本决策，一文一决策                                                                       |
| `docs/domain/`                                | 领域与术语     | 术语表、业务词汇单一来源                                                                             |
| `docs/delivery/`                              | 交付产物入口   | 功能包、模板（见 `delivery/README.md`）                                                              |
| `docs/development/` 等                        | 开发与运维文档 | VitePress 开发栏目；部署与线上步骤见仓库根 `deploy/`；仓库级约定见根 `AGENTS.md`、各 app `AGENTS.md` |
| （已删除）`docs/architecture/`、`docs/guide/` | —              | 原内容与代码脱节；包边界以 `scripts/verify-monorepo.mjs`、`.cursor/rules/common/monorepo.mdc` 为准   |

## 2. Frontmatter（推荐）

正式文档建议包含：

```yaml
---
title: 文档标题
status: draft | active | deprecated | archived
doc_type: governance | architecture | domain | delivery
last_verified: YYYY-MM-DD
---
```

**必填（本仓库当前阶段）**：`status`、`last_verified`。其余字段逐步补齐。

## 3. 单一事实来源（SoT）

- 同一主题**只应有一篇**「主文档」；其他文档通过链接引用，不重复全文。
- ADR 接受后，相关「为什么」以 ADR 为准；实现细节可在 `design/` 或应用内文档展开，但须在 ADR 或主文档中链回。

## 4. 临时文档

- 放在 `docs/delivery/features/<FEAT-ID>/` 或明确标注 `status: draft` 并写清**适用版本 / 过期条件**。
- 功能型 quick start、一次性对接说明**不得**冒充全局规范；须在文首说明范围。

## 5. 设计、需求与开发类文档（交付完成即删除）

下列路径中的文档默认视为**随交付迭代的工件**，不是长期档案；**当对应能力已在默认分支合并、上线或验收关闭后**，应删除原文，而不是长期保留「已完成」的说明稿。

| 类别         | 典型路径                                                                                                                                              | 删除前必须做的事                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 技术设计     | `apps/backend/docs/design/**`（模块设计稿）                                                                                                           | 将**仍对维护者有用**的边界、状态机、失败语义写入 `docs/adr/`、`apps/backend/docs/process-specs/` 或代码旁注释；更新索引与链接                 |
| 业务需求     | `apps/backend/docs/requirements/**`                                                                                                                   | 将验收约束、接口契约沉淀到 `process-specs`、OpenAPI/类型或 `docs/domain/`；前后端对齐类内容合并到 `docs/design/*-alignment.md` 后删除单篇需求 |
| 开发过程记录 | `docs/development/` 下的执行计划、阶段性总结；~~`apps/backend/docs/tasks/`、`improvements/`、`plans/`、`summaries/`~~（已物理删除，勿再恢复为长文堆） | 将结论写入 ADR、治理文档或 `architecture-optimization-tasks` 等**汇总索引**的一条目后删除过程稿                                               |

**不删除**（除非被更高层策略取代）：`docs/governance/`、`docs/adr/`、各子目录 `README.md` 索引（如 `docs/adr/`、`docs/domain/`）、`process-specs` 中仍作为运行契约的规格。

**操作顺序（强制）**：合并/发布完成 → 迁移可复用知识 → 全仓搜索并更新引用 → `git rm` 删除文件 → PR 中注明「已收敛至某 ADR/某 process-spec」。

## 6. AI 与文档

- **生成新文档前**须征得维护者确认（见根目录 `AGENTS.md` 行为约定）。
- AI 编码规范以 `AGENTS.md` 与 `.codex/playbooks/*` 为 canonical；`.cursor/`、`.claude/`、`.serena/` 只做工具适配与摘要，不重复堆叠全文。
- AI 的统一输出入口、逻辑矫正与注释审查协议以 `docs/governance/AGENT_OUTPUT_PROTOCOL.md` 为准；完整模板正文以 `docs/governance/AGENT_OUTPUT_TEMPLATES.md` 为准。

## 7. 变更记录

- 调整本策略时，更新 `last_verified` 并在 PR 中简述影响范围。
