# What to do when a task is completed

This memory is a tool-local summary. Canonical completion rules live in `AGENTS.md` and `.codex/playbooks/verification-gates.md`.

- First choose the narrowest verification commands that match the area touched.
- Micro gate for small changes:
  - `pnpm fix:changed`
- Slice gate for affected app / scripts closure:
  - `pnpm check:slice`
- Prefer per-project checks during investigation:
  - `pnpm typecheck:backend`
  - `pnpm typecheck:admin`
  - `pnpm typecheck:h5`
  - plus the relevant lint/test/build commands for the affected app
- For broader completion, repo guidance says the merge gate is:
  - `pnpm verify-monorepo; pnpm verify:scripts; pnpm lint; pnpm typecheck; pnpm test`
- A broader all-in gate exists as `pnpm verify` (monorepo + scripts governance + lint + quality gates + admin-view-types + typecheck + test); it does not call root `pnpm build`, but turbo `typecheck` / `test` can still build dependencies via `^build`.
- Do not run expensive full-repo verification unless the user asked for it or the scope justifies it.

## Before finishing or handing off

- Re-check whether the task was backend-only, admin-only, miniapp-only, cross-app, or review-only, and make sure the required `AGENTS.md` / playbook chain was respected.
- If the work is cross-app, confirm the contract flow was respected: backend first, then generated types, then frontend.
- If the task touched any high-risk area (`finance`, `payment`, `auth`, Prisma/migrations/seeds, multi-tenant, dicts, schedulers, destructive data changes, contract changes), verify that the appropriate app rules and playbooks were consulted before the change.
- Respect the repo's doc rule: no new `.md` documents without user confirmation.
- Keep commit messages in required Chinese format before commit.

## Practical completion checklist

- Run the smallest sufficient lint/typecheck/test/build commands for the changed scope.
- Do not run full lint/typecheck/test/verify for a Micro task unless the user explicitly asks or the work is in PR/merge-gate scope.
- Only claim success based on fresh command output.
- If preparing to merge, run the repo merge gate or the user-requested equivalent.
- Mention any checks not run and why.
