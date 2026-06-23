# Backend Technical Design Navigation

Module-level design drafts under this directory were removed after the useful boundaries, flows, and failure semantics were covered by code, OpenAPI/generated types, ADRs, or `apps/backend/docs/process-specs/**`.

## Maintenance Rules

1. Do not recreate broad module design handbooks for implemented behavior.
2. Put long-lived process rules in `../process-specs/`, architecture decisions in `docs/adr/`, and API contracts in OpenAPI/generated types.
3. Create a new design doc only before a real design decision is needed and delete or migrate it after delivery closes.
