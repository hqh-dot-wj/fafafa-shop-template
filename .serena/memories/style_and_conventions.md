# Style and conventions

This memory is a tool-local summary, not canonical. Prefer `AGENTS.md`, `.codex/playbooks/*`, and `docs/governance/*` when instructions differ.

## Formatting and editor defaults

- `.editorconfig` sets:
  - UTF-8 encoding
  - spaces, size 2
  - LF line endings
  - trim trailing whitespace
  - final newline required
- Markdown keeps trailing whitespace and disables max line length enforcement.
- Prettier config:
  - `singleQuote: true`
  - `trailingComma: all`
  - `semi: true`
  - `printWidth: 120`
  - `tabWidth: 2`
  - `useTabs: false`
  - `endOfLine: lf`
  - `arrowParens: always`

## ESLint baseline

- Based on `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-config-prettier`.
- Repo-level rules emphasize:
  - `@typescript-eslint/no-explicit-any`: warn
  - `@typescript-eslint/no-unused-vars`: warn, `_`-prefixed args/vars allowed
  - `no-console`: warn, but `warn` and `error` allowed
  - `no-debugger`: warn
  - `no-duplicate-imports`: warn
  - `prefer-const`: warn
  - `no-var`: error
  - `eqeqeq`: warn with `smart`
- Backend TS has explicit exceptions in root ESLint for empty object type / useless constructor edge cases.

## Repo operating conventions

- Prefer minimal, evidence-based changes. Do not make broad refactors when task boundaries are unclear.
- Prefer standardized or existing repo/community solutions over custom replacements.
- Do not create or generate `.md`, PRD, design docs, or analysis docs without explicit user confirmation.
- Do not change Prisma schema/migrations, perform data migration/cleanup/destructive deletion, or alter auth/payment/tenant semantics without stopping for user confirmation.
- For cross-app changes, follow backend -> build backend if needed -> `pnpm generate-types` -> frontend updates.
- For debugging type issues, prefer project-specific commands over aggregated root `pnpm typecheck`.

## Commit conventions

- Commit message format is mandatory:
  - `<type>(<scope>): <中文描述>`
- Allowed `type`: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- Allowed `scope`: `backend`, `admin-web`, `miniapp-client`, `libs`
- Description must be Chinese.

## Hooks and staged formatting

- `commit-msg` runs `scripts/check-commit-message.mjs`
- `pre-commit` runs `pnpm lint-staged`, staged quality gates, and staged admin view type gates.
- `pre-push` runs `pnpm verify:pre-push`
- `lint-staged` routes changed files through `scripts/tasks/changed-files.mjs` so backend/admin-web/miniapp JS/TS/Vue plus styles and docs get stable staged Prettier + ESLint fixes.
- Prettier is the only formatting authority. ESLint fixes quality issues and safe autofix only.
- Root package scripts are public API; complex task logic belongs in `scripts/tasks/*.mjs`, and new public entries should pass `pnpm verify:scripts`.

## Important task-specific references

- Root repo instructions: `AGENTS.md`
- Backend rules: `apps/backend/AGENTS.md`
- Admin rules: `apps/admin-web/AGENTS.md`
- Miniapp rules: `apps/miniapp-client/AGENTS.md`
- Playbooks live under `.codex/playbooks/` and are part of the canonical rule chain.
