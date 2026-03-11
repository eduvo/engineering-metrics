import { NewRelicRecord } from "./types.js";

export interface SlaStats {
  averageApdex: number | null;
  averageSatisfiedPercent: number | null;
  averageErrorRatePercent: number | null;
  averageResponseTimeMs: number | null;
  averageThroughputRpm: number | null;
  byApp: Record<string, {
    apdex: number | null;
    satisfiedPercent: number | null;
    errorRatePercent: number | null;
    responseTimeMs: number | null;
    throughputRpm: number | null;
  }>;
}

export interface BrowserErrorStats {
  byApp: Record<string, number | null>;
}

export interface TeamErrorsSummary {
  apmSla: {
    monthly: Record<string, SlaStats>;
    quarterly: Record<string, SlaStats>;
    total: SlaStats;
  };
  browserErrors: BrowserErrorStats;
}

export interface ErrorsSummary {
  teams: Record<string, TeamErrorsSummary>;
  crossTeam: {
    apmSla: {
      monthly: Record<string, SlaStats>;
      quarterly: Record<string, SlaStats>;
      total: SlaStats;
    };
    browserErrors: BrowserErrorStats;
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return parseFloat((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2));
}

function getQuarter(yearMonth: string): string {
  const [year, monthStr] = yearMonth.split("-");
  const month = parseInt(monthStr, 10);
  const q = Math.ceil(month / 3);
  return `${year}-Q${q}`;
}

function groupByMonth(records: NewRelicRecord[]): Record<string, NewRelicRecord[]> {
  const groups: Record<string, NewRelicRecord[]> = {};
  for (const r of records) {
    if (!groups[r.month]) groups[r.month] = [];
    groups[r.month].push(r);
  }
  return groups;
}

function groupByQuarter(records: NewRelicRecord[]): Record<string, NewRelicRecord[]> {
  const groups: Record<string, NewRelicRecord[]> = {};
  for (const r of records) {
    const quarter = getQuarter(r.month);
    if (!groups[quarter]) groups[quarter] = [];
    groups[quarter].push(r);
  }
  return groups;
}

function computeSlaStats(records: NewRelicRecord[]): SlaStats {
  const byApp: Record<string, NewRelicRecord[]> = {};
  for (const r of records) {
    if (!byApp[r.appName]) byApp[r.appName] = [];
    byApp[r.appName].push(r);
  }

  const appStats: SlaStats["byApp"] = {};
  const allApdex: number[] = [];
  const allResponse: number[] = [];
  const allThroughput: number[] = [];
  const satisfiedWeighted: { satisfied: number; throughput: number }[] = [];
  const errorWeighted: { error: number; throughput: number }[] = [];

  for (const [app, recs] of Object.entries(byApp)) {
    const apdexVals = recs.map((r) => r.apdex).filter((v): v is number => v !== undefined);
    const responseVals = recs.map((r) => r.responseTimeMs).filter((v): v is number => v !== undefined);
    const throughputVals = recs.map((r) => r.throughputRpm).filter((v): v is number => v !== undefined);

    const appSatWeighted: { value: number; throughput: number }[] = [];
    const appErrWeighted: { value: number; throughput: number }[] = [];
    for (const r of recs) {
      const tp = r.throughputRpm;
      if (tp !== undefined) {
        if (r.satisfiedPercent !== undefined) appSatWeighted.push({ value: r.satisfiedPercent, throughput: tp });
        appErrWeighted.push({ value: r.errorRatePercent, throughput: tp });
      }
    }

    const a = average(apdexVals);
    const rt = average(responseVals);
    const tp = average(throughputVals);

    const appTpSat = appSatWeighted.reduce((s, v) => s + v.throughput, 0);
    const sat = appTpSat > 0
      ? parseFloat((appSatWeighted.reduce((s, v) => s + v.value * v.throughput, 0) / appTpSat).toFixed(2))
      : null;

    const appTpErr = appErrWeighted.reduce((s, v) => s + v.throughput, 0);
    const e = appTpErr > 0
      ? parseFloat((appErrWeighted.reduce((s, v) => s + v.value * v.throughput, 0) / appTpErr).toFixed(2))
      : null;

    appStats[app] = { apdex: a, satisfiedPercent: sat, errorRatePercent: e, responseTimeMs: rt, throughputRpm: tp };
    if (a !== null) allApdex.push(a);
    if (sat !== null && tp !== null) satisfiedWeighted.push({ satisfied: sat, throughput: tp });
    if (e !== null && tp !== null) errorWeighted.push({ error: e, throughput: tp });
    if (rt !== null) allResponse.push(rt);
    if (tp !== null) allThroughput.push(tp);
  }

  const totalThroughputSat = satisfiedWeighted.reduce((s, v) => s + v.throughput, 0);
  const weightedSatisfied = totalThroughputSat > 0
    ? parseFloat((satisfiedWeighted.reduce((s, v) => s + v.satisfied * v.throughput, 0) / totalThroughputSat).toFixed(2))
    : null;

  const totalThroughputErr = errorWeighted.reduce((s, v) => s + v.throughput, 0);
  const weightedError = totalThroughputErr > 0
    ? parseFloat((errorWeighted.reduce((s, v) => s + v.error * v.throughput, 0) / totalThroughputErr).toFixed(2))
    : null;

  return {
    averageApdex: average(allApdex),
    averageSatisfiedPercent: weightedSatisfied,
    averageErrorRatePercent: weightedError,
    averageResponseTimeMs: average(allResponse),
    averageThroughputRpm: average(allThroughput),
    byApp: appStats,
  };
}

function computeBrowserErrors(records: NewRelicRecord[]): BrowserErrorStats {
  const byApp: Record<string, number | null> = {};
  for (const r of records) {
    byApp[r.appName] = r.errorRatePercent;
  }
  return { byApp };
}

function summarizeSla(records: NewRelicRecord[]): {
  monthly: Record<string, SlaStats>;
  quarterly: Record<string, SlaStats>;
  total: SlaStats;
} {
  const monthly: Record<string, SlaStats> = {};
  for (const [month, recs] of Object.entries(groupByMonth(records)).sort(([a], [b]) => a.localeCompare(b))) {
    monthly[month] = computeSlaStats(recs);
  }
  const quarterly: Record<string, SlaStats> = {};
  for (const [quarter, recs] of Object.entries(groupByQuarter(records)).sort(([a], [b]) => a.localeCompare(b))) {
    quarterly[quarter] = computeSlaStats(recs);
  }
  return { monthly, quarterly, total: computeSlaStats(records) };
}

export function summarizeErrors(records: NewRelicRecord[]): TeamErrorsSummary {
  const slaRecords = records.filter((r) => r.dataType === "apm-sla");
  const jsRecords = records.filter((r) => r.dataType === "javascript");

  return {
    apmSla: summarizeSla(slaRecords),
    browserErrors: computeBrowserErrors(jsRecords),
  };
}

export function summarizeAll(teamRecords: Record<string, NewRelicRecord[]>): ErrorsSummary {
  const teams: Record<string, TeamErrorsSummary> = {};
  const allRecords: NewRelicRecord[] = [];

  for (const [key, records] of Object.entries(teamRecords)) {
    teams[key] = summarizeErrors(records);
    allRecords.push(...records);
  }

  const allSla = allRecords.filter((r) => r.dataType === "apm-sla");
  const allJs = allRecords.filter((r) => r.dataType === "javascript");

  return {
    teams,
    crossTeam: {
      apmSla: summarizeSla(allSla),
      browserErrors: computeBrowserErrors(allJs),
    },
  };
}
