# Shared Libraries Newcomer Quickstart

The `libs/` directory hosts reusable code for multiple apps.

## 1. `common-types`

- Path: `libs/common-types/`
- Purpose: shared type contracts and domain enums

## 2. `common-constants`

- Path: `libs/common-constants/`
- Purpose: shared constants and dictionary governance
- Key file: `src/dict-governance/registry.ts`

## 3. `common-utils`

- Path: `libs/common-utils/`
- Purpose: reusable utility functions

## 4. Usage Rules

1. Put truly shared logic in `libs/` instead of duplicating inside apps.
2. After shared type changes, run downstream checks for admin web and miniapp.
3. For dictionary updates, run governance checks in the same change set.

## 5. Local Commands

```bash
pnpm --filter @libs/common-types typecheck
pnpm --filter @libs/common-constants test
pnpm --filter @libs/common-utils test
```
