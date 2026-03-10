# JIRA Bugs Pipeline

Counts customer-reported bugs matching a configurable JQL filter, broken down by severity, with monthly summaries per team and cross-team.

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
  jira-bugs:
    severityFieldName: "Severity[Dropdown]"
    customerBugsFilter: >-
      issuetype = Bug
      AND resolution IN (Done, Unresolved)
      AND labels = jira_escalated
```

- `severityFieldName`: JIRA field name for the Severity dropdown. Resolved to a custom field ID at runtime via the JIRA fields API. The pipeline extracts the first two characters of the value (e.g., `S1` from `S1 - Critical`).
- `customerBugsFilter`: JQL fragment AND-ed with the project key and date range.

Teams only need a `jira-bugs` section if they use this pipeline.

## CLI Usage

```bash
npm run etl -- jira-bugs [--team <KEY>] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
```

- `--team` (optional): JIRA project key. If omitted, runs for all teams with a `customerBugsFilter` configured.
- `--since` (default: `2026-02-09`): Only issues created on or after this date.
- `--until` (optional): Only issues created on or before this date.

## Extract (`src/pipelines/jira-bugs/extract.ts`)

- Resolves `severityFieldName` to a custom field ID via `resolveFieldId()`.
- Delegates to shared `fetchJiraIssues()` from `src/shared/jira-api.ts`.
- JQL: `project = "KEY" AND created >= "DATE" [AND created <= "DATE"] AND (customerBugsFilter) ORDER BY created DESC`
- Fields requested: `summary`, `issuetype`, `assignee`, `created`, `resolutiondate`, plus the resolved severity field.
- No changelog expansion (lighter API responses).

## Transform (`src/pipelines/jira-bugs/transform.ts`)

Maps each issue to a `BugRecord`:
- Extracts the first two characters of the severity field value (e.g., `S1` from `S1 - Critical`).
- Computes `timeToResolveDays` as `(resolvedDate - createdDate)` in fractional days (`null` for unresolved bugs).

## Summarize (`src/pipelines/jira-bugs/summarize.ts`)

Produces a four-level summary structure (`BugsSummary`), each level broken down by severity:

| Level | Key | Description |
|-------|-----|-------------|
| Per team per month | `teams.<KEY>.monthly.<YYYY-MM>.<severity>` | Total bugs and median TTR per severity per month |
| Per team total | `teams.<KEY>.total.<severity>` | Total bugs and median TTR per severity across all months |
| Cross-team per month | `crossTeam.monthly.<YYYY-MM>.<severity>` | Across all teams per severity per month |
| Cross-team total | `crossTeam.total.<severity>` | Across all teams and months per severity |

Each severity entry is a `SeverityStats` object:

```json
{ "totalBugs": 5, "medianTimeToResolveDays": 2.54 }
```

Month keys are derived from the bug's `createdDate` (format: `YYYY-MM`).

## BugRecord Schema

| Field               | Type            | Description                                  |
|---------------------|-----------------|----------------------------------------------|
| `issueKey`          | `string`        | External issue identifier (e.g., `MB-1234`)  |
| `summary`           | `string`        | Issue title/summary                          |
| `severity`          | `string \| null`| Severity code (e.g., `S1`, `S2`)             |
| `issueType`         | `string`        | Issue type (typically `Bug`)                 |
| `assignee`          | `string \| null`| Display name of the assignee                 |
| `createdDate`       | `string`        | Original issue creation date                 |
| `resolvedDate`      | `string \| null`| Issue resolution date (null if unresolved)   |
| `timeToResolveDays` | `number \| null`| Days between created and resolved            |

## Output

Written to `data/jira-bugs-<timestamp>.json` containing `{ summary, records }`.
