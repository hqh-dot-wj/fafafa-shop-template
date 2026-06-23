---
title: ADR Index
status: active
doc_type: architecture
last_verified: 2026-04-15
---

# Architecture Decision Records

This directory stores accepted architecture decisions.

## Active ADRs

| Document                                                                                         | Topic                               |
| ------------------------------------------------------------------------------------------------ | ----------------------------------- |
| [ADR-0001-typescript-strictness.md](./ADR-0001-typescript-strictness.md)                         | Backend `strictNullChecks` strategy |
| [ADR-0002-eslint-layering.md](./ADR-0002-eslint-layering.md)                                     | ESLint multi-app layering strategy  |
| [ADR-0003-soft-delete-strategy.md](./ADR-0003-soft-delete-strategy.md)                           | Soft-delete strategy                |
| [ADR-0004-member-asset-source-of-truth.md](./ADR-0004-member-asset-source-of-truth.md)           | Member asset source of truth        |
| [ADR-0005-marketing-scene-driven-resolution.md](./ADR-0005-marketing-scene-driven-resolution.md) | 营销 C 端场景快照主链路与观测       |
| [ADR-0006-product-card-display-boundary.md](./ADR-0006-product-card-display-boundary.md)         | 商品卡展示标签与营销价签边界       |

## Relation to `docs/design/`

- ADR answers why a decision is chosen.
- `docs/design/` contains implementation-oriented designs and alignment notes.
