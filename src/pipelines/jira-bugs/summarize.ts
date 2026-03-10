import { BugRecord } from "../../types.js";

export interface SeverityStats {
  totalBugs: number;
  medianTimeToResolveDays: number | null;
}

export interface ProjectBugsSummary {
  monthly: Record<string, Record<string, SeverityStats>>;
  total: Record<string, SeverityStats>;
}

export interface BugsSummary {
  projects: Record<string, ProjectBugsSummary>;
  crossProject: {
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
    result[sev] = {
      totalBugs: recs.length,
      medianTimeToResolveDays: median(resolveTimes),
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

export function summarizeProject(records: BugRecord[]): ProjectBugsSummary {
  const monthly: Record<string, Record<string, SeverityStats>> = {};
  for (const [month, recs] of Object.entries(groupByMonth(records))) {
    monthly[month] = computeSeverityStats(recs);
  }
  return {
    monthly,
    total: computeSeverityStats(records),
  };
}

export function summarizeAll(projectRecords: Record<string, BugRecord[]>): BugsSummary {
  const projects: Record<string, ProjectBugsSummary> = {};
  const allRecords: BugRecord[] = [];

  for (const [key, records] of Object.entries(projectRecords)) {
    projects[key] = summarizeProject(records);
    allRecords.push(...records);
  }

  const crossMonthly: Record<string, Record<string, SeverityStats>> = {};
  for (const [month, recs] of Object.entries(groupByMonth(allRecords))) {
    crossMonthly[month] = computeSeverityStats(recs);
  }

  return {
    projects,
    crossProject: {
      monthly: crossMonthly,
      total: computeSeverityStats(allRecords),
    },
  };
}
