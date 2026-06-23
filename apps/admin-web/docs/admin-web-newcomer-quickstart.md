# Admin Web Newcomer Quickstart

Use this guide to understand page structure, API access, and state management quickly.

## 1. Key Directories

1. `apps/admin-web/src/views/`: business pages by domain
2. `apps/admin-web/src/service/`: request and API layer
3. `apps/admin-web/src/router/`: routes and permission wiring
4. `apps/admin-web/src/store/`: Pinia state
5. `apps/admin-web/src/components/`: shared UI components

## 2. Active Page Domains

- `system`, `monitor`, `pms`, `store`, `marketing`, `member`, `tool`, `home`, `_builtin`

## 3. Development Conventions

1. Reuse existing `modules/` composition pattern under each view domain.
2. Keep API files in `src/service/api/<domain>/`.
3. Prefer shared dictionary and shared types; avoid local hard-coded option sets.

## 4. Integration Notes

- Admin web integrates with backend APIs and permission data.
- No direct code dependency on miniapp; data alignment occurs through backend contracts.

## 5. Local Commands

```bash
pnpm dev:admin
pnpm --filter @apps/admin-web lint
pnpm --filter @apps/admin-web typecheck
pnpm --filter @apps/admin-web test
```
