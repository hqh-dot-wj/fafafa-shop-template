# Backend Documentation Index

This index is aligned with the current backend code layout and is optimized for onboarding and module discovery.

## Recommended Reading Order

1. [Backend Newcomer Quickstart](./backend-newcomer-quickstart.md)
2. [Technical Design Navigation](./design/README.md)
3. [Requirements Navigation](./requirements/README.md)
4. [Process Specifications](./process-specs/)
5. [Testing Documentation](./testing/)

## Common Subdirectories

- `design/`: module-level technical design
- `requirements/`: business requirements and acceptance constraints
- `process-specs/`: cross-module process and event contracts
- `guides/`: deployment, configuration, and operations guidance
- `testing/`: strategy, scripts, and summaries
- `references/`: quick references and module overviews
- `archive/`: 少量历史快照（非权威）
- ~~`tasks/`、`improvements/`、`plans/`、`summaries/`~~：过程稿目录已删除（2026-04）；新过程说明请写在 PR / `docs/design/` 或 ADR，避免再堆长文

## 文档生命周期（与仓库治理一致）

`design/`、`requirements/` 中的单篇文档仍可能为**交付过程稿**：对应能力在默认分支**合并且验收结束后**，应把仍需长期保留的结论迁移到 ADR、`process-specs/`、`docs/design/*-alignment.md` 或代码注释，然后**删除**原文并更新全仓链接。`tasks/`、`improvements/`、`plans/`、`summaries/` 目录已删除，不再作为落点。细则见根目录 [`docs/governance/DOCUMENT_POLICY.md`](../../../docs/governance/DOCUMENT_POLICY.md) 第 5 节。

## Code Mapping

- Core modules: `apps/backend/src/module/`
- Infrastructure: `apps/backend/src/common/`, `apps/backend/src/config/`, `apps/backend/src/prisma/`
- Seed entry: `apps/backend/prisma/seeds/run-bootstrap-then-hunan-overrides.ts`
- Dictionary governance source: `libs/common-constants/src/dict-governance/registry.ts`

## Verification Commands

```bash
node scripts/verify-monorepo.mjs
pnpm --filter @apps/backend typecheck
```
