# Metrics Agent — Architecture

## Purpose

An extensible ETL system that extracts engineering metrics from external tools (JIRA, GitHub), transforms raw data into standardized records, and outputs results as JSON.

## Project Structure

```
metrics-agent/
├── src/
│   ├── index.ts                       # CLI entry point (Commander)
│   ├── config.ts                      # Environment + team config loader
│   ├── types.ts                       # Shared types: MetricRecord, BugRecord, ETLResult, PipelineSummary
│   ├── shared/
│   │   ├── jira-types.ts              # Shared JIRA API response types
│   │   ├── jira-api.ts                # Shared JIRA fetch with pagination & auth
│   │   ├── github-types.ts            # GitHub API response types
│   │   └── github-api.ts              # GitHub Search API client with pagination & rate limit handling
│   ├── loaders/
│   │   └── json-loader.ts             # Writes JSON to data/ directory
│   └── pipelines/
│       ├── base.ts                    # Abstract Pipeline<TRaw, TTransformed>
│       ├── jira-cycle-time/           # Cycle time between JIRA status transitions
│       ├── jira-bugs/                 # Customer bug counts by severity
│       └── github-prs/               # GitHub PR metrics (count, time-to-close, contributors)
├── config.yaml                        # Per-team pipeline configuration
├── data/                              # Pipeline output (gitignored)
├── docs/                              # Pipeline-specific documentation
├── .env                               # API credentials (gitignored)
├── .env.example                       # Template for required env vars
├── package.json
├── tsconfig.json
└── README.md
```

## Core Abstractions

### Pipeline Base Class (`src/pipelines/base.ts`)

Template method pattern with four steps:

```
extract()   → raw records from external API
transform() → standardized output records
summarize() → aggregate stats (averages, medians, breakdowns)
load()      → write to output destination, return file path
```

The `run()` method orchestrates all four steps, logs progress, and returns an `ETLResult`.

### JSON Loader (`src/loaders/json-loader.ts`)

Writes `{ summary, records }` to `data/<pipeline-name>-<timestamp>.json`. Creates the `data/` directory if missing.

### Team Configuration (`config.yaml`)

Each top-level key is a team. Pipeline-specific settings are nested under the pipeline name:

```yaml
MB:
  jira-cycle-time:
    startStatus: Ready For Development
    endStatus: Closed
  jira-bugs:
    severityFieldName: "Severity[Dropdown]"
    customerBugsFilter: "issuetype = Bug AND ..."
  github-prs:
    repos:
      - eduvo/mb_rails4
```

Teams only need config sections for the pipelines they use. When running without `--team`, each pipeline auto-discovers teams that have its config section.

## Pipelines

| Pipeline | Source | Metrics | Docs |
|----------|--------|---------|------|
| `jira-cycle-time` | JIRA API | Cycle time between status transitions (avg, median) | [docs/jira-cycle-time.md](jira-cycle-time.md) |
| `jira-bugs` | JIRA API | Bug counts by severity, time-to-resolve | [docs/jira-bugs.md](jira-bugs.md) |
| `github-prs` | GitHub Search API | PR count, time-to-close, contributors | [docs/github-prs.md](github-prs.md) |

Each pipeline produces per-team and cross-team summaries bucketed by month and quarter.

## Shared Infrastructure

### JIRA (`src/shared/jira-api.ts`, `src/shared/jira-types.ts`)

- Authentication: Basic auth (email:token base64 encoded)
- Pagination: Token-based (`nextPageToken` / `isLast`)
- `fetchJiraIssues(config, { jql, fields, expand? })` — shared across JIRA pipelines
- `resolveFieldId(config, fieldName)` — looks up custom field IDs by display name

### GitHub (`src/shared/github-api.ts`, `src/shared/github-types.ts`)

- Authentication: Bearer token
- API: GitHub Search API (`/search/issues`)
- Automatic date-range splitting when results exceed the 1,000 result limit
- Rate limit retry with exponential back-off

## CLI

```bash
npm run etl -- <pipeline> [--team <KEY>] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
```

Available pipelines: `jira-cycle-time`, `jira-bugs`, `github-prs`.

## Adding a New Pipeline

1. Create `src/pipelines/<name>/` with `types.ts`, `extract.ts`, `transform.ts`, `summarize.ts`, `index.ts`
2. Extend `Pipeline<TRaw, TTransformed>` from `src/pipelines/base.ts`
3. Add config loader in `src/config.ts` (if new env vars are needed)
4. Add per-team config to `config.yaml`
5. Register a Commander subcommand in `src/index.ts`
6. Add env vars to `.env.example`
7. Add documentation to `docs/`

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| `expand=changelog` inline | Avoids per-issue changelog API calls and rate limiting |
| Token-based JIRA pagination | Required by JIRA v3 `/search/jql` endpoint |
| GitHub Search API with date splitting | Overcomes the 1,000 result cap per query |
| `.js` in import paths | Required by TypeScript `NodeNext` module resolution |
| `dotenv` without override | Env vars set in shell take precedence over `.env` file |
| `tsx` for execution | Run TypeScript directly without a build step |
| Per-team `config.yaml` | Different projects use different workflow statuses and filters |
