# Backend Newcomer Quickstart

This document helps first-time contributors build a practical mental model of the backend within 10 minutes.

## 1. Core Directories

1. `apps/backend/src/module/`: domain modules
2. `apps/backend/src/common/`: cross-cutting infrastructure
3. `apps/backend/src/config/`: configuration loading and mapping
4. `apps/backend/src/prisma/`: Prisma extensions and DB integration
5. `apps/backend/prisma/`: schema, migrations, and seed data

## 2. Active Domain Modules

- `admin`, `client`, `store`, `pms`, `marketing`, `finance`, `payment`, `risk`, `lbs`, `notification`

## 3. Typical API Change Flow

1. Add or update `dto`, `vo`, `controller`, `service`, and repository layer in the target module.
2. Reuse existing common capabilities first; avoid parallel custom infrastructure.
3. Align enums and dictionaries with shared libraries before frontend integration.

## 4. Data and Tenant Constraints

- Use unified `DATABASE_URL` source.
- Follow repository and Prisma extension conventions for tenant and soft-delete constraints.
- For dictionary changes, update governance registry and seed data in the same change set.

## 5. Local Commands

```bash
pnpm dev:backend
pnpm --filter @apps/backend typecheck
pnpm --filter @apps/backend test
node scripts/check-dict-governance.mjs
```
