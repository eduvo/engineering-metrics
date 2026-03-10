# Metrics Agent — Architecture Documentation

## Purpose

An extensible ETL system that extracts engineering metrics from external tools (JIRA, GitHub, etc.), transforms raw data into standardized metric records, and loads results to output destinations.

## Project Structure

```
metrics-agent/
├── src/
│   ├── index.ts                       # CLI entry point (commander)
│   ├── config.ts                      # Environment + team config loader
│   ├── types.ts                       # Shared types: MetricRecord, BugRecord, ETLResult, PipelineSummary
│   ├── shared/
│   │   ├── jira-types.ts              # Shared JIRA API response types
│   │   └── jira-api.ts                # Shared JIRA fetch with pagination & auth
│   ├── loaders/
│   │   └── json-loader.ts             # Writes JSON to data/ directory
│   └── pipelines/
│       ├── base.ts                    # Abstract Pipeline<TRaw, TTransformed>
│       ├── jira-cycle-time/
│       │   ├── types.ts               # Cycle-time-specific types & options
│       │   ├── extract.ts             # Cycle-time extraction (delegates to shared jira-api)
│       │   ├── transform.ts           # Cycle time computation from changelog
│       │   ├── summarize.ts           # Per-team summary: monthly, quarterly, total
│       │   └── index.ts               # JiraCycleTimePipeline class
│       └── jira-bugs/
│           ├── types.ts               # Bug pipeline options (customerBugsFilter)
│           ├── extract.ts             # Bug extraction with custom JQL filter
│           ├── transform.ts           # Bug record mapping + time-to-resolve + severity
│           ├── summarize.ts           # Multi-level summary: per-team/cross-team × monthly/total × severity
│           └── index.ts               # JiraBugsPipeline class
├── config.yaml                        # Per-team pipeline configuration
├── data/                              # Pipeline output (gitignored)
├── .env                               # JIRA connection credentials (gitignored)
├── .env.example                       # Template for required env vars
├── package.json
├── tsconfig.json
└── README.md
```

## Core Abstractions

### Pipeline Base Class (`src/pipelines/base.ts`)

Template method pattern with three abstract steps:

```
extract() → raw records from external API
transform() → standardized MetricRecord[]
summarize() → PipelineSummary (e.g., average cycle time)
load() → write to output destination, return file path
```

The `run()` method orchestrates all four steps, logs progress, and returns an `ETLResult`.

### MetricRecord (`src/types.ts`)

Standardized output schema for all pipelines:

| Field           | Type            | Description                                      |
|-----------------|-----------------|--------------------------------------------------|
| `issueKey`      | `string`        | External issue identifier (e.g., `MB-1234`)      |
| `summary`       | `string`        | Issue title/summary                              |
| `description`   | `string \| null`| Plain-text issue description                     |
| `issueType`     | `string`        | Issue type (Bug, Story, Task, Sub-task, etc.)     |
| `assignee`      | `string \| null`| Display name of the assignee                     |
| `cycleTimeDays` | `number`        | Days between start and end status transitions     |
| `startDate`     | `string`        | ISO timestamp of first transition to start status |
| `endDate`       | `string`        | ISO timestamp of first transition to end status   |
| `startStatus`   | `string`        | Configured start status name                      |
| `endStatus`     | `string`        | Configured end status name                        |
| `statusTransitions` | `StatusTransition[]` | All status changes: `{ from, to, timestamp }` |
| `createdDate`   | `string`        | Original issue creation date                      |
| `resolvedDate`  | `string \| null`| Issue resolution date (null if unresolved)        |

### BugRecord (`src/types.ts`)

Output schema for the jira-bugs pipeline:

| Field              | Type            | Description                                         |
|--------------------|-----------------|-----------------------------------------------------|
| `issueKey`         | `string`        | External issue identifier (e.g., `MB-1234`)         |
| `summary`          | `string`        | Issue title/summary                                 |
| `severity`         | `string \| null`| First two characters of the JIRA severity dropdown (e.g., `S1`, `S2`) |
| `issueType`        | `string`        | Issue type (typically `Bug`)                         |
| `assignee`         | `string \| null`| Display name of the assignee                        |
| `createdDate`      | `string`        | Original issue creation date                        |
| `resolvedDate`     | `string \| null`| Issue resolution date (null if unresolved)          |
| `timeToResolveDays`| `number \| null`| Days between creation and resolution                |

### JSON Loader (`src/loaders/json-loader.ts`)

Writes `{ summary, records }` to `data/<pipeline-name>-<timestamp>.json`. Creates the `data/` directory if missing.

The `summary` object contains aggregate stats (e.g., `averageCycleTimeDays`, `totalBugs`, `medianTimeToResolveDays`).

### Shared JIRA Infrastructure (`src/shared/`)

Common JIRA integration code shared across all JIRA-based pipelines:

- **`jira-types.ts`** — Shared response types: `JiraIssue`, `JiraIssueFields`, `JiraChangelogEntry`, `JiraChangelogItem`, `JiraSearchResponse`. The `changelog` property on `JiraIssue` is optional (only cycle-time pipeline requests it).
- **`jira-api.ts`** — `fetchJiraIssues(config, { jql, fields, expand? })` handles authentication (Basic auth), token-based pagination, and error handling. `resolveFieldId(config, fieldName)` looks up a JIRA custom field ID by its display name via the `/rest/api/3/field` endpoint. Each pipeline passes its own JQL, fields, and optional expand parameters.

## JIRA Cycle Time Pipeline

### Configuration

**Connection** (`.env`):

| Variable         | Required | Description                       |
|------------------|----------|-----------------------------------|
| `JIRA_BASE_URL`  | Yes      | e.g., `https://org.atlassian.net` |
| `JIRA_EMAIL`     | Yes      | Atlassian account email           |
| `JIRA_API_TOKEN` | Yes      | Atlassian API token               |

**Per-team pipeline config** (`config.yaml`):

```yaml
MB:
  jira-cycle-time:
    startStatus: Ready For Development
    endStatus: Closed
    filter:
  jira-bugs:
    severityFieldName: "Severity[Dropdown]"
    customerBugsFilter: >-
      issuetype = Bug
      AND resolution IN (Done, Unresolved)
      AND labels = jira_escalated
```

Settings are nested under each pipeline name within each team key:
- `jira-cycle-time.startStatus` / `jira-cycle-time.endStatus`: Cycle time status boundaries (case-insensitive matching)
- `jira-cycle-time.filter` (optional): Additional JQL fragment AND-ed with the project key and date range. Leave empty or omit to include all resolved issues.
- `jira-bugs.customerBugsFilter`: JQL fragment AND-ed with project + date range for the bugs pipeline
- `jira-bugs.severityFieldName`: JIRA field name for the Severity dropdown (e.g., `Severity[Dropdown]`). Resolved to a custom field ID at runtime via the JIRA fields API. The pipeline extracts the first two characters of the field value (e.g., `S1` from `S1 - Critical`).

Teams only need config sections for the pipelines they use. When running without `--team`, each pipeline auto-discovers teams that have its config section.

### CLI Usage

```bash
npm run etl -- jira-cycle-time [--team <KEY>] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
```

- `--team` (optional): JIRA project key. If omitted, runs for all teams in `config.yaml` that have `startStatus` and `endStatus` configured.
- `--since` (default: `2026-02-09`): Only issues resolved on or after this date
- `--until` (optional): Only issues resolved on or before this date

### Extract (`src/pipelines/jira-cycle-time/extract.ts`)

- Endpoint: `GET /rest/api/3/search/jql`
- Authentication: Basic auth (email:token base64 encoded)
- Pagination: Token-based (`nextPageToken` / `isLast`), NOT offset-based
- Changelog: Fetched inline via `expand=changelog` query parameter
- JQL: `project = "KEY" AND resolved >= "DATE" [AND resolved <= "DATE"] ORDER BY resolved DESC`
- Fields requested: `summary`, `description`, `issuetype`, `assignee`, `created`, `resolutiondate`

### Transform (`src/pipelines/jira-cycle-time/transform.ts`)

- Walks each issue's `changelog.histories` to find the first status transition matching the configured start/end statuses
- Status matching is case-insensitive (`.toUpperCase()`)
- Issues are excluded if: no matching start transition, no matching end transition, or end date <= start date
- Cycle time is computed as `(endDate - startDate)` in fractional days

### Summarize (`src/pipelines/jira-cycle-time/summarize.ts`)

Produces a `CycleTimeSummary` with per-team and cross-team levels, each containing `CycleTimeStats` (ticket count, average, and median cycle time):

| Level | Key | Bucketing |
|-------|-----|----------|
| Per team monthly | `teams.<KEY>.monthly.<YYYY-MM>` | By resolved month |
| Per team quarterly | `teams.<KEY>.quarterly.<YYYY-QN>` | By resolved quarter |
| Per team total | `teams.<KEY>.total` | All records for team |
| Cross-team monthly | `crossTeam.monthly.<YYYY-MM>` | By resolved month across all teams |
| Cross-team quarterly | `crossTeam.quarterly.<YYYY-QN>` | By resolved quarter across all teams |
| Cross-team total | `crossTeam.total` | All records across all teams |

When multiple teams are configured, all are extracted and transformed independently, then a combined output file is produced with cross-team aggregations.

Tickets are assigned to a month/quarter based on their `resolvedDate` (or `endDate` if `resolvedDate` is null).

### JIRA API Types (`src/pipelines/jira-cycle-time/types.ts`)

- `JiraIssue`: Re-exported from shared types with `changelog` required (non-optional)
- `JiraExtractOptions`: Pipeline options — `projectKey`, `since`, `until?`

## JIRA Bugs Pipeline

Counts customer-reported bugs matching a configurable JQL filter, broken down by severity, with monthly and overall summaries per team and cross-team.

### Configuration

Uses the same JIRA connection credentials (`.env`) as the cycle-time pipeline.

Requires a `customerBugsFilter` JQL fragment and `severityFieldName` in `config.yaml` for each team. The filter is AND-ed with the project key and date range.

### CLI Usage

```bash
npm run etl -- jira-bugs [--team <KEY>] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
```

- `--team` (optional): JIRA project key. If omitted, runs for all teams in `config.yaml` that have a `customerBugsFilter` configured.
- `--since` (default: `2026-02-09`): Only issues created on or after this date
- `--until` (optional): Only issues created on or before this date

When multiple teams are configured, all are extracted and transformed independently, then a combined output file is produced with cross-team aggregations.

### Extract (`src/pipelines/jira-bugs/extract.ts`)

- Resolves `severityFieldName` to a custom field ID via the JIRA fields API (`resolveFieldId`)
- Delegates to shared `fetchJiraIssues()` from `src/shared/jira-api.ts`
- JQL: `project = "KEY" AND created >= "DATE" [AND created <= "DATE"] AND (customerBugsFilter) ORDER BY created DESC`
- Fields requested: `summary`, `issuetype`, `assignee`, `created`, `resolutiondate`, plus the resolved severity field
- No changelog expansion (lighter API responses)

### Transform (`src/pipelines/jira-bugs/transform.ts`)

- Maps each issue to a `BugRecord`
- Extracts the first two characters of the severity field value (e.g., `S1` from `S1 - Critical`)
- Computes `timeToResolveDays` as `(resolvedDate - createdDate)` in fractional days (`null` for unresolved bugs)

### Summarize (`src/pipelines/jira-bugs/summarize.ts`)

Produces a four-level summary structure (`BugsSummary`), each level broken down by severity:

| Level | Key | Description |
|-------|-----|-------------|
| Per team per month | `teams.<KEY>.monthly.<YYYY-MM>.<severity>` | Total bugs and median TTR for each severity in each month |
| Per team total | `teams.<KEY>.total.<severity>` | Total bugs and median TTR for each severity across all months |
| Cross-team per month | `crossTeam.monthly.<YYYY-MM>.<severity>` | Total bugs and median TTR for each severity across all teams in each month |
| Cross-team total | `crossTeam.total.<severity>` | Total bugs and median TTR for each severity across all teams and months |

Each severity entry is a `SeverityStats` object:

```json
{ "totalBugs": 5, "medianTimeToResolveDays": 2.54 }
```

Month keys are derived from the bug's `createdDate` (format: `YYYY-MM`).

### BugRecord (`src/types.ts`)

| Field               | Type            | Description                                  |
|---------------------|-----------------|----------------------------------------------|
| `issueKey`          | `string`        | External issue identifier (e.g., `MB-1234`)  |
| `summary`           | `string`        | Issue title/summary                          |
| `issueType`         | `string`        | Issue type (typically `Bug`)                 |
| `assignee`          | `string \| null`| Display name of the assignee                 |
| `createdDate`       | `string`        | Original issue creation date                 |
| `resolvedDate`      | `string \| null`| Issue resolution date (null if unresolved)   |
| `timeToResolveDays` | `number \| null`| Days between created and resolved (null if unresolved) |

### Summary

The pipeline summary includes:
- `totalBugs`: Total number of bugs matching the query
- `medianTimeToResolveDays`: Median time-to-resolve across resolved bugs (null if none resolved)

### Types (`src/pipelines/jira-bugs/types.ts`)

- `JiraBugsExtractOptions`: `projectKey`, `since`, `until?`, `customerBugsFilter`

## Adding a New Pipeline

1. Create `src/pipelines/<source>/` with:
   - `types.ts` — raw API types and options interface
   - `extract.ts` — data extraction function (use `src/shared/jira-api.ts` for JIRA pipelines)
   - `transform.ts` — transformation to output records
   - `index.ts` — pipeline class extending `Pipeline<TRaw, TTransformed>`

2. Add a config loader function in `src/config.ts` (if new env vars are needed)

3. Add per-team config to `config.yaml` (if team-specific settings are needed)

4. Add a new commander subcommand in `src/index.ts`

5. Add env vars to `.env.example`

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| `expand=changelog` inline | Avoids per-issue changelog API calls and rate limiting (429) |
| Token-based pagination | Required by JIRA v3 `/search/jql` endpoint |
| `.js` in import paths | Required by TypeScript `NodeNext` module resolution |
| `dotenv` without override | Env vars set in shell take precedence over `.env` file |
| `tsx` for execution | Run TypeScript directly without a build step |
| No offset-based pagination | JIRA v3 search/jql does not support `startAt`/`total` |
| Per-team `config.yaml` | Different JIRA projects use different workflow statuses and filters |
