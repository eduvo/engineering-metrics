import { MetricRecord } from "../../types.js";

export interface CycleTimeStats {
  ticketCount: number;
  averageCycleTimeDays: number | null;
  medianCycleTimeDays: number | null;
}

export interface ProjectCycleTimeSummary {
  monthly: Record<string, CycleTimeStats>;
  quarterly: Record<string, CycleTimeStats>;
  total: CycleTimeStats;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : parseFloat(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return parseFloat((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2));
}

function computeStats(records: MetricRecord[]): CycleTimeStats {
  const times = records.map((r) => r.cycleTimeDays);
  return {
    ticketCount: records.length,
    averageCycleTimeDays: average(times),
    medianCycleTimeDays: median(times),
  };
}

function getResolvedMonth(record: MetricRecord): string {
  return (record.resolvedDate ?? record.endDate).substring(0, 7);
}

function getQuarter(yearMonth: string): string {
  const [year, monthStr] = yearMonth.split("-");
  const month = parseInt(monthStr, 10);
  const q = Math.ceil(month / 3);
  return `${year}-Q${q}`;
}

function groupByMonth(records: MetricRecord[]): Record<string, MetricRecord[]> {
  const groups: Record<string, MetricRecord[]> = {};
  for (const r of records) {
    const month = getResolvedMonth(r);
    if (!groups[month]) groups[month] = [];
    groups[month].push(r);
  }
  return groups;
}

function groupByQuarter(records: MetricRecord[]): Record<string, MetricRecord[]> {
  const groups: Record<string, MetricRecord[]> = {};
  for (const r of records) {
    const quarter = getQuarter(getResolvedMonth(r));
    if (!groups[quarter]) groups[quarter] = [];
    groups[quarter].push(r);
  }
  return groups;
}

export function summarizeCycleTime(records: MetricRecord[]): ProjectCycleTimeSummary {
  const monthly: Record<string, CycleTimeStats> = {};
  for (const [month, recs] of Object.entries(groupByMonth(records)).sort(([a], [b]) => a.localeCompare(b))) {
    monthly[month] = computeStats(recs);
  }

  const quarterly: Record<string, CycleTimeStats> = {};
  for (const [quarter, recs] of Object.entries(groupByQuarter(records)).sort(([a], [b]) => a.localeCompare(b))) {
    quarterly[quarter] = computeStats(recs);
  }

  return {
    monthly,
    quarterly,
    total: computeStats(records),
  };
}
