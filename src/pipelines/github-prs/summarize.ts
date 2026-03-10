import { PRRecord } from "./types.js";

export interface PRStats {
  prCount: number;
  averageTimeToCloseDays: number | null;
  medianTimeToCloseDays: number | null;
  prsByContributor: Record<string, number>;
}

export interface TeamPRsSummary {
  monthly: Record<string, PRStats>;
  quarterly: Record<string, PRStats>;
  total: PRStats;
}

export interface PRsSummary {
  teams: Record<string, TeamPRsSummary>;
  crossTeam: {
    monthly: Record<string, PRStats>;
    quarterly: Record<string, PRStats>;
    total: PRStats;
  };
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

function countByContributor(records: PRRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of records) {
    counts[r.author] = (counts[r.author] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([, a], [, b]) => b - a),
  );
}

function computeStats(records: PRRecord[]): PRStats {
  const closeTimes = records
    .map((r) => r.timeToCloseDays)
    .filter((t): t is number => t !== null);

  return {
    prCount: records.length,
    averageTimeToCloseDays: average(closeTimes),
    medianTimeToCloseDays: median(closeTimes),
    prsByContributor: countByContributor(records),
  };
}

function getClosedMonth(record: PRRecord): string {
  const date = record.mergedAt ?? record.closedAt ?? record.createdAt;
  return date.substring(0, 7);
}

function getQuarter(yearMonth: string): string {
  const [year, monthStr] = yearMonth.split("-");
  const month = parseInt(monthStr, 10);
  const q = Math.ceil(month / 3);
  return `${year}-Q${q}`;
}

function groupByMonth(records: PRRecord[]): Record<string, PRRecord[]> {
  const groups: Record<string, PRRecord[]> = {};
  for (const r of records) {
    const month = getClosedMonth(r);
    if (!groups[month]) groups[month] = [];
    groups[month].push(r);
  }
  return groups;
}

function groupByQuarter(records: PRRecord[]): Record<string, PRRecord[]> {
  const groups: Record<string, PRRecord[]> = {};
  for (const r of records) {
    const quarter = getQuarter(getClosedMonth(r));
    if (!groups[quarter]) groups[quarter] = [];
    groups[quarter].push(r);
  }
  return groups;
}

export function summarizePRs(records: PRRecord[]): TeamPRsSummary {
  const monthly: Record<string, PRStats> = {};
  for (const [month, recs] of Object.entries(groupByMonth(records)).sort(([a], [b]) => a.localeCompare(b))) {
    monthly[month] = computeStats(recs);
  }

  const quarterly: Record<string, PRStats> = {};
  for (const [quarter, recs] of Object.entries(groupByQuarter(records)).sort(([a], [b]) => a.localeCompare(b))) {
    quarterly[quarter] = computeStats(recs);
  }

  return {
    monthly,
    quarterly,
    total: computeStats(records),
  };
}

export function summarizeAll(teamRecords: Record<string, PRRecord[]>): PRsSummary {
  const teams: Record<string, TeamPRsSummary> = {};
  const allRecords: PRRecord[] = [];

  for (const [key, records] of Object.entries(teamRecords)) {
    teams[key] = summarizePRs(records);
    allRecords.push(...records);
  }

  const crossMonthly: Record<string, PRStats> = {};
  for (const [month, recs] of Object.entries(groupByMonth(allRecords)).sort(([a], [b]) => a.localeCompare(b))) {
    crossMonthly[month] = computeStats(recs);
  }

  const crossQuarterly: Record<string, PRStats> = {};
  for (const [quarter, recs] of Object.entries(groupByQuarter(allRecords)).sort(([a], [b]) => a.localeCompare(b))) {
    crossQuarterly[quarter] = computeStats(recs);
  }

  return {
    teams,
    crossTeam: {
      monthly: crossMonthly,
      quarterly: crossQuarterly,
      total: computeStats(allRecords),
    },
  };
}
