import { MetricRecord } from "../../types.js";

export interface CycleTimeStats {
  ticketCount: number;
  cycleTimeTicketCount: number;
  leadTimeTicketCount: number;
  averageCycleTimeDays: number | null;
  medianCycleTimeDays: number | null;
  averageLeadTimeDays: number | null;
  medianLeadTimeDays: number | null;
}

export interface TeamCycleTimeSummary {
  weekly: Record<string, CycleTimeStats>;
  monthly: Record<string, CycleTimeStats>;
  quarterly: Record<string, CycleTimeStats>;
  total: CycleTimeStats;
}

export interface CycleTimeSummary {
  teams: Record<string, TeamCycleTimeSummary>;
  crossTeam: {
    weekly: Record<string, CycleTimeStats>;
    monthly: Record<string, CycleTimeStats>;
    quarterly: Record<string, CycleTimeStats>;
    total: CycleTimeStats;
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

function computeStats(records: MetricRecord[]): CycleTimeStats {
  const cycleTimes = records.map((r) => r.cycleTimeDays).filter((v): v is number => v !== null);
  const leadTimes = records.map((r) => r.leadTimeDays).filter((v): v is number => v !== null);
  return {
    ticketCount: records.length,
    cycleTimeTicketCount: cycleTimes.length,
    leadTimeTicketCount: leadTimes.length,
    averageCycleTimeDays: average(cycleTimes),
    medianCycleTimeDays: median(cycleTimes),
    averageLeadTimeDays: average(leadTimes),
    medianLeadTimeDays: median(leadTimes),
  };
}

function getResolvedMonth(record: MetricRecord): string {
  return (record.resolvedDate ?? record.endDate ?? record.createdDate).substring(0, 7);
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

function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}

function groupByWeek(records: MetricRecord[]): Record<string, MetricRecord[]> {
  const groups: Record<string, MetricRecord[]> = {};
  for (const r of records) {
    const week = getISOWeek(r.resolvedDate ?? r.endDate ?? r.createdDate);
    if (!groups[week]) groups[week] = [];
    groups[week].push(r);
  }
  return groups;
}

export function summarizeCycleTime(records: MetricRecord[]): TeamCycleTimeSummary {
  const weekly: Record<string, CycleTimeStats> = {};
  for (const [week, recs] of Object.entries(groupByWeek(records)).sort(([a], [b]) => a.localeCompare(b))) {
    weekly[week] = computeStats(recs);
  }

  const monthly: Record<string, CycleTimeStats> = {};
  for (const [month, recs] of Object.entries(groupByMonth(records)).sort(([a], [b]) => a.localeCompare(b))) {
    monthly[month] = computeStats(recs);
  }

  const quarterly: Record<string, CycleTimeStats> = {};
  for (const [quarter, recs] of Object.entries(groupByQuarter(records)).sort(([a], [b]) => a.localeCompare(b))) {
    quarterly[quarter] = computeStats(recs);
  }

  return {
    weekly,
    monthly,
    quarterly,
    total: computeStats(records),
  };
}

export function summarizeAll(teamRecords: Record<string, MetricRecord[]>): CycleTimeSummary {
  const teams: Record<string, TeamCycleTimeSummary> = {};
  const allRecords: MetricRecord[] = [];

  for (const [key, records] of Object.entries(teamRecords)) {
    teams[key] = summarizeCycleTime(records);
    allRecords.push(...records);
  }

  const crossWeekly: Record<string, CycleTimeStats> = {};
  for (const [week, recs] of Object.entries(groupByWeek(allRecords)).sort(([a], [b]) => a.localeCompare(b))) {
    crossWeekly[week] = computeStats(recs);
  }

  const crossMonthly: Record<string, CycleTimeStats> = {};
  for (const [month, recs] of Object.entries(groupByMonth(allRecords)).sort(([a], [b]) => a.localeCompare(b))) {
    crossMonthly[month] = computeStats(recs);
  }

  const crossQuarterly: Record<string, CycleTimeStats> = {};
  for (const [quarter, recs] of Object.entries(groupByQuarter(allRecords)).sort(([a], [b]) => a.localeCompare(b))) {
    crossQuarterly[quarter] = computeStats(recs);
  }

  return {
    teams,
    crossTeam: {
      weekly: crossWeekly,
      monthly: crossMonthly,
      quarterly: crossQuarterly,
      total: computeStats(allRecords),
    },
  };
}
