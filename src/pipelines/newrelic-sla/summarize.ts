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
  return parseFloat((values.reduce((s, v) => s + v, 0) / values.length).toFixed(4));
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
  const allSatisfied: number[] = [];
  const allError: number[] = [];
  const allResponse: number[] = [];
  const allThroughput: number[] = [];

  for (const [app, recs] of Object.entries(byApp)) {
    const apdexVals = recs.map((r) => r.apdex).filter((v): v is number => v !== undefined);
    const satisfiedVals = recs.map((r) => r.satisfiedPercent).filter((v): v is number => v !== undefined);
    const errorVals = recs.map((r) => r.errorRatePercent);
    const responseVals = recs.map((r) => r.responseTimeMs).filter((v): v is number => v !== undefined);
    const throughputVals = recs.map((r) => r.throughputRpm).filter((v): v is number => v !== undefined);

    const a = average(apdexVals);
    const sat = average(satisfiedVals);
    const e = average(errorVals);
    const rt = average(responseVals);
    const tp = average(throughputVals);

    appStats[app] = { apdex: a, satisfiedPercent: sat, errorRatePercent: e, responseTimeMs: rt, throughputRpm: tp };
    if (a !== null) allApdex.push(a);
    if (sat !== null) allSatisfied.push(sat);
    if (e !== null) allError.push(e);
    if (rt !== null) allResponse.push(rt);
    if (tp !== null) allThroughput.push(tp);
  }

  return {
    averageApdex: average(allApdex),
    averageSatisfiedPercent: average(allSatisfied),
    averageErrorRatePercent: average(allError),
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
