import { BugRecord } from "../../types.js";

export interface SeverityStats {
  totalBugs: number;
  medianTimeToResolveDays: number | null;
  averageTimeToResolveDays: number | null;
}

export interface TeamBugsSummary {
  weekly: Record<string, Record<string, SeverityStats>>;
  monthly: Record<string, Record<string, SeverityStats>>;
  total: Record<string, SeverityStats>;
}

export interface BugsSummary {
  teams: Record<string, TeamBugsSummary>;
  crossTeam: {
    weekly: Record<string, Record<string, SeverityStats>>;
    monthly: Record<string, Record<string, SeverityStats>>;
    total: Record<string, SeverityStats>;
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

function computeSeverityStats(records: BugRecord[]): Record<string, SeverityStats> {
  const groups = new Map<string, BugRecord[]>();
  for (const r of records) {
    const sev = r.severity ?? "Unknown";
    if (!groups.has(sev)) groups.set(sev, []);
    groups.get(sev)!.push(r);
  }

  const result: Record<string, SeverityStats> = {};
  for (const sev of [...groups.keys()].sort()) {
    const recs = groups.get(sev)!;
    const resolveTimes = recs
      .map((r) => r.timeToResolveDays)
      .filter((d): d is number => d !== null);
    const avg = resolveTimes.length > 0
      ? parseFloat((resolveTimes.reduce((a, b) => a + b, 0) / resolveTimes.length).toFixed(2))
      : null;
    result[sev] = {
      totalBugs: recs.length,
      medianTimeToResolveDays: median(resolveTimes),
      averageTimeToResolveDays: avg,
    };
  }
  return result;
}

function groupByMonth(records: BugRecord[]): Record<string, BugRecord[]> {
  const groups: Record<string, BugRecord[]> = {};
  for (const r of records) {
    const month = r.createdDate.substring(0, 7);
    if (!groups[month]) groups[month] = [];
    groups[month].push(r);
  }
  return groups;
}

function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}

function groupByWeek(records: BugRecord[]): Record<string, BugRecord[]> {
  const groups: Record<string, BugRecord[]> = {};
  for (const r of records) {
    const week = getISOWeek(r.createdDate);
    if (!groups[week]) groups[week] = [];
    groups[week].push(r);
  }
  return groups;
}

export function summarizeTeam(records: BugRecord[]): TeamBugsSummary {
  const weekly: Record<string, Record<string, SeverityStats>> = {};
  for (const [week, recs] of Object.entries(groupByWeek(records))) {
    weekly[week] = computeSeverityStats(recs);
  }
  const monthly: Record<string, Record<string, SeverityStats>> = {};
  for (const [month, recs] of Object.entries(groupByMonth(records))) {
    monthly[month] = computeSeverityStats(recs);
  }
  return {
    weekly,
    monthly,
    total: computeSeverityStats(records),
  };
}

export function summarizeAll(teamRecords: Record<string, BugRecord[]>): BugsSummary {
  const teams: Record<string, TeamBugsSummary> = {};
  const allRecords: BugRecord[] = [];

  for (const [key, records] of Object.entries(teamRecords)) {
    teams[key] = summarizeTeam(records);
    allRecords.push(...records);
  }

  const crossWeekly: Record<string, Record<string, SeverityStats>> = {};
  for (const [week, recs] of Object.entries(groupByWeek(allRecords))) {
    crossWeekly[week] = computeSeverityStats(recs);
  }

  const crossMonthly: Record<string, Record<string, SeverityStats>> = {};
  for (const [month, recs] of Object.entries(groupByMonth(allRecords))) {
    crossMonthly[month] = computeSeverityStats(recs);
  }

  return {
    teams,
    crossTeam: {
      weekly: crossWeekly,
      monthly: crossMonthly,
      total: computeSeverityStats(allRecords),
    },
  };
}
