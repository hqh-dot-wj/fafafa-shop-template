# Miniapp Newcomer Quickstart

This guide provides a fast map of miniapp pages, API layers, and core development paths.

## 1. Key Directories

1. `apps/miniapp-client/src/pages/`: business pages
2. `apps/miniapp-client/src/pages-auth/`: login and registration
3. `apps/miniapp-client/src/api/`: API wrappers
4. `apps/miniapp-client/src/http/`: HTTP foundation
5. `apps/miniapp-client/src/store/`: Pinia stores

## 2. Active Page Domains

- `index`, `category`, `product`, `cart`, `order`, `pay`, `address`, `marketing`, `upgrade`, `me`, `preview`

## 3. API and Type Conventions

- Keep API wrappers in `src/api/` and shared request logic in `src/http/`.
- Prefer `@libs/common-types` for contract consistency.

## 4. UI and Layout Notes

- Layout and tabbar behavior live in `src/layouts/` and `src/tabbar/`.
- For scroll and page layout constraints, see `docs/guides/page-layout-scroll-control.md`.

## 5. Local Commands

```bash
pnpm dev:h5
pnpm dev:mp
pnpm check:h5
pnpm typecheck:h5
```
