# Metrics Agent

Extensible ETL system for engineering metrics. See `docs/architecture.md` for full architecture, types, and API details.

## Code Style

- TypeScript strict mode, ES modules with `.js` import extensions
- Prefer `interface` over `type` for object shapes
- Classes only for the Pipeline pattern; pure functions everywhere else

## Build & Run

- `npm run etl -- <pipeline-name> [options]` — run a pipeline via `tsx`
- `npm run build` — compile TypeScript to `dist/`
- `npx tsc --noEmit` — type-check without emitting

## Conventions

- Pipeline output goes to `data/` (gitignored)
- Environment variables prefixed by data source (e.g., `JIRA_*`)
- Per-team pipeline config lives in `config.yaml` at the project root
- Shared JIRA API logic (auth, pagination) lives in `src/shared/`
- Status matching in transformers is case-insensitive
- Raw extraction returns source API native types; transformation maps to pipeline-specific record types (`MetricRecord`, `BugRecord`)
