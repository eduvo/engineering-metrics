# Dashboard Report

## Overview

The dashboard is a self-contained HTML file generated from the latest ETL data. It visualizes metrics from all four pipelines in a single report with tabbed navigation.

## Usage

```bash
# Generate on demand from existing data
npm run report

# Automatically generated after running all pipelines
npm run etl -- all --since 2026-01-01
```

Reports are saved to `reports/dashboard-<timestamp>.html`.

## Architecture

The dashboard is split into two modules:

| Module | Responsibility |
|---|---|
| `src/ui/generate-report.ts` | Orchestration — finds the latest data file for each pipeline, loads them, calls the HTML generator, and writes the output file |
| `src/ui/html-template.ts` | Presentation — all HTML structure, CSS styling, and rendering logic |

### Data Flow

```
data/*.json  →  generate-report.ts  →  html-template.ts  →  reports/dashboard-<timestamp>.html
               (load latest files)     (render HTML)         (self-contained HTML file)
```

`generate-report.ts` scans the `data/` directory for the most recent file matching each pipeline prefix (`jira-cycle-time`, `jira-bugs`, `github-prs`, `newrelic-sla`), reads the `summary` section from each, and passes all data to `generateHTML()`.

### Integration with CLI

- The `report` command (`npm run report`) calls `generateReport()` directly.
- The `all` command (`npm run etl -- all`) calls `generateReport()` after all pipelines finish, regardless of individual pipeline failures.

## Dashboard Sections

### Overview Tab

Cross-team aggregated view with:

- **KPI Cards** — cycle time (median), PR count, total bugs, Apdex score
- **Cycle Time Trend** — monthly ticket count, median and average cycle time
- **PR Throughput Trend** — monthly PR count, median and average time-to-close
- **Bug Trend** — monthly bug counts and TTR by severity
- **SLA Trend** — monthly Apdex, satisfied %, error rate %, response time, throughput

### Per-Team Tabs

One tab per team, each showing:

- **Cycle Time** — overall stats (ticket count, median, average), monthly and quarterly breakdowns
- **Customer Bugs** — total by severity with TTR, monthly trend table
- **Pull Requests** — overall stats, top 10 contributors with bar chart, monthly breakdown
- **SLA / Reliability** — APM summary (Apdex, error rate, satisfied %, response time), browser error rates per app, APM metrics by app and month

## Data Requirements

The dashboard renders gracefully with partial data — if a pipeline's data file is missing, its sections are omitted. At least one pipeline's data must be present.

Each pipeline's JSON file must have a `summary` key with the team-level and cross-team structure produced by the pipeline's `summarize` function.
