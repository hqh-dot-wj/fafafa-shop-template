# 开发文档

本目录包含项目开发相关的文档和指南。

---

## 📚 文档索引

### 快速开始

- [快速开始](./getting-started.md) - 项目环境搭建和运行指南

### 开发规范

- [CODEOWNERS 使用指南](./codeowners-guide.md) - 代码所有权和审查规则
- [依赖管理规范](./dependency-management.md) - Monorepo 依赖版本管理
- [GitHub 配置指南](./github-setup.md) - 分支保护、团队配置等

### AI 辅助开发

- [Skills 安装指南](./skills-installation.md) - Anthony Fu Skills 安装和配置
- [AI 错误记录](./agent-error-record.md) - AI 协作中可复盘错误的记录入口

### 测试

- [Harness Engineering 工程指南](../governance/HARNESS_ENGINEERING.md) - Harness 脚本、后端耗时任务、队列/Worker 和验证门禁

### 架构优化

- [Monorepo 架构审计报告](./monorepo-architecture-audit.md) - 架构健康度、治理缺口与后续改进项
- [架构优化任务索引](./architecture-optimization-tasks.md) - 已收敛架构任务与未关闭事项

---

## 🗂️ 文档分类说明

### 仓库入门（非 VitePress 独占）

- 根目录 `AGENTS.md`、各 `apps/*/AGENTS.md`
- `docs/governance/`（工程宪章与文档策略）

### `/docs/development/` - 开发文档（当前目录）

面向开发者的文档，包括：

- 开发环境搭建
- 开发规范
- 测试指南
- 架构优化记录

### `/docs/design/` - 设计文档

架构设计和分析文档，包括：

- 架构分析
- 模块设计
- 技术选型

部署与线上运维步骤见仓库根目录 `deploy/`（`docker-compose`、`nginx`、`scripts/remote_deploy.sh` 等）。

---

## 📝 文档命名规范

### 文件命名

- 使用 kebab-case（小写字母 + 连字符）
- 例如: `getting-started.md`, `dependency-management.md`

### 标题规范

- 一级标题: 文档主题
- 二级标题: 主要章节
- 三级标题: 子章节

### 内容组织

1. 概述/目录
2. 主要内容
3. 示例/代码
4. 相关资源
5. 更新记录

---

## 🔄 文档维护

### 更新频率

- **开发规范**: 有变更时立即更新
- **架构优化索引**: 每次完成任务后只更新摘要和权威落点
- **测试文档**: 测试策略变更时更新

### 维护责任

- 文档所有者: @hqh-dot-wj
- 审查要求: 文档变更需要 PR 审查
- 文档治理策略以 [DOCUMENT_POLICY.md](../governance/DOCUMENT_POLICY.md) 为准

---

**最后更新**: 2026-05-22
**维护者**: @hqh-dot-wj
