# New Relic Error Rates Pipeline

## Overview

Extracts APM error rate % and JavaScript error rate % per application from New Relic via the NerdGraph (GraphQL) API.

## Data Points

| Metric | Source Event | NRQL Function |
|--------|-------------|---------------|
| APM error rate % | `Transaction` | `percentage(count(*), WHERE error IS true)` |
| JS error rate % | `PageView`, `JavaScriptError` | `JavaScriptError count / PageView count * 100` |

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEWRELIC_API_KEY` | Yes | New Relic User API key (NerdGraph) |
| `NEWRELIC_ACCOUNT_ID` | Yes | New Relic account ID (integer) |
| `NEWRELIC_API_URL` | No | NerdGraph endpoint (defaults to `https://api.newrelic.com/graphql`; use `https://api.eu.newrelic.com/graphql` for EU) |

### Team Config (`config.yaml`)

```yaml
MB:
  newrelic-errors:
    apps:
      - MB Production
      - MB Staging
```

Each team lists the New Relic application names to include. Only teams with a `newrelic-errors` section are processed.

## CLI Usage

```bash
# All configured teams
npm run etl -- newrelic-errors

# Single team
npm run etl -- newrelic-errors --team MB

# Custom date range
npm run etl -- newrelic-errors --since 2026-01-01 --until 2026-03-01
```

## API Details

The pipeline uses NerdGraph (New Relic's GraphQL API) to execute NRQL queries. Results are faceted by `appName` and `monthOf(timestamp)` to produce per-app, per-month error rate percentages.

### APM Error Rate NRQL

```sql
SELECT percentage(count(*), WHERE error IS true) as 'errorRate'
FROM Transaction
WHERE appName IN ('App1', 'App2')
FACET appName, monthOf(timestamp)
SINCE '2026-02-01' UNTIL '2026-03-01'
LIMIT MAX
```

### JavaScript Error Rate NRQL

```sql
SELECT filter(count(*), WHERE eventType() = 'JavaScriptError')
  / filter(count(*), WHERE eventType() = 'PageView') * 100 as 'errorRate'
FROM PageView, JavaScriptError
WHERE appName IN ('App1', 'App2')
FACET appName, monthOf(timestamp)
SINCE '2026-02-01' UNTIL '2026-03-01'
LIMIT MAX
```

## Output

JSON file written to `data/newrelic-errors-<timestamp>.json` containing:

```json
{
  "summary": {
    "teams": {
      "MB": {
        "apm": {
          "monthly": { "2026-02": { "averageErrorRatePercent": 1.5, "byApp": { "MB Production": 1.5 } } },
          "quarterly": { "2026-Q1": { ... } },
          "total": { "averageErrorRatePercent": 1.5, "byApp": { ... } }
        },
        "javascript": { ... }
      }
    },
    "crossTeam": { "apm": { ... }, "javascript": { ... } }
  },
  "records": {
    "MB": [
      { "appName": "MB Production", "errorType": "apm", "errorRatePercent": 1.5, "month": "2026-02" }
    ]
  }
}
```
