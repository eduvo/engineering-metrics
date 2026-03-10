# JIRA Cycle Time Pipeline

Extracts resolved JIRA issues, computes cycle time between configurable status transitions, and produces monthly/quarterly summaries per team and cross-team.

## Configuration

**Connection** (`.env`):

| Variable         | Required | Description                       |
|------------------|----------|-----------------------------------|
| `JIRA_BASE_URL`  | Yes      | e.g., `https://org.atlassian.net` |
| `JIRA_EMAIL`     | Yes      | Atlassian account email           |
| `JIRA_API_TOKEN` | Yes      | Atlassian API token               |

**Per-team config** (`config.yaml`):

```yaml
MB:
  jira-cycle-time:
    startStatus: Ready For Development
    endStatus: Closed
    filter:
```

- `startStatus` / `endStatus`: Status names defining the cycle time boundaries (case-insensitive matching).
- `filter` (optional): Additional JQL fragment AND-ed with the project key and date range. Leave empty or omit to include all resolved issues.

Teams only need a `jira-cycle-time` section if they use this pipeline.

## CLI Usage

```bash
npm run etl -- jira-cycle-time [--team <KEY>] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
```

- `--team` (optional): JIRA project key. If omitted, runs for all teams with `startStatus` and `endStatus` configured.
- `--since` (default: `2026-02-09`): Only issues resolved on or after this date.
- `--until` (optional): Only issues resolved on or before this date.

## Extract (`src/pipelines/jira-cycle-time/extract.ts`)

- Endpoint: `GET /rest/api/3/search/jql`
- Authentication: Basic auth (email:token base64 encoded).
- Pagination: Token-based (`nextPageToken` / `isLast`), not offset-based.
- Changelog: Fetched inline via `expand=changelog` query parameter.
- JQL: `project = "KEY" AND resolved >= "DATE" [AND resolved <= "DATE"] [AND (filter)] ORDER BY resolved DESC`
- Fields requested: `summary`, `description`, `issuetype`, `assignee`, `created`, `resolutiondate`.

## Transform (`src/pipelines/jira-cycle-time/transform.ts`)

- Walks each issue's `changelog.histories` to find the first status transition matching the configured start/end statuses.
- Status matching is case-insensitive.
- Issues are excluded if: no matching start transition, no matching end transition, or end date <= start date.
- Cycle time is computed as `(endDate - startDate)` in fractional days.

## Summarize (`src/pipelines/jira-cycle-time/summarize.ts`)

Produces a `CycleTimeSummary` with per-team and cross-team levels:

| Level | Key | Bucketing |
|-------|-----|-----------|
| Per team monthly | `teams.<KEY>.monthly.<YYYY-MM>` | By resolved month |
| Per team quarterly | `teams.<KEY>.quarterly.<YYYY-QN>` | By resolved quarter |
| Per team total | `teams.<KEY>.total` | All records for team |
| Cross-team monthly | `crossTeam.monthly.<YYYY-MM>` | Across all teams per month |
| Cross-team quarterly | `crossTeam.quarterly.<YYYY-QN>` | Across all teams per quarter |
| Cross-team total | `crossTeam.total` | All records across all teams |

Each level contains a `CycleTimeStats` object with ticket count, average, and median cycle time.

Tickets are assigned to a month/quarter based on their `resolvedDate` (or `endDate` if `resolvedDate` is null).

## MetricRecord Schema

| Field                | Type                   | Description                                       |
|----------------------|------------------------|---------------------------------------------------|
| `issueKey`           | `string`               | External issue identifier (e.g., `MB-1234`)       |
| `summary`            | `string`               | Issue title/summary                               |
| `description`        | `string \| null`       | Plain-text issue description                      |
| `issueType`          | `string`               | Issue type (Bug, Story, Task, etc.)               |
| `assignee`           | `string \| null`       | Display name of the assignee                      |
| `cycleTimeDays`      | `number`               | Days between start and end status transitions     |
| `startDate`          | `string`               | ISO timestamp of first transition to start status |
| `endDate`            | `string`               | ISO timestamp of first transition to end status   |
| `startStatus`        | `string`               | Configured start status name                      |
| `endStatus`          | `string`               | Configured end status name                        |
| `statusTransitions`  | `StatusTransition[]`   | All status changes: `{ from, to, timestamp }`     |
| `createdDate`        | `string`               | Original issue creation date                      |
| `resolvedDate`       | `string \| null`       | Issue resolution date (null if unresolved)        |

## Output

Written to `data/jira-cycle-time-<timestamp>.json` containing `{ summary, records }`.
