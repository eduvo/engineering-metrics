# metrics-agent

ETL pipelines for engineering metrics. Extracts data from JIRA and computes metrics such as cycle time and bug counts, with summaries broken down by month, quarter, severity, and project.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your JIRA credentials
```

### Verify Connection

After configuring your `.env`, verify that your credentials work:

```bash
npm run check-token
```

This will confirm your JIRA connection and display the authenticated user. Fix any errors before running pipelines — common issues:

- **Authentication failed** — double-check `JIRA_EMAIL` and `JIRA_API_TOKEN`
- **Access denied** — your account may lack the required JIRA permissions
- **Cannot reach JIRA** — verify `JIRA_BASE_URL` is correct (e.g., `https://fariaedu.atlassian.net`)

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JIRA_BASE_URL` | Yes | Your Atlassian instance URL (e.g., `https://fariaedu.atlassian.net`) |
| `JIRA_EMAIL` | Yes | Email associated with your Atlassian account |
| `JIRA_API_TOKEN` | Yes | JIRA Cloud API token ([generate one here](https://id.atlassian.com/manage-profile/security/api-tokens)) |

### Project Configuration (`config.yaml`)

Each project key has pipeline-specific settings. Projects only need sections for the pipelines they use:

```yaml
MB:
  jira-cycle-time:
    startStatus: Ready For Development
    endStatus: Closed
    filter:                              # optional JQL fragment
  jira-bugs:
    severityFieldName: "Severity"
    customerBugsFilter: >-
      issuetype = Bug
      AND resolution IN (Done, Unresolved)
      AND labels = jira_escalated
```

When running without `--project`, each pipeline auto-discovers all projects that have its config section.

## Pipelines

### JIRA Cycle Time

Extracts resolved JIRA issues and computes cycle time (time between configured start and end status transitions). Produces per-project summaries broken down by month, quarter, and overall totals.

```bash
# All configured projects
npm run etl -- jira-cycle-time --since 2026-01-01

# Single project with date range
npm run etl -- jira-cycle-time --project MB --since 2026-01-01 --until 2026-03-31
```

**Options:**

| Flag | Required | Default | Description |
|---|---|---|---|
| `-p, --project <key>` | No | all configured | JIRA project key |
| `-s, --since <date>` | No | `2026-02-09` | Start date for resolved issues (YYYY-MM-DD) |
| `-u, --until <date>` | No | — | End date for resolved issues (YYYY-MM-DD) |

**Config options:**

| Key | Required | Description |
|---|---|---|
| `startStatus` | Yes | Status marking cycle start (case-insensitive) |
| `endStatus` | Yes | Status marking cycle end (case-insensitive) |
| `filter` | No | Additional JQL fragment AND-ed into the query |

**Summary output:** ticket count, average and median cycle time — per month, per quarter, and overall.

### JIRA Bugs

Counts customer-reported bugs matching a configurable JQL filter, broken down by severity. Produces per-project and cross-project summaries by month and overall.

```bash
# All configured projects
npm run etl -- jira-bugs --since 2026-01-01

# Single project
npm run etl -- jira-bugs --project MB --since 2026-01-01
```

**Options:**

| Flag | Required | Default | Description |
|---|---|---|---|
| `-p, --project <key>` | No | all configured | JIRA project key |
| `-s, --since <date>` | No | `2026-02-09` | Start date for created issues (YYYY-MM-DD) |
| `-u, --until <date>` | No | — | End date for created issues (YYYY-MM-DD) |

**Config options:**

| Key | Required | Description |
|---|---|---|
| `customerBugsFilter` | Yes | JQL fragment AND-ed with project + date range |
| `severityFieldName` | Yes | JIRA field name for the Severity dropdown (resolved to field ID at runtime) |

**Summary output:** total bugs and median time-to-resolve per severity — per project per month, per project total, cross-project per month, and cross-project total. Severity values are the first two characters of the JIRA field value (e.g., `S1`, `S2`).

### Output

Results are written as JSON to `data/<pipeline-name>-<timestamp>.json`, containing both `summary` and `records`.

## Adding New Pipelines

1. Create a new directory under `src/pipelines/` (e.g., `src/pipelines/github/`)
2. Extend the `Pipeline` base class from `src/pipelines/base.ts`
3. Implement `extract()`, `transform()`, `summarize()`, and `load()` methods
4. Register a new command in `src/index.ts`

See `docs/architecture.md` for detailed architecture documentation.
