import { NewRelicConfig } from "../../config.js";
import { executeNrql, lookupApplicationId, fetchSlaMetrics } from "../../shared/newrelic-api.js";
import { NewRelicErrorsExtractOptions, RawNewRelicResult } from "./types.js";

function escapeNrqlString(value: string): string {
  return value.replace(/'/g, "\\'");
}

function toISODate(date: string): string {
  return new Date(date).toISOString().slice(0, 10);
}

function getMonthRanges(since: string, until: string): { from: string; to: string; month: string }[] {
  const ranges: { from: string; to: string; month: string }[] = [];
  const start = new Date(since + "T00:00:00Z");
  const end = new Date(until + "T00:00:00Z");

  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));

  while (cursor < end) {
    const monthStart = new Date(Math.max(cursor.getTime(), start.getTime()));
    const nextMonth = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    const monthEnd = new Date(Math.min(nextMonth.getTime(), end.getTime()));

    const year = cursor.getUTCFullYear();
    const mm = String(cursor.getUTCMonth() + 1).padStart(2, "0");

    ranges.push({
      from: monthStart.toISOString(),
      to: monthEnd.toISOString(),
      month: `${year}-${mm}`,
    });

    cursor = nextMonth;
  }

  return ranges;
}

export async function extractNewRelicErrors(
  config: NewRelicConfig,
  options: NewRelicErrorsExtractOptions,
): Promise<RawNewRelicResult[]> {
  const since = toISODate(options.since);
  const until = toISODate(options.until ?? new Date().toISOString());
  const monthRanges = getMonthRanges(since, until);

  const results: RawNewRelicResult[] = [];

  // APM SLA data via REST API per app per month
  for (const appName of options.apps) {
    console.log(`  Looking up app ID for "${appName}"...`);
    const appId = await lookupApplicationId(config, appName);
    console.log(`  App ID: ${appId}`);

    for (const range of monthRanges) {
      console.log(`  Fetching SLA metrics for "${appName}" ${range.month} (${range.from} → ${range.to})...`);
      const metrics = await fetchSlaMetrics(config, appId, range.from, range.to);

      let apdex = 0;
      let satisfiedPercent = 0;
      let errorRatePercent = 0;
      let responseTimeMs = 0;
      let throughputRpm = 0;
      let callCount = 0;
      let errorCount = 0;

      for (const m of metrics) {
        const values = m.timeslices[0]?.values;
        if (!values) continue;

        if (m.name === "Apdex") {
          apdex = values.score ?? 0;
          const satisfied = values.s ?? 0;
          const total = values.count ?? 0;
          satisfiedPercent = total > 0 ? (satisfied / total) * 100 : 0;
        } else if (m.name === "HttpDispatcher") {
          responseTimeMs = values.average_response_time ?? 0;
          throughputRpm = values.calls_per_minute ?? 0;
          callCount = values.call_count ?? 0;
        } else if (m.name === "Errors/all") {
          errorCount = values.error_count ?? 0;
        }
      }

      errorRatePercent = callCount > 0 ? (errorCount / callCount) * 100 : 0;

      results.push({
        appName,
        month: range.month,
        dataType: "apm-sla",
        apdex: parseFloat(apdex.toFixed(4)),
        satisfiedPercent: parseFloat(satisfiedPercent.toFixed(2)),
        errorRatePercent: parseFloat(errorRatePercent.toFixed(4)),
        responseTimeMs: parseFloat(responseTimeMs.toFixed(2)),
        throughputRpm: parseFloat(throughputRpm.toFixed(2)),
      });
    }
  }

  // JavaScript error rate per app per month (still via NRQL)
  const appList = options.apps.map((a) => `'${escapeNrqlString(a)}'`).join(", ");
  const jsNrql = `SELECT filter(count(*), WHERE eventType() = 'JavaScriptError') / filter(count(*), WHERE eventType() = 'PageView') * 100 as 'errorRate' FROM PageView, JavaScriptError WHERE appName IN (${appList}) FACET appName, monthOf(timestamp) SINCE '${since}' UNTIL '${until}' LIMIT MAX`;
  console.log(`  JS NRQL: ${jsNrql}`);
  const jsResults = await executeNrql(config, jsNrql);

  for (const r of jsResults) {
    const facet = r.facet as string[];
    results.push({
      appName: facet[0],
      month: facet[1],
      dataType: "javascript",
      errorRatePercent: parseFloat(((r.errorRate as number) ?? 0).toFixed(4)),
    });
  }

  return results;
}
