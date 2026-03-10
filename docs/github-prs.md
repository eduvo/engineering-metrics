# GitHub PRs Pipeline

Extracts closed pull requests from GitHub repositories, computes time-to-close metrics, and produces monthly/quarterly summaries with contributor breakdowns.

## Configuration

**Connection** (`.env`):

| Variable       | Required | Description                                      |
|----------------|----------|--------------------------------------------------|
| `GITHUB_TOKEN` | Yes      | GitHub personal access token with `repo` scope   |

**Per-team config** (`config.yaml`):

```yaml
MB:
  github-prs:
    repos:
      - eduvo/mb_rails4
```

- `repos`: List of GitHub repositories in `owner/repo` format.

Teams only need a `github-prs` section if they use this pipeline. When running without `--team`, the pipeline auto-discovers teams that have `github-prs.repos` configured.

## CLI Usage

```bash
npm run etl -- github-prs [--team <KEY>] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
```

- `--team` (optional): Team key from `config.yaml`. If omitted, runs for all teams with `github-prs` config.
- `--since` (default: `2026-02-09`): Only PRs closed on or after this date.
- `--until` (optional): Only PRs closed on or before this date. Defaults to today.

Date inputs are normalized to `YYYY-MM-DD`, so formats like `2025-1-1` are accepted.

## Extract (`src/pipelines/github-prs/extract.ts`)

- API: GitHub Search API (`GET /search/issues`)
- Query: `repo:{owner}/{repo} is:pr is:closed closed:>=YYYY-MM-DD` (or `closed:YYYY-MM-DD..YYYY-MM-DD` when both bounds are specified)
- Pagination: 100 results per page, up to 10 pages (1,000 results per query)
- **1,000 result limit handling**: When a query exceeds 1,000 results, the date range is automatically split in half and each half is fetched recursively until all results are retrieved.
- **Rate limit handling**: On 403 responses, retries up to 3 times with exponential back-off (respects `Retry-After` header). A 1.5s delay is inserted between requests to avoid secondary rate limits.
- **Deduplication**: Results are deduplicated by PR number after all windows are fetched.
- Iterates over all repos configured for the team.

## Transform (`src/pipelines/github-prs/transform.ts`)

Maps each raw GitHub PR to a `PRRecord`:
- Extracts the repo name by matching the PR's `html_url` against configured repos (falls back to URL pattern extraction).
- `mergedAt` is read from the nested `pull_request.merged_at` field (Search API format).
- `timeToCloseDays` is computed as `(mergedAt or closedAt) - createdAt` in fractional days.

## Summarize (`src/pipelines/github-prs/summarize.ts`)

Produces a `PRsSummary` with per-team and cross-team levels:

| Level | Key | Bucketing |
|-------|-----|-----------|
| Per team monthly | `teams.<KEY>.monthly.<YYYY-MM>` | By closed/merged month |
| Per team quarterly | `teams.<KEY>.quarterly.<YYYY-QN>` | By closed/merged quarter |
| Per team total | `teams.<KEY>.total` | All PRs for team |
| Cross-team monthly | `crossTeam.monthly.<YYYY-MM>` | Across all teams per month |
| Cross-team quarterly | `crossTeam.quarterly.<YYYY-QN>` | Across all teams per quarter |
| Cross-team total | `crossTeam.total` | All PRs across all teams |

Each level contains a `PRStats` object:

| Field                    | Type                      | Description                                     |
|--------------------------|---------------------------|-------------------------------------------------|
| `prCount`                | `number`                  | Total number of PRs                             |
| `averageTimeToCloseDays` | `number \| null`          | Mean time-to-close in days                      |
| `medianTimeToCloseDays`  | `number \| null`          | Median time-to-close in days                    |
| `prsByContributor`       | `Record<string, number>`  | PR count per contributor, sorted descending     |

Month/quarter is derived from `mergedAt` (preferred), `closedAt`, or `createdAt`.

## PRRecord Schema

| Field            | Type            | Description                                        |
|------------------|-----------------|----------------------------------------------------|
| `repo`           | `string`        | Repository in `owner/repo` format                  |
| `number`         | `number`        | PR number                                          |
| `title`          | `string`        | PR title                                           |
| `author`         | `string`        | GitHub username of the PR author                   |
| `createdAt`      | `string`        | ISO timestamp of PR creation                       |
| `closedAt`       | `string \| null`| ISO timestamp of PR close                          |
| `mergedAt`       | `string \| null`| ISO timestamp of PR merge (null if closed unmerged) |
| `timeToCloseDays`| `number \| null`| Days between creation and close/merge              |
| `url`            | `string`        | URL to the PR on GitHub                            |

## Output

Written to `data/github-prs-<timestamp>.json` containing `{ summary, records }`.
