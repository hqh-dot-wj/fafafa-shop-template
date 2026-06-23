# Docs 文档指引

## 1. 速览

- 适用范围：`docs/**`
- 职责定位：仓库内版本化知识库，承载治理、ADR、领域术语与交付文档；部署与线上运维见仓库根 `deploy/`。
- 先读顺序：
  1. 根 `AGENTS.md`
  2. 本文件
  3. `.codex/playbooks/doc-request-flow.md`
  4. `docs/governance/DOCUMENT_POLICY.md`

新增或生成 `.md` 前必须先获得用户确认。已确认后，仍需判断文档类型、目录归属和是否与现有主文档重复。

## 2. 目录职责

| 目录                | 职责                                              |
| ------------------- | ------------------------------------------------- |
| `docs/governance/`  | 工程治理、Harness Engineering、输出协议、文档策略 |
| `docs/adr/`         | 架构决策记录，不可逆或高成本决策一文一决策        |
| `docs/domain/`      | 领域术语、业务词汇与语义单一来源                  |
| `docs/delivery/`    | 交付产物入口、功能包模板                          |
| `docs/development/` | 开发过程与专题材料，交付后按策略收敛              |
| `docs/design/`      | 技术设计、前后端对齐、专题方案                    |

目录归属以 `docs/governance/DOCUMENT_POLICY.md` 为准。不要把过程稿伪装成长期规范。

## 3. 文档写作边界

- `AGENTS.md` 是智能体地图，`docs/` 是知识库；两者不要互相复制全文。
- 同一主题只保留一个主文档，其他文档通过链接引用。
- ADR 记录“为什么做这个决策”；设计文档记录“怎么落地”；交付文档记录“这次交付如何验收”。
- 功能完成、合并或验收关闭后，过程稿要迁移有用知识再删除，不长期保留“已完成说明稿”。
- 文档中的命令、路径、脚本名必须能在仓库里找到；不写无证据假设。

## 4. Frontmatter

正式文档建议包含：

```yaml
---
title: 文档标题
status: draft | active | deprecated | archived
doc_type: governance | architecture | domain | delivery
last_verified: YYYY-MM-DD
---
```

当前阶段至少保持 `status` 与 `last_verified` 可维护。更新治理类文档时同步更新 `last_verified`。

## 5. Harness 文档策略

- 根 `AGENTS.md` 保持短入口和权威索引。
- 子目录 `AGENTS.md` 只写局部地图、边界、高风险点和验证入口。
- Harness Engineering 主文档放在 `docs/governance/HARNESS_ENGINEERING.md`；分阶段建设与合格谓词（`SliceOK` / `PhaseDone` / manifest 边界）见 `docs/governance/HARNESS_ROADMAP.md`。不要作为 `docs/development/` 过程稿长期保存。
- 复杂流程写到 `.codex/playbooks/**`，不要塞回根 `AGENTS.md`。
- 可机械检查的规则优先沉淀到 `scripts/**`。
- 业务语义和长期维护知识优先沉淀到 `docs/domain/`、`docs/adr/` 或对应主文档。

## 6. Superpowers 与执行真相

| 目录                                | 定位                                                |
| ----------------------------------- | --------------------------------------------------- |
| `docs/superpowers/specs/`、`plans/` | 设计参考 / 历史 spec，**非** Agent 执行 WIP         |
| `docs/exec-plans/active/`           | 实施编排唯一 WIP（Phase、DoD、`pnpm eval:phase`）   |
| `docs/delivery/features/`           | 产品交付与验收（`META.yaml` 通过 `exec_plan` 关联） |

文中若出现「REQUIRED SUB-SKILL: superpowers:…」，仓库内等效路径为 exec-plan + `.codex/playbooks/**`，superpowers 仅作对照。

## 7. 验证建议

文档改动通常不跑代码验证。交付前至少检查：

- 路径、命令、脚本名是否真实存在。
- 新文档是否已获得用户确认。
- 是否与 `DOCUMENT_POLICY.md` 的目录分层冲突。
- 是否新增了需要更新的索引、README 或根 `AGENTS.md` 权威索引。

如修改文档检查脚本或治理规则，再按 `scripts/AGENTS.md` 执行脚本验证。
