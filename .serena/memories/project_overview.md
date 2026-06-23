# Nest-Admin-Soybean overview

This memory is a tool-local summary, not the canonical rule source. If it conflicts with `AGENTS.md` or `.codex/playbooks/*`, use the canonical files.

- A `pnpm` + `turborepo` monorepo for a multi-surface admin system.
- Main apps:
  - `apps/backend`: NestJS backend with Prisma and multi-tenant concerns.
  - `apps/admin-web`: Vue 3 admin frontend using Naive UI and elegant-router.
  - `apps/miniapp-client`: uni-app + Vue 3 client using wot-design-uni.
- Shared code lives under `libs/`, especially `common-constants`, `common-types`, and `common-utils`.
- Other important top-level folders: `scripts/` for repo utilities and verification scripts, `db/` for database-related assets, `docs/`, `logs/`, and `upload/`.

## Environment

- OS: Windows.
- Shell: PowerShell. Chain commands with `;` rather than Unix `&&` habits when following repo guidance.
- Required runtime versions:
  - Node `>= 20.19.0`
  - pnpm `>= 10.5.0`

## Repo-level workflow rules

- Treat this repo as instruction-driven: read the nearest `AGENTS.md` plus the relevant `.codex/playbooks/*` before changing code in a given area.
- Task categories matter:
  - `backend-only`: root `AGENTS.md` -> `apps/backend/AGENTS.md` -> `.codex/playbooks/backend-safe-change.md`
  - `admin-web-only`: root `AGENTS.md` -> `apps/admin-web/AGENTS.md` -> `.codex/playbooks/admin-web-module-change.md`
  - `miniapp-only`: root `AGENTS.md` -> `apps/miniapp-client/AGENTS.md` -> `.codex/playbooks/miniapp-page-change.md`
  - `cross-app`: root `AGENTS.md` + related app `AGENTS.md` + `.codex/playbooks/context-scan.md` + `.codex/playbooks/verification-gates.md`
  - `review-only`: root `AGENTS.md` + `.codex/playbooks/review-mode.md`
- Cross-app default change order is strict: backend first -> build backend if needed -> `pnpm generate-types` -> admin/miniapp changes.
- Do not hand-write frontend API types to bypass backend/generated contract flow.
- High-risk areas include: `finance`, `payment`, `auth`, Prisma schema/migrations/seeds, multi-tenant isolation, dictionary governance, scheduled jobs, destructive/bulk data changes, and cross-app contract changes.
- For high-risk work, read the matching layered `AGENTS.md` and relevant playbooks before touching code.
- Verification is layered:
  - Micro: `pnpm fix:changed`
  - Slice: `pnpm check:slice`
  - Batch: matching app/cross-app gates from `AGENTS.md`
  - PR: `pnpm verify-monorepo; pnpm verify:scripts; pnpm lint; pnpm typecheck; pnpm test`
- Frontend strict mode is report-only for now: `pnpm report:strict`; it must not be added to hooks or default CI.
