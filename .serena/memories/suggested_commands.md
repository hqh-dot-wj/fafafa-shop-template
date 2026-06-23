# Suggested commands for Nest-Admin-Soybean

This memory is a convenience list, not canonical. Prefer `AGENTS.md` and `.codex/playbooks/*` for current rules.

## Core repo commands

- Install deps: `pnpm install`
- Run all dev tasks: `pnpm dev`
- Backend dev: `pnpm dev:backend`
- Admin web dev: `pnpm dev:admin`
- Miniapp dev: `pnpm dev:mp`（根目录）/ `pnpm --filter @apps/miniapp-client dev:h5`（仅 H5 模式）

## Build commands

- Build all: `pnpm build`
- Build backend: `pnpm build:backend`
- Build admin web: `pnpm build:admin`
- Build miniapp: `pnpm build:mp`（根目录）/ `pnpm --filter @apps/miniapp-client build:h5`（仅 H5 模式）

## Type generation and contracts

- Generate shared contract/types: `pnpm generate-types`
- Explicit contracts pipeline: `pnpm contracts:generate`
- Contracts check against frontends: `pnpm contracts:check`
- Important: backend may need to be built first before `pnpm generate-types` in cross-app work.

## Verification commands

- Micro changed-file fix: `pnpm fix:changed`
- Slice check for affected files: `pnpm check:slice`
- Package scripts governance: `pnpm verify:scripts`
- Frontend strict report, non-blocking: `pnpm report:strict`
- Monorepo integrity: `pnpm verify-monorepo`
- Lint all: `pnpm lint`
- Typecheck all: `pnpm typecheck`
- Test all: `pnpm test`
- Full verify: `pnpm verify` — same as scripts in root `package.json`; it does not call root `pnpm build`, but turbo `typecheck` / `test` can still build dependencies via `^build`.
- Common narrower checks:
  - Backend lint/typecheck: `pnpm check:backend`
  - Admin lint/typecheck: `pnpm check:admin`
  - Miniapp lint/typecheck: `pnpm check:h5`
  - Backend-only typecheck: `pnpm typecheck:backend`
  - Admin-only typecheck: `pnpm typecheck:admin`
  - Miniapp-only typecheck: `pnpm typecheck:h5`
- Merge gate from repo instructions: `pnpm verify-monorepo; pnpm verify:scripts; pnpm lint; pnpm typecheck; pnpm test`

## Useful repo scripts

- Pre-push lightweight gate: `pnpm verify:pre-push`
- Dictionary governance check: `pnpm verify:dict-governance`
- Menu orphan check: `pnpm --filter @apps/backend check:menu-orphans`
- Marketing regression suite: run the backend package test command directly with the relevant spec names; do not add root scripts for business-domain suites.

## Windows / PowerShell basics

- List files: `Get-ChildItem`
- Change directory: `Set-Location <path>`
- Read a file: `Get-Content -Raw <path>`
- Search text in files: `Select-String -Path <glob> -Pattern <text>`
- Check executable resolution: `Get-Command <name>`
- Chain commands in this repo's documented style: `cmd1; cmd2`

## Git commands worth knowing

- Status: `git status`
- Diff working tree: `git diff`
- Diff staged: `git diff --cached`
- Create branch: `git switch -c codex/<topic>`
- Commit with required format: `git commit -m "feat(backend): 中文描述"`
