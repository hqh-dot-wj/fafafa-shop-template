---
title: Backend testing documentation
status: active
doc_type: development
last_verified: 2026-05-10
---

# Backend Testing Documentation

This directory keeps long-lived backend testing guidance. Test inventories and one-off completion summaries are not authoritative; use the source tree and package scripts as the source of truth.

## Current Entrypoints

| Need | Document |
| ---- | -------- |
| Backend unit and integration conventions | [testing-guide.md](./testing-guide.md) |
| Backend E2E flow and environment notes | [e2e-test-guide.md](./e2e-test-guide.md) |
| Coupon, points, and commission calculation tests | [commission-testing-guide.md](./commission-testing-guide.md) |

## Commands

Run from the repository root:

```bash
pnpm test:backend
pnpm --filter @apps/backend test
pnpm --filter @apps/backend test:e2e
pnpm --filter @apps/backend test:finance
pnpm --filter @apps/backend test:commission
```

For change-specific validation, prefer the root task routing rules from `AGENTS.md` and `.codex/playbooks/verification-gates.md`.

## Source Locations

- Unit tests: `apps/backend/src/**/*.spec.ts` and selected legacy tests under `apps/backend/test/unit/`
- Integration tests: `apps/backend/test/integration/*.spec.ts`
- E2E tests: `apps/backend/test/*.e2e-spec.ts`
- Shared fixtures: `apps/backend/test/fixtures/`
- Finance test helpers: `apps/backend/src/module/finance/test/`
